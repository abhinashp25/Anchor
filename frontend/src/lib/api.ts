import type { Collection, Environment, HistoryEntry, HttpMethod, KeyValue } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      // Tells the backend this request comes from our frontend, not a cross-site form.
      // Browsers can't attach custom headers cross-origin without a CORS preflight,
      // so this header acts as a lightweight CSRF token with no extra state needed.
      "x-anchor-csrf": "1",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export const api = {
  auth: {
    register: (email: string, password: string, name: string) =>
      request<{ user: AuthUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    me: () => request<{ user: AuthUser }>("/api/auth/me"),
    deleteAccount: () => request<{ ok: true }>("/api/auth/me", { method: "DELETE" }),
  },

  collections: {
    list: () => request<{ collections: Collection[] }>("/api/collections"),
    create: (name: string) =>
      request<{ collection: Collection }>("/api/collections", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    update: (id: string, patch: { name?: string; nodes?: unknown }) =>
      request<{ collection: Collection }>(`/api/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    remove: (id: string) => request<{ ok: true }>(`/api/collections/${id}`, { method: "DELETE" }),
  },

  environments: {
    list: () => request<{ environments: Environment[] }>("/api/environments"),
    create: (name: string) =>
      request<{ environment: Environment }>("/api/environments", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    update: (id: string, patch: { name?: string; variables?: KeyValue[] }) =>
      request<{ environment: Environment }>(`/api/environments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    activate: (id: string) => request<{ ok: true }>(`/api/environments/${id}/activate`, { method: "POST" }),
    remove: (id: string) => request<{ ok: true }>(`/api/environments/${id}`, { method: "DELETE" }),
  },

  history: {
    list: () => request<{ history: HistoryEntry[] }>("/api/history"),
    add: (entry: { method: HttpMethod; url: string; status?: number; timeMs?: number }) =>
      request<{ entry: HistoryEntry }>("/api/history", {
        method: "POST",
        body: JSON.stringify(entry),
      }),
    clear: () => request<{ ok: true }>("/api/history", { method: "DELETE" }),
  },

  proxy: (payload: {
    method: HttpMethod;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  }) =>
    request<{
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      timeMs: number;
      sizeBytes: number;
      error?: string;
    }>("/api/proxy", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { ApiError };
