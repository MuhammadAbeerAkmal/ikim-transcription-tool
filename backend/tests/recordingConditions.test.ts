import { describe, it, expect } from "vitest";
import { computeSpeechRate } from "../src/services/recordingConditions.js";

describe("computeSpeechRate", () => {
  it("computes words per minute correctly", () => {
    // 10 words in 30 seconds = 20 words/minute
    expect(computeSpeechRate("one two three four five six seven eight nine ten", 30)).toBe(20);
  });

  it("collapses multiple spaces and ignores empty tokens", () => {
    expect(computeSpeechRate("one   two    three", 60)).toBe(3);
  });

  it("returns 0 for zero or negative duration instead of dividing by zero", () => {
    expect(computeSpeechRate("some words here", 0)).toBe(0);
  });
});
