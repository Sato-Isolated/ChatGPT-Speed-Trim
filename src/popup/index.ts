import { MAX_MESSAGE_LIMIT, MESSAGE_TYPES, MIN_MESSAGE_LIMIT } from "../shared/constants";
import type { ExtSettingsV1, PageRuntimeStatus } from "../shared/schema";
import { getSettings, saveSettings } from "../shared/storage";
import { describePageStatus, mergeSettings } from "./model";

const SUPPORTED_GPT_HOSTS = ["chatgpt.com", "chat.openai.com"];

const q = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
};

const isSupportedGptTab = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return SUPPORTED_GPT_HOSTS.some((host) => (
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    ));
  } catch {
    return false;
  }
};

let activeChatGptTabId: number | null = null;

const setStatus = (value: string, note: string, tone: string): void => {
  q<HTMLParagraphElement>("stats").textContent = value;
  q<HTMLParagraphElement>("statusNote").textContent = note;
  q<HTMLSpanElement>("statusDot").dataset.tone = tone;
};

const refreshStatus = async (): Promise<void> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeChatGptTabId = null;

  if (!tab?.id) {
    setStatus("No active tab", "Open a ChatGPT conversation to use the optimizer.", "neutral");
    return;
  }

  if (!isSupportedGptTab(tab.url)) {
    setStatus("Open a ChatGPT tab", "The optimizer only runs on supported ChatGPT pages.", "neutral");
    return;
  }
  activeChatGptTabId = tab.id;

  const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.getPageStatus }).catch(() => null);
  const status = response?.data as PageRuntimeStatus | undefined;
  const view = status
    ? describePageStatus(status)
    : describePageStatus({ hookReady: false, state: "waiting", stats: null, timestamp: Date.now() });
  setStatus(view.value, view.note, view.tone);
};

const wireSettings = async (): Promise<void> => {
  let settings: ExtSettingsV1 = await getSettings();
  const enabled = q<HTMLInputElement>("enabled");
  const messageLimit = q<HTMLInputElement>("messageLimit");
  const reloadButton = q<HTMLButtonElement>("reloadChatGpt");

  enabled.checked = settings.enabled;
  messageLimit.value = String(settings.messageLimit);

  enabled.addEventListener("change", async () => {
    settings = mergeSettings(settings, { enabled: enabled.checked });
    await saveSettings(settings);
    reloadButton.hidden = false;
    await refreshStatus();
  });

  messageLimit.addEventListener("change", async () => {
    const parsed = Number(messageLimit.value);
    const safe = Number.isFinite(parsed)
      ? Math.max(MIN_MESSAGE_LIMIT, Math.min(MAX_MESSAGE_LIMIT, parsed))
      : settings.messageLimit;
    messageLimit.value = String(safe);
    settings = mergeSettings(settings, { messageLimit: safe });
    await saveSettings(settings);
    reloadButton.hidden = false;
    await refreshStatus();
  });

  reloadButton.addEventListener("click", async () => {
    if (activeChatGptTabId === null) {
      await refreshStatus();
      return;
    }
    reloadButton.disabled = true;
    reloadButton.textContent = "Reloading…";
    await chrome.tabs.reload(activeChatGptTabId);
    window.close();
  });
};

const main = async (): Promise<void> => {
  await wireSettings();
  await refreshStatus();
};

void main();
