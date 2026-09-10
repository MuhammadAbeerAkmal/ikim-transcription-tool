import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ClientError } from "../lib/errors.js";
import {
  annotationSpanSchema,
  validateOffsets,
  type AnnotationSpanInput,
} from "../services/spanValidation.js";
import {
  normalizeMeasurement,
  type MeasurementUnit,
} from "../services/unitNormalization.js";

export const annotationsRouter = Router();

annotationsRouter.post("/items/:itemId/spans", async (req, res) => {
  const { itemId } = req.params;
  const spanInput = annotationSpanSchema.parse(req.body);

  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });

  if (!item.correctedTranscript) {
    throw new ClientError(
      `Item ${itemId} has no transcript yet so cannot annotate it`,
    );
  }

  const offsetError = validateOffsets(
    spanInput.startOffset,
    spanInput.endOffset,
    item.correctedTranscript.length,
  );
  if (offsetError) {
    throw new ClientError(offsetError);
  }

  const span = await prisma.annotationSpan.create({
    data: {
      itemId: item.id,
      type: spanInput.type,
      startOffset: spanInput.startOffset,
      endOffset: spanInput.endOffset,
      attributes: resolveAttributes(spanInput) as Prisma.InputJsonValue,
    },
  });

  res.status(201).json({ span });
});

// Never trust a client-supplied normalizedValue for MEASUREMENT spans.
// Recompute it server-side from value+unit, same principle as duration
// always being read server-side rather than accepted from the client.
function resolveAttributes(
  spanInput: AnnotationSpanInput,
): Record<string, unknown> {
  if (spanInput.type !== "MEASUREMENT") return spanInput.attributes;
  const { normalizedValue } = normalizeMeasurement(
    spanInput.attributes.value,
    spanInput.attributes.unit as MeasurementUnit,
  );
  return { ...spanInput.attributes, normalizedValue };
}

const annotationTypeEnum = z.enum([
  "CRUD",
  "NUMBER",
  "FORMATTING_COMMAND",
  "SPELLED_OUT",
  "NAMED_ENTITY",
  "MEDICAL_TERM",
  "MEASUREMENT",
]);

const updateSpanSchema = z.object({
  type: annotationTypeEnum.optional(),
  startOffset: z.number().int().min(0).optional(),
  endOffset: z.number().int().min(0).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

annotationsRouter.patch("/spans/:id", async (req, res) => {
  const { id } = req.params;
  const updates = updateSpanSchema.parse(req.body);

  const existing = await prisma.annotationSpan.findUniqueOrThrow({
    where: { id },
    include: { item: true },
  });

  const startOffset = updates.startOffset ?? existing.startOffset;
  const endOffset = updates.endOffset ?? existing.endOffset;

  const offsetError = validateOffsets(
    startOffset,
    endOffset,
    existing.item.correctedTranscript?.length ?? 0,
  );
  if (offsetError) {
    throw new ClientError(offsetError);
  }

  // A type change ships new attributes matching that type's shape (the
  // frontend always sends both together), so the *new* type, not the
  // span's existing one, decides whether MEASUREMENT normalization runs.
  const effectiveType = updates.type ?? existing.type;
  let attributes = updates.attributes;
  if (
    effectiveType === "MEASUREMENT" &&
    attributes &&
    typeof attributes.value === "number" &&
    typeof attributes.unit === "string"
  ) {
    const { normalizedValue } = normalizeMeasurement(
      attributes.value,
      attributes.unit as MeasurementUnit,
    );
    attributes = { ...attributes, normalizedValue };
  }

  const span = await prisma.annotationSpan.update({
    where: { id },
    data: {
      type: updates.type,
      startOffset,
      endOffset,
      attributes: attributes
        ? (attributes as Prisma.InputJsonValue)
        : undefined,
    },
  });

  res.json({ span });
});

annotationsRouter.delete("/spans/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.annotationSpan.delete({ where: { id } });
  res.status(204).send();
});
