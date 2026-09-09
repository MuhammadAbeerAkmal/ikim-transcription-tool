import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

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
    .enum(["duration_asc", "duration_desc", "createdAt_asc", "createdAt_desc"])
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
  speechRateOverride: z.number().optional(),
  distanceEstimateOverride: z.number().optional(),
});

itemsRouter.patch("/items/:id", async (req, res) => {
  const updates = updateItemSchema.parse(req.body);
  const item = await prisma.item.update({
    where: { id: req.params.id },
    data: updates,
  });
  res.json({ item });
});
