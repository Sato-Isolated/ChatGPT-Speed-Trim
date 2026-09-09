import { MESSAGE_TYPES } from "../shared/constants";
import type { ExtSettingsV1, PageStatusEvent, TrimStats } from "../shared/schema";
import { getExtraMessages, readRuntimeState, setExtraMessages, writeRuntimeState } from "./runtimeState";
import { trimConversation } from "./trim/trimConversation";
import type { ConversationPayload as TrimConversationPayload, MappingNode } from "./trim/trimConversation";

type RawConversationPayload = {
  conversation_id?: string;
  current_node?: string | null;
  mapping?: Record<string, unknown>;
};

type ConversationMatch = {
  payload: TrimConversationPayload;
  apply: (next: TrimConversationPayload) => Record<string, unknown>;
};

const ALLOWED_HOSTS = ["chatgpt.com", "chat.openai.com"];
const BACKEND_PREFIX = "/backend-api/";
const CONVERSATION_PATH_PATTERN = /\/conversation\/[^/]+\/?$/;
let activeSettings: ExtSettingsV1 | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const isMappingNode = (value: unknown): value is MappingNode => {
  if (!isRecord(value)) {
    return false;
  }

  const parentValid = value.parent === null || typeof value.parent === "string";
  const childrenValid = Array.isArray(value.children) && value.children.every((child) => typeof child === "string");

  if (!parentValid || !childrenValid) {
    return false;
  }

  if (value.message === null || typeof value.message === "undefined") {
    return true;
  }

  if (!isRecord(value.message)) {
    return false;
  }

  if (typeof value.message.author !== "undefined" && !isRecord(value.message.author)) {
    return false;
  }

  if (typeof value.message.content !== "undefined") {
    if (!isRecord(value.message.content)) {
      return false;
    }
    if (typeof value.message.content.parts !== "undefined" && !Array.isArray(value.message.content.parts)) {
      return false;
    }
  }

  return true;
};

const hasValidMapping = (value: unknown): value is Record<string, MappingNode> => {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((node) => isMappingNode(node));
};

const debugLog = (settings: ExtSettingsV1, message: string, meta?: unknown): void => {
  if (!settings.debug) {
    return;
  }
  if (typeof meta === "undefined") {
    console.debug("[CGPT Optimizer]", message);
    return;
  }
  console.debug("[CGPT Optimizer]", message, meta);
};

const resolveBaseOrigin = (): string => {
  if (typeof globalThis.location?.origin === "string" && globalThis.location.origin.length > 0) {
    return globalThis.location.origin;
  }
  return "https://chatgpt.com";
};

const readRequestUrl = (request: RequestInfo | URL): URL | null => {
  try {
    if (typeof request === "string") {
      try {
        return new URL(request);
      } catch {
        return new URL(request, resolveBaseOrigin());
      }
    }
    if (request instanceof URL) {
      return request;
    }
    try {
      return new URL(request.url);
    } catch {
      return new URL(request.url, resolveBaseOrigin());
    }
  } catch {
    return null;
  }
};

const isAllowedHost = (hostname: string): boolean => (
  ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
);

const isTrimCandidate = (value: unknown): value is TrimConversationPayload => {
  if (!isRecord(value) || !hasValidMapping(value.mapping)) {
    return false;
  }
  return typeof value.current_node === "string" && value.current_node.length > 0;
};

const pickConversationPayload = (body: Record<string, unknown>): ConversationMatch | null => {
  if (isTrimCandidate(body)) {
    return {
      payload: body,
      apply: (next) => next as Record<string, unknown>
    };
  }

  const conversation = body.conversation;
  if (isTrimCandidate(conversation)) {
    return {
      payload: conversation,
      apply: (next) => ({ ...body, conversation: next })
    };
  }

  const data = body.data;
  if (!isRecord(data)) {
    return null;
  }
  if (isTrimCandidate(data)) {
    return {
      payload: data,
      apply: (next) => ({ ...body, data: next })
    };
  }
  if (isTrimCandidate(data.conversation)) {
    return {
      payload: data.conversation,
      apply: (next) => ({ ...body, data: { ...data, conversation: next } })
    };
  }
  return null;
};

