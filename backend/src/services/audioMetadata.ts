import { parseFile } from "music-metadata";
import ffmpeg from "fluent-ffmpeg";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface AudioMetadata {
  durationSec: number;
  sampleRate: number | null;
  channels: number | null;
  bitDepth: number | null;
  metadata: Record<string, unknown> | null;
}

export async function extractMetadata(
  filePath: string,
): Promise<AudioMetadata> {
  const meta = await parseFile(filePath);
  return {
    durationSec: meta.format.duration ?? 0,
    sampleRate: meta.format.sampleRate ?? null,
    channels: meta.format.numberOfChannels ?? null,
    bitDepth: meta.format.bitsPerSample ?? null,
    metadata: Object.keys(meta.native).length > 0 ? meta.native : null,
  };
}

function measureVolumeLevels(
  filePath: string,
): Promise<{ meanVolumeDb: number }> {
  return new Promise((resolve, reject) => {
    let stderrOutput = "";
    ffmpeg(filePath)
      .audioFilters("volumedetect")
      .format("null")
      .output(process.platform === "win32" ? "NUL" : "/dev/null")
      .on("stderr", (line: string) => {
        stderrOutput += line + "\n";
      })
      .on("end", () => {
        const meanMatch = stderrOutput.match(
          /mean_volume:\s*(-?\d+(\.\d+)?)\s*dB/,
        );
        if (!meanMatch) {
          reject(new Error("Could not parse ffmpeg volumedetect output"));
          return;
        }
        resolve({ meanVolumeDb: parseFloat(meanMatch[1]) });
      })
      .on("error", reject)
      .run();
  });
}

const CLOSE_REFERENCE_DB = -10; // very close to the microphone
const FAR_REFERENCE_DB = -40; // far from the microphone
const CLOSE_DISTANCE_M = 0.1;
const FAR_DISTANCE_M = 2.0;

export function estimateDistanceFromVolume(meanVolumeDb: number): number {
  const clamped = Math.max(
    FAR_REFERENCE_DB,
    Math.min(CLOSE_REFERENCE_DB, meanVolumeDb),
  );
  const t =
    (CLOSE_REFERENCE_DB - clamped) / (CLOSE_REFERENCE_DB - FAR_REFERENCE_DB);
  return CLOSE_DISTANCE_M + t * (FAR_DISTANCE_M - CLOSE_DISTANCE_M);
}

export async function estimateDistance(filePath: string): Promise<number> {
  const { meanVolumeDb } = await measureVolumeLevels(filePath);
  return estimateDistanceFromVolume(meanVolumeDb);
}
