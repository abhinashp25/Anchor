import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, ChevronDown, Plus } from "lucide-react";
import { useStore } from "../store";

export function EnvironmentSwitcher() {
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useStore((s) => s.setActiveEnvironment);
  const addEnvironment = useStore((s) => s.addEnvironment);
  const [open, setOpen] = useState(false);

  const active = environments.find((e) => e.id === activeEnvironmentId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-raised text-[12px] text-text-dim hover:text-text"
      >
        <Globe size={13} />
        {active?.name ?? "No Environment"}
        <ChevronDown size={12} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute top-full right-0 mt-1 bg-surface-raised border border-border rounded-md shadow-lg z-10 py-1 min-w-[180px]"
        >
          {environments.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setActiveEnvironment(e.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg ${
                e.id === activeEnvironmentId ? "text-accent" : "text-text-dim"
              }`}
            >
              {e.name}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => {
                const name = prompt("Environment name");
                if (name) addEnvironment(name);
                setOpen(false);
              }}
              className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-[12px] text-text-faint hover:text-text"
            >
              <Plus size={12} /> New environment
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
