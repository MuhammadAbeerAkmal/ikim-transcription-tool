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

/**
 * Parses a spoken German number phrase into a digit value.
 *
 * Handles standard cardinal numbers ("zwölf" -> 12, "einundzwanzig" -> 21).
 * For multi-word input where every word is itself a single digit (e.g.
 * "sechs null"), falls back to reading them as a literal digit sequence
 * rather than sixty, matching the brief's own worked example, where
 * "sechs null" denotes a suture size ("6/0"), not the number sixty. This
 * is a heuristic, not a general solution to that ambiguity.
 */
export function normalizeSpokenNumber(text: string): number | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  if (words.length === 1) {
    return parseGermanNumberWord(words[0]);
  }

  const digits = words.map((w) => parseGermanNumberWord(w));
  if (digits.every((d) => d !== null && d >= 0 && d <= 9)) {
    return Number(digits.join(""));
  }

  return null;
}
