import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma.js";
import { STORAGE_DIR } from "../middleware/upload.js";
import {
  extractMetadata,
  estimateDistance,
} from "../services/audioMetadata.js";
import {
  determineInitialStatus,
  determineAudioOnlyStatus,
} from "../services/itemStatus.js";
import { computeSpeechRate } from "../services/recordingConditions.js";
import { normalizeMeasurement } from "../services/unitNormalization.js";
import type { AnnotationType, Prisma } from "@prisma/client";

function spanFor(
  text: string,
  needle: string,
): { startOffset: number; endOffset: number } {
  const startOffset = text.indexOf(needle);
  if (startOffset === -1) {
    throw new Error(`Seed data bug: "${needle}" not found in transcript`);
  }
  return { startOffset, endOffset: startOffset + needle.length };
}

// Real, committed German speech (synthesized once via Windows SAPI's
// German voice, not generated at seed time) rather than a synthetic
// tone. See demo-assets/README.md and DESIGN.md.
const DEMO_ASSETS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "demo-assets",
);

async function writeDemoAudio(originalFilename: string): Promise<string> {
  const sourcePath = path.join(DEMO_ASSETS_DIR, originalFilename);
  const storedName = `${crypto.randomUUID()}-${originalFilename}`;
  const filePath = path.join(STORAGE_DIR, storedName);
  fs.copyFileSync(sourcePath, filePath);
  return filePath;
}

async function createAudioFile(originalFilename: string, filePath: string) {
  const meta = await extractMetadata(filePath);
  const stat = fs.statSync(filePath);
  return prisma.audioFile.create({
    data: {
      filename: originalFilename,
      path: filePath,
      mimeType: "audio/wav",
      sizeBytes: stat.size,
      durationSec: meta.durationSec,
      sampleRate: meta.sampleRate,
      channels: meta.channels,
      bitDepth: meta.bitDepth,
      metadata: (meta.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}

async function seed() {
  const existing = await prisma.item.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} item(s), skipping seed.`);
    return;
  }

  console.log("Seeding demo data...");

  // --- Item 1: a fully paired, fully tagged example -----------------
  const demo1Path = await writeDemoAudio("op-report-demo.wav");
  const demo1Audio = await createAudioFile("op-report-demo.wav", demo1Path);

  // The audio (op-report-demo.wav, real synthesized German speech) reads
  // this exact text aloud. It opens with the brief's own §2 JSON-example
  // sentences ("Kontrollierte Rueckenlagerung...", "Steriles Abwaschen und
  // Abdecken..."), then the brief's §4.5 worked example dictated sentence
  // verbatim: "Single-Shot-Antibiose mit Cefuroxim eintausendfuenfhundert
  // Milligramm neue Zeile Prolene sechs null fortlaufend", containing
  // exactly the five elements the brief itself names: a MEDICAL_TERM
  // (drug), a MEASUREMENT, a FORMATTING_COMMAND, a second MEDICAL_TERM
  // (device), and a NUMBER. originalTranscript approximates a plausible
  // ASR first-pass (no hyphenation, spoken-out numbers, dropped umlauts);
  // correctedTranscript is the annotator's fix, matching what's spoken.
  const original1 =
    "Kontrollierte Ruckenlagerung des Patienten. Steriles Abwaschen und " +
    "Abdecken des OP Gebietes. Single Shot Antibiose mit Cefuroxim " +
    "eintausendfuenfhundert Milligramm neue Zeile Prolene sechs null " +
    "fortlaufend. Die Operation verlief ohne Komplikationen.";
  const corrected1 =
    "Kontrollierte Rückenlagerung des Patienten. Steriles Abwaschen und " +
    "Abdecken des OP-Gebietes. Single-Shot-Antibiose mit Cefuroxim 1500 mg " +
    "neue Zeile Prolene 6/0 fortlaufend. Die Operation verlief ohne " +
    "Komplikationen.";

  const item1 = await prisma.item.create({
    data: {
      audioFileId: demo1Audio.id,
      originalTranscript: original1,
      correctedTranscript: corrected1,
      transcriptSourcePath: "demo/op-report-demo.txt",
      status: determineInitialStatus(demo1Audio.durationSec),
      annotator: "Demo Annotator",
      speechRateComputed: computeSpeechRate(corrected1, demo1Audio.durationSec),
      distanceEstimateComputed: await estimateDistance(demo1Path).catch(
        () => null,
      ),
    },
  });

  const measurement = normalizeMeasurement(1500, "mg");
  const spans: {
    type: AnnotationType;
    needle: string;
    attributes: Record<string, unknown>;
  }[] = [
    {
      type: "CRUD",
      needle: "Single-Shot-Antibiose",
      attributes: { editType: "correct" },
    },
    {
      type: "MEDICAL_TERM",
      needle: "Cefuroxim",
      attributes: { category: "drug", note: "" },
    },
    {
      type: "MEASUREMENT",
      needle: "1500 mg",
      attributes: {
        value: 1500,
        unit: "mg",
        normalizedValue: measurement.normalizedValue,
      },
    },
    {
      type: "FORMATTING_COMMAND",
      needle: "neue Zeile",
      attributes: { command: "newline", isLiteral: false },
    },
    {
      type: "MEDICAL_TERM",
      needle: "Prolene",
      attributes: { category: "device", note: "" },
    },
    {
      type: "NUMBER",
      needle: "6/0",
      // Matches the brief's own worked example exactly: "sechs null" is
      // classified there as a NUMBER spoken as words, meaning 6/0 - not
      // "digits" despite the digit-like result. See DESIGN.md.
      attributes: { rendering: "words", normalizedValue: 60 },
    },
  ];

  for (const s of spans) {
    const { startOffset, endOffset } = spanFor(corrected1, s.needle);
    await prisma.annotationSpan.create({
      data: {
        itemId: item1.id,
        type: s.type,
        startOffset,
        endOffset,
        attributes: s.attributes as Prisma.InputJsonValue,
      },
    });
  }

  // --- Item 2: a short clip, to show the 15s auto-reject rule live --
  const demo2Path = await writeDemoAudio("too-short-clip.wav");
  const demo2Audio = await createAudioFile("too-short-clip.wav", demo2Path);
  await prisma.item.create({
    data: {
      audioFileId: demo2Audio.id,
      status: determineAudioOnlyStatus(demo2Audio.durationSec),
      distanceEstimateComputed: await estimateDistance(demo2Path).catch(
        () => null,
      ),
    },
  });

  // --- Item 3: audio waiting on a transcript, for Manual Pairing -----
  const demo3Path = await writeDemoAudio("unassigned-recording.wav");
  const demo3Audio = await createAudioFile(
    "unassigned-recording.wav",
    demo3Path,
  );
  await prisma.item.create({
    data: {
      audioFileId: demo3Audio.id,
      status: determineAudioOnlyStatus(demo3Audio.durationSec),
      distanceEstimateComputed: await estimateDistance(demo3Path).catch(
        () => null,
      ),
    },
  });

  console.log("Seed complete: 3 demo items created.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
