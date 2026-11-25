# Vanni - Voice and Video Calls (WebRTC)

## 1. Architecture
```
 Browser A  <------------ media (DTLS-SRTP, peer-to-peer) ------------>  Browser B
    |                                                                       |
    |  signalling (STOMP over WebSocket, /app/call.*, /user/queue/events)   |
    +----------------------> Vanni backend (8080) <-------------------------+
                                  |
                       (when direct path fails)
                                  v
                         coturn TURN relay (3478)
```
- The backend only **relays signalling** (offer, answer, ICE candidates) and tracks call state. It never touches audio/video.
- Media is encrypted by WebRTC (DTLS-SRTP). A TURN server relays encrypted packets only.
- STUN discovers public addresses; TURN is the fallback when peers are behind strict NATs or firewalls (roughly 10-20 % of real-world connections).

## 2. Requirements
- `getUserMedia` needs a **secure context**: `http://localhost` works, any other host needs HTTPS.
- Same-machine testing between two browsers works without TURN (host candidates). Testing across networks needs TURN reachable from both sides.
- Docker Desktop on macOS cannot expose a large UDP port range reliably, so run coturn on a small cloud VM for cross-network tests, or use a hosted TURN provider. For local single-network tests STUN alone is enough.
- Ports (none are 5000/7000): TURN/STUN `3478` (UDP and TCP), TURN TLS `5349`, relay range `49160-49200` UDP.

## 3. Call state machine
```
IDLE --invite--> RINGING --accept--> CONNECTING --media up--> CONNECTED --end--> ENDED
                    |  \--decline--> ENDED(declined)
                    |  \--cancel (caller)--> ENDED(cancelled)
                    \--45 s timeout--> ENDED(missed)
CONNECTED --ICE disconnected--> RECONNECTING --restart ok--> CONNECTED
                                          \--15 s--> ENDED(failed)
```
End reasons: `COMPLETED, DECLINED, CANCELLED, MISSED, BUSY, FAILED, DISCONNECTED, HANDLED_ELSEWHERE`.

Rules enforced by the server: direct conversation only; both users active members; no block in either direction; each user in at most one call; only the callee can accept/decline; only the caller can cancel; either can end.

## 4. Signalling contract
Client -> server (`/app/...`):
| Destination | Payload |
|---|---|
| `call.invite` | `{conversationId, type: "AUDIO"|"VIDEO", clientCallId}` |
| `call.accept` | `{callId}` |
| `call.decline` | `{callId}` |
| `call.cancel` | `{callId}` |
| `call.end` | `{callId}` |
| `call.signal` | `{callId, kind: "offer"|"answer"|"candidate", payload}` (<= 16 KB) |

Server -> client (`/user/queue/events` envelope):
| `type` | `data` |
|---|---|
| `call.incoming` | `{callId, conversationId, caller: UserSummary, type}` |
| `call.ringing` | `{callId}` (to caller, once the callee is reachable) |
| `call.accepted` | `{callId}` (caller then creates the offer) |
| `call.declined` / `call.cancelled` / `call.busy` / `call.missed` | `{callId}` |
| `call.handled_elsewhere` | `{callId}` (callee's other tabs stop ringing) |
| `call.signal` | `{callId, kind, payload}` |
| `call.ended` | `{callId, reason, durationSec}` |
| `call.state` | `{callId, state}` (optional sync after reconnect) |

## 5. Negotiation flow
1. Caller `call.invite` -> server validates -> `call.incoming` to every callee session, `call.ringing` to caller.
2. Callee `call.accept` -> server notifies caller `call.accepted` and others `call.handled_elsewhere`.
3. Both fetch `GET /api/calls/ice-servers`, create `RTCPeerConnection({iceServers, iceTransportPolicy})`, add local tracks.
4. Caller `createOffer` -> `setLocalDescription` -> `call.signal(offer)`.
5. Callee `setRemoteDescription` -> `createAnswer` -> `setLocalDescription` -> `call.signal(answer)`.
6. Both send ICE candidates through `call.signal(candidate)` as they appear (`onicecandidate`). **Queue candidates that arrive before the remote description is set.**
7. `connectionState === "connected"` -> client reports nothing; the server marks `CONNECTED` when it sees the first `call.state` ping or on answer (choose one and document it in code).
8. If `connectionState` becomes `disconnected`, the caller runs an **ICE restart** (`createOffer({iceRestart:true})`).

## 6. TURN credentials (coturn REST API style)
coturn config (`turnserver.conf`):
```
listening-port=3478
tls-listening-port=5349
fingerprint
use-auth-secret
static-auth-secret=<TURN_SECRET>
realm=vanni
min-port=49160
max-port=49200
no-multicast-peers
no-cli
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
user-quota=12
total-quota=1200
```
Credential generation in Spring: `username = "<expiryUnixSeconds>:<userId>"`, `credential = Base64(HMAC-SHA1(TURN_SECRET, username))`, TTL 3600 s. Response:
```json
{ "iceServers": [
  { "urls": ["stun:stun.l.google.com:19302"] },
  { "urls": ["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp"],
    "username": "1764150000:42", "credential": "..." } ],
  "relayOnly": false }
```
The secret never leaves the server. Prefer your own STUN in production; the Google STUN address is fine for development.

## 7. Frontend implementation notes
- Keep WebRTC code in `lib/webrtc.js` (pure functions + a class), UI in `components/call/*`, state in `useCall`.
- Constraints: audio `{echoCancellation:true, noiseSuppression:true, autoGainControl:true}`; video `{width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30}, facingMode:"user"}`.
- Mute = `track.enabled = false` (keeps the connection). Camera off the same way (and optionally stop the track to turn off the camera light).
- Flip camera: `getUserMedia` with the other `facingMode`, then `sender.replaceTrack`.
- Quality indicator: poll `pc.getStats()` every 2 s (packet loss, RTT, jitter) and map to good/fair/poor.
- Ringtone: preloaded `<audio loop>`; if `play()` rejects, rely on the notification and title flash.
- Always stop tracks (`track.stop()`) and `pc.close()` on end, error and unmount.
- Screen share (stretch): `getDisplayMedia`, `replaceTrack` on the video sender.

## 8. Security and privacy
- Calls only between members of a direct chat; blocks respected.
- Signal relay validates participant and size; unknown `callId` is ignored.
- TURN credentials are short-lived and user-specific; TURN denies private IP ranges to stop it being used to probe your network.
- **IP exposure:** peer-to-peer reveals each side's IP address to the other. Offer the "relay only" setting (`iceTransportPolicy: "relay"`), which routes everything through TURN.
- Add `Permissions-Policy: camera=(self), microphone=(self)` and a CSP that allows the WebSocket origin.
- Never log SDP or ICE candidates (they contain IP addresses).

## 9. Database
See `DATABASE.md` V13: `call_logs` and `messages.call_log_id`.

## 10. Testing
- Unit: state machine, ICE credential generator, relay validation.
- Playwright with fake media: `chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] })`; grant `camera` and `microphone` permissions in the context.
- Manual matrix: Chrome-Chrome, Chrome-Safari, desktop-phone, same Wi-Fi, different networks (TURN), mobile data.
