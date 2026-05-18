import type { ExtSettingsV1 } from "./schema";

export const CURRENT_SCHEMA_VERSION = 2;
export const MIN_MESSAGE_LIMIT = 5;
export const MAX_MESSAGE_LIMIT = 200;
export const DEFAULT_MESSAGE_LIMIT = 10;

export const DEFAULT_SETTINGS: ExtSettingsV1 = {
  enabled: true,
  messageLimit: DEFAULT_MESSAGE_LIMIT,
  debug: false,
  disableNotifications: false
};

export const MESSAGE_TYPES = {
  pageStats: "CGPT_OPTIMIZER_PAGE_STATS",
  pageSettings: "CGPT_OPTIMIZER_PAGE_SETTINGS",
  pageSettingsRequest: "CGPT_OPTIMIZER_PAGE_SETTINGS_REQUEST"
} as const;
