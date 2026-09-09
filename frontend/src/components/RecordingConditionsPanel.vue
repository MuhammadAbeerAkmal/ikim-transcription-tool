<script setup lang="ts">
import { ref, watch } from "vue";
import { updateItem, type Item } from "../api/client";

const props = defineProps<{ item: Item }>();
const emit = defineEmits<{ updated: [] }>();

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
