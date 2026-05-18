import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from "./constants";
import { normalizeCurrentSettings, runSchemaMigrations } from "./migrations";
import type { ExtSettingsV1 } from "./schema";
import { STORAGE_KEYS } from "./storageKeys";

export const ensureInitializedStorage = async (): Promise<void> => {
  const current = await chrome.storage.local.get([
    STORAGE_KEYS.schemaVersion,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.legacySettingsV1
  ]);

  const { patch, removeKeys, nextVersion } = runSchemaMigrations(
    current[STORAGE_KEYS.schemaVersion],
    current
  );

  if (typeof patch[STORAGE_KEYS.settings] === "undefined" && !current[STORAGE_KEYS.settings]) {
    patch[STORAGE_KEYS.settings] = DEFAULT_SETTINGS;
  }
  patch[STORAGE_KEYS.settings] = normalizeCurrentSettings(
    patch[STORAGE_KEYS.settings] ?? current[STORAGE_KEYS.settings]
  );

  if (nextVersion !== CURRENT_SCHEMA_VERSION || current[STORAGE_KEYS.schemaVersion] !== CURRENT_SCHEMA_VERSION) {
    patch[STORAGE_KEYS.schemaVersion] = CURRENT_SCHEMA_VERSION;
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }

  if (removeKeys.length > 0) {
    await chrome.storage.local.remove(removeKeys);
  }
};

export const getSettings = async (): Promise<ExtSettingsV1> => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeCurrentSettings(data[STORAGE_KEYS.settings]);
};

export const saveSettings = async (next: ExtSettingsV1): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: normalizeCurrentSettings(next) });
};
