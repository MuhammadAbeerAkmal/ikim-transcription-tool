<script setup lang="ts">
import { ref } from "vue";
import {
  createSpan,
  deleteSpan,
  type AnnotationSpan,
  type AnnotationType,
} from "../api/client";
import { humanize } from "../utils/humanize";

const props = defineProps<{
  itemId: string;
  pendingSelection: {
    startOffset: number;
    endOffset: number;
    text: string;
  } | null;
  spans: AnnotationSpan[];
}>();

const emit = defineEmits<{ "spans-changed": []; "clear-selection": [] }>();

const selectedType = ref<AnnotationType>("MEDICAL_TERM");
const error = ref<string | null>(null);
const submitting = ref(false);

const editType = ref<"correct" | "add" | "delete">("correct");
const numberRendering = ref<"digits" | "words">("digits");
const numberValue = ref(0);
const formattingCommand = ref("newline");
const isLiteral = ref(false);
const resolvedWord = ref("");
const entityType = ref<"person" | "organisation" | "place" | "date">("person");
const medicalCategory = ref<
  "anatomy" | "procedure" | "diagnosis" | "drug" | "device"
>("drug");
const medicalNote = ref("");
const measurementValue = ref(0);
const measurementUnit = ref("mg");

const MEASUREMENT_UNITS = [
  "g",
  "mg",
  "ug",
  "kg",
  "ml",
  "l",
  "mmHg",
  "IE",
  "mm",
  "cm",
  "Ch",
];
const FORMATTING_COMMANDS = [
  "newline",
  "paragraph",
  "period",
  "comma",
  "colon",
  "dash",
  "bracket_open",
  "bracket_close",
];
const MEDICAL_CATEGORIES = [
  "anatomy",
  "procedure",
  "diagnosis",
  "drug",
  "device",
] as const;

// Mirrors backend/src/services/unitNormalization.ts's base-unit grouping,
// duplicated here only for an immediate UI preview before submit, the
// backend remains the source of truth for the stored normalized value.
const MASS_TO_G: Record<string, number> = {
  g: 1,
  mg: 0.001,
  ug: 0.000001,
  kg: 1000,
};
const VOLUME_TO_ML: Record<string, number> = { ml: 1, l: 1000 };
const LENGTH_TO_MM: Record<string, number> = { mm: 1, cm: 10 };

function previewNormalized(value: number, unit: string): number {
  if (unit in MASS_TO_G) return value * MASS_TO_G[unit];
  if (unit in VOLUME_TO_ML) return value * VOLUME_TO_ML[unit];
  if (unit in LENGTH_TO_MM) return value * LENGTH_TO_MM[unit];
  return value;
}

function buildAttributes(): Record<string, unknown> {
  switch (selectedType.value) {
    case "CRUD":
      return { editType: editType.value };
    case "NUMBER":
      return {
        rendering: numberRendering.value,
        normalizedValue: numberValue.value,
      };
    case "FORMATTING_COMMAND":
      return { command: formattingCommand.value, isLiteral: isLiteral.value };
    case "SPELLED_OUT":
      return { resolvedWord: resolvedWord.value };
    case "NAMED_ENTITY":
      return { entityType: entityType.value };
    case "MEDICAL_TERM":
      return { category: medicalCategory.value, note: medicalNote.value };
    case "MEASUREMENT":
      return {
        value: measurementValue.value,
        unit: measurementUnit.value,
        normalizedValue: previewNormalized(
          measurementValue.value,
          measurementUnit.value,
        ),
      };
    default:
      return {};
  }
}

async function submit() {
  if (!props.pendingSelection) return;
  error.value = null;
  submitting.value = true;
  try {
    await createSpan(props.itemId, {
      type: selectedType.value,
      startOffset: props.pendingSelection.startOffset,
      endOffset: props.pendingSelection.endOffset,
      attributes: buildAttributes(),
    });
    emit("spans-changed");
    emit("clear-selection");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to create span";
  } finally {
    submitting.value = false;
  }
}

async function removeSpan(id: string) {
  await deleteSpan(id);
  emit("spans-changed");
}
</script>

