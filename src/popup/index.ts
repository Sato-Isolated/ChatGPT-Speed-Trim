import { MAX_MESSAGE_LIMIT, MIN_MESSAGE_LIMIT } from "../shared/constants";
import { getSettings, saveSettings } from "../shared/storage";

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

const refreshStats = async (): Promise<void> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const statsNode = q<HTMLParagraphElement>("stats");

  if (!tab?.id) {
    statsNode.textContent = "Rendered: no active tab";
    return;
  }

  if (!isSupportedGptTab(tab.url)) {
    statsNode.textContent = "Rendered: open ChatGPT tab";
    return;
  }

  const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_STATS" }).catch(() => null);
  const stats = response?.data;
  statsNode.textContent = stats
    ? `Rendered: ${stats.visibleKept}/${stats.visibleTotal}`
    : "Rendered: ChatGPT detected (reload tab once)";
};

const wireSettings = async (): Promise<void> => {
  const settings = await getSettings();
  const enabled = q<HTMLInputElement>("enabled");
  const messageLimit = q<HTMLInputElement>("messageLimit");

  enabled.checked = settings.enabled;
  messageLimit.value = String(settings.messageLimit);

  enabled.addEventListener("change", async () => {
    await saveSettings({ ...settings, enabled: enabled.checked });
  });

  messageLimit.addEventListener("change", async () => {
    const parsed = Number(messageLimit.value);
    const safe = Number.isFinite(parsed)
      ? Math.max(MIN_MESSAGE_LIMIT, Math.min(MAX_MESSAGE_LIMIT, parsed))
      : settings.messageLimit;
    messageLimit.value = String(safe);
    await saveSettings({ ...settings, messageLimit: safe });
  });
};

const main = async (): Promise<void> => {
  await wireSettings();
  await refreshStats();
};

void main();
