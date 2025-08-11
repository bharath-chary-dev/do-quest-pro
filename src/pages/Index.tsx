import { Helmet } from "react-helmet-async";
import ThemeToggle from "@/components/ThemeToggle";
import TodoApp from "@/features/todo/TodoApp";

const LIVE_DEMO = "https://d904fd2f-b517-4c8a-800e-839bb901b6ab.lovableproject.com";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>To-Do List App – Tasks, Priorities, Deadlines</title>
        <meta name="description" content="Beautiful, responsive To-Do app with localStorage, drag-and-drop, subtasks, filters, search, and dark mode." />
        <link rel="canonical" href={LIVE_DEMO} />
      </Helmet>

      <header className="border-b bg-gradient-subtle">
        <div className="container mx-auto py-6 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">To-Do List App – Tasks, Priorities, Deadlines</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto py-8">
        <TodoApp />
      </main>
    </div>
  );
};

export default Index;
