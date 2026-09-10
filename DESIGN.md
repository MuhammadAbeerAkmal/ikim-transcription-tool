# Design notes

## Data model, and why

Three tables: `AudioFile`, `Item`, `AnnotationSpan`. `AudioFile` and `Item` are split because an item's lifecycle doesn't need both halves at once (audio can arrive before its transcript, or the reverse). `Item.audioFileId` is nullable and unique.

`ItemStatus.UNMATCHED` covers both halves of an unpaired item: audio waiting on a transcript, and a transcript waiting on audio. The Manual Pairing screen queries both the same way (`audioFileId: null` vs `originalTranscript: null`). A separate pairing-status enum was considered and dropped; it would mean every status check elsewhere branches on two enums instead of one.

`AnnotationSpan.attributes` is a single `Json` column shared across all seven types, validated per-type by a Zod discriminated union at the API boundary. The column stays generic so a new type doesn't need a migration.

## Tradeoffs made

- **Pairing matches by basename only**, not full path, since only the uploaded file's real name is verifiable server-side. If two audio files share a basename, neither auto-matches (a `Map` would silently drop one); both surface in Manual Pairing instead.
- **Unpairing** splits one row into two: the original `Item` keeps its transcript and spans (they reference the transcript's text offsets), and a new row takes the audio side.
- **Overlapping spans are allowed.** The brief doesn't ask for exclusivity, and inventing one (e.g. "50 mg" as MEASUREMENT plus "50" as NUMBER) would be an unrequested rule.
- **A span's type is editable, its text range is not.** Reclassifying a mistagged span is common; sliding its offsets to different text is rare and has no natural UI gesture for it, so that case stays delete-and-recreate.
- **Editing the transcript clears that item's spans**, in the same transaction. Offsets are only valid against the exact text they were recorded against; a real diff-based shift is more complexity than the time budget allows. The frontend flags this with a visible warning rather than losing tags silently.
- **MEASUREMENT's `normalizedValue` is always recomputed server-side**, same principle as duration: never trust a client-supplied derived value.
- **Distance estimate is a labeled heuristic**, not a measurement: ffmpeg's mean signal level (dB), linearly mapped between two reference points (-10dB to 0.1m, -40dB to 2.0m). An annotator's override always wins over the suggestion, everywhere that value is read.
- **Export includes every paired item regardless of status**, not just "completed" ones; the brief doesn't gate export on a review state, and adding one would be exactly the review-queue workflow §5 rules out. Each line groups fields under `spans` and `recordingConditions` (rather than a flat row) so a consumer doesn't need to know the database's column names, and resolves `speechRateWpm`/`distanceEstimateMeters` as override-if-set-else-computed.
- **Demo audio is synthesized German speech** (Windows SAPI, not a sine tone, not a human recording), committed to `backend/demo-assets/`, seeded automatically on first `docker compose up`. See that folder's README for what each clip contains.

## Deliberately different from the brief

- **The brief says "six types" but lists seven** (§4.5). All seven are implemented (per §8: decide, note it, move on). CRUD is the natural odd one out of the count anyway: it marks *why* the transcript was corrected, not *what* the tagged text is, unlike the other six.
- **NUMBER's `rendering` attribute reflects the spoken form, not the result.** Both of the brief's own examples resolve to `"words"`: "zwoelf" (one word, 12) and "sechs null" (the suture-size example, meaning 6/0) are both explicitly called "spoken as words," even though the second reads like digits. `rendering: "digits"` would describe an ASR transcript that already wrote numeral characters instead of spelling the number out, a case the brief's examples don't show. One real limitation this exposes: `normalizedValue` is a plain number, so "6/0" and "sechzig" (60) both store as `60`.

## What was cut, and what's next

- **`normalizeSpokenNumber`** parses German number words correctly (tested), but isn't wired into the NUMBER form; the annotator still types both fields by hand. Next: a live-parsing text field.
- **Word-to-audio-time mapping** for click-to-seek evenly distributes words across duration (no per-word timestamps available), an approximation, not real alignment. Next: real per-word timestamps, if a forced-alignment tool were ever in scope.
- **File validation is extension-only**, not content-sniffed. Browsers and curl send inconsistent MIME types for identical files, which made MIME validation reject legitimate uploads. Next: sniff the file's actual header bytes instead of trusting the extension or a client-sent MIME type.
- **Demo audio is TTS, not a human recording.** Next: swap in a few real recordings of the same sentences.
