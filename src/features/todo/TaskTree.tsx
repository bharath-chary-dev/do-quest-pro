import { useMemo, useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Priority } from "./types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GripVertical, Plus, Trash2 } from "lucide-react";

interface TaskListProps {
  tasks: Task[];
  parentId: string | null;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onAddSubtask: (parentId: string, title: string, dueDate?: string, priority?: Priority) => void;
  onReorder: (parentId: string | null, activeId: string, overId: string) => void;
}

export function TaskList(props: TaskListProps) {
  const { tasks, parentId, onReorder } = props;
  const ids = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(parentId, String(active.id), String(over.id));
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 animate-fade-in">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} {...props} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function TaskRow({ task, parentId, onUpdateTask, onDeleteTask, onAddSubtask, onReorder }: TaskListProps & { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showSubForm, setShowSubForm] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [subDue, setSubDue] = useState<string | undefined>(undefined);
  const [subPriority, setSubPriority] = useState<Priority>("medium");

  const isOverdue = useMemo(() => {
    if (!task.dueDate || task.completed) return false;
    const today = new Date();
    const due = new Date(task.dueDate + "T23:59:59");
    return due < today;
  }, [task.dueDate, task.completed]);

  const saveTitle = () => {
    if (!title.trim()) return setTitle(task.title);
    if (title !== task.title) onUpdateTask({ ...task, title });
    setEditing(false);
  };

  return (
    <Card ref={setNodeRef} style={style} className={`p-3 elevated ${isOverdue ? "border-destructive" : ""}`}>
      <div className="flex items-center gap-3">
        <button className="p-1 text-muted-foreground hover:text-foreground" aria-label="Drag handle" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <Checkbox checked={task.completed} onCheckedChange={(checked) => onUpdateTask({ ...task, completed: Boolean(checked) })} aria-label="Toggle complete" />

        {editing ? (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()} className="max-w-sm" />
        ) : (
          <button className="text-left flex-1 story-link" onClick={() => setEditing(true)}>
            <span className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2">
          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
          {!isOverdue && task.dueDate && <Badge variant="secondary">Due {task.dueDate}</Badge>}
          <PriorityBadge priority={task.priority} />
        </div>

        <Select value={task.priority} onValueChange={(v: Priority) => onUpdateTask({ ...task, priority: v })}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" value={task.dueDate ?? ""} onChange={(e) => onUpdateTask({ ...task, dueDate: e.target.value || undefined })} className="w-[150px]" aria-label="Due date" />

        <Button variant="ghost" size="icon" onClick={() => setShowSubForm((s) => !s)} aria-label="Add subtask">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={() => onDeleteTask(task.id)} aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="sm:hidden mt-2 flex items-center gap-2">
        {isOverdue && <Badge variant="destructive">Overdue</Badge>}
        {!isOverdue && task.dueDate && <Badge variant="secondary">Due {task.dueDate}</Badge>}
        <PriorityBadge priority={task.priority} />
      </div>

      {showSubForm && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2 animate-fade-in">
          <Input placeholder="Subtask title" value={subTitle} onChange={(e) => setSubTitle(e.target.value)} className="flex-1" />
          <Input type="date" value={subDue ?? ""} onChange={(e) => setSubDue(e.target.value || undefined)} className="sm:w-[160px]" />
          <Select value={subPriority} onValueChange={(v: Priority) => setSubPriority(v)}>
            <SelectTrigger className="sm:w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => {
            if (!subTitle.trim()) return;
            onAddSubtask(task.id, subTitle.trim(), subDue, subPriority);
            setSubTitle(""); setSubDue(undefined); setSubPriority("medium"); setShowSubForm(false);
          }}>Add</Button>
        </div>
      )}

      {task.subtasks?.length ? (
        <div className="mt-3 pl-6 border-l">
          <TaskList
            tasks={task.subtasks}
            parentId={task.id}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onAddSubtask={onAddSubtask}
            onReorder={onReorder}
          />
        </div>
      ) : null}
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  const variant = priority === "high" ? "destructive" : priority === "medium" ? "default" : "secondary";
  return <Badge variant={variant as any}>{label}</Badge>;
}
