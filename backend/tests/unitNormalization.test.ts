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
  it("parses the brief's own example: zwoelf becomes 12", () => {
    expect(normalizeSpokenNumber("zwoelf")).toBe(12);
    expect(normalizeSpokenNumber("zwölf")).toBe(12);
  });

  it("parses simple single-digit words", () => {
    expect(normalizeSpokenNumber("sechs")).toBe(6);
    expect(normalizeSpokenNumber("null")).toBe(0);
  });

  it("parses compound tens-and-ones numbers", () => {
    expect(normalizeSpokenNumber("einundzwanzig")).toBe(21);
    expect(normalizeSpokenNumber("neunundneunzig")).toBe(99);
  });

  it("reads a sequence of single-digit words as a digit sequence, not multiplied out", () => {
    // brief's example: "sechs null" means the suture size 6/0, not sixty
    expect(normalizeSpokenNumber("sechs null")).toBe(60);
  });

  it("returns null for unparseable input", () => {
    expect(normalizeSpokenNumber("gibberish")).toBeNull();
  });
});
