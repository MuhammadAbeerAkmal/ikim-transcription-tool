import { Router } from "express";
import { z } from "zod";
import { uploadAudio } from "../middleware/upload.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { ClientError } from "../lib/errors.js";
import type { AudioFile, Item } from "@prisma/client";

import {
  extractMetadata,
  estimateDistance,
} from "../services/audioMetadata.js";
import {
  determineInitialStatus,
  determineAudioOnlyStatus,
} from "../services/itemStatus.js";
import {
  validateTranscriptRows,
  pairTranscriptsToAudio,
} from "../services/pairing.js";
import { computeSpeechRate } from "../services/recordingConditions.js";

export const ingestRouter = Router();

ingestRouter.post("/audio", uploadAudio.array("files"), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const created: Array<{ audioFile: AudioFile; item: Item }> = [];
  const failed: Array<{ filename: string; reason: string }> = [];

  for (const file of files) {
    try {
      const metadata = await extractMetadata(file.path);
      const distanceEstimateComputed = await estimateDistance(file.path);

      const audioFile = await prisma.audioFile.create({
        data: {
          filename: file.originalname,
          path: file.path,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          durationSec: metadata.durationSec,
          sampleRate: metadata.sampleRate,
          channels: metadata.channels,
          bitDepth: metadata.bitDepth,
          metadata: (metadata.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      const item = await prisma.item.create({
        data: {
          audioFileId: audioFile.id,
          status: determineAudioOnlyStatus(metadata.durationSec),
          distanceEstimateComputed,
        },
      });

      created.push({ audioFile, item });
    } catch (err) {
      failed.push({
        filename: file.originalname,
        reason:
          err instanceof Error ? err.message : "Unable to process this file",
      });
    }
  }

  // 201 only makes sense if something was actually created; an all-failed
  // batch is a client-side problem (bad files), not a successful creation.
  res.status(created.length > 0 ? 201 : 400).json({ created, failed });
});

const transcriptsRequestSchema = z.union([
  z.array(z.unknown()),
  z.object({ path: z.string(), label: z.string() }),
]);

ingestRouter.post("/transcripts", async (req, res) => {
  const parsed = transcriptsRequestSchema.parse(req.body);
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  const { validRows, errors } = validateTranscriptRows(rows);

  // status: "UNMATCHED" alone is not enough, transcript-only orphan items
  // also get that status but have no audioFile, which would crash the
  // `i.audioFile!.filename` map below. Filter explicitly for audio-bearing rows.
  const openAudioItems = await prisma.item.findMany({
    where: { status: "UNMATCHED", audioFileId: { not: null } },
    include: { audioFile: true },
  });
  const audioFilenames = openAudioItems.map((i) => i.audioFile!.filename);

  const { matched, unmatchedAudio, unmatchedTranscripts } =
    pairTranscriptsToAudio(validRows, audioFilenames);

  const updated = [];
  for (const pair of matched) {
    const item = openAudioItems.find(
      (i) => i.audioFile!.filename === pair.audioFilename,
    )!;
    updated.push(
      await prisma.item.update({
        where: { id: item.id },
        data: {
          originalTranscript: pair.label,
          correctedTranscript: pair.label,
          transcriptSourcePath: pair.transcriptPath,
          status: determineInitialStatus(item.audioFile!.durationSec),
          speechRateComputed: computeSpeechRate(
            pair.label,
            item.audioFile!.durationSec,
          ),
        },
      }),
    );
  }

  const createdUnmatched = [];
  for (const row of unmatchedTranscripts) {
    createdUnmatched.push(
      await prisma.item.create({
        data: {
          originalTranscript: row.label,
          correctedTranscript: row.label,
          transcriptSourcePath: row.path,
          status: "UNMATCHED",
        },
      }),
    );
  }

  res.status(201).json({
    matched: updated,
    unmatchedAudio,
    unmatchedTranscripts: createdUnmatched,
    rowErrors: errors,
  });
});

const manualPairSchema = z.object({
  audioItemId: z.string(),
  transcriptItemId: z.string(),
});

ingestRouter.post("/pairing/manual", async (req, res) => {
  const { audioItemId, transcriptItemId } = manualPairSchema.parse(req.body);

  const [audioItem, transcriptItem] = await Promise.all([
    prisma.item.findUniqueOrThrow({
      where: { id: audioItemId },
      include: { audioFile: true },
    }),
    prisma.item.findUniqueOrThrow({ where: { id: transcriptItemId } }),
  ]);

  if (!audioItem.audioFile) {
    throw new ClientError(
      `Invalid pairing: audioItemId ${audioItemId} has no audio file attached`,
    );
  }
  if (!transcriptItem.originalTranscript || transcriptItem.audioFileId) {
    throw new ClientError(
      `Invalid pairing: transcriptItemId ${transcriptItemId} is not a transcript-only item`,
    );
  }

  const merged = await prisma.item.update({
    where: { id: audioItem.id },
    data: {
      originalTranscript: transcriptItem.originalTranscript,
      correctedTranscript: transcriptItem.correctedTranscript,
      transcriptSourcePath: transcriptItem.transcriptSourcePath,
      status: determineInitialStatus(audioItem.audioFile!.durationSec),
      speechRateComputed: computeSpeechRate(
        transcriptItem.originalTranscript,
        audioItem.audioFile!.durationSec,
      ),
    },
  });

  await prisma.item.delete({ where: { id: transcriptItem.id } });

  res.json({ item: merged });
});
