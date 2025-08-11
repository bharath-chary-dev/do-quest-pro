export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string; // yyyy-mm-dd
  createdAt: string; // ISO
  subtasks: Task[];
}
