import type { ItemStatus } from "@prisma/client";

export const REJECTION_THRESHOLD_SECONDS = 15;

export function determineInitialStatus(durationSec: number): ItemStatus {
  return durationSec <= REJECTION_THRESHOLD_SECONDS ? "REJECTED" : "PENDING";
}

export function determineAudioOnlyStatus(durationSec: number): ItemStatus {
  return durationSec <= REJECTION_THRESHOLD_SECONDS ? "REJECTED" : "UNMATCHED";
}
