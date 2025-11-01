/**
 * Example: Client-side code with "use client" directive
 */

"use client";

import React from "react";

export default function Button({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export function useCounter() {
  const [count, setCount] = React.useState(0);

  return {
    count,
    increment: () => setCount((c) => c + 1),
    decrement: () => setCount((c) => c - 1),
  };
}
