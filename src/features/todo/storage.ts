import { Task } from "./types";

const STORAGE_KEY = "todo-app-v1";

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    // Basic shape safety
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => ({
      id: String(t.id),
      title: String(t.title ?? ""),
      completed: Boolean(t.completed),
      priority: (t as any).priority ?? "medium",
      dueDate: t.dueDate,
      createdAt: t.createdAt ?? new Date().toISOString(),
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    }));
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
