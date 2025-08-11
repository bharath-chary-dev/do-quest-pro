import { useEffect, useMemo, useRef, useState } from "react";
import { Task, Priority } from "./types";
import { loadTasks, saveTasks } from "./storage";
import { TaskList } from "./TaskTree";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Download, Upload, Filter, SortAsc, CheckCircle2, ListTodo } from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";

function uid() { return Math.random().toString(36).slice(2, 9); }

export type StatusFilter = "all" | "active" | "completed" | "overdue";
export type SortBy = "manual" | "created" | "due" | "priority" | "title";

export default function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [prioFilter, setPrioFilter] = useState<"all" | Priority>("all");
  const [sortBy, setSortBy] = useState<SortBy>("manual");

  useEffect(() => { setTasks(loadTasks()); }, []);
  useEffect(() => { saveTasks(tasks); }, [tasks]);

  const addTask = () => {
    if (!title.trim()) return;
    const t: Task = { id: uid(), title: title.trim(), completed: false, priority, dueDate, createdAt: new Date().toISOString(), subtasks: [] };
    setTasks((prev) => [t, ...prev]);
    setTitle(""); setPriority("medium"); setDueDate(undefined);
  };

  const updateTask = (updated: Task) => {
    const recurse = (list: Task[]): Task[] => list.map((t) => t.id === updated.id ? { ...updated } : { ...t, subtasks: recurse(t.subtasks) });
    setTasks((prev) => recurse(prev));
  };

  const deleteTask = (id: string) => {
    const recurse = (list: Task[]): Task[] => list.filter((t) => t.id !== id).map((t) => ({ ...t, subtasks: recurse(t.subtasks) }));
    setTasks((prev) => recurse(prev));
  };

  const addSubtask = (parentId: string, subTitle: string, subDue?: string, subPriority: Priority = "medium") => {
    const sub: Task = { id: uid(), title: subTitle, completed: false, priority: subPriority, dueDate: subDue, createdAt: new Date().toISOString(), subtasks: [] };
    const recurse = (list: Task[]): Task[] => list.map((t) => t.id === parentId ? { ...t, subtasks: [sub, ...(t.subtasks || [])] } : { ...t, subtasks: recurse(t.subtasks) });
    setTasks((prev) => recurse(prev));
  };

  const reorder = (parentId: string | null, activeId: string, overId: string) => {
    const reorderWithin = (list: Task[]): Task[] => {
      const idxA = list.findIndex((t) => t.id === activeId);
      const idxB = list.findIndex((t) => t.id === overId);
      if (idxA === -1 || idxB === -1) return list;
      return arrayMove(list, idxA, idxB);
    };

    const recurse = (list: Task[]): Task[] => {
      if (parentId === null) return reorderWithin(list).map((t) => ({ ...t, subtasks: recurse(t.subtasks) }));
      return list.map((t) => t.id === parentId ? { ...t, subtasks: reorderWithin(t.subtasks).map((s) => ({ ...s, subtasks: recurse(s.subtasks) })) } : { ...t, subtasks: recurse(t.subtasks) });
    };
    setTasks((prev) => recurse(prev));
  };

  const clearCompleted = () => {
    const recurse = (list: Task[]): Task[] => list.filter((t) => !t.completed).map((t) => ({ ...t, subtasks: recurse(t.subtasks) }));
    setTasks((prev) => recurse(prev));
  };

  const flatOverdue = (t: Task): boolean => {
    if (t.dueDate && !t.completed) {
      const due = new Date(t.dueDate + "T23:59:59");
      if (due < new Date()) return true;
    }
    return t.subtasks?.some(flatOverdue) ?? false;
  };

  const filtered = useMemo(() => {
    const filterTree = (list: Task[]): Task[] => list
      .filter((t) => {
        const matchesQuery = t.title.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "all" ? true : status === "active" ? !t.completed : status === "completed" ? t.completed : flatOverdue(t);
        const matchesPrio = prioFilter === "all" ? true : t.priority === prioFilter;
        return matchesQuery && matchesStatus && matchesPrio;
      })
      .map((t) => ({ ...t, subtasks: filterTree(t.subtasks) }));

    const sorters: Record<SortBy, (a: Task, b: Task) => number> = {
      manual: () => 0,
      created: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      due: (a, b) => +(new Date(a.dueDate ?? "2999-12-31")) - +(new Date(b.dueDate ?? "2999-12-31")),
      priority: (a, b) => prioRank(b.priority) - prioRank(a.priority),
      title: (a, b) => a.title.localeCompare(b.title),
    };

    const sortTree = (list: Task[]): Task[] => {
      const sorted = [...list].sort(sorters[sortBy]);
      return sorted.map((t) => ({ ...t, subtasks: sortTree(t.subtasks) }));
    };

    return sortTree(filterTree(tasks));
  }, [tasks, query, status, prioFilter, sortBy]);

  const stats = useMemo(() => {
    const total = countTasks(tasks);
    const done = countTasks(tasks, true);
    return { total, done };
  }, [tasks]);

  const onExport = () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `todo-export-${new Date().toISOString()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Tasks exported as JSON." });
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json)) throw new Error("Invalid JSON format");
      setTasks(json);
      toast({ title: "Imported", description: "Tasks imported successfully." });
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message ?? "Invalid file", variant: "destructive" as any });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-gradient-subtle elevated">
        <div className="flex items-center gap-3">
          <ListTodo className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Add a Task</h2>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_160px_160px_auto] gap-2">
          <Input placeholder="What do you need to do?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} />
          <Input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value || undefined)} />
          <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addTask} className="hover-scale">Add Task</Button>
        </div>
      </Card>

      <Card className="p-4 elevated">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2"><Filter className="h-4 w-4" /><span className="text-sm">Filters</span></div>
          <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="w-[200px]" />
          <Select value={status} onValueChange={(v: StatusFilter) => setStatus(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioFilter} onValueChange={(v: any) => setPrioFilter(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> {stats.done}/{stats.total} done
            </div>
            <Button variant="secondary" onClick={clearCompleted}>Clear completed</Button>
            <Button variant="outline" onClick={onExport}><Download className="h-4 w-4 mr-2" />Export JSON</Button>
            <label className="inline-flex items-center">
              <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.currentTarget.value = ""; }} />
              <Button variant="outline" asChild>
                <span><Upload className="h-4 w-4 mr-2" />Import JSON</span>
              </Button>
            </label>
            <div className="flex items-center gap-2"><SortAsc className="h-4 w-4" />
              <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="due">Due date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <TaskList
        tasks={filtered}
        parentId={null}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onAddSubtask={addSubtask}
        onReorder={reorder}
      />
    </div>
  );
}

function prioRank(p: Priority) { return p === "high" ? 2 : p === "medium" ? 1 : 0; }

function countTasks(list: Task[], doneOnly = false): number {
  return list.reduce((acc, t) => acc + ((doneOnly ? t.completed : true) ? 1 : 0) + countTasks(t.subtasks, doneOnly), 0);
}
