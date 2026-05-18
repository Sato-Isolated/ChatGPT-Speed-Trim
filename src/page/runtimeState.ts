import type { RuntimeTrimState } from "../shared/schema";
import { PAGE_KEYS } from "../shared/storageKeys";

const defaultState = (): RuntimeTrimState => ({
  conversationId: null,
  baselineTurnCount: null,
  turnsSinceRefresh: 0,
  lastTotal: 0,
  lastRendered: 0,
  lastExtra: 0
});

export const getExtraMessages = (): number => {
  const value = Number(sessionStorage.getItem(PAGE_KEYS.extraMessages) ?? "0");
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }
  return Math.min(value, 200);
};

export const setExtraMessages = (value: number): void => {
  sessionStorage.setItem(PAGE_KEYS.extraMessages, String(Math.max(0, value)));
};

export const readRuntimeState = (): RuntimeTrimState => {
  try {
    const raw = sessionStorage.getItem(PAGE_KEYS.runtimeStats);
    if (!raw) {
      return defaultState();
    }
    return { ...defaultState(), ...(JSON.parse(raw) as Partial<RuntimeTrimState>) };
  } catch {
    return defaultState();
  }
};

export const writeRuntimeState = (state: RuntimeTrimState): void => {
  sessionStorage.setItem(PAGE_KEYS.runtimeStats, JSON.stringify(state));
};