const postStats = (stats: TrimStats): void => {
  window.postMessage({ type: MESSAGE_TYPES.pageStats, payload: stats }, "*");
  const runtime = readRuntimeState();
  writeRuntimeState({
    conversationId: stats.conversationId,
    baselineTurnCount: runtime.baselineTurnCount ?? stats.visibleTotal,
    turnsSinceRefresh: runtime.turnsSinceRefresh + 1,
    lastTotal: stats.visibleTotal,
    lastRendered: stats.visibleKept,
    lastExtra: stats.extraMessages
  });
};

const postStatus = (state: PageStatusEvent["state"]): void => {
  const payload: PageStatusEvent = { state, timestamp: Date.now() };
  window.postMessage({ type: MESSAGE_TYPES.pageStatus, payload }, "*");
};

export const isConversationGet = (request: RequestInfo | URL, init?: RequestInit): boolean => {
  const method = (init?.method ?? (request instanceof Request ? request.method : "GET")).toUpperCase();
  if (method !== "GET") {
    return false;
  }

  const parsed = readRequestUrl(request);
  if (!parsed || !isAllowedHost(parsed.hostname)) {
    return false;
  }

  return parsed.pathname.startsWith(BACKEND_PREFIX)
    && CONVERSATION_PATH_PATTERN.test(parsed.pathname);
};

export type ConversationTransformResult =
  | { state: "disabled"; body: unknown; stats: null }
  | { state: "unsupported"; body: unknown; stats: null }
  | { state: "active"; body: Record<string, unknown>; stats: TrimStats };

export const transformConversationBody = (
  body: unknown,
  settings: ExtSettingsV1,
  extraMessages: number
): ConversationTransformResult => {
  if (!settings.enabled) {
    return { state: "disabled", body, stats: null };
  }
  if (!isRecord(body)) {
    return { state: "unsupported", body, stats: null };
  }

  const match = pickConversationPayload(body);
  if (!match) {
    return { state: "unsupported", body, stats: null };
  }

  const { payload, stats } = trimConversation(match.payload, settings.messageLimit, extraMessages);
  return { state: "active", body: match.apply(payload), stats };
};

export const installFetchProxy = (settings: ExtSettingsV1): void => {
  activeSettings = settings;
  postStatus(settings.enabled ? "waiting" : "disabled");

  if ((window as Window & { __CGPT_OPTIMIZER_PATCHED__?: boolean }).__CGPT_OPTIMIZER_PATCHED__) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const currentSettings = activeSettings;
    const response = await originalFetch(input, init);

    if (!currentSettings || !currentSettings.enabled || !isConversationGet(input, init)) {
      return response;
    }

    try {
      const json = await response.clone().json() as unknown;
      let extraMessages = getExtraMessages();
      const runtime = readRuntimeState();
      let result = transformConversationBody(json, currentSettings, extraMessages);
      const incomingConversationId = result.state === "active" ? result.stats.conversationId : null;
      if (
        runtime.conversationId
        && incomingConversationId
        && runtime.conversationId !== incomingConversationId
        && extraMessages > 0
      ) {
        setExtraMessages(0);
        extraMessages = 0;
        result = transformConversationBody(json, currentSettings, extraMessages);
        debugLog(currentSettings, "Reset extraMessages for new conversation", {
          previousConversationId: runtime.conversationId,
          conversationId: incomingConversationId
        });
      }

      if (result.state !== "active") {
        postStatus(result.state);
        debugLog(currentSettings, "Skip trim: no compatible conversation payload");
        return response;
      }

      postStats(result.stats);
      debugLog(currentSettings, "Trim applied", {
        conversationId: result.stats.conversationId,
        visibleKept: result.stats.visibleKept,
        visibleTotal: result.stats.visibleTotal
      });

      return new Response(JSON.stringify(result.body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      postStatus("error");
      debugLog(currentSettings, "Trim failed", error);
      return response;
    }
  };

  (window as Window & { __CGPT_OPTIMIZER_PATCHED__?: boolean }).__CGPT_OPTIMIZER_PATCHED__ = true;
};
