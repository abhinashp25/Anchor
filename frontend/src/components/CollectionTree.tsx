import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Folder, Plus, FolderPlus } from "lucide-react";
import type { Collection, CollectionNode } from "../types";
import { useStore } from "../store";
import { MethodBadge } from "./MethodBadge";

const GIT_COLORS: Record<string, string> = {
  new: "var(--color-git-new)",
  modified: "var(--color-git-modified)",
  saved: "var(--color-git-saved)",
};

function GitDot({ status }: { status: string }) {
  return (
    <span
      className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
      style={{ background: GIT_COLORS[status] }}
      title={status}
    />
  );
}

function TreeNode({ node, depth }: { node: CollectionNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const openRequest = useStore((s) => s.openRequest);
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const isActive =
    node.type === "request" &&
    tabs.find((t) => t.id === activeTabId)?.requestId === node.id;

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 py-1 px-2 rounded hover:bg-surface-raised text-[13px] text-text-dim"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight size={12} />
          </motion.span>
          <Folder size={13} />
          <span className="truncate">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {node.children.map((child) => (
                <TreeNode key={child.id} node={child} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      onClick={() => openRequest(node)}
      className={`w-full flex items-center gap-2 py-1 px-2 rounded text-[13px] transition-colors ${
        isActive ? "bg-surface-raised text-text" : "text-text-dim hover:bg-surface-raised"
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <GitDot status={node.gitStatus} />
      <MethodBadge method={node.method} compact />
      <span className="truncate flex-1 text-left">{node.name}</span>
    </button>
  );
}

export function CollectionTree({ collection }: { collection: Collection }) {
  const addRequestToCollection = useStore((s) => s.addRequestToCollection);
  const addFolder = useStore((s) => s.addFolder);

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1.5 group">
        <span className="text-[11px] uppercase tracking-wider text-text-faint font-semibold">
          {collection.name}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => addFolder(collection.id, "New Folder")}
            className="text-text-faint hover:text-text p-0.5"
            title="New folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={() => addRequestToCollection(collection.id)}
            className="text-text-faint hover:text-text p-0.5"
            title="New request"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
      {collection.nodes.length === 0 ? (
        <p className="px-3 py-2 text-[12px] text-text-faint italic">
          Empty. Add a request to get started.
        </p>
      ) : (
        collection.nodes.map((node) => <TreeNode key={node.id} node={node} depth={0} />)
      )}
    </div>
  );
}
