import { Anchor, Download, LogOut, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { CollectionTree } from "./CollectionTree";
import { HistoryPanel } from "./HistoryPanel";
import { downloadWorkspaceSnapshot } from "../lib/exportSnapshot";
import { useState } from "react";

export function Sidebar() {
  const collections = useStore((s) => s.collections);
  const environments = useStore((s) => s.environments);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const [tab, setTab] = useState<"collections" | "history">("collections");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (confirmInput.trim().toUpperCase() !== "DELETE") return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setShowDeleteModal(false);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-surface h-full">
      <div className="flex items-center gap-2 px-3 h-12 border-b border-border">
        <Anchor size={16} className="text-accent" strokeWidth={2.5} />
        <span className="font-display font-semibold text-[14px] tracking-tight">Anchor</span>
      </div>

      <div className="flex border-b border-border">
        {(["collections", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] uppercase tracking-wider font-semibold transition-colors ${
              tab === t ? "text-accent border-b-2 border-accent" : "text-text-faint hover:text-text-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tab === "collections" ? (
          collections.map((c) => <CollectionTree key={c.id} collection={c} />)
        ) : (
          <HistoryPanel />
        )}
      </div>

      <button
        onClick={() => downloadWorkspaceSnapshot(collections, environments)}
        className="flex items-center gap-2 px-3 py-2 border-t border-border text-[12px] text-text-dim hover:bg-surface-raised transition-colors"
      >
        <Download size={13} />
        <span>Export snapshot (.json)</span>
      </button>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <span className="text-[12px] text-text-faint truncate" title={user?.email}>{user?.email}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setConfirmInput("");
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="text-text-faint hover:text-status-5xx p-1 transition-colors"
            title="Delete Account"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={logout}
            className="text-text-faint hover:text-status-4xx p-1 transition-colors"
            title="Log out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-5 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-base font-semibold text-text">Delete Account</h2>
            <p className="text-[13px] text-text-muted">
              This action is <strong className="text-status-5xx">permanent</strong>. All your collections, environments, and history will be deleted.
            </p>
            <p className="text-[12px] text-text-faint">
              Type <span className="font-mono font-bold text-text">DELETE</span> below to confirm:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text focus:outline-none focus:border-status-5xx"
              autoFocus
            />
            {deleteError && (
              <p className="text-[12px] text-status-5xx">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text rounded border border-border hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmInput.trim().toUpperCase() !== "DELETE" || isDeleting}
                className="px-3 py-1.5 text-xs font-medium text-white bg-status-5xx hover:opacity-90 disabled:opacity-40 rounded transition-opacity"
              >
                {isDeleting ? "Deleting…" : "Permanently Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
