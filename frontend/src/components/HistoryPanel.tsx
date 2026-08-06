import { useStore } from "../store";
import { MethodBadge } from "./MethodBadge";

export function HistoryPanel() {
  const history = useStore((s) => s.history);

  if (!history.length) {
    return <p className="px-3 py-2 text-[12px] text-text-faint italic">No requests sent yet.</p>;
  }

  return (
    <div className="flex flex-col">
      {history.map((h) => (
        <div
          key={h.id}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-surface-raised"
        >
          <MethodBadge method={h.method} compact />
          <span className="truncate flex-1 text-text-dim font-mono">{h.url || "(empty url)"}</span>
          {h.status !== undefined && (
            <span
              className="font-mono"
              style={{
                color:
                  h.status >= 200 && h.status < 300
                    ? "var(--color-status-2xx)"
                    : h.status >= 400
                    ? "var(--color-status-4xx)"
                    : "var(--color-status-3xx)",
              }}
            >
              {h.status || "ERR"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
