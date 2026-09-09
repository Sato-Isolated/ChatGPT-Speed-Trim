import { MESSAGE_TYPES } from "../shared/constants";
import { DEFAULT_SETTINGS } from "../shared/constants";
import type { PageRuntimeStatus, PageStatusEvent, TrimStats } from "../shared/schema";
import type { ExtSettingsV1 } from "../shared/schema";
import { PAGE_KEYS } from "../shared/storageKeys";
import { STORAGE_KEYS } from "../shared/storageKeys";
import { getDomTrimWindow } from "./domTrim";

let latestStatus: PageRuntimeStatus = {
  hookReady: false,
  state: "waiting",
  stats: null,
  timestamp: Date.now()
};
let mountObserver: MutationObserver | null = null;
let domTrimFrame: number | null = null;
let currentSettings: ExtSettingsV1 = DEFAULT_SETTINGS;

const UI = {
  rootId: "cgpt-optimizer-root",
  badgeId: "cgpt-optimizer-badge",
  buttonId: "cgpt-optimizer-load-older"
} as const;

const DOM = {
  hiddenClass: "cgpt-optimizer-hidden-turn",
  styleId: "cgpt-optimizer-styles",
  turnSelector: "[data-testid^='conversation-turn-']"
} as const;

const ROOT_HOST_SELECTORS = [
  "main",
  "[role='main']",
  "body"
] as const;

const getRootHost = (): HTMLElement | null => {
  for (const selector of ROOT_HOST_SELECTORS) {
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement) {
      return node;
    }
  }
  if (document.body instanceof HTMLElement) {
    return document.body;
  }
  if (document.documentElement instanceof HTMLElement) {
    return document.documentElement;
  }
  return null;
};

const ensureRoot = (): HTMLElement | null => {
  const existing = document.getElementById(UI.rootId);
  if (existing instanceof HTMLElement) {
    return existing;
  }

  const host = getRootHost();
  if (!host) {
    return null;
  }

  const root = document.createElement("div");
  root.id = UI.rootId;
  root.setAttribute("data-cgpt-optimizer", "overlay");
  root.style.cssText = [
    "position:fixed",
    "right:0",
    "bottom:0",
    "z-index:2147483647",
    "pointer-events:none"
  ].join(";");
  host.appendChild(root);
  return root;
};

const ensureMountedUi = (): void => {
  if (latestStatus.state !== "active" || !latestStatus.stats) {
    return;
  }
  updateBadge(latestStatus.stats);
  syncLoadOlderButton(latestStatus.stats);
};

const clearMountedUi = (): void => {
  document.getElementById(UI.rootId)?.remove();
};

const ensureDomStyles = (): void => {
  if (document.getElementById(DOM.styleId)) {
    return;
  }
  const style = document.createElement("style");
  style.id = DOM.styleId;
  style.textContent = `.${DOM.hiddenClass}{display:none!important}`;
  (document.head ?? document.documentElement)?.appendChild(style);
};

const getConversationId = (): string | null => {
  const match = location.pathname.match(/\/c\/([^/]+)/);
  return match?.[1] ?? null;
};

const applyDomTrim = (): void => {
  domTrimFrame = null;
  const turns = Array.from(document.querySelectorAll<HTMLElement>(DOM.turnSelector));

  if (!currentSettings.enabled) {
    for (const turn of turns) {
      turn.classList.remove(DOM.hiddenClass);
    }
    latestStatus = {
      hookReady: true,
      state: "disabled",
      stats: null,
      timestamp: Date.now()
    };
    clearMountedUi();
    return;
  }

  if (turns.length === 0) {
    return;
  }

  ensureDomStyles();
  const extraMessagesRaw = Number(sessionStorage.getItem(PAGE_KEYS.extraMessages) ?? "0");
  const extraMessages = Number.isFinite(extraMessagesRaw)
    ? Math.max(0, Math.min(200, extraMessagesRaw))
    : 0;
  const trimWindow = getDomTrimWindow(turns.length, currentSettings.messageLimit, extraMessages);

  turns.forEach((turn, index) => {
    turn.classList.toggle(DOM.hiddenClass, index < trimWindow.hiddenCount);
  });

  const stats: TrimStats = {
    conversationId: getConversationId(),
    visibleTotal: turns.length,
    visibleKept: trimWindow.visibleCount,
    absoluteMessageCount: turns.length,
    hasOlderMessages: trimWindow.hasOlderMessages,
    extraMessages,
    timestamp: Date.now()
  };
  latestStatus = { hookReady: true, state: "active", stats, timestamp: stats.timestamp };
  updateBadge(stats);
  syncLoadOlderButton(stats);
};

