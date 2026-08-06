import { useState } from "react";
import type { BodyMode, Tab } from "../types";
import { useStore } from "../store";
import { KeyValueEditor } from "./KeyValueEditor";
import { id } from "../lib/id";

const TABS = ["Params", "Headers", "Body"] as const;
type SubTab = (typeof TABS)[number];

const BODY_MODES: { value: BodyMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "json", label: "JSON" },
  { value: "form", label: "Form" },
  { value: "raw", label: "Raw" },
];

export function RequestPanel({ tab }: { tab: Tab }) {
  const [sub, setSub] = useState<SubTab>("Params");
  const updateTabRequest = useStore((s) => s.updateTabRequest);

  const enabledHeaderCount = tab.request.headers.filter((h) => h.enabled && h.key).length;
  const enabledParamCount = tab.request.params.filter((p) => p.enabled && p.key).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border px-2">
        {TABS.map((t) => {
          const count =
            t === "Headers" ? enabledHeaderCount : t === "Params" ? enabledParamCount : 0;
          return (
            <button
              key={t}
              onClick={() => setSub(t)}
              className={`px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
                sub === t ? "border-accent text-text" : "border-transparent text-text-faint hover:text-text-dim"
              }`}
            >
              {t}
              {count > 0 && <span className="ml-1 text-text-faint">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sub === "Params" && (
          <KeyValueEditor
            rows={tab.request.params}
            onChange={(rows) => updateTabRequest(tab.id, (r) => (r.params = rows))}
          />
        )}
        {sub === "Headers" && (
          <KeyValueEditor
            rows={tab.request.headers}
            onChange={(rows) => updateTabRequest(tab.id, (r) => (r.headers = rows))}
          />
        )}
        {sub === "Body" && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex gap-1">
              {BODY_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() =>
                    updateTabRequest(tab.id, (r) => {
                      r.body = { mode: m.value };
                      if (m.value === "form") r.body.form = [{ id: id(), key: "", value: "", enabled: true }];
                    })
                  }
                  className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                    tab.request.body.mode === m.value
                      ? "bg-accent text-bg"
                      : "bg-surface-raised text-text-dim hover:text-text"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {tab.request.body.mode === "json" && (
              <textarea
                value={tab.request.body.json ?? ""}
                onChange={(e) =>
                  updateTabRequest(tab.id, (r) => (r.body = { ...r.body, json: e.target.value }))
                }
                placeholder={'{\n  "key": "value"\n}'}
                spellCheck={false}
                className="flex-1 bg-surface-raised rounded-md p-3 font-mono text-[13px] outline-none resize-none placeholder:text-text-faint focus:ring-1 focus:ring-accent min-h-[200px]"
              />
            )}
            {tab.request.body.mode === "raw" && (
              <textarea
                value={tab.request.body.raw ?? ""}
                onChange={(e) =>
                  updateTabRequest(tab.id, (r) => (r.body = { ...r.body, raw: e.target.value }))
                }
                spellCheck={false}
                className="flex-1 bg-surface-raised rounded-md p-3 font-mono text-[13px] outline-none resize-none min-h-[200px]"
              />
            )}
            {tab.request.body.mode === "form" && (
              <KeyValueEditor
                rows={tab.request.body.form ?? []}
                onChange={(rows) =>
                  updateTabRequest(tab.id, (r) => (r.body = { ...r.body, form: rows }))
                }
              />
            )}
            {tab.request.body.mode === "none" && (
              <p className="text-[12px] text-text-faint italic">This request has no body.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
