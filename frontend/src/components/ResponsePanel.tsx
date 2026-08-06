import { useState } from "react";
import { motion } from "framer-motion";
import type { Tab } from "../types";

const TABS = ["Body", "Headers"] as const;
type SubTab = (typeof TABS)[number];

function statusColor(status: number): string {
  if (status === 0) return "var(--color-status-4xx)";
  if (status < 300) return "var(--color-status-2xx)";
  if (status < 400) return "var(--color-status-3xx)";
  return "var(--color-status-4xx)";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function ResponsePanel({ tab }: { tab: Tab }) {
  const [sub, setSub] = useState<SubTab>("Body");

  if (tab.loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-faint text-[13px]">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          Sending request…
        </motion.div>
      </div>
    );
  }

  if (!tab.response) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-faint text-[13px]">
        Send a request to see the response here.
      </div>
    );
  }

  const { response } = tab;

  if (response.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <span className="font-mono text-[13px]" style={{ color: "var(--color-status-4xx)" }}>
          Request failed
        </span>
        <p className="text-[12px] text-text-faint max-w-sm">{response.error}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border font-mono text-[12px]">
        <span style={{ color: statusColor(response.status) }} className="font-semibold">
          {response.status} {response.statusText}
        </span>
        <span className="text-text-dim">{response.timeMs} ms</span>
        <span className="text-text-dim">{formatBytes(response.sizeBytes)}</span>
      </div>

      <div className="flex border-b border-border px-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={`px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              sub === t ? "border-accent text-text" : "border-transparent text-text-faint hover:text-text-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sub === "Body" ? (
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-all text-text-dim">
            {prettyBody(response.body) || "(empty body)"}
          </pre>
        ) : (
          <div className="flex flex-col gap-1">
            {Object.entries(response.headers).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[12.5px] font-mono">
                <span className="text-accent">{k}:</span>
                <span className="text-text-dim break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
