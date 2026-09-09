import { describe, expect, it } from "vitest";
import { isConversationGet, transformConversationBody } from "../src/page/fetchProxy";
import { DEFAULT_SETTINGS } from "../src/shared/constants";

const makeConversation = () => ({
  conversation_id: "conv",
  current_node: "b",
  mapping: {
    root: { id: "root", parent: null, children: ["a"], message: null },
    a: {
      id: "a",
      parent: "root",
      children: ["b"],
      message: { author: { role: "user" }, content: { parts: ["hello"] } }
    },
    b: {
      id: "b",
      parent: "a",
      children: [],
      message: { author: { role: "assistant" }, content: { parts: ["hi"] } }
    }
  }
});

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

  it("rejects the conversation-list endpoint", () => {
    expect(isConversationGet("https://chatgpt.com/backend-api/conversations?offset=0")).toBe(false);
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

  it.each([
    ["direct", (conversation: ReturnType<typeof makeConversation>) => conversation],
    ["conversation envelope", (conversation: ReturnType<typeof makeConversation>) => ({ conversation })],
    ["data envelope", (conversation: ReturnType<typeof makeConversation>) => ({ data: conversation })],
    ["nested data envelope", (conversation: ReturnType<typeof makeConversation>) => ({ data: { conversation } })]
  ])("trims a null-root payload in the %s shape", (_label, wrap) => {
    const result = transformConversationBody(wrap(makeConversation()), { ...DEFAULT_SETTINGS, messageLimit: 1 }, 0);

    expect(result.state).toBe("active");
    if (result.state === "active") {
      expect(result.stats.visibleTotal).toBe(2);
      expect(result.stats.visibleKept).toBe(1);
    }
  });

  it("returns the original body when disabled", () => {
    const body = makeConversation();
    const result = transformConversationBody(body, { ...DEFAULT_SETTINGS, enabled: false }, 0);

    expect(result).toEqual({ state: "disabled", body, stats: null });
    expect(Object.keys(body.mapping)).toEqual(["root", "a", "b"]);
  });

  it("reports unsupported payloads without including conversation content", () => {
    const body = { title: "not a conversation mapping" };
    const result = transformConversationBody(body, DEFAULT_SETTINGS, 0);

    expect(result).toEqual({ state: "unsupported", body, stats: null });
  });
});
