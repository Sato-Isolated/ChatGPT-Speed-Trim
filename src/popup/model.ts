import type { ExtSettingsV1, PageRuntimeStatus } from "../shared/schema";

export type PopupStatusTone = "success" | "neutral" | "warning" | "error";

export type PopupStatusView = {
  value: string;
  note: string;
  tone: PopupStatusTone;
};

export const mergeSettings = (
  current: ExtSettingsV1,
  patch: Partial<ExtSettingsV1>
): ExtSettingsV1 => ({ ...current, ...patch });

export const describePageStatus = (status: PageRuntimeStatus): PopupStatusView => {
  if (!status.hookReady) {
    return {
      value: "Page hook unavailable",
      note: "Reload the ChatGPT tab. If this persists, reload the extension in Brave.",
      tone: "error"
    };
  }

  switch (status.state) {
    case "active":
      return status.stats
        ? {
            value: `Rendered: ${status.stats.visibleKept}/${status.stats.visibleTotal}`,
            note: status.stats.hasOlderMessages
              ? "Older messages are available from the page control."
              : "The full conversation currently fits within the limit.",
            tone: "success"
          }
        : {
            value: "Optimizer active",
            note: "Waiting for conversation statistics.",
            tone: "neutral"
          };
    case "disabled":
      return {
        value: "Optimizer disabled",
        note: "Enable it above, then reload ChatGPT to apply.",
        tone: "neutral"
      };
    case "unsupported":
      return {
        value: "Conversation format unsupported",
        note: "ChatGPT responded, but the conversation could not be safely trimmed.",
        tone: "warning"
      };
    case "error":
      return {
        value: "Trim failed",
        note: "Reload ChatGPT and check the extension again.",
        tone: "error"
      };
    case "waiting":
    default:
      return {
        value: "Optimizer ready",
        note: "Open a conversation to start trimming.",
        tone: "neutral"
      };
  }
};
