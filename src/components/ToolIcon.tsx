import type { ReactNode } from "react";
import type { ToolId } from "../catalog";

const glyphs: Record<ToolId | "all", ReactNode> = {
  all: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  "code-image": (
    <>
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16" />
    </>
  ),
  json: (
    <>
      <path d="M9 3H7a2 2 0 0 0-2 2v4a3 3 0 0 1-2 3 3 3 0 0 1 2 3v4a2 2 0 0 0 2 2h2m6-18h2a2 2 0 0 1 2 2v4a3 3 0 0 0 2 3 3 3 0 0 0-2 3v4a2 2 0 0 1-2 2h-2" />
    </>
  ),
  timestamp: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  jwt: (
    <>
      <path d="m12 2 8 4.5v11L12 22l-8-4.5v-11L12 2Z" />
      <path d="m9.5 12 2 2 3.5-4" />
    </>
  ),
  sql: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  diff: (
    <>
      <path d="M8 4v16m8-16v16M4 8h8m-8 8h8m1-8h7m-7 8h7" />
    </>
  ),
  codec: (
    <>
      <path d="m7 7-4 5 4 5m10-10 4 5-4 5M10 4l4 16" />
    </>
  ),
  "json-type": (
    <>
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5M10 4h4M10 20h4" />
    </>
  ),
  text: (
    <>
      <path d="M4 6h16M4 11h12M4 16h16M4 21h9" />
    </>
  ),
  cron: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5M12 8v4l3 2" />
    </>
  ),
};

export default function ToolIcon({
  id,
  compact = false,
}: {
  id: ToolId | "all";
  compact?: boolean;
}) {
  return (
    <span className={compact ? "side-icon" : "tool-icon"} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyphs[id]}
      </svg>
    </span>
  );
}
