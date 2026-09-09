<script setup lang="ts">
import { ref } from "vue";
import { useAudioPlayer } from "../composables/useAudioPlayer";

const props = defineProps<{ src: string }>();

const audioEl = ref<HTMLAudioElement | null>(null);
const {
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onTimeUpdate,
  onLoadedMetadata,
  onPlay,
  onPause,
  togglePlay,
  seek,
  skip,
  setRate,
} = useAudioPlayer(audioEl);

defineExpose({ seek });

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowLeft") skip(-5);
  if (e.code === "ArrowRight") skip(5);
}

function onRateChange(e: Event) {
  setRate(Number((e.target as HTMLSelectElement).value));
}

function onScrub(e: Event) {
  seek(Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="audio-player card" tabindex="0" @keydown="onKeydown">
    <audio
      ref="audioEl"
      :src="props.src"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @play="onPlay"
      @pause="onPause"
    ></audio>

    <div class="controls">
      <button class="play-button" @click="togglePlay()">{{ isPlaying ? "Pause" : "Play" }}</button>
      <button class="secondary" @click="skip(-5)">« 5s</button>
      <button class="secondary" @click="skip(5)">5s »</button>
      <input
        type="range"
        class="scrubber"
        min="0"
        :max="duration || 0"
        step="0.1"
        :value="currentTime"
        @input="onScrub"
      />
      <span class="time">{{ currentTime.toFixed(1) }}s / {{ duration.toFixed(1) }}s</span>
      <select :value="playbackRate" @change="onRateChange">
        <option v-for="r in RATES" :key="r" :value="r">{{ r }}x</option>
      </select>
    </div>

    <p class="shortcuts">
      <strong>Shortcuts:</strong> Space = play/pause · ← = back 5s · → = forward 5s
    </p>
  </div>
</template>

<style scoped>
.audio-player {
  outline: none;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.play-button {
  min-width: 68px;
}

.scrubber {
  flex: 1;
  accent-color: var(--color-accent);
  padding: 0;
  border: none;
  background: none;
}

.time {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.shortcuts {
  margin: 0.75rem 0 0;
  font-size: 0.78rem;
  color: var(--color-ink-muted);
}
</style>
