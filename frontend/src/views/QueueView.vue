<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  listItems,
  deleteItem,
  exportUrl,
  type QueueItem,
  type ItemStatus,
  type ItemSort,
} from "../api/client";
import { humanize } from "../utils/humanize";

const emit = defineEmits<{
  "open-item": [itemId: string];
  "go-to-upload": [];
}>();

const items = ref<QueueItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const statusFilter = ref<ItemStatus | "">("");
const sort = ref<ItemSort>("createdAt_desc");

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const result = await listItems({
      status: statusFilter.value || undefined,
      sort: sort.value,
    });
    items.value = result.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load queue";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([statusFilter, sort], load);

function formatDuration(sec: number | null) {
  if (sec === null) return "-";
  return `${sec.toFixed(1)}s`;
}

async function onDelete(item: QueueItem) {
  const confirmed = window.confirm(
    `Delete "${item.filename}"? This removes the audio file and any tags permanently.`,
  );
  if (!confirmed) return;
  await deleteItem(item.id);
  await load();
}
</script>

<template>
  <div class="queue">
    <div class="page-header">
      <div>
        <h2>Work Queue</h2>
        <p class="hint">
          Recordings waiting to be checked and tagged. Click a row to start.
        </p>
      </div>
      <a :href="exportUrl()" class="export-link"
        >Export gold standard (JSONL)</a
      >
    </div>

    <div class="controls">
      <select v-model="statusFilter">
        <option value="">All statuses</option>
        <option value="UNMATCHED">Unmatched</option>
        <option value="PENDING">Pending</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="COMPLETED">Completed</option>
        <option value="REJECTED">Rejected</option>
      </select>
      <select v-model="sort">
        <option value="createdAt_desc">Newest first</option>
        <option value="duration_asc">Duration: shortest first</option>
        <option value="duration_desc">Duration: longest first</option>
        <option value="status_asc">Status: A-Z</option>
        <option value="status_desc">Status: Z-A</option>
      </select>
      <button class="secondary" @click="load">Refresh</button>
    </div>

    <div class="card table-card">
      <p v-if="loading" class="hint loading-state">Loading…</p>
      <p v-else-if="error" class="error-text loading-state">{{ error }}</p>
      <div v-else-if="items.length === 0" class="empty-state">
        <p class="empty-title">No recordings yet</p>
        <p class="hint">Upload some audio to start building your work queue.</p>
        <button @click="emit('go-to-upload')">Upload audio</button>
      </div>

      <table v-else>
        <thead>
          <tr>
            <th>Filename</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Annotator</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="row"
            @click="emit('open-item', item.id)"
          >
            <td>{{ item.filename }}</td>
            <td class="numeric">{{ formatDuration(item.durationSec) }}</td>
            <td>
              <span :class="['pill', item.status.toLowerCase()]">{{
                humanize(item.status)
              }}</span>
            </td>
            <td>{{ item.annotator ?? "-" }}</td>
            <td class="actions">
              <button class="link danger" @click.stop="onDelete(item)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.queue {
  max-width: 900px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.page-header h2 {
  font-size: 1.15rem;
  margin: 0 0 0.25rem;
}

.export-link {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.export-link:hover {
  background: var(--color-accent-hover);
}

.controls {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.loading-state {
  padding: 1.25rem;
  display: block;
}

.empty-state {
  padding: 3rem 1.5rem;
  text-align: center;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
}

.empty-state .hint {
  margin: 0 0 1.1rem;
}

th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-ink-muted);
  background: var(--color-surface-alt);
  border-bottom: 1px solid var(--color-border);
}

td {
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.numeric {
  font-variant-numeric: tabular-nums;
}

.actions {
  text-align: right;
}

button.link {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.82rem;
  cursor: pointer;
}

button.link.danger {
  color: var(--color-danger);
}

.row {
  cursor: pointer;
}

.row:hover {
  background: var(--color-surface-alt);
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>
