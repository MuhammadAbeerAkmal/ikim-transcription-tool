const BASE_URL = "http://localhost:4000/api";

export type ItemStatus =
  | "UNMATCHED"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED";

export type AnnotationType =
  | "CRUD"
  | "NUMBER"
  | "FORMATTING_COMMAND"
  | "SPELLED_OUT"
  | "NAMED_ENTITY"
  | "MEDICAL_TERM"
  | "MEASUREMENT";

export interface AudioFile {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  sampleRate: number | null;
  channels: number | null;
  bitDepth: number | null;
  metadata: unknown;
  createdAt: string;
}

export interface AnnotationSpan {
  id: string;
  itemId: string;
  type: AnnotationType;
  startOffset: number;
  endOffset: number;
  attributes: Record<string, unknown>;
  createdAt: string;
}

export interface Item {
  id: string;
  audioFileId: string | null;
  originalTranscript: string | null;
  correctedTranscript: string | null;
  transcriptSourcePath: string | null;
  status: ItemStatus;
  annotator: string | null;
  speechRateComputed: number | null;
  speechRateOverride: number | null;
  distanceEstimateComputed: number | null;
  distanceEstimateOverride: number | null;
  distanceEstimateMethod: string | null;
  createdAt: string;
  updatedAt: string;
  audioFile?: AudioFile;
  spans?: AnnotationSpan[];
}

export interface QueueItem {
  id: string;
  filename: string | null;
  durationSec: number | null;
  status: ItemStatus;
  annotator: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : undefined,
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function uploadAudio(files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  return request<{
    created: { audioFile: AudioFile; item: Item }[];
    failed: { filename: string; reason: string }[];
  }>("/audio", { method: "POST", body: formData });
}

export function submitTranscripts(
  rows: { path: string; label: string }[] | { path: string; label: string },
) {
  return request<{
    matched: Item[];
    unmatchedAudio: string[];
    unmatchedTranscripts: Item[];
    rowErrors: { index: number; reason: string }[];
  }>("/transcripts", { method: "POST", body: JSON.stringify(rows) });
}

export function manualPair(audioItemId: string, transcriptItemId: string) {
  return request<{ item: Item }>("/pairing/manual", {
    method: "POST",
    body: JSON.stringify({ audioItemId, transcriptItemId }),
  });
}

export interface UnmatchedAudioItem {
  id: string;
  filename: string;
  durationSec: number;
}

export interface UnmatchedTranscriptItem {
  id: string;
  transcriptSourcePath: string | null;
  originalTranscript: string;
}

export function getUnmatchedPairs() {
  return request<{
    unmatchedAudioItems: UnmatchedAudioItem[];
    unmatchedTranscriptItems: UnmatchedTranscriptItem[];
  }>("/pairing/unmatched");
}

export function listItems(params: { status?: ItemStatus; sort?: string } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  const qs = query.toString();
  return request<{ items: QueueItem[] }>(`/items${qs ? `?${qs}` : ""}`);
}

export function getItem(id: string) {
  return request<{ item: Item }>(`/items/${id}`);
}

export function updateItem(
  id: string,
  updates: Partial<
    Pick<
      Item,
      | "correctedTranscript"
      | "annotator"
      | "status"
      | "speechRateOverride"
      | "distanceEstimateOverride"
    >
  >,
) {
  return request<{ item: Item; spansInvalidated: boolean }>(`/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function createSpan(
  itemId: string,
  span: {
    type: AnnotationType;
    startOffset: number;
    endOffset: number;
    attributes: Record<string, unknown>;
  },
) {
  return request<{ span: AnnotationSpan }>(`/items/${itemId}/spans`, {
    method: "POST",
    body: JSON.stringify(span),
  });
}

export function updateSpan(
  id: string,
  updates: Partial<
    Pick<AnnotationSpan, "startOffset" | "endOffset" | "attributes">
  >,
) {
  return request<{ span: AnnotationSpan }>(`/spans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteSpan(id: string) {
  return request<void>(`/spans/${id}`, { method: "DELETE" });
}

export function exportUrl() {
  return `${BASE_URL}/export`;
}
