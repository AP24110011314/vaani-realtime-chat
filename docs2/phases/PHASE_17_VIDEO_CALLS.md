# Phase 17 - 1:1 Voice and Video Calls

**Commit message:** `Video Calls`
**Prerequisites:** Phases 4-6 complete (real-time, presence, receipts). This is the largest phase; budget extra time.
**Goal:** call a person from a direct chat with audio or video, using WebRTC. Signalling over the existing STOMP connection; media goes peer-to-peer (or via a TURN relay when needed).
**Read first:** `CALLS_WEBRTC.md` (architecture, state machine, events, TURN setup), `SECURITY.md` (Calls)

## Scope
In: direct chats only, voice and video, ring/accept/decline/cancel/end, busy and missed handling, mute, camera on/off, camera switch on mobile, call history messages, TURN with short-lived credentials, reconnect (ICE restart).
Out (stretch): group calls, call recording, screen share (add last if time allows), background blur.

## Backend tasks
1. Migration `V13__calls.sql`: `call_logs`, `messages.call_log_id`, `CALL` message type, `users.calls_relay_only`.
2. `CallService` + in-memory `CallSessionRegistry` (callId, caller, callee, conversationId, type, state, timestamps). Rules: direct conversations only, both active members, no block either way, a user can be in only one call (else `busy`), ring timeout 45 s -> `missed`.
3. STOMP handlers `call.invite`, `call.accept`, `call.decline`, `call.cancel`, `call.end`, `call.signal` (events in `CALLS_WEBRTC.md`). Every handler checks that the sender is a participant of that `callId`; `call.signal` relays only to the other participant, max 16 KB, rate limited (60/10 s), kinds `offer|answer|candidate` only.
4. Multi-tab: all callee tabs ring; first `accept` wins; the others receive `call.handled_elsewhere`.
5. Presence integration: if a participant's last session disconnects, end the call after a 10 s grace period (`end_reason = DISCONNECTED`).
6. `GET /calls/ice-servers`: returns STUN + TURN with **time-limited credentials** (HMAC-SHA1 per coturn `use-auth-secret`, TTL 1 h) and respects `calls_relay_only`.
7. On call end, write `call_logs` and a `CALL` message ("Voice call 3:12", "Missed video call", "Declined", "No answer") visible to both and counted as unread when missed.
8. Docker Compose: optional `coturn` service (see `ENVIRONMENT.md`).

## Frontend tasks
1. `lib/webrtc.js` + `useCall` hook (state machine: idle, outgoing, incoming, connecting, connected, reconnecting, ended). One `RTCPeerConnection`, tracks added after permissions granted, `iceServers` fetched per call.
2. Header buttons in direct chats: voice and video (disabled if blocked/offline-aware tooltip; calls to offline users ring on their other devices or log a missed call).
3. `IncomingCallOverlay` (full-screen glass): caller avatar and name, Accept (audio/video), Decline; ringtone via an `<audio>` element (browsers may block autoplay before the first user interaction, so also use the tab title/notification as a fallback); stop ringing when handled elsewhere.
4. `CallScreen`: large remote video (or avatar for audio), draggable self-view picture-in-picture, bottom glass control bar (mute, camera, flip camera, end), call timer, connection quality indicator (via `getStats`), "Reconnecting..." state.
5. Device errors: permission denied, no camera/microphone, device busy; offer to continue audio-only.
6. Cleanup on end/unmount/page unload: stop all tracks, close the peer connection, release wake lock. Use `navigator.sendBeacon` or the STOMP disconnect to end the call.
7. Settings: "Hide my IP in calls (relay only)" toggle with explanation.
8. In-chat call log bubbles with "Call back" action.
9. Requires a secure context for `getUserMedia`: `localhost` is fine in development; production needs HTTPS.

## Tests
Backend: state machine (every transition and illegal transition), busy, timeout -> missed, non-participant signal rejected, size/rate limits, multi-tab accept-once, ICE credential HMAC format, block rules, disconnect grace. Frontend: `useCall` with a mocked `RTCPeerConnection`. **Playwright:** two contexts with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`; A calls B, B accepts, assert both `RTCPeerConnection.connectionState === 'connected'` and remote video has `currentTime` advancing; decline, cancel, busy and missed flows.

## Acceptance checklist
- [x] Voice and video calls connect between two browsers on the same machine and between two devices on the same Wi-Fi.
- [x] Decline, cancel, busy, missed and hang-up all leave the correct call-history message and free both users.
- [x] Mute and camera toggles work and are visible to the other side.
- [x] Killing one tab or the network ends or recovers the call cleanly, with no stuck "in call" state.
- [ ] Across different networks a call connects through TURN (test with a hosted TURN server).
- [x] Camera/microphone indicator turns off after every call.

## Commit
```bash
git add -A && git commit -m "Video Calls"
```
