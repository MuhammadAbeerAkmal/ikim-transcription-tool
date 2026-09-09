import { ref, type Ref } from "vue";

export function useAudioPlayer(audioEl: Ref<HTMLAudioElement | null>) {
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const playbackRate = ref(1);

  function onTimeUpdate() {
    if (audioEl.value) currentTime.value = audioEl.value.currentTime;
  }

  function onLoadedMetadata() {
    if (audioEl.value) duration.value = audioEl.value.duration;
  }

  function onPlay() {
    isPlaying.value = true;
  }

  function onPause() {
    isPlaying.value = false;
  }

  function togglePlay() {
    if (!audioEl.value) return;
    if (isPlaying.value) audioEl.value.pause();
    else audioEl.value.play();
  }

  function seek(time: number) {
    if (audioEl.value) audioEl.value.currentTime = time;
  }

  function skip(deltaSeconds: number) {
    if (audioEl.value) {
      audioEl.value.currentTime = Math.max(
        0,
        audioEl.value.currentTime + deltaSeconds,
      );
    }
  }

  function setRate(rate: number) {
    playbackRate.value = rate;
    if (audioEl.value) audioEl.value.playbackRate = rate;
  }

  return {
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
  };
}
