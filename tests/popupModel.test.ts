import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/constants";
import type { PageRuntimeStatus } from "../src/shared/schema";
import { describePageStatus, mergeSettings } from "../src/popup/model";

describe("popup model", () => {
  it("preserves sequential setting changes", () => {
    let settings = mergeSettings(DEFAULT_SETTINGS, { enabled: false });
    settings = mergeSettings(settings, { messageLimit: 42 });

    expect(settings.enabled).toBe(false);
    expect(settings.messageLimit).toBe(42);
  });

  it.each([
    ["waiting", "Optimizer ready", "neutral"],
    ["disabled", "Optimizer disabled", "neutral"],
    ["unsupported", "Conversation format unsupported", "warning"],
    ["error", "Trim failed", "error"]
  ] as const)("describes the %s state", (state, value, tone) => {
    const status: PageRuntimeStatus = { hookReady: true, state, stats: null, timestamp: 1 };

    expect(describePageStatus(status)).toMatchObject({ value, tone });
  });

  it("describes active trim statistics", () => {
    const status: PageRuntimeStatus = {
      hookReady: true,
      state: "active",
      stats: {
        conversationId: "conv",
        visibleTotal: 50,
        visibleKept: 10,
        absoluteMessageCount: 51,
        hasOlderMessages: true,
        extraMessages: 0,
        timestamp: 1
      },
      timestamp: 1
    };

    expect(describePageStatus(status)).toMatchObject({
      value: "Rendered: 10/50",
      tone: "success"
    });
  });

  it("reports a missing page hook", () => {
    const status: PageRuntimeStatus = { hookReady: false, state: "waiting", stats: null, timestamp: 1 };

    expect(describePageStatus(status).value).toBe("Page hook unavailable");
  });
});
