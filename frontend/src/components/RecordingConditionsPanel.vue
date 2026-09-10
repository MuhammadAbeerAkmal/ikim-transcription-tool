<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { updateItem, type Item } from "../api/client";

const props = defineProps<{ item: Item }>();
const emit = defineEmits<{ updated: [] }>();

// music-metadata's native tag dict, keyed by format (e.g. WAV's bext/LIST
// INFO chunks), each a list of {id, value} pairs. Flattened here purely
// for display, the raw shape is what actually goes into the export.
interface MetadataEntry {
  tagType: string;
  id: string;
  value: unknown;
}

const metadataEntries = computed<MetadataEntry[]>(() => {
  const native = props.item.audioFile?.metadata as
    | Record<string, { id: string; value: unknown }[]>
    | null
    | undefined;
  if (!native) return [];
  return Object.entries(native).flatMap(([tagType, tags]) =>
    tags.map((tag) => ({ tagType, id: tag.id, value: tag.value })),
  );
});

const speechRateOverride = ref<number | null>(props.item.speechRateOverride);
const distanceEstimateOverride = ref<number | null>(
  props.item.distanceEstimateOverride,
);
const saving = ref(false);
const saved = ref(false);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.item.id,
  () => {
    speechRateOverride.value = props.item.speechRateOverride;
    distanceEstimateOverride.value = props.item.distanceEstimateOverride;
  },
);

async function saveOverrides() {
  saving.value = true;
  try {
    // Send the real value, including null, coalescing null to undefined
    // here would silently turn "clear this override" into "don't touch
    // it," making overrides impossible to undo once set.
    await updateItem(props.item.id, {
      speechRateOverride: speechRateOverride.value,
      distanceEstimateOverride: distanceEstimateOverride.value,
    });
    emit("updated");
    saved.value = true;
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      saved.value = false;
    }, 2500);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="conditions-panel card">
    <h3>Recording conditions</h3>
    <dl>
      <dt>Duration</dt>
      <dd>{{ item.audioFile?.durationSec }}s</dd>
      <dt>Sample rate</dt>
      <dd>{{ item.audioFile?.sampleRate ?? "-" }} Hz</dd>
      <dt>Channels</dt>
      <dd>{{ item.audioFile?.channels ?? "-" }}</dd>
      <dt>Bit depth</dt>
      <dd>{{ item.audioFile?.bitDepth ?? "-" }}</dd>
    </dl>

    <div v-if="metadataEntries.length > 0" class="metadata-block">
      <p class="metadata-title">Embedded file metadata</p>
      <dl class="metadata-list">
        <template v-for="(entry, i) in metadataEntries" :key="i">
          <dt>{{ entry.tagType }}: {{ entry.id }}</dt>
          <dd>{{ entry.value }}</dd>
        </template>
      </dl>
    </div>
    <p v-else class="hint metadata-empty">
      No embedded bext/LIST INFO metadata found in this file.
    </p>

    <div class="overrides">
      <label>
        Speech rate (WPM)
        <span class="suggested"
          >suggested {{ item.speechRateComputed?.toFixed(1) ?? "-" }}</span
        >
        <input type="number" v-model.number="speechRateOverride" />
      </label>
      <label>
        Distance estimate (m)
        <span class="suggested"
          >suggested
          {{ item.distanceEstimateComputed?.toFixed(2) ?? "-" }}</span
        >
        <input
          type="number"
          step="0.1"
          v-model.number="distanceEstimateOverride"
        />
      </label>
    </div>
    <p class="hint">
      Distance is a heuristic estimate from signal level, not a real
      measurement. The override, not the suggestion is what gets exported.
    </p>
    <div class="save-row">
      <button :disabled="saving" @click="saveOverrides">
        {{ saving ? "Saving…" : "Save overrides" }}
      </button>
      <span v-if="saved" class="saved-badge">Saved</span>
    </div>
  </div>
</template>

<style scoped>
.conditions-panel h3 {
  margin: 0 0 0.8rem;
  font-size: 1rem;
}

dl {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 0.2rem 1.5rem;
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
}

dt {
  color: var(--color-ink-muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

dd {
  margin: 0 0 0.6rem;
  font-variant-numeric: tabular-nums;
}

.metadata-block {
  margin: 0 0 1.1rem;
}

.metadata-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-ink-muted);
  margin: 0 0 0.4rem;
}

.metadata-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 1rem;
  margin: 0;
  font-size: 0.85rem;
  max-width: 480px;
}

.metadata-list dt {
  color: var(--color-ink-muted);
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.85rem;
}

.metadata-list dd {
  margin: 0;
  word-break: break-word;
}

.metadata-empty {
  margin: 0 0 1.1rem;
}

.overrides {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.7rem;
  flex-wrap: wrap;
}

label {
  display: block;
  font-size: 0.85rem;
  color: var(--color-ink-muted);
}

.suggested {
  display: block;
  font-size: 0.78rem;
  margin-top: 0.1rem;
}

input {
  display: block;
  margin-top: 0.3rem;
  width: 150px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
</style>
