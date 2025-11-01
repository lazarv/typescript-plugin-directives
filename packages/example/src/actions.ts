/**
 * Example: Module-level Server Actions with "use server" directive
 *
 * This entire module is marked as server-only with a top-level directive.
 * All exported functions in this file are automatically server actions.
 */

"use server";

export async function addTodo(formData: FormData) {
  const title = formData.get("title") as string;

  // Simulate database operation
  console.log("Adding todo:", title);

  return { success: true, id: Math.random().toString(36) };
}

export async function deleteTodo(id: string) {
  console.log("Deleting todo:", id);

  return { success: true };
}

export async function updateTodo(
  id: string,
  data: { title?: string; completed?: boolean }
) {
  console.log("Updating todo:", id, data);

  return { success: true };
}

// Arrow function - also a server action due to module-level directive
export const getTodos = async () => {
  return [
    { id: "1", title: "Learn TypeScript", completed: false },
    { id: "2", title: "Build a plugin", completed: true },
  ];
};
