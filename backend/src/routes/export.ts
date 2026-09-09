import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const exportRouter = Router();

// Exports every item that has both audio and a transcript, regardless of
// status, the brief doesn't restrict export to "completed" items, and
// adding a status gate here would be workflow scope the brief explicitly
// says to avoid (see "Out of scope": no review queues).
exportRouter.get("/export", async (_req, res) => {
  const items = await prisma.item.findMany({
    where: {
      audioFileId: { not: null },
      originalTranscript: { not: null },
    },
    include: { audioFile: true, spans: true },
  });

  const lines = items.map((item) => {
    const line = {
      audioReference: item.audioFile!.filename,
      originalTranscript: item.originalTranscript,
      correctedTranscript: item.correctedTranscript,
      spans: item.spans.map((span) => ({
        type: span.type,
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        attributes: span.attributes,
      })),
      recordingConditions: {
        durationSec: item.audioFile!.durationSec,
        sampleRate: item.audioFile!.sampleRate,
        channels: item.audioFile!.channels,
        bitDepth: item.audioFile!.bitDepth,
        // override ?? computed: an annotator's override always wins over
        // the derived suggestion when both exist.
        speechRateWpm: item.speechRateOverride ?? item.speechRateComputed,
        distanceEstimateMeters:
          item.distanceEstimateOverride ?? item.distanceEstimateComputed,
      },
    };
    return JSON.stringify(line);
  });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="gold-standard-export.jsonl"',
  );
  res.send(lines.join("\n"));
});
