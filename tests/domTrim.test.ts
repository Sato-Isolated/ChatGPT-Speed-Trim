import { describe, expect, it } from "vitest";
import { getDomTrimWindow } from "../src/content/domTrim";

describe("getDomTrimWindow", () => {
  it("hides turns older than the configured limit", () => {
    expect(getDomTrimWindow(50, 10, 0)).toEqual({
      hiddenCount: 40,
      visibleCount: 10,
      hasOlderMessages: true
    });
  });

  it("adds the requested older messages", () => {
    expect(getDomTrimWindow(50, 10, 20)).toEqual({
      hiddenCount: 20,
      visibleCount: 30,
      hasOlderMessages: true
    });
  });

  it("keeps every turn when the conversation fits", () => {
    expect(getDomTrimWindow(7, 10, 0)).toEqual({
      hiddenCount: 0,
      visibleCount: 7,
      hasOlderMessages: false
    });
  });
});
