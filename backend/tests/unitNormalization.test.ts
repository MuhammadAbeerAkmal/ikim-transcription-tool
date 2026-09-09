import { describe, it, expect } from "vitest";
import {
  normalizeMeasurement,
  normalizeSpokenNumber,
} from "../src/services/unitNormalization.js";

describe("normalizeMeasurement", () => {
  it("converts mg to g, matching the brief's worked example (1500mg = 1.5g)", () => {
    expect(normalizeMeasurement(1500, "mg")).toEqual({
      normalizedValue: 1.5,
      baseUnit: "g",
    });
  });

  it("converts kg to g", () => {
    expect(normalizeMeasurement(2, "kg")).toEqual({
      normalizedValue: 2000,
      baseUnit: "g",
    });
  });

  it("converts l to ml", () => {
    expect(normalizeMeasurement(1.5, "l")).toEqual({
      normalizedValue: 1500,
      baseUnit: "ml",
    });
  });

  it("converts cm to mm", () => {
    expect(normalizeMeasurement(3, "cm")).toEqual({
      normalizedValue: 30,
      baseUnit: "mm",
    });
  });

  it("leaves standalone units (mmHg, IE, Ch) unconverted", () => {
    expect(normalizeMeasurement(120, "mmHg")).toEqual({
      normalizedValue: 120,
      baseUnit: "mmHg",
    });
    expect(normalizeMeasurement(40, "IE")).toEqual({
      normalizedValue: 40,
      baseUnit: "IE",
    });
    expect(normalizeMeasurement(18, "Ch")).toEqual({
      normalizedValue: 18,
      baseUnit: "Ch",
    });
  });
});

describe("normalizeSpokenNumber", () => {
  it("parses the brief's own example: zwoelf becomes 12, rendered as words", () => {
    expect(normalizeSpokenNumber("zwoelf")).toEqual({ value: 12, rendering: "words" });
    expect(normalizeSpokenNumber("zwölf")).toEqual({ value: 12, rendering: "words" });
  });

  it("parses simple single-digit words as words", () => {
    expect(normalizeSpokenNumber("sechs")).toEqual({ value: 6, rendering: "words" });
    expect(normalizeSpokenNumber("null")).toEqual({ value: 0, rendering: "words" });
  });

  it("parses compound tens-and-ones numbers as words", () => {
    expect(normalizeSpokenNumber("einundzwanzig")).toEqual({ value: 21, rendering: "words" });
    expect(normalizeSpokenNumber("neunundneunzig")).toEqual({ value: 99, rendering: "words" });
  });

  it("reads a sequence of single-digit words as a digit sequence, distinct from the same-valued cardinal number", () => {
    // brief's example: "sechs null" means the suture size 6/0, not sixty.
    // Both produce the numeric value 60, so `rendering` is what actually
    // distinguishes them — this is the field a consumer must check.
    const digitSequence = normalizeSpokenNumber("sechs null");
    const cardinalSixty = normalizeSpokenNumber("sechzig");
    expect(digitSequence).toEqual({ value: 60, rendering: "digits" });
    expect(cardinalSixty).toEqual({ value: 60, rendering: "words" });
    expect(digitSequence?.rendering).not.toBe(cardinalSixty?.rendering);
  });

  it("returns null for unparseable input", () => {
    expect(normalizeSpokenNumber("gibberish")).toBeNull();
  });
});
