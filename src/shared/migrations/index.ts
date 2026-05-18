import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, MAX_MESSAGE_LIMIT, MIN_MESSAGE_LIMIT } from "../constants";
import type { ExtSettingsV1 } from "../schema";
import { STORAGE_KEYS } from "../storageKeys";

type MigrationContext = {
  patch: Record<string, unknown>;
  removeKeys: string[];
};

type Migration = {
  toVersion: number;
  up: (snapshot: Record<string, unknown>, context: MigrationContext) => void;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const toBoolean = (value: unknown, fallback: boolean): boolean => (
  typeof value === "boolean" ? value : fallback
);

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const normalizeSettings = (input: unknown): ExtSettingsV1 => {
  const source = asRecord(input);
  if (!source) {
    return DEFAULT_SETTINGS;
  }

  const messageLimitRaw = toNumber(source.messageLimit, DEFAULT_SETTINGS.messageLimit);
  const messageLimit = Math.max(MIN_MESSAGE_LIMIT, Math.min(MAX_MESSAGE_LIMIT, messageLimitRaw));

  return {
    enabled: toBoolean(source.enabled, DEFAULT_SETTINGS.enabled),
    messageLimit,
    debug: toBoolean(source.debug, DEFAULT_SETTINGS.debug),
    disableNotifications: toBoolean(source.disableNotifications, DEFAULT_SETTINGS.disableNotifications)
  };
};

const migrations: Record<number, Migration> = {
  1: {
    toVersion: 2,
    up: (snapshot, context) => {
      const v2Candidate = snapshot[STORAGE_KEYS.settings];
      const v1Candidate = snapshot[STORAGE_KEYS.legacySettingsV1];

      context.patch[STORAGE_KEYS.settings] = normalizeSettings(v2Candidate ?? v1Candidate);
      if (typeof v1Candidate !== "undefined") {
        context.removeKeys.push(STORAGE_KEYS.legacySettingsV1);
      }
    }
  }
};

const getSafeVersion = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  if (value < 1) {
    return 1;
  }
  return Math.floor(value);
};

export const runSchemaMigrations = (
  currentVersionRaw: unknown,
  snapshot: Record<string, unknown>
): MigrationContext & { nextVersion: number } => {
  const context: MigrationContext = { patch: {}, removeKeys: [] };
  let version = getSafeVersion(currentVersionRaw);

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      break;
    }
    migration.up(snapshot, context);
    version = migration.toVersion;
  }

  return {
    ...context,
    nextVersion: version
  };
};

export const normalizeCurrentSettings = (candidate: unknown): ExtSettingsV1 => normalizeSettings(candidate);
