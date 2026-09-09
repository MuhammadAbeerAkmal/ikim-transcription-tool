<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  manualPair,
  getUnmatchedPairs,
  type UnmatchedAudioItem,
  type UnmatchedTranscriptItem,
} from "../api/client";

const audioItems = ref<UnmatchedAudioItem[]>([]);
const transcriptItems = ref<UnmatchedTranscriptItem[]>([]);
const selectedAudioId = ref("");
const selectedTranscriptId = ref("");
const loading = ref(false);
const pairing = ref(false);
const error = ref<string | null>(null);
const message = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const result = await getUnmatchedPairs();
    audioItems.value = result.unmatchedAudioItems;
    transcriptItems.value = result.unmatchedTranscriptItems;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load unmatched items";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function pair() {
  if (!selectedAudioId.value || !selectedTranscriptId.value) return;
  error.value = null;
  message.value = null;
  pairing.value = true;
  try {
    await manualPair(selectedAudioId.value, selectedTranscriptId.value);
    message.value = "Paired successfully. The item is now in the work queue.";
    selectedAudioId.value = "";
    selectedTranscriptId.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to pair";
  } finally {
    pairing.value = false;
  }
}
</script>

<template>
  <div class="pairing">
    <h2>Manual pairing</h2>
    <p class="hint">
      Items here have audio with no transcript, or a transcript with no matching audio
      (nothing is ever dropped. This is where you fix leftovers by hand).
    </p>

    <p v-if="loading" class="hint">Loading…</p>
    <template v-else>
      <div class="columns">
        <div class="card column">
          <h3>Unmatched audio ({{ audioItems.length }})</h3>
          <p v-if="audioItems.length === 0" class="hint no-margin">None right now.</p>
          <ul v-else>
            <li v-for="a in audioItems" :key="a.id">
              <label>
                <input type="radio" :value="a.id" v-model="selectedAudioId" />
                {{ a.filename }} <span class="muted">. {{ a.durationSec.toFixed(1) }}s</span>
              </label>
            </li>
          </ul>
        </div>
        <div class="card column">
          <h3>Unmatched transcripts ({{ transcriptItems.length }})</h3>
          <p v-if="transcriptItems.length === 0" class="hint no-margin">None right now.</p>
          <ul v-else>
            <li v-for="t in transcriptItems" :key="t.id">
              <label>
                <input type="radio" :value="t.id" v-model="selectedTranscriptId" />
                {{ t.transcriptSourcePath ?? "(no path)" }}
                <span class="muted">. "{{ t.originalTranscript.slice(0, 40) }}{{ t.originalTranscript.length > 40 ? "…" : "" }}"</span>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <button :disabled="!selectedAudioId || !selectedTranscriptId || pairing" @click="pair">
        {{ pairing ? "Pairing…" : "Pair selected" }}
      </button>
      <p v-if="message" class="saved-badge">{{ message }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.pairing {
  max-width: 900px;
}

h2 {
  font-size: 1.15rem;
  margin: 0 0 0.3rem;
}

.hint {
  margin: 0 0 1.2rem;
}

.no-margin {
  margin: 0;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.column h3 {
  font-size: 0.9rem;
  margin: 0 0 0.6rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
}

li:last-child {
  border-bottom: none;
}

label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  cursor: pointer;
}

.muted {
  color: var(--color-ink-muted);
}

.saved-badge {
  display: block;
  margin-top: 0.6rem;
}

.error-text {
  margin-top: 0.6rem;
}
</style>
