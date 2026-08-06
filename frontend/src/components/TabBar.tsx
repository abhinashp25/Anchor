import { motion, AnimatePresence } from "framer-motion";
import { X, Circle } from "lucide-react";
import { useStore } from "../store";
import { MethodBadge } from "./MethodBadge";

export function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);

  if (!tabs.length) return null;

  return (
    <div className="flex items-stretch h-10 border-b border-border bg-surface overflow-x-auto">
      <AnimatePresence initial={false}>
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <motion.div
              key={tab.id}
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 160 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-1.5 px-3 border-r border-border cursor-pointer shrink-0 ${
                active ? "bg-bg text-text" : "text-text-dim hover:bg-surface-raised"
              }`}
            >
              <MethodBadge method={tab.request.method} compact />
              <span className="truncate text-[12px] flex-1">{tab.request.name}</span>
              {tab.dirty && (
                <Circle size={7} className="fill-current text-accent shrink-0 group-hover:hidden" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`text-text-faint hover:text-text shrink-0 ${
                  tab.dirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
