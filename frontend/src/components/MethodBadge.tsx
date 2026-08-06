import type { HttpMethod } from "../types";

const COLORS: Record<HttpMethod, string> = {
  GET: "var(--color-method-get)",
  POST: "var(--color-method-post)",
  PUT: "var(--color-method-put)",
  PATCH: "var(--color-method-patch)",
  DELETE: "var(--color-method-delete)",
  HEAD: "var(--color-text-dim)",
  OPTIONS: "var(--color-text-dim)",
};

export function MethodBadge({ method, compact }: { method: HttpMethod; compact?: boolean }) {
  return (
    <span
      className="font-mono font-semibold tracking-tight"
      style={{
        color: COLORS[method],
        fontSize: compact ? "10px" : "12px",
        width: compact ? "34px" : "auto",
        display: "inline-block",
      }}
    >
      {compact ? method.slice(0, 4) : method}
    </span>
  );
}

export const METHOD_COLORS = COLORS;
