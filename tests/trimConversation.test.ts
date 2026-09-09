import { describe, expect, it } from "vitest";
import { trimConversation } from "../src/page/trim/trimConversation";

const makeNode = (id: string, parent: string | null, role: string, text: string) => ({
  id,
  parent,
  children: [],
  message: {
    author: { role },
    content: { parts: [text] }
  }
});

const makeRoot = (id = "root") => ({
  id,
  parent: null,
  children: [],
  message: null
});

describe("trimConversation", () => {
  it("keeps latest meaningful nodes within budget", () => {
    const mapping: Record<string, any> = {
      root: makeNode("root", null, "system", "init"),
      a: makeNode("a", "root", "user", "u1"),
      b: makeNode("b", "a", "assistant", "a1"),
      c: makeNode("c", "b", "user", "u2"),
      d: makeNode("d", "c", "assistant", "a2")
    };
    mapping.root.children = ["a"];
    mapping.a.children = ["b"];
    mapping.b.children = ["c"];
    mapping.c.children = ["d"];

    const { payload, stats } = trimConversation({
      conversation_id: "conv",
      current_node: "d",
      mapping
    }, 2, 0);

    const ids = Object.keys(payload.mapping ?? {});
    expect(ids).toContain("root");
    expect(ids).toContain("c");
    expect(ids).toContain("d");
    expect(ids).not.toContain("a");
    expect(ids).not.toContain("b");
    expect(payload.mapping?.root.parent).toBeNull();
    expect(payload.mapping?.root.children).toEqual(["c"]);
    expect(payload.mapping?.c.parent).toBe("root");
    expect(payload.mapping?.c.children).toEqual(["d"]);
    expect(payload.mapping?.d.parent).toBe("c");
    expect(payload.mapping?.d.children).toEqual([]);
    expect(stats.visibleKept).toBe(3);
    expect(stats.visibleTotal).toBe(5);
    expect(stats.hasOlderMessages).toBe(true);
  });

  it("accepts a realistic null-message root", () => {
    const mapping: Record<string, any> = {
      root: makeRoot(),
      a: makeNode("a", "root", "user", "first"),
      b: makeNode("b", "a", "assistant", "second"),
      c: makeNode("c", "b", "user", "third")
    };
    mapping.root.children = ["a"];
    mapping.a.children = ["b"];
    mapping.b.children = ["c"];

    const { payload, stats } = trimConversation({ current_node: "c", mapping }, 2, 0);

    expect(Object.keys(payload.mapping ?? {})).toEqual(["b", "c"]);
    expect(payload.mapping?.b.parent).toBeNull();
    expect(stats.visibleTotal).toBe(3);
    expect(stats.visibleKept).toBe(2);
  });

  it("counts multimedia parts but ignores empty content", () => {
    const mapping: Record<string, any> = {
      root: makeRoot(),
      image: {
        id: "image",
        parent: "root",
        children: ["empty"],
        message: { author: { role: "user" }, content: { parts: [{ asset_pointer: "file-service://image" }] } }
      },
      empty: makeNode("empty", "image", "assistant", "   "),
      text: makeNode("text", "empty", "assistant", "answer")
    };
    mapping.root.children = ["image"];
    mapping.empty.children = ["text"];

    const { stats } = trimConversation({ current_node: "text", mapping }, 10, 0);

    expect(stats.visibleTotal).toBe(2);
    expect(stats.visibleKept).toBe(2);
  });
});
