# Phase 13 - Voice Messages (Voice Notes)

**Commit message:** `Voice Messages`
**Prerequisites:** Phase 7 (attachments) complete.
**Goal:** record a voice message in the browser, send it, and play it with a waveform and speed control. (Your "Voice messages" and "Voice Notes" requests are this same feature.)
**Read:** `DATABASE.md` (V9), `API.md` (Attachments), `SECURITY.md` (Microphone, uploads)

## Design decisions
1. **Recording:** `MediaRecorder` with the first supported type from: `audio/webm;codecs=opus` (Chrome/Firefox/Edge), `audio/mp4` (Safari). Check with `MediaRecorder.isTypeSupported`. Never assume one format.
2. **Limits:** max **5 minutes**, max 10 MB, min 1 second (shorter is discarded).
3. **Waveform:** computed in the browser with `AudioContext` + `AnalyserNode` during recording, reduced to **64 bars** (0-255) and uploaded with the file. The server validates length = 64 and range.
4. **Duration:** measured by the client; the server stores it but clamps to 0 < duration <= 300 000 ms. (Optionally verify with ffprobe if installed; do not make ffprobe mandatory.)
5. **Storage/serving:** same `StorageService` and authorization as attachments. The download endpoint **must support HTTP Range requests** (Safari will not play audio without it). Cache-Control private.
6. **Message type:** `VOICE` with exactly one audio attachment. Voice messages can be replied to and deleted like others; they cannot be edited.
7. Microphone permission is requested only when the user taps the mic. Permissions-Policy header must allow `microphone=(self)`.

## Backend tasks
1. Migration `V9__voice.sql`: add `VOICE` to `messages.message_type`; add `duration_ms`, `waveform` to `attachments`.
2. Allow audio MIME types in the sniffed allowlist: `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/x-m4a`. Content sniffing still decides, not the extension or declared type.
3. `AttachmentService.uploadVoice(file, durationMs, waveform)` and `MessageService.send` rule: type `VOICE` requires exactly 1 voice attachment owned by the sender and no text.
4. Range-request support in `GET /attachments/{id}` (`Accept-Ranges`, `206 Partial Content`, `Content-Range`).
5. DTO: `AttachmentDto.durationMs`, `waveform` (array of 64 ints); `MessageDto.type = VOICE`.
6. Conversation list preview: "Voice message 0:42".
7. Rate limit voice uploads with the existing upload limits.

## Frontend tasks
1. `VoiceRecorder` in `MessageComposer`: mic button when the input is empty (send button when there is text). Tap to start; shows pulsing red dot, timer, live waveform, **Cancel** (trash) and **Send**; optional pause/resume; auto-stop at 5:00.
2. Handle states: permission denied (explain how to re-enable), no microphone found, unsupported browser (hide the mic and show a tooltip), tab hidden while recording (keep going), stop all tracks on finish/cancel/unmount.
3. `VoicePlayer` in the bubble: play/pause, waveform bars with progress, click/drag to seek, elapsed/total time, speed toggle 1x / 1.5x / 2x. Only one voice plays at a time. Keep the audio element out of the DOM render loop to avoid restarts when messages update.
4. Upload with progress; pending/failed/retry states like other messages; preview the recording before sending (long recordings only).
5. Accessibility: buttons labelled, progress exposed as a slider with `aria-valuenow`, keyboard control (Space play/pause, arrows seek).

## Tests
Server rejects: non-audio disguised as audio, too long, too large, bad waveform length, foreign attachment id; Range requests return correct bytes; non-member cannot stream. Frontend: format selection helper, waveform reduction, recorder state machine (mock MediaRecorder). Playwright (Chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`): record 3 s, send, other user plays it.

## Acceptance checklist
- [x] Record, cancel, and send work in Chrome (Safari recording: NEEDS MANUAL CHECK in PROGRESS.md).
- [x] The recipient sees the waveform instantly and can play, seek and change speed.
- [x] Seeking works (Range support) and a non-member gets 403/404.
- [x] Microphone indicator turns off after sending or cancelling.

## Commit
```bash
git add -A && git commit -m "Voice Messages"
```
