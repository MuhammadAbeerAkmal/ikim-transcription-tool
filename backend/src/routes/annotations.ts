import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ClientError } from "../lib/errors.js";
import {
  annotationSpanSchema,
  validateOffsets,
} from "../services/spanValidation.js";

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
      attributes: spanInput.attributes as Prisma.InputJsonValue,
    },
  });

  res.status(201).json({ span });
});

const updateSpanSchema = z.object({
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

  const span = await prisma.annotationSpan.update({
    where: { id },
    data: {
      startOffset,
      endOffset,
      attributes: updates.attributes
        ? (updates.attributes as Prisma.InputJsonValue)
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
