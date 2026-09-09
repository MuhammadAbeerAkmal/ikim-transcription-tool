import { z } from "zod";

const measurementUnitSchema = z.enum([
  "g",
  "mg",
  "ug",
  "kg",
  "ml",
  "l",
  "mmHg",
  "IE",
  "mm",
  "cm",
  "Ch",
]);

// CRUD is kept as a real type, modeled as an edit-provenance tag rather
// than a content-classification tag like the other six. The brief
// describes it differently ("correct, add, or delete tokens") from the
// content types (NUMBER, MEDICAL_TERM, etc.), so it's read here as marking
// where the corrected transcript diverges from the original, not what the
// content itself is.
const crudAttributesSchema = z.object({
  editType: z.enum(["correct", "add", "delete"]),
});

const numberAttributesSchema = z.object({
  rendering: z.enum(["digits", "words"]),
  normalizedValue: z.number(),
});

const formattingCommandAttributesSchema = z.object({
  command: z.enum([
    "newline",
    "paragraph",
    "period",
    "comma",
    "colon",
    "dash",
    "bracket_open",
    "bracket_close",
  ]),
  isLiteral: z.boolean(),
});

const spelledOutAttributesSchema = z.object({
  resolvedWord: z.string().min(1),
});

const namedEntityAttributesSchema = z.object({
  entityType: z.enum(["person", "organisation", "place", "date"]),
});

const medicalTermAttributesSchema = z.object({
  category: z.enum(["anatomy", "procedure", "diagnosis", "drug", "device"]),
  note: z.string().optional().default(""),
});

const measurementAttributesSchema = z.object({
  value: z.number(),
  unit: measurementUnitSchema,
  normalizedValue: z.number(),
});

const baseSpanFields = {
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
};

export const annotationSpanSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CRUD"),
    ...baseSpanFields,
    attributes: crudAttributesSchema,
  }),
  z.object({
    type: z.literal("NUMBER"),
    ...baseSpanFields,
    attributes: numberAttributesSchema,
  }),
  z.object({
    type: z.literal("FORMATTING_COMMAND"),
    ...baseSpanFields,
    attributes: formattingCommandAttributesSchema,
  }),
  z.object({
    type: z.literal("SPELLED_OUT"),
    ...baseSpanFields,
    attributes: spelledOutAttributesSchema,
  }),
  z.object({
    type: z.literal("NAMED_ENTITY"),
    ...baseSpanFields,
    attributes: namedEntityAttributesSchema,
  }),
  z.object({
    type: z.literal("MEDICAL_TERM"),
    ...baseSpanFields,
    attributes: medicalTermAttributesSchema,
  }),
  z.object({
    type: z.literal("MEASUREMENT"),
    ...baseSpanFields,
    attributes: measurementAttributesSchema,
  }),
]);

export type AnnotationSpanInput = z.infer<typeof annotationSpanSchema>;

/**
 * Offsets are validated separately from the Zod shape check, since the
 * valid range depends on the target transcript's length, which Zod alone
 * can't know.
 */
export function validateOffsets(
  startOffset: number,
  endOffset: number,
  textLength: number,
): string | null {
  if (startOffset < 0 || endOffset < 0) return "Offsets must be non-negative";
  if (startOffset >= endOffset)
    return "startOffset must be less than endOffset";
  if (endOffset > textLength) return "endOffset exceeds transcript length";
  return null;
}
