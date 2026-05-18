import { MESSAGE_TYPES } from "../shared/constants";
import { DEFAULT_SETTINGS } from "../shared/constants";
import type { TrimStats } from "../shared/schema";
import type { ExtSettingsV1 } from "../shared/schema";
import { PAGE_KEYS } from "../shared/storageKeys";
import { STORAGE_KEYS } from "../shared/storageKeys";

let latestStats: TrimStats | null = null;
let mountObserver: MutationObserver | null = null;

const UI = {
  rootId: "cgpt-optimizer-root",
  badgeId: "cgpt-optimizer-badge",
  buttonId: "cgpt-optimizer-load-older"
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
  if (!latestStats) {
    return;
  }
  updateBadge(latestStats);
  ensureLoadOlderButton();
};

const startMountObserver = (): void => {
  if (mountObserver) {
    return;
  }
  mountObserver = new MutationObserver(() => {
    if (!document.getElementById(UI.rootId)) {
      ensureMountedUi();
    }
  });

  if (document.documentElement) {
    mountObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
};

const postPageSettings = async (): Promise<void> => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    const settings = (result[STORAGE_KEYS.settings] as ExtSettingsV1 | undefined) ?? DEFAULT_SETTINGS;
    window.postMessage({ type: MESSAGE_TYPES.pageSettings, payload: settings }, "*");
  } catch {
    window.postMessage({ type: MESSAGE_TYPES.pageSettings, payload: DEFAULT_SETTINGS }, "*");
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
  node.textContent = `Showing ${stats.visibleKept}/${stats.visibleTotal} messages`;
};

const ensureLoadOlderButton = (): void => {
  const root = ensureRoot();
  if (!root || document.getElementById(UI.buttonId)) {
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
  const message = event.data;
  if (message?.type === MESSAGE_TYPES.pageSettingsRequest) {
    void postPageSettings();
    return;
  }
  if (!message || message.type !== MESSAGE_TYPES.pageStats || !message.payload) {
    return;
  }
  latestStats = message.payload as TrimStats;
  updateBadge(latestStats);
  ensureLoadOlderButton();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_PAGE_STATS") {
    sendResponse({ ok: true, data: latestStats });
  }
});

void postPageSettings();
startMountObserver();
