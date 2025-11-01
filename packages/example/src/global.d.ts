/**
 * Example: Extending the plugin with custom directives
 *
 * This file shows how a third-party library could extend
 * the directive system with custom directives.
 */

// Extend the DirectiveRegistry with custom directives
declare global {
  interface DirectiveRegistry {
    "use experimental": never;
  }
}

export {};
