<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  originalTranscript: string;
  correctedTranscript: string;
  durationSec: number;
  saved?: boolean;
}>();

const emit = defineEmits<{
  "update:correctedTranscript": [value: string];
  seek: [time: number];
  "tag-selection": [
    selection: { startOffset: number; endOffset: number; text: string },
  ];
}>();

interface WordToken {
  text: string;
  estimatedTime: number;
}

// Word-timestamp estimation: the input transcript format has no per-word
// timing, so click-to-seek evenly distributes words across the audio's
// known duration. An approximation, not real forced alignment.
const wordTokens = computed<WordToken[]>(() => {
  const matches = [...props.correctedTranscript.matchAll(/\S+/g)];
  const total = matches.length;
  return matches.map((m, i) => ({
    text: m[0],
    estimatedTime: total > 0 ? (i / total) * props.durationSec : 0,
  }));
});

function onTextareaInput(e: Event) {
  emit("update:correctedTranscript", (e.target as HTMLTextAreaElement).value);
}

function onSelectionEvent(e: Event) {
  const textarea = e.target as HTMLTextAreaElement;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) return;
  emit("tag-selection", {
    startOffset: start,
    endOffset: end,
    text: textarea.value.slice(start, end),
  });
}
</script>

<template>
  <div class="transcript-editor card">
    <div class="column">
      <h3>Original (immutable)</h3>
      <p class="original">{{ props.originalTranscript }}</p>
    </div>

    <div class="column">
      <h3>Click a word to jump the audio there</h3>
      <p class="word-view">
        <span
          v-for="(w, i) in wordTokens"
          :key="i"
          class="word"
          @click="emit('seek', w.estimatedTime)"
          >{{ w.text }}</span
        >
      </p>
    </div>

    <div class="column">
      <h3>
        Corrected (editable). Select text, then tag it in the panel
        <span v-if="saved" class="saved-badge">Saved</span>
      </h3>
      <textarea
        :value="props.correctedTranscript"
        rows="6"
        @input="onTextareaInput"
        @mouseup="onSelectionEvent"
        @keyup="onSelectionEvent"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.transcript-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.column h3 {
  font-size: 0.78rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-ink-muted);
  margin: 0 0 0.5rem;
}

.saved-badge {
  text-transform: none;
  letter-spacing: normal;
  color: var(--color-success);
  font-weight: 600;
  margin-left: 0.4rem;
}

.original {
  background: var(--color-surface-alt);
  padding: 0.8rem;
  border-radius: var(--radius-sm);
  margin: 0;
  line-height: 1.6;
}

.word-view {
  line-height: 2.1;
  margin: 0;
  background: var(--color-surface-alt);
  padding: 0.8rem;
  border-radius: var(--radius-sm);
}

.word {
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  border-radius: 4px;
}

.word:hover {
  background: var(--color-accent-soft);
  color: var(--color-accent-hover);
}

textarea {
  width: 100%;
  font-size: 0.95rem;
  line-height: 1.6;
  resize: vertical;
}
</style>
