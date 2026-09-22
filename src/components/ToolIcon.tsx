import type { ReactNode } from "react";
export default function ToolIcon({ children }: { children: ReactNode }) {
  return (
    <span className="tool-icon" aria-hidden="true">
      {children}
    </span>
  );
}
