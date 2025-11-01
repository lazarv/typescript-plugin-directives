/**
 * Example: Importing and using directive-marked functions
 */

import { addTodo, deleteTodo, getTodos } from "./actions";
import { customFeature } from "./experimental";

// When you hover over these imported functions, you should see
// their directive annotations in the tooltip

async function main() {
  customFeature();

  // These imports should show [use server] hints
  const todos = await getTodos();
  console.log("Todos:", todos);

  const formData = new FormData();
  formData.set("title", "New Todo");
  await addTodo(formData);

  await deleteTodo("1");
}

main().catch(console.error);
