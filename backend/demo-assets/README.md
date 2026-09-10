# Demo audio

Three WAV files, read by `backend/src/scripts/seed.ts` into the app on first
`docker compose up` (or `yarn seed`). Real synthesized German speech.
Windows SAPI's built-in `Microsoft Hedda Desktop` (de-DE) voice, not a real
human recording and not a synthetic test tone either. See DESIGN.md for why.

- `op-report-demo.wav` (~26s): Opens with the two example sentences from
  the brief's own §2 JSON transcript sample, then the brief's exact §4.5
  worked-example dictated sentence. This is the fully tagged demo item.
- `unassigned-recording.wav` (~18s): A second short dictation, left
  without a transcript to populate the Manual Pairing screen.
- `too-short-clip.wav` (~2s): Under the 15-second threshold, to
  demonstrate the auto-reject rule live.
