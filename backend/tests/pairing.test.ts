import { describe, it, expect } from "vitest";
import {
  validateTranscriptRows,
  pairTranscriptsToAudio,
} from "../src/services/pairing.js";

describe("validateTranscriptRows", () => {
  it("accepts well-formed rows", () => {
    const { validRows, errors } = validateTranscriptRows([
      { path: "audio/a.wav", label: "Hello" },
    ]);
    expect(validRows).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it("rejects non-array input", () => {
    const { validRows, errors } = validateTranscriptRows({ path: "a" });
    expect(validRows).toHaveLength(0);
    expect(errors[0].reason).toMatch(/not a JSON array/);
  });

  it("reports missing fields but keeps good rows", () => {
    const { validRows, errors } = validateTranscriptRows([
      { path: "audio/a.wav", label: "Hello" },
      { path: "audio/b.wav" },
    ]);
    expect(validRows).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it("flags duplicate paths, keeps the first", () => {
    const { validRows, errors } = validateTranscriptRows([
      { path: "audio/a.wav", label: "First" },
      { path: "audio/a.wav", label: "Second" },
    ]);
    expect(validRows).toHaveLength(1);
    expect(validRows[0].label).toBe("First");
    expect(errors[0].reason).toMatch(/Duplicate/);
  });
});

describe("pairTranscriptsToAudio", () => {
  it("matches by basename, ignoring directory prefix", () => {
    const { matched } = pairTranscriptsToAudio(
      [{ path: "audio/a.wav", label: "Hello" }],
      ["a.wav"],
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].audioFilename).toBe("a.wav");
  });

  it("reports unmatched audio without dropping it", () => {
    const { unmatchedAudio } = pairTranscriptsToAudio([], ["orphan.wav"]);
    expect(unmatchedAudio).toEqual(["orphan.wav"]);
  });

  it("reports unmatched transcripts without dropping them", () => {
    const { unmatchedTranscripts } = pairTranscriptsToAudio(
      [{ path: "missing.wav", label: "Hello" }],
      [],
    );
    expect(unmatchedTranscripts).toHaveLength(1);
  });

  it("does not auto-match when two audio files share a basename", () => {
    const { matched, unmatchedAudio, unmatchedTranscripts } =
      pairTranscriptsToAudio(
        [{ path: "audio/dup.wav", label: "Hello" }],
        ["path1/dup.wav", "path2/dup.wav"],
      );
    expect(matched).toHaveLength(0);
    expect(unmatchedAudio).toEqual(["path1/dup.wav", "path2/dup.wav"]);
    expect(unmatchedTranscripts).toHaveLength(1);
  });
});
