import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import {
  annotationSpanSchema,
  validateOffsets,
} from "../src/services/spanValidation.js";

describe("annotationSpanSchema", () => {
  it("accepts a valid MEASUREMENT span", () => {
    const result = annotationSpanSchema.safeParse({
      type: "MEASUREMENT",
      startOffset: 0,
      endOffset: 10,
      attributes: { value: 1500, unit: "mg", normalizedValue: 1.5 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects attributes that don't match the declared type", () => {
    const result = annotationSpanSchema.safeParse({
      type: "MEASUREMENT",
      startOffset: 0,
      endOffset: 10,
      attributes: { resolvedWord: "wrong shape for this type" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown annotation type", () => {
    const result = annotationSpanSchema.safeParse({
      type: "NOT_A_REAL_TYPE",
      startOffset: 0,
      endOffset: 10,
      attributes: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("validateOffsets", () => {
  it("rejects startOffset >= endOffset", () => {
    expect(validateOffsets(5, 5, 100)).toMatch(/startOffset/);
  });

  it("rejects endOffset beyond the transcript length", () => {
    expect(validateOffsets(0, 200, 100)).toMatch(/exceeds/);
  });

  it("accepts valid offsets", () => {
    expect(validateOffsets(0, 10, 100)).toBeNull();
  });
});

describe("span persistence (real database)", () => {
  let itemId: string;
  let audioFileId: string;

  beforeAll(async () => {
    const audioFile = await prisma.audioFile.create({
      data: {
        filename: "span-persistence-test.wav",
        path: "/tmp/span-persistence-test.wav",
        mimeType: "audio/wav",
        sizeBytes: 1000,
        durationSec: 20,
      },
    });
    audioFileId = audioFile.id;

    const item = await prisma.item.create({
      data: {
        audioFileId: audioFile.id,
        originalTranscript: "Cefuroxim eintausendfuenfhundert Milligramm",
        correctedTranscript: "Cefuroxim eintausendfuenfhundert Milligramm",
        status: "PENDING",
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.annotationSpan.deleteMany({ where: { itemId } });
    await prisma.item.deleteMany({ where: { id: itemId } });
    await prisma.audioFile.deleteMany({ where: { id: audioFileId } });
  });

  it("persists a span and round-trips its fields exactly", async () => {
    const created = await prisma.annotationSpan.create({
      data: {
        itemId,
        type: "MEDICAL_TERM",
        startOffset: 0,
        endOffset: 9,
        attributes: { category: "drug", note: "" },
      },
    });

    const fetched = await prisma.annotationSpan.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(fetched.type).toBe("MEDICAL_TERM");
    expect(fetched.startOffset).toBe(0);
    expect(fetched.endOffset).toBe(9);
    expect(fetched.attributes).toEqual({ category: "drug", note: "" });
  });

  it("allows overlapping spans on the same item (deliberately unenforced)", async () => {
    const spanA = await prisma.annotationSpan.create({
      data: {
        itemId,
        type: "MEDICAL_TERM",
        startOffset: 0,
        endOffset: 9,
        attributes: { category: "drug", note: "" },
      },
    });
    const spanB = await prisma.annotationSpan.create({
      data: {
        itemId,
        type: "NUMBER",
        startOffset: 5,
        endOffset: 15,
        attributes: { rendering: "digits", normalizedValue: 1500 },
      },
    });

    const spans = await prisma.annotationSpan.findMany({ where: { itemId } });
    expect(spans.map((s) => s.id)).toEqual(
      expect.arrayContaining([spanA.id, spanB.id]),
    );
  });

  it("deletes a span persistently", async () => {
    const created = await prisma.annotationSpan.create({
      data: {
        itemId,
        type: "CRUD",
        startOffset: 0,
        endOffset: 5,
        attributes: { editType: "correct" },
      },
    });

    await prisma.annotationSpan.delete({ where: { id: created.id } });

    const found = await prisma.annotationSpan.findUnique({
      where: { id: created.id },
    });
    expect(found).toBeNull();
  });

  it("cascades span deletion when the parent item is deleted", async () => {
    const audioFile = await prisma.audioFile.create({
      data: {
        filename: "cascade-test.wav",
        path: "/tmp/cascade-test.wav",
        mimeType: "audio/wav",
        sizeBytes: 500,
        durationSec: 20,
      },
    });
    const tempItem = await prisma.item.create({
      data: {
        audioFileId: audioFile.id,
        originalTranscript: "test",
        correctedTranscript: "test",
        status: "PENDING",
      },
    });
    const span = await prisma.annotationSpan.create({
      data: {
        itemId: tempItem.id,
        type: "CRUD",
        startOffset: 0,
        endOffset: 4,
        attributes: { editType: "correct" },
      },
    });

    await prisma.item.delete({ where: { id: tempItem.id } });

    const found = await prisma.annotationSpan.findUnique({
      where: { id: span.id },
    });
    expect(found).toBeNull();

    await prisma.audioFile.delete({ where: { id: audioFile.id } });
  });
});
