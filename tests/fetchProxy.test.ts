import { describe, expect, it } from "vitest";
import { isConversationGet } from "../src/page/fetchProxy";

describe("isConversationGet", () => {
  it("matches legacy chatgpt conversation endpoint", () => {
    expect(isConversationGet("https://chatgpt.com/backend-api/conversation/abc")).toBe(true);
  });

  it("matches chatgpt conversation variant under backend-api", () => {
    expect(isConversationGet("https://chatgpt.com/backend-api/f/conversation/abc")).toBe(true);
  });

  it("matches chat.openai.com endpoint", () => {
    expect(isConversationGet("https://chat.openai.com/backend-api/conversation/abc")).toBe(true);
  });

  it("rejects non-conversation backend route", () => {
    expect(isConversationGet("https://chatgpt.com/backend-api/models")).toBe(false);
  });

  it("rejects non-GET methods", () => {
    expect(
      isConversationGet(
        new Request("https://chatgpt.com/backend-api/conversation/abc", { method: "POST" })
      )
    ).toBe(false);
  });

  it("rejects disallowed hosts", () => {
    expect(isConversationGet("https://example.com/backend-api/conversation/abc")).toBe(false);
  });
});
