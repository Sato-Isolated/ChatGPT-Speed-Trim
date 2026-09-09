export interface ExtSettingsV1 {
  enabled: boolean;
  messageLimit: number;
  debug: boolean;
  disableNotifications: boolean;
}

export interface RuntimeTrimState {
  conversationId: string | null;
  baselineTurnCount: number | null;
  turnsSinceRefresh: number;
  lastTotal: number;
  lastRendered: number;
  lastExtra: number;
}

export interface TrimStats {
  conversationId: string | null;
  visibleTotal: number;
  visibleKept: number;
  absoluteMessageCount: number;
  hasOlderMessages: boolean;
  extraMessages: number;
  timestamp: number;
}

export type PageRuntimeState = "waiting" | "active" | "unsupported" | "error" | "disabled";

export interface PageRuntimeStatus {
  hookReady: boolean;
  state: PageRuntimeState;
  stats: TrimStats | null;
  timestamp: number;
}

export interface PageStatusEvent {
  state: Exclude<PageRuntimeState, "active">;
  timestamp: number;
}

export interface BgResponse<T> {
  ok: boolean;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
}
