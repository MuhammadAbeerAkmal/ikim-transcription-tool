<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getItem, updateItem, type Item } from "../api/client";
import AudioPlayer from "../components/AudioPlayer.vue";
import TranscriptEditor from "../components/TranscriptEditor.vue";
import AnnotationPanel from "../components/AnnotationPanel.vue";
import RecordingConditionsPanel from "../components/RecordingConditionsPanel.vue";
import { humanize } from "../utils/humanize";

const props = defineProps<{ itemId: string }>();
const emit = defineEmits<{ back: [] }>();

const item = ref<Item | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const pendingSelection = ref<{
  startOffset: number;
  endOffset: number;
  text: string;
} | null>(null);
const audioPlayerRef = ref<InstanceType<typeof AudioPlayer> | null>(null);
const annotatorInput = ref("");
const transcriptSaved = ref(false);
const annotatorSaved = ref(false);
const spansInvalidatedWarning = ref(false);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let transcriptFlashTimeout: ReturnType<typeof setTimeout> | null = null;
let annotatorFlashTimeout: ReturnType<typeof setTimeout> | null = null;

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const result = await getItem(props.itemId);
    item.value = result.item;
    annotatorInput.value = result.item.annotator ?? "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load item";
  } finally {
    loading.value = false;
  }
}

async function onAnnotatorChange() {
  await updateItem(props.itemId, { annotator: annotatorInput.value });
  annotatorSaved.value = true;
  if (annotatorFlashTimeout) clearTimeout(annotatorFlashTimeout);
  annotatorFlashTimeout = setTimeout(() => {
    annotatorSaved.value = false;
  }, 2000);
}

onMounted(load);

function storedFilename(fullPath: string): string {
  return fullPath.split(/[\\/]/).pop() ?? fullPath;
}

const audioSrc = computed(() => {
  if (!item.value?.audioFile) return "";
  return `http://localhost:4000/media/${encodeURIComponent(storedFilename(item.value.audioFile.path))}`;
});

function onSeek(time: number) {
  audioPlayerRef.value?.seek(time);
}

function onTagSelection(selection: {
  startOffset: number;
  endOffset: number;
  text: string;
}) {
  pendingSelection.value = selection;
}

function onCorrectedTranscriptChange(value: string) {
  if (!item.value) return;
  item.value.correctedTranscript = value;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const result = await updateItem(props.itemId, { correctedTranscript: value });
    transcriptSaved.value = true;
    if (transcriptFlashTimeout) clearTimeout(transcriptFlashTimeout);
    transcriptFlashTimeout = setTimeout(() => {
      transcriptSaved.value = false;
    }, 2000);

    if (result.spansInvalidated && item.value) {
      // Editing the transcript clears existing spans server-side (their
      // offsets would otherwise silently point at the wrong text)
      // reflect that locally without a full reload, to avoid a loading
      // flicker in the middle of an autosave.
      item.value.spans = [];
      spansInvalidatedWarning.value = true;
    }
  }, 800);
}
</script>

<template>
  <div class="annotation-view">
    <button class="back" @click="emit('back')">← Back to queue</button>

    <p v-if="loading">Loading…</p>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <template v-else-if="item">
      <p v-if="spansInvalidatedWarning" class="warn-text">
        Existing tags were cleared because the transcript changed. Their positions no
        longer matched the text. Please re-tag as needed.
      </p>
      <div class="meta-row">
        <h2>{{ item.audioFile?.filename }}</h2>
        <span :class="['pill', item.status.toLowerCase()]">{{
          humanize(item.status)
        }}</span>
        <label class="annotator-field">
          Annotator
          <input
            v-model="annotatorInput"
            placeholder="Your name"
            @change="onAnnotatorChange"
          />
          <span v-if="annotatorSaved" class="saved-badge">Saved</span>
        </label>
      </div>
      <p class="hint">
        Listen to the audio, fix the transcript on the right if the AI got it
        wrong, then select any text to tag it.
      </p>
      <AudioPlayer ref="audioPlayerRef" :src="audioSrc" />

      <div class="workspace">
        <TranscriptEditor
          :original-transcript="item.originalTranscript ?? ''"
          :corrected-transcript="item.correctedTranscript ?? ''"
          :duration-sec="item.audioFile?.durationSec ?? 0"
          :saved="transcriptSaved"
          @seek="onSeek"
          @tag-selection="onTagSelection"
          @update:corrected-transcript="onCorrectedTranscriptChange"
        />

        <AnnotationPanel
          :item-id="item.id"
          :pending-selection="pendingSelection"
          :spans="item.spans ?? []"
          @spans-changed="load"
          @clear-selection="pendingSelection = null"
        />
      </div>

      <RecordingConditionsPanel :item="item" @updated="load" />
    </template>
  </div>
</template>

<style scoped>
.annotation-view {
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  font-weight: 500;
}

.back:hover {
  text-decoration: underline;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

h2 {
  font-size: 1.2rem;
  margin: 0;
}

.annotator-field {
  margin-left: auto;
  font-size: 0.82rem;
  color: var(--color-ink-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.annotator-field input {
  padding: 0.35rem 0.6rem;
  font-size: 0.85rem;
}

.hint {
  margin: -0.4rem 0 0;
}

.workspace {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 720px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>
