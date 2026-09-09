<script setup lang="ts">
import { ref, reactive } from "vue";
import {
  uploadAudio,
  submitTranscripts,
  type AudioFile,
  type Item,
} from "../api/client";
import { humanize } from "../utils/humanize";

const selectedFiles = ref<File[]>([]);
const uploading = ref(false);
const error = ref<string | null>(null);

const uploadResult = ref<{
  created: { audioFile: AudioFile; item: Item }[];
  failed: { filename: string; reason: string }[];
} | null>(null);

// Per-item transcript text + save state, keyed by item id. Lets each
// uploaded file get its own simple "type the transcript, save it" box,
// per the brief's "allow pasting a transcript for one item directly in
// the UI" requirement, instead of forcing everything through JSON.
const transcriptDrafts = reactive<Record<string, string>>({});
const savingItem = ref<string | null>(null);
const savedItems = reactive<Record<string, boolean>>({});

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFiles.value = input.files ? Array.from(input.files) : [];
}

async function handleUpload() {
  if (selectedFiles.value.length === 0) return;
  uploading.value = true;
  error.value = null;
  try {
    uploadResult.value = await uploadAudio(selectedFiles.value);
    for (const c of uploadResult.value.created) {
      transcriptDrafts[c.item.id] = "";
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Upload failed";
  } finally {
    uploading.value = false;
  }
}

async function saveTranscript(filename: string, itemId: string) {
  const text = transcriptDrafts[itemId]?.trim();
  if (!text) return;
  savingItem.value = itemId;
  error.value = null;
  try {
    await submitTranscripts({ path: filename, label: text });
    savedItems[itemId] = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to save transcript";
  } finally {
    savingItem.value = null;
  }
}

// Secondary, advanced path: bulk JSON import for pipeline-style batches.
const transcriptJson = ref("");
const submittingBulk = ref(false);
const bulkResult = ref<{
  matched: Item[];
  unmatchedAudio: string[];
  unmatchedTranscripts: Item[];
  rowErrors: { index: number; reason: string }[];
} | null>(null);

async function handleBulkSubmit() {
  error.value = null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(transcriptJson.value);
  } catch {
    error.value = "That's not valid JSON. Check the format and try again.";
    return;
  }
  submittingBulk.value = true;
  try {
    bulkResult.value = await submitTranscripts(
      parsed as { path: string; label: string }[],
    );
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Transcript submission failed";
  } finally {
    submittingBulk.value = false;
  }
}
</script>

<template>
  <div class="ingest">
    <h2 class="page-title">Upload</h2>

    <section class="card">
      <h3>1. Upload audio</h3>
      <p class="hint">Accepts .wav, .mp3, .m4a. Multiple files at once.</p>
      <div class="upload-row">
        <input
          type="file"
          multiple
          accept=".wav,.mp3,.m4a"
          @change="onFileChange"
        />
        <button
          :disabled="uploading || selectedFiles.length === 0"
          @click="handleUpload"
        >
          {{
            uploading
              ? "Uploading…"
              : `Upload ${selectedFiles.length || ""} file(s)`
          }}
        </button>
      </div>

      <div v-if="uploadResult?.failed.length" class="result">
        <p class="error-text">
          {{ uploadResult.failed.length }} file(s) failed:
        </p>
        <ul>
          <li
            v-for="f in uploadResult.failed"
            :key="f.filename"
            class="error-text"
          >
            {{ f.filename }} - {{ f.reason }}
          </li>
        </ul>
      </div>
    </section>

    <section v-if="uploadResult && uploadResult.created.length" class="card">
      <h3>2. Add a transcript for each file</h3>
      <p class="hint">
        Type or paste the AI's first-pass transcript for each recording, then
        save it. Recordings marked "Rejected" are too short to need one.
      </p>

      <div v-for="c in uploadResult.created" :key="c.item.id" class="file-row">
        <div class="file-info">
          <strong>{{ c.audioFile.filename }}</strong>
          <span class="duration"
            >{{ c.audioFile.durationSec.toFixed(1) }}s</span
          >
          <span :class="['pill', c.item.status.toLowerCase()]">{{
            humanize(c.item.status)
          }}</span>
        </div>

        <p v-if="c.item.status === 'REJECTED'" class="hint no-margin">
          Too short to route to an annotator. No transcript needed.
        </p>
        <template v-else>
          <textarea
            v-model="transcriptDrafts[c.item.id]"
            rows="2"
            placeholder="Type or paste the transcript for this recording…"
          ></textarea>
          <div class="save-row">
            <button
              :disabled="
                savingItem === c.item.id || !transcriptDrafts[c.item.id]?.trim()
              "
              @click="saveTranscript(c.audioFile.filename, c.item.id)"
            >
              {{ savingItem === c.item.id ? "Saving…" : "Save transcript" }}
            </button>
            <span v-if="savedItems[c.item.id]" class="saved-badge"
              >Saved. Now in the work queue</span
            >
          </div>
        </template>
      </div>
    </section>

    <details class="card advanced">
      <summary>Advanced: bulk import via JSON</summary>
      <p class="hint">
        For importing many transcripts at once (e.g. from an existing pipeline).
        Paste a JSON array of
        <code>{ "path": "...", "label": "..." }</code> objects.
      </p>
      <textarea
        v-model="transcriptJson"
        rows="6"
        class="mono"
        placeholder='[{"path": "audio/880_NTX.wav", "label": "Kontrollierte Rueckenlagerung..."}]'
      ></textarea>
      <button
        :disabled="submittingBulk || !transcriptJson"
        @click="handleBulkSubmit"
      >
        {{ submittingBulk ? "Submitting…" : "Submit transcripts" }}
      </button>

      <div v-if="bulkResult" class="result">
        <p v-if="bulkResult.matched.length">
          <strong>{{ bulkResult.matched.length }}</strong> matched and paired.
        </p>
        <p v-if="bulkResult.unmatchedAudio.length" class="warn-text">
          {{ bulkResult.unmatchedAudio.length }} audio file(s) still waiting for
          a transcript.
        </p>
        <p v-if="bulkResult.unmatchedTranscripts.length" class="warn-text">
          {{ bulkResult.unmatchedTranscripts.length }} transcript row(s) had no
          matching audio. Saved for manual pairing.
        </p>
        <p v-if="bulkResult.rowErrors.length" class="error-text">
          {{ bulkResult.rowErrors.length }} row(s) had problems (kept the rest):
        </p>
        <ul v-if="bulkResult.rowErrors.length">
          <li
            v-for="e in bulkResult.rowErrors"
            :key="e.index"
            class="error-text"
          >
            Row {{ e.index }}: {{ e.reason }}
          </li>
        </ul>
      </div>
    </details>

    <p v-if="error" class="error-text">{{ error }}</p>
  </div>
</template>

<style scoped>
.ingest {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 680px;
}

.page-title {
  font-size: 1.15rem;
  margin: 0;
}

h3 {
  font-size: 0.95rem;
  margin: 0 0 0.3rem;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-row {
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--color-border);
}

.file-row:last-child {
  border-bottom: none;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.duration {
  color: var(--color-ink-muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

textarea {
  width: 100%;
  margin-bottom: 0.6rem;
  resize: vertical;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.no-margin {
  margin: 0;
}

.result {
  margin-top: 1rem;
  font-size: 0.9rem;
}

.advanced summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-ink-muted);
}

.advanced[open] summary {
  margin-bottom: 0.9rem;
  color: var(--color-ink);
}
</style>
