import type { Collection, Environment } from "../types";

// Explicit export, not continuous sync: source of truth is now the backend/database.
// This exists purely so collections can still be dropped into a git repo and diffed,
// which was the original point of a "git-native" client — cloud sync for convenience,
// an explicit file for teams who want their API collections versioned as code.
export function downloadWorkspaceSnapshot(collections: Collection[], environments: Environment[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    collections,
    environments: environments.map((e) => ({ ...e, variables: e.variables })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anchor-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
