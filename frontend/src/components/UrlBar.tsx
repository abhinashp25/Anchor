import { motion } from "framer-motion";
import { Send, Save, Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { HttpMethod, Tab } from "../types";
import { useStore } from "../store";
import { METHOD_COLORS } from "./MethodBadge";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function UrlBar({ tab }: { tab: Tab }) {
  const updateTabRequest = useStore((s) => s.updateTabRequest);
  const runRequest = useStore((s) => s.runRequest);
  const saveTab = useStore((s) => s.saveTab);
  const [methodOpen, setMethodOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      <div className="relative">
        <button
          onClick={() => setMethodOpen((o) => !o)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface-raised font-mono font-semibold text-[12px] min-w-[86px] justify-between"
          style={{ color: METHOD_COLORS[tab.request.method] }}
        >
          {tab.request.method}
          <ChevronDown size={12} />
        </button>
        {methodOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1 left-0 bg-surface-raised border border-border rounded-md shadow-lg z-10 py-1 min-w-[86px]"
          >
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  updateTabRequest(tab.id, (r) => (r.method = m));
                  setMethodOpen(false);
                }}
                className="w-full text-left px-2.5 py-1 font-mono text-[12px] font-semibold hover:bg-bg"
                style={{ color: METHOD_COLORS[m] }}
              >
                {m}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <input
        value={tab.request.url}
        onChange={(e) => updateTabRequest(tab.id, (r) => (r.url = e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") runRequest(tab.id);
        }}
        placeholder="https://api.example.com/v1/resource or {{baseUrl}}/resource"
        className="flex-1 bg-surface-raised rounded-md px-3 py-1.5 font-mono text-[13px] outline-none placeholder:text-text-faint focus:ring-1 focus:ring-accent"
      />

      <button
        onClick={() => runRequest(tab.id)}
        disabled={tab.loading}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-accent text-bg font-semibold text-[13px] hover:bg-accent-dim transition-colors disabled:opacity-60"
      >
        {tab.loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
        Send
      </button>

      <button
        onClick={() => saveTab(tab.id)}
        disabled={!tab.dirty}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[13px] text-text-dim hover:text-text hover:bg-surface-raised transition-colors disabled:opacity-40"
      >
        <Save size={13} />
        Save
      </button>
    </div>
  );
}
