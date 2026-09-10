import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ClientError } from "../lib/errors.js";
import { determineAudioOnlyStatus } from "../services/itemStatus.js";

export const itemsRouter = Router();

const statusEnum = z.enum([
  "UNMATCHED",
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
]);

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  sort: z
    .enum([
      "duration_asc",
      "duration_desc",
      "createdAt_asc",
      "createdAt_desc",
      "status_asc",
      "status_desc",
    ])
    .optional(),
});

itemsRouter.get("/items", async (req, res) => {
  const { status, sort } = listQuerySchema.parse(req.query);

  // Only audio-bearing items are real work-queue entries. A transcript-only
  // orphan has no filename or duration to show in a queue built around
  // those columns (brief 4.2). Those stay a pairing concern, surfaced via
  // the ingest endpoints instead.
  const where: Prisma.ItemWhereInput = { audioFileId: { not: null } };
  if (status) where.status = status;

  let orderBy: Prisma.ItemOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "duration_asc") orderBy = { audioFile: { durationSec: "asc" } };
  if (sort === "duration_desc")
    orderBy = { audioFile: { durationSec: "desc" } };
  if (sort === "createdAt_asc") orderBy = { createdAt: "asc" };
  if (sort === "createdAt_desc") orderBy = { createdAt: "desc" };
  if (sort === "status_asc") orderBy = { status: "asc" };
  if (sort === "status_desc") orderBy = { status: "desc" };

  const items = await prisma.item.findMany({
    where,
    orderBy,
    include: { audioFile: true },
  });

  res.json({
    items: items.map((item) => ({
      id: item.id,
      filename: item.audioFile?.filename ?? null,
      durationSec: item.audioFile?.durationSec ?? null,
      status: item.status,
      annotator: item.annotator,
    })),
  });
});

itemsRouter.get("/items/:id", async (req, res) => {
  const item = await prisma.item.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { audioFile: true, spans: true },
  });
  res.json({ item });
});

const updateItemSchema = z.object({
  correctedTranscript: z.string().optional(),
  annotator: z.string().optional(),
  status: statusEnum.optional(),
  // .nullable() matters here: an annotator clearing an override (going
  // back to the computed suggestion) sends null explicitly, which is
  // different from omitting the field entirely (leave it as-is).
  speechRateOverride: z.number().nullable().optional(),
  distanceEstimateOverride: z.number().nullable().optional(),
});

itemsRouter.patch("/items/:id", async (req, res) => {
  const updates = updateItemSchema.parse(req.body);

  const existing = await prisma.item.findUniqueOrThrow({
    where: { id: req.params.id },
  });

  const transcriptChanged =
    updates.correctedTranscript !== undefined &&
    updates.correctedTranscript !== existing.correctedTranscript;

  // Editing the transcript invalidates existing span offsets. They were
  // recorded against the old text, and a real shift-on-edit would need a
  // proper diff (and still be ambiguous for edits landing inside a span).
  // Rather than leave spans silently pointing at the wrong substring in
  // the exported data, clear them and let the annotator re-tag. Done in
  // a transaction so the transcript update and span clear land together.
  const item = await prisma.$transaction(async (tx) => {
    if (transcriptChanged) {
      await tx.annotationSpan.deleteMany({ where: { itemId: req.params.id } });
    }
    return tx.item.update({
      where: { id: req.params.id },
      data: updates,
      include: { spans: true },
    });
  });

  res.json({ item, spansInvalidated: transcriptChanged });
});

itemsRouter.post("/items/:id/unpair", async (req, res) => {
  const existing = await prisma.item.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { audioFile: true },
  });

  if (!existing.audioFileId || !existing.originalTranscript) {
    throw new ClientError(`Item ${req.params.id} is not currently paired`);
  }

  // Spans reference offsets into the corrected transcript's text, not
  // the audio, so they stay with the transcript side of the split. That
  // means the *original* row (keeping its id, transcripts, and spans)
  // becomes the transcript-only item, and a brand-new row becomes the
  // audio-only item.
  //
  // Order matters: audioFileId is unique, so the old row's link must be
  // cleared before the new row can claim that same audioFileId.
  const [transcriptOnlyItem, audioOnlyItem] = await prisma.$transaction(
    async (tx) => {
      const transcriptOnlyItem = await tx.item.update({
        where: { id: existing.id },
        data: {
          audioFileId: null,
          status: "UNMATCHED",
          speechRateComputed: null,
          speechRateOverride: null,
          distanceEstimateComputed: null,
          distanceEstimateOverride: null,
          distanceEstimateMethod: null,
        },
        include: { spans: true },
      });

      const audioOnlyItem = await tx.item.create({
        data: {
          audioFileId: existing.audioFileId!,
          status: determineAudioOnlyStatus(existing.audioFile!.durationSec),
          distanceEstimateComputed: existing.distanceEstimateComputed,
          distanceEstimateOverride: existing.distanceEstimateOverride,
          distanceEstimateMethod: existing.distanceEstimateMethod,
        },
        include: { audioFile: true },
      });

      return [transcriptOnlyItem, audioOnlyItem];
    },
  );

  res.json({ transcriptOnlyItem, audioOnlyItem });
});

itemsRouter.delete("/items/:id", async (req, res) => {
  const item = await prisma.item.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { audioFile: true },
  });

  // Deleting the Item cascades to its spans automatically (schema's
  // onDelete: Cascade). The AudioFile is a separate row, deleted here
  // explicitly. Leaving it behind would be an orphaned row with no
  // Item pointing at it, and its file would linger on disk forever.
  await prisma.$transaction(async (tx) => {
    await tx.item.delete({ where: { id: item.id } });
    if (item.audioFileId) {
      await tx.audioFile.delete({ where: { id: item.audioFileId } });
    }
  });

  if (item.audioFile) {
    await fs.unlink(item.audioFile.path).catch(() => {
      // File already gone or unreadable. Not worth failing the request
      // over, the database rows are already cleaned up correctly.
    });
  }

  res.status(204).send();
});
