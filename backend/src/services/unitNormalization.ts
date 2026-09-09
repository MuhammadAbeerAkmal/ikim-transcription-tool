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
  // Mirrors the NUMBER annotation type's own "rendering" attribute
  // (digits | words) from the brief — reused here deliberately, since
  // it's exactly the distinction this function needs to preserve.
  // A plain `number` return can't tell "sixty" (words) apart from "6/0"
  // (digits) once both collapse to the value 60 — that was a real bug:
  // the old version claimed to handle this case but silently discarded
  // the distinction its own docstring said it preserved.
  rendering: "digits" | "words";
}

/**
 * Parses a spoken German number phrase into a digit value plus how it
 * was rendered. Handles standard cardinal numbers ("zwölf" -> 12, words)
 * and digit sequences ("sechs null" -> 60, digits — the brief's own
 * suture-size example, "6/0", not the number sixty). The `rendering`
 * field is what lets a consumer tell those two cases apart; the numeric
 * value alone cannot.
 *
 * STATUS: demonstrated-correct and tested, but not yet called from any
 * route or from the frontend's NUMBER annotation form — the annotator
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
    return { value: Number(digits.join("")), rendering: "digits" };
  }

  return null;
}