<template>
  <div class="annotation-panel card">
    <div v-if="pendingSelection" class="new-span">
      <p class="eyebrow">New tag</p>
      <p class="selection-preview">
        "<em>{{ pendingSelection.text }}</em
        >"
      </p>

      <label
        >Type
        <select v-model="selectedType">
          <option value="CRUD">Edit Correction</option>
          <option value="NUMBER">Number</option>
          <option value="FORMATTING_COMMAND">Formatting Command</option>
          <option value="SPELLED_OUT">Spelled Out</option>
          <option value="NAMED_ENTITY">Named Entity</option>
          <option value="MEDICAL_TERM">Medical Term</option>
          <option value="MEASUREMENT">Measurement</option>
        </select>
      </label>

      <div v-if="selectedType === 'CRUD'" class="fields">
        <label
          >Edit type
          <select v-model="editType">
            <option value="correct">Correct</option>
            <option value="add">Add</option>
            <option value="delete">Delete</option>
          </select>
        </label>
      </div>

      <div v-else-if="selectedType === 'NUMBER'" class="fields">
        <label
          >Rendering
          <select v-model="numberRendering">
            <option value="digits">Digits</option>
            <option value="words">Words</option>
          </select>
        </label>
        <label
          >Normalized value <input type="number" v-model.number="numberValue"
        /></label>
      </div>

      <div v-else-if="selectedType === 'FORMATTING_COMMAND'" class="fields">
        <label
          >Command
          <select v-model="formattingCommand">
            <option v-for="c in FORMATTING_COMMANDS" :key="c" :value="c">
              {{ humanize(c) }}
            </option>
          </select>
        </label>
        <label class="checkbox-label"
          ><input type="checkbox" v-model="isLiteral" /> Literal words (not a
          command)</label
        >
      </div>

      <div v-else-if="selectedType === 'SPELLED_OUT'" class="fields">
        <label>Resolved word <input v-model="resolvedWord" /></label>
      </div>

      <div v-else-if="selectedType === 'NAMED_ENTITY'" class="fields">
        <label
          >Entity type
          <select v-model="entityType">
            <option value="person">Person</option>
            <option value="organisation">Organisation</option>
            <option value="place">Place</option>
            <option value="date">Date</option>
          </select>
        </label>
      </div>

      <div v-else-if="selectedType === 'MEDICAL_TERM'" class="fields">
        <label
          >Category
          <select v-model="medicalCategory">
            <option v-for="c in MEDICAL_CATEGORIES" :key="c" :value="c">
              {{ humanize(c) }}
            </option>
          </select>
        </label>
        <label>Note <input v-model="medicalNote" /></label>
      </div>

      <div v-else-if="selectedType === 'MEASUREMENT'" class="fields">
        <label
          >Value <input type="number" v-model.number="measurementValue"
        /></label>
        <label
          >Unit
          <select v-model="measurementUnit">
            <option v-for="u in MEASUREMENT_UNITS" :key="u" :value="u">
              {{ u }}
            </option>
          </select>
        </label>
        <p class="hint">
          Normalized preview:
          {{ previewNormalized(measurementValue, measurementUnit) }}
        </p>
      </div>

      <div class="actions">
        <button :disabled="submitting" @click="submit">Create span</button>
        <button class="secondary" @click="emit('clear-selection')">
          Cancel
        </button>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>
    <p v-else class="hint">
      Select text in the corrected transcript to tag it.
    </p>

    <h3>Existing spans ({{ spans.length }})</h3>
    <ul class="span-list">
      <li v-for="s in spans" :key="s.id">
        <span class="span-type">{{ humanize(s.type) }}</span>
        <span class="span-range">[{{ s.startOffset }}–{{ s.endOffset }}]</span>
        <button class="link" @click="removeSpan(s.id)">delete</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.annotation-panel h3 {
  font-size: 0.95rem;
  margin: 1.1rem 0 0.5rem;
}

.new-span {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent);
  margin: 0 0 0.3rem;
}

.selection-preview {
  font-size: 0.95rem;
  margin: 0 0 0.8rem;
}

label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 0.6rem;
  color: var(--color-ink-muted);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.checkbox-label input {
  width: auto;
}

select,
input:not([type="checkbox"]) {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

button.link {
  border: none;
  background: none;
  color: var(--color-danger);
  padding: 0 0.4rem;
  font-size: 0.8rem;
}

.span-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}

.span-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--color-border);
}

.span-list li:last-child {
  border-bottom: none;
}

.span-type {
  font-weight: 600;
}

.span-range {
  color: var(--color-ink-muted);
  font-variant-numeric: tabular-nums;
}
</style>
