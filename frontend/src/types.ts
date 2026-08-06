export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type BodyMode = "none" | "json" | "form" | "raw";

export interface RequestBody {
  mode: BodyMode;
  json?: string;
  form?: KeyValue[];
  raw?: string;
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  gitStatus: "saved" | "modified" | "new";
}

export interface CollectionFolder {
  id: string;
  name: string;
  type: "folder";
  children: CollectionNode[];
}

export type CollectionNode =
  | (ApiRequest & { type: "request" })
  | CollectionFolder;

export interface Collection {
  id: string;
  name: string;
  nodes: CollectionNode[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValue[];
  isActive?: boolean;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  sizeBytes: number;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  status?: number;
  timeMs?: number;
}

export interface Tab {
  id: string;
  requestId: string;
  request: ApiRequest;
  response: ResponseData | null;
  loading: boolean;
  dirty: boolean;
}
