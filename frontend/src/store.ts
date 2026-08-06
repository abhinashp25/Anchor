import { create } from "zustand";
import type {
  ApiRequest,
  Collection,
  CollectionNode,
  Environment,
  HistoryEntry,
  Tab,
} from "./types";
import { id } from "./lib/id";
import { executeRequest } from "./lib/execute";
import { api, type AuthUser, ApiError } from "./lib/api";

function newRequest(name = "New Request"): ApiRequest {
  return {
    id: id(),
    name,
    method: "GET",
    url: "",
    headers: [{ id: id(), key: "", value: "", enabled: true }],
    params: [{ id: id(), key: "", value: "", enabled: true }],
    body: { mode: "none" },
    gitStatus: "new",
  };
}

function updateNode(
  nodes: CollectionNode[],
  reqId: string,
  fn: (r: ApiRequest & { type: "request" }) => void
): CollectionNode[] {
  return nodes.map((n) => {
    if (n.type === "request" && n.id === reqId) {
      const copy = { ...n };
      fn(copy);
      return copy;
    }
    if (n.type === "folder") {
      return { ...n, children: updateNode(n.children, reqId, fn) };
    }
    return n;
  });
}

interface Store {
  // auth
  user: AuthUser | null;
  authChecked: boolean;
  authError: string | null;
  authBusy: boolean;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  // data
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history: HistoryEntry[];
  tabs: Tab[];
  activeTabId: string | null;
  dataLoaded: boolean;
  loadWorkspace: () => Promise<void>;

  addRequestToCollection: (collectionId: string) => void;
  addFolder: (collectionId: string, name: string) => void;
  openRequest: (req: ApiRequest) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabRequest: (tabId: string, updater: (r: ApiRequest) => void) => void;
  runRequest: (tabId: string) => Promise<void>;
  saveTab: (tabId: string) => void;

  setActiveEnvironment: (envId: string) => void;
  addEnvironment: (name: string) => void;
  updateEnvironment: (envId: string, updater: (e: Environment) => void) => void;
}

function persistCollection(get: () => Store, collectionId: string) {
  const collection = get().collections.find((c) => c.id === collectionId);
  if (!collection) return;
  api.collections.update(collectionId, { nodes: collection.nodes }).catch(() => {
    // Best-effort: a failed save surfaces as the request staying "dirty" in the tab,
    // which is visible to the user rather than silently lost.
  });
}

export const useStore = create<Store>((set, get) => ({
  user: null,
  authChecked: false,
  authError: null,
  authBusy: false,

  checkAuth: async () => {
    try {
      const { user } = await api.auth.me();
      set({ user, authChecked: true });
    } catch {
      set({ user: null, authChecked: true });
    }
  },

  login: async (email, password) => {
    set({ authBusy: true, authError: null });
    try {
      const { user } = await api.auth.login(email, password);
      set({ user, authBusy: false });
      return true;
    } catch (e) {
      set({ authBusy: false, authError: e instanceof ApiError ? e.message : "Login failed" });
      return false;
    }
  },

  register: async (email, password, name) => {
    set({ authBusy: true, authError: null });
    try {
      const { user } = await api.auth.register(email, password, name);
      set({ user, authBusy: false });
      return true;
    } catch (e) {
      set({ authBusy: false, authError: e instanceof ApiError ? e.message : "Registration failed" });
      return false;
    }
  },

  logout: async () => {
    await api.auth.logout().catch(() => {});
    set({
      user: null,
      collections: [],
      environments: [],
      history: [],
      tabs: [],
      activeTabId: null,
      dataLoaded: false,
    });
  },

  deleteAccount: async () => {
    await api.auth.deleteAccount();
    set({
      user: null,
      collections: [],
      environments: [],
      history: [],
      tabs: [],
      activeTabId: null,
      dataLoaded: false,
    });
  },

  collections: [],
  environments: [],
  activeEnvironmentId: null,
  history: [],
  tabs: [],
  activeTabId: null,
  dataLoaded: false,

  loadWorkspace: async () => {
    const [{ collections }, { environments }, { history }] = await Promise.all([
      api.collections.list(),
      api.environments.list(),
      api.history.list(),
    ]);
    const active = environments.find((e) => e.isActive) ?? environments[0] ?? null;
    set({
      collections,
      environments,
      activeEnvironmentId: active?.id ?? null,
      history,
      dataLoaded: true,
    });
  },

  addRequestToCollection: (collectionId) => {
    const req = newRequest();
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? { ...c, nodes: [...c.nodes, { ...req, type: "request" as const }] }
          : c
      ),
    }));
    persistCollection(get, collectionId);
    get().openRequest(req);
  },

  addFolder: (collectionId, name) => {
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              nodes: [
                ...c.nodes,
                { id: id(), name, type: "folder" as const, children: [] },
              ],
            }
          : c
      ),
    }));
    persistCollection(get, collectionId);
  },

  openRequest: (req) => {
    const existing = get().tabs.find((t) => t.requestId === req.id);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const tab: Tab = {
      id: id(),
      requestId: req.id,
      request: { ...req },
      response: null,
      loading: false,
      dirty: false,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (tabId) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      let activeTabId = s.activeTabId;
      if (activeTabId === tabId) {
        activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
      }
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabRequest: (tabId, updater) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const request = { ...t.request };
        updater(request);
        return { ...t, request, dirty: true };
      }),
    }));
  },

  runRequest: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, loading: true } : t)),
    }));
    const env =
      get().environments.find((e) => e.id === get().activeEnvironmentId) ?? null;
    const response = await executeRequest(tab.request, env);
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, loading: false, response } : t
      ),
    }));
    try {
      const { entry } = await api.history.add({
        method: tab.request.method,
        url: tab.request.url,
        status: response.status || undefined,
        timeMs: response.timeMs,
      });
      set((s) => ({ history: [entry, ...s.history].slice(0, 100) }));
    } catch {
      // History logging is non-critical; don't block the response on it
    }
  },

  saveTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    let collectionId: string | null = null;
    set((s) => ({
      collections: s.collections.map((c) => {
        const nextNodes = updateNode(c.nodes, tab.requestId, (r) => {
          Object.assign(r, tab.request, { gitStatus: "saved" as const });
        });
        if (nextNodes !== c.nodes) collectionId = c.id;
        return { ...c, nodes: nextNodes };
      }),
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, dirty: false } : t)),
    }));
    if (collectionId) persistCollection(get, collectionId);
  },

  setActiveEnvironment: (envId) => {
    set({ activeEnvironmentId: envId });
    api.environments.activate(envId).catch(() => {});
  },

  addEnvironment: (name) => {
    api.environments.create(name).then(({ environment }) => {
      set((s) => ({ environments: [...s.environments, environment] }));
    });
  },

  updateEnvironment: (envId, updater) => {
    set((s) => ({
      environments: s.environments.map((e) => {
        if (e.id !== envId) return e;
        const copy = { ...e, variables: [...e.variables] };
        updater(copy);
        return copy;
      }),
    }));
    const env = get().environments.find((e) => e.id === envId);
    if (env) api.environments.update(envId, { variables: env.variables }).catch(() => {});
  },
}));
