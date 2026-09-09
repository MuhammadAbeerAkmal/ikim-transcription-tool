<script setup lang="ts">
import { ref } from "vue";
import IngestView from "./views/IngestView.vue";
import QueueView from "./views/QueueView.vue";
import AnnotationView from "./views/AnnotationView.vue";
import PairingView from "./views/PairingView.vue";

type View = "ingest" | "queue" | "annotation" | "pairing";

const currentView = ref<View>("queue");
const selectedItemId = ref<string | null>(null);

function openItem(itemId: string) {
  selectedItemId.value = itemId;
  currentView.value = "annotation";
}

function backToQueue() {
  selectedItemId.value = null;
  currentView.value = "queue";
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <h1>IKIM Transcription Tool</h1>
        <p class="tagline">Correct AI-generated transcripts against the original audio, then tag what matters.</p>
      </div>
      <nav>
        <button
          :class="{ active: currentView === 'queue' }"
          @click="currentView = 'queue'"
        >
          Work Queue
        </button>
        <button
          :class="{ active: currentView === 'ingest' }"
          @click="currentView = 'ingest'"
        >
          Upload
        </button>
        <button
          :class="{ active: currentView === 'pairing' }"
          @click="currentView = 'pairing'"
        >
          Manual Pairing
        </button>
      </nav>
    </header>

    <main class="app-main">
      <IngestView v-if="currentView === 'ingest'" />
      <QueueView
        v-else-if="currentView === 'queue'"
        @open-item="openItem"
        @go-to-upload="currentView = 'ingest'"
      />
      <PairingView v-else-if="currentView === 'pairing'" />
      <AnnotationView
        v-else-if="currentView === 'annotation' && selectedItemId"
        :item-id="selectedItemId"
        @back="backToQueue"
        @go-to-pairing="currentView = 'pairing'"
      />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 2rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-header h1 {
  font-size: 1.15rem;
  margin: 0;
}

.tagline {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  color: var(--color-ink-muted);
}

.app-header nav {
  display: flex;
  gap: 0.5rem;
}

.app-header button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink);
  border-radius: var(--radius-sm);
}

.app-header button:hover:not(.active) {
  background: var(--color-surface-alt);
}

.app-header button.active {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 1080px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
</style>
