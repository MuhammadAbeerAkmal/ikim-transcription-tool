import { z } from "zod";

export const transcriptRowSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
});

export type TranscriptRow = z.infer<typeof transcriptRowSchema>;

export interface RowValidationError {
  index: number;
  reason: string;
}

export interface ValidationResult {
  validRows: TranscriptRow[];
  errors: RowValidationError[];
}

export function validateTranscriptRows(input: unknown): ValidationResult {
  if (!Array.isArray(input)) {
    return {
      validRows: [],
      errors: [{ index: -1, reason: "Input is not a JSON array" }],
    };
  }

  const errors: RowValidationError[] = [];
  const validRows: TranscriptRow[] = [];
  const seenPaths = new Set<string>();

  input.forEach((row, index) => {
    const result = transcriptRowSchema.safeParse(row);
    if (!result.success) {
      errors.push({
        index,
        reason: result.error.issues.map((i) => i.message).join("; "),
      });
      return;
    }
    if (seenPaths.has(result.data.path)) {
      errors.push({ index, reason: `Duplicate path: ${result.data.path}` });
      return;
    }
    seenPaths.add(result.data.path);
    validRows.push(result.data);
  });

  return { validRows, errors };
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export interface MatchedPair {
  audioFilename: string;
  transcriptPath: string;
  label: string;
}

export interface PairingResult {
  matched: MatchedPair[];
  unmatchedAudio: string[];
  unmatchedTranscripts: TranscriptRow[];
}

export function pairTranscriptsToAudio(
  transcriptRows: TranscriptRow[],
  audioFilenames: string[],
): PairingResult {
  // If two audio files share a basename, we can't safely tell which one a
  // transcript row is meant for so excluding both from auto-matching (rather
  // than letting a Map silently keep only the last one) means neither gets
  // dropped; both surface in unmatchedAudio for the user to pair manually.
  const basenameCounts = new Map<string, number>();
  for (const f of audioFilenames) {
    const key = basename(f);
    basenameCounts.set(key, (basenameCounts.get(key) ?? 0) + 1);
  }

  const audioByBasename = new Map<string, string>();
  for (const f of audioFilenames) {
    const key = basename(f);
    if (basenameCounts.get(key) === 1) {
      audioByBasename.set(key, f);
    }
  }

  const matchedAudioFilenames = new Set<string>();
  const matched: MatchedPair[] = [];
  const unmatchedTranscripts: TranscriptRow[] = [];

  for (const row of transcriptRows) {
    const audioFilename = audioByBasename.get(basename(row.path));
    if (audioFilename) {
      matched.push({
        audioFilename,
        transcriptPath: row.path,
        label: row.label,
      });
      matchedAudioFilenames.add(audioFilename);
    } else {
      unmatchedTranscripts.push(row);
    }
  }

  const unmatchedAudio = audioFilenames.filter(
    (f) => !matchedAudioFilenames.has(f),
  );

  return { matched, unmatchedAudio, unmatchedTranscripts };
}
