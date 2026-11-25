# Phase 15 - Scheduled Messages ("Send Later")

**Commit message:** `Scheduled Messages`
**Prerequisites:** Phases 4, 7 complete.
**Goal:** write a message now, choose when it is sent, manage and cancel scheduled messages.
**Read:** `DATABASE.md` (V11), `API.md` (Scheduled), `WEBSOCKET.md`

## Design decisions
1. Times are stored in **UTC**; the browser shows and picks in the user's local timezone (display the zone name, e.g. "Wed 26 Nov, 9:00 AM IST").
2. Limits: at least **1 minute** in the future, at most **90 days** ahead; max **50 pending** per user; text up to 4000 chars; up to 5 attachments (previously uploaded by the same user).
3. **Authorization is checked again at send time**: the user must still be an active member and not blocked. If it fails the item becomes `FAILED` with a reason and the user gets an event (never silently dropped).
4. **Exactly-once sending:** the scheduler claims rows with `SELECT ... WHERE status='PENDING' AND scheduled_for <= UTC_TIMESTAMP(3) ORDER BY scheduled_for LIMIT 50 FOR UPDATE SKIP LOCKED`, marks them `SENDING`, then calls `MessageService.send` with `clientMessageId = scheduled_messages.client_message_id` (a UUID created at scheduling). The existing unique key makes retries safe.
5. If the server was down, overdue messages are sent on startup (within 24 h of their time; older ones are marked `FAILED: MISSED`).
6. **Attachment reservation:** attachments linked to a pending schedule have `scheduled_message_id` set, so the orphan cleanup job (unattached > 24 h) must skip them. Cancelling releases them.
7. Mentions and replies are allowed; replies to a message that is later deleted still send.
8. Scheduled messages are private to the sender until sent.

## Backend tasks
1. Migration `V11__scheduled_messages.sql`.
2. `ScheduledMessageService`: `create`, `list(status)`, `update` (text/time only while `PENDING`), `cancel`, `sendNow`, `processDue()`.
3. `ScheduledMessageJob` (`@Scheduled(fixedDelay = 10000)`), transactional claim + send, failure handling with `attempts` (max 3 retries with backoff for transient errors).
4. Endpoints in `API.md`. Validate timezone-agnostic ISO UTC input and reject past times.
5. Events to the owner only: `scheduled.created|updated|sent|failed|cancelled` so multiple tabs stay in sync.
6. Update the attachment cleanup job as described.
7. Metrics/log line per run (count sent, failed) without message content.

## Frontend tasks
1. Composer **split send button**: main click sends now; chevron (and long-press on touch) opens a glass menu: quick picks ("Later today 6:00 PM", "Tomorrow 9:00 AM", "Monday 9:00 AM") computed in local time, and "Pick date and time" (native `datetime-local` styled, min = now + 1 min).
2. After scheduling: toast "Scheduled for ..." with Undo; a small chip above the composer "1 scheduled" opens a popover list for this chat.
3. `ScheduledPage` (route `/app/scheduled`, link in the sidebar menu): list grouped by day, status badges (Pending, Sent, Failed, Cancelled), actions Edit time, Edit text, Send now, Cancel; failed items show the reason and a Retry/Reschedule action.
4. When a scheduled message is sent, it appears in the chat normally via `message.created`.
5. Empty state, loading skeleton, error toasts, keyboard accessible menu.

## Tests
Claim logic with two concurrent scheduler instances (each message sent exactly once); idempotent retry; removed-from-group and blocked cases become `FAILED`; past/too-far times rejected; 51st pending rejected; cancel releases attachments and the cleanup job does not delete reserved ones; restart catch-up; timezone conversion helper tests (IST and a DST zone). Playwright: schedule 1 minute ahead (use a short test override such as `SCHEDULE_MIN_LEAD_SECONDS=5`), wait, recipient receives it.

## Acceptance checklist
- [ ] A message scheduled for 1-2 minutes ahead arrives on time for the recipient and appears once.
- [ ] Edit, cancel and send-now work; other tabs update live.
- [ ] Failure cases are visible, never lost.
- [ ] Attachments in scheduled messages survive the cleanup job.

## Commit
```bash
git add -A && git commit -m "Scheduled Messages"
```
