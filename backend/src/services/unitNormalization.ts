export type MeasurementUnit =
  | "g"
  | "mg"
  | "ug"
  | "kg"
  | "ml"
  | "l"
  | "mmHg"
  | "IE"
  | "mm"
  | "cm"
  | "Ch";

interface UnitConversion {
  baseUnit: string;
  factor: number;
}

// Grouped by what they naturally convert to. mmHg, IE, and Ch each stand
// alone. There's nothing else in the accepted unit list to convert them
// to or from, so they normalize to themselves.
const UNIT_CONVERSION: Record<MeasurementUnit, UnitConversion> = {
  g: { baseUnit: "g", factor: 1 },
  mg: { baseUnit: "g", factor: 0.001 },
  ug: { baseUnit: "g", factor: 0.000001 },
  kg: { baseUnit: "g", factor: 1000 },
  ml: { baseUnit: "ml", factor: 1 },
  l: { baseUnit: "ml", factor: 1000 },
  mmHg: { baseUnit: "mmHg", factor: 1 },
  IE: { baseUnit: "IE", factor: 1 },
  mm: { baseUnit: "mm", factor: 1 },
  cm: { baseUnit: "mm", factor: 10 },
  Ch: { baseUnit: "Ch", factor: 1 },
};

export interface NormalizedMeasurement {
  normalizedValue: number;
  baseUnit: string;
}

export function normalizeMeasurement(
  value: number,
  unit: MeasurementUnit,
): NormalizedMeasurement {
  const conversion = UNIT_CONVERSION[unit];
  return {
    normalizedValue: value * conversion.factor,
    baseUnit: conversion.baseUnit,
  };
}

const ONES: Record<string, number> = {
  null: 0,
  eins: 1,
  ein: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
};

const TEENS: Record<string, number> = {
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zwoelf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
};

const TENS: Record<string, number> = {
  zwanzig: 20,
  dreißig: 30,
  dreissig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
};

const ONES_PREFIX_PATTERN = Object.keys(ONES)
  .filter((w) => w !== "null")
  .join("|");
const TENS_SUFFIX_PATTERN = Object.keys(TENS).join("|");
const COMPOUND_PATTERN = new RegExp(
  `^(${ONES_PREFIX_PATTERN})und(${TENS_SUFFIX_PATTERN})$`,
);

function parseGermanNumberWord(word: string): number | null {
  const w = word.toLowerCase().trim();
  if (w in ONES) return ONES[w];
  if (w in TEENS) return TEENS[w];
  if (w in TENS) return TENS[w];

  const match = w.match(COMPOUND_PATTERN);
  if (match) {
    return ONES[match[1]] + TENS[match[2]];
  }

  return null;
}

export interface SpokenNumberResult {
  value: number;
  // Mirrors the NUMBER annotation type's own "rendering" attribute from
  // the brief. Both of the brief's own examples resolve to "words" here:
  // "zwoelf" (one cardinal word -> 12) and "sechs null" (a digit-by-digit
  // reading -> meaning 6/0, explicitly called "a NUMBER spoken as words"
  // in the brief's worked example) both name actual German words, so
  // both are rendering: "words". This function only ever parses spoken
  // number-words, so it can never itself produce "digits". That value
  // would describe a transcript where the ASR already wrote literal
  // numeral characters instead of spelling the number out, a case this
  // function isn't given (it receives word tokens, not digit glyphs).
  rendering: "digits" | "words";
}

/**
 * Parses a spoken German number phrase into a numeric value plus how it
 * was rendered. Handles both a single cardinal word ("zwölf" -> 12) and
 * a digit-by-digit reading of several single-digit words ("sechs null"
 * -> the brief's own suture-size example, meaning 6/0). Both cases are
 * "words" per the brief's worked example; what distinguishes "sechs
 * null" (6/0) from "sechzig" (60) is that they're different spoken
 * phrases, not a different `rendering` value, both parse to the numeric
 * value 60 here, since the NUMBER schema's `normalizedValue` is a plain
 * number and can't hold a non-numeric code like "6/0" without a schema
 * change. See DESIGN.md.
 *
 * STATUS: demonstrated-correct and tested, but not yet called from any
 * route or from the frontend's NUMBER annotation form. The annotator
 * currently types `rendering` and the value by hand there. Wiring this
 * in (e.g. auto-suggesting both from a typed spoken-text field) is real
 * UI work, deliberately not done yet given time constraints. Unlike
 * normalizeMeasurement (which the backend does call, to validate a
 * MEASUREMENT span's normalizedValue instead of trusting the client),
 * this one currently has no live caller.
 */
export function normalizeSpokenNumber(text: string): SpokenNumberResult | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  if (words.length === 1) {
    const value = parseGermanNumberWord(words[0]);
    return value === null ? null : { value, rendering: "words" };
  }

  const digits = words.map((w) => parseGermanNumberWord(w));
  if (digits.every((d) => d !== null && d >= 0 && d <= 9)) {
    return { value: Number(digits.join("")), rendering: "words" };
  }

  return null;
}
