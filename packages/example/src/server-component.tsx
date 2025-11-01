/**
 * Example: React Server Component with inline server action
 *
 * This file demonstrates a server component that contains an inline
 * server action with its own "use server" directive.
 */

import Button from "./client.js";
import { MyComponent } from "./compiler";

const _a = Button({
  onClick: () => console.log("Clicked"),
  children: "Click me",
});

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export async function TodoList({ userId }: { userId: string }) {
  // Fetch initial todos (this runs on the server)
  const todos: Todo[] = await getTodosForUser(userId);

  // Inline server action with "use server" directive
  async function toggleTodo(formData: FormData) {
    "use server";

    const todoId = formData.get("todoId") as string;
    const completed = formData.get("completed") === "true";

    console.log("Toggling todo:", todoId, "to", !completed);

    // Simulate database update
    return { success: true, todoId, completed: !completed };
  }

  // Another inline server action
  async function createTodo(formData: FormData) {
    "use server";

    const title = formData.get("title") as string;

    console.log("Creating todo for user:", userId, "with title:", title);

    return {
      success: true,
      todo: {
        id: Math.random().toString(36),
        title,
        completed: false,
      },
    };
  }

  return (
    <div className="todo-list">
      <h1>Todos for User {userId}</h1>

      <form action={createTodo as any}>
        <input type="text" name="title" placeholder="New todo..." />
        <Button onClick={() => console.log("Add clicked")}>Add</Button>
      </form>

      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <form action={toggleTodo as any}>
              <input type="hidden" name="todoId" value={todo.id} />
              <input
                type="hidden"
                name="completed"
                value={String(todo.completed)}
              />
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={(e: any) => e.currentTarget.form?.requestSubmit()}
              />
              <span
                style={{
                  textDecoration: todo.completed ? "line-through" : "none",
                }}
              >
                {todo.title}
              </span>
            </form>
          </li>
        ))}
      </ul>

      <MyComponent value={42} />
    </div>
  );
}

// Helper function that runs on server
async function getTodosForUser(_userId: string): Promise<Todo[]> {
  // Simulate fetching from database
  return [
    { id: "1", title: "Learn Server Actions", completed: false },
    { id: "2", title: "Build React app", completed: true },
  ];
}
