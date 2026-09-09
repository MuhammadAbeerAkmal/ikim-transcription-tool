export function computeSpeechRate(
  transcript: string,
  durationSec: number,
): number {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const durationMinutes = durationSec / 60;
  if (durationMinutes <= 0) return 0;
  return wordCount / durationMinutes;
}