const scheduleDomTrim = (): void => {
  if (domTrimFrame !== null) {
    return;
  }
  domTrimFrame = requestAnimationFrame(applyDomTrim);
};

const startMountObserver = (): void => {
  if (mountObserver) {
    return;
  }
  mountObserver = new MutationObserver(() => {
    if (!document.getElementById(UI.rootId)) {
      ensureMountedUi();
    }
    scheduleDomTrim();
  });

  if (document.documentElement) {
    mountObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
};

const postPageSettings = async (): Promise<void> => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    const settings = (result[STORAGE_KEYS.settings] as ExtSettingsV1 | undefined) ?? DEFAULT_SETTINGS;
    currentSettings = settings;
    window.postMessage({ type: MESSAGE_TYPES.pageSettings, payload: settings }, "*");
    scheduleDomTrim();
  } catch {
    currentSettings = DEFAULT_SETTINGS;
    window.postMessage({ type: MESSAGE_TYPES.pageSettings, payload: DEFAULT_SETTINGS }, "*");
    scheduleDomTrim();
  }
};

const updateBadge = (stats: TrimStats): void => {
  const root = ensureRoot();
  if (!root) {
    return;
  }

  let node = document.getElementById(UI.badgeId);
  if (!node) {
    node = document.createElement("div");
    node.id = UI.badgeId;
    node.setAttribute("role", "status");
    node.style.cssText = [
      "position:fixed",
      "right:14px",
      "bottom:14px",
      "z-index:2",
      "pointer-events:auto",
      "padding:8px 10px",
      "border-radius:10px",
      "font:12px/1.2 'Segoe UI',sans-serif",
      "background:#123f37",
      "color:#f8f5ef",
      "box-shadow:0 8px 24px rgba(0,0,0,.2)"
    ].join(";");
    root.appendChild(node);
  }
  const text = `Showing ${stats.visibleKept}/${stats.visibleTotal} messages`;
  if (node.textContent !== text) {
    node.textContent = text;
  }
};

const syncLoadOlderButton = (stats: TrimStats): void => {
  const root = ensureRoot();
  if (!root) {
    return;
  }

  const existing = document.getElementById(UI.buttonId);
  if (!stats.hasOlderMessages) {
    existing?.remove();
    return;
  }
  if (existing) {
    return;
  }

  const button = document.createElement("button");
  button.id = UI.buttonId;
  button.type = "button";
  button.ariaLabel = "Load older ChatGPT messages";
  button.textContent = "Load older messages";
  button.style.cssText = [
    "position:fixed",
    "right:14px",
    "bottom:58px",
    "z-index:2",
    "pointer-events:auto",
    "padding:10px 12px",
    "border-radius:10px",
    "border:0",
    "cursor:pointer",
    "background:#bd5b2f",
    "color:#fff"
  ].join(";");
  button.addEventListener("click", () => {
    const current = Number(sessionStorage.getItem(PAGE_KEYS.extraMessages) ?? "0");
    sessionStorage.setItem(PAGE_KEYS.extraMessages, String(current + 20));
    location.reload();
  });
  root.appendChild(button);
};

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const message = event.data;
  if (message?.type === MESSAGE_TYPES.pageSettingsRequest) {
    void postPageSettings();
    return;
  }
  if (message?.type === MESSAGE_TYPES.pageStatus && message.payload) {
    const payload = message.payload as Partial<PageStatusEvent>;
    if (
      typeof payload.timestamp === "number"
      && ["waiting", "unsupported", "error", "disabled"].includes(String(payload.state))
    ) {
      if (latestStatus.state === "active" && payload.state !== "disabled") {
        return;
      }
      latestStatus = {
        hookReady: true,
        state: payload.state as PageStatusEvent["state"],
        stats: null,
        timestamp: payload.timestamp
      };
      clearMountedUi();
    }
    return;
  }
  if (message?.type !== MESSAGE_TYPES.pageStats || !message.payload) {
    return;
  }
  const stats = message.payload as TrimStats;
  latestStatus = {
    hookReady: true,
    state: "active",
    stats,
    timestamp: stats.timestamp
  };
  updateBadge(stats);
  syncLoadOlderButton(stats);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.getPageStatus) {
    sendResponse({ ok: true, data: latestStatus });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEYS.settings]) {
    void postPageSettings();
  }
});

void postPageSettings();
startMountObserver();
scheduleDomTrim();
