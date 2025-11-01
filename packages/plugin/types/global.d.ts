/**
 * Global type definitions for TypeScript directives
 */

declare global {
  type DefaultCacheProviderOptions = "ttl" | "tags";
  type DirectiveOption<T extends string> = `${T}=${string}`;
  type DirectiveOptions<T extends string> =
    | DirectiveOption<T>
    | `${DirectiveOption<T>}; ${DirectiveOption<T>}`;

  type DirectiveWithOptions<
    D extends string,
    P extends string,
    O extends Record<P, string>,
  > = P extends P
    ?
        | (O extends { default: string }
            ? `use ${D}; ${DirectiveOptions<O["default"]>}`
            : never)
        | {
            [K in P]:
              | `use ${D}: ${K}`
              | (K extends keyof O
                  ? `use ${D}: ${K}; ${DirectiveOptions<O[K]>}`
                  : O extends { default: string }
                    ? `use ${D}: ${K}; ${DirectiveOptions<O["default"]>}`
                    : never);
          }[P]
    : never;

  interface DirectiveRegistry {
    /**
     * Enforces strict mode for the entire module.
     * @module This module is in strict mode.
     * @inline This module is in strict mode.
     */
    "use strict": never;

    /**
     * Marks functions to run on the server. Used for server functions in React Server Components.
     * @module All exported functions in this module are server functions that run exclusively on the server.
     * @inline A server function that runs exclusively on the server.
     */
    "use server": never;

    /**
     * Marks a component to run on the client. Used for client components in React Server Components.
     * @module This module contains client-side code and all exports run in the browser.
     * @inline This component renders and runs on the client-side in the browser.
     */
    "use client": never;

    /**
     * Prevents a function from being optimized by React Compiler.
     * @module All exported functions in this module are not optimized by React Compiler.
     * @inline This function is not optimized by React Compiler.
     */
    "use no memo": never;
  }

  /**
   * All available execution context directives.
   */
  type Directive =
    | {
        [K in keyof DirectiveRegistry]: K extends never
          ? K
          : DirectiveRegistry[K];
      }[keyof DirectiveRegistry]
    | keyof DirectiveRegistry;
}

export {};
