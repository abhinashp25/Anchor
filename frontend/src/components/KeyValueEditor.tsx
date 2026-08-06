import { X } from "lucide-react";
import type { KeyValue } from "../types";
import { id } from "../lib/id";

export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  function update(idx: number, patch: Partial<KeyValue>) {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    if (idx === rows.length - 1 && (patch.key || patch.value)) {
      next.push({ id: id(), key: "", value: "", enabled: true });
    }
    onChange(next);
  }

  function remove(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col">
      {rows.map((row, idx) => (
        <div
          key={row.id}
          className="group flex items-center gap-2 py-1 border-b border-border-subtle last:border-0"
        >
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(idx, { enabled: e.target.checked })}
            className="accent-accent"
          />
          <input
            value={row.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className="flex-1 bg-transparent font-mono text-[13px] px-2 py-1 rounded outline-none placeholder:text-text-faint focus:bg-surface-raised"
          />
          <input
            value={row.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className="flex-1 bg-transparent font-mono text-[13px] px-2 py-1 rounded outline-none placeholder:text-text-faint focus:bg-surface-raised"
          />
          <button
            onClick={() => remove(idx)}
            className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-status-4xx transition-opacity"
            aria-label="Remove row"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
