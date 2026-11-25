# Vanni - UI / UX Specification

## 1. Brand
- Name: **Vanni**. Tone: friendly, simple, fast.
- Logo: a text wordmark "Vanni" with a small speech-bubble glyph (SVG, inline). Favicon the same bubble.
- Colours: primary blue `#2563eb`, accent teal `#14b8a6`, neutrals from slate. Sent bubble = primary with white text; received = neutral surface. Dark mode via `.dark` class and CSS variables.
- Font: Inter (system fallback). Base 16 px, message text 15 px.
- Radius 12-16 px for bubbles/cards, 8 px for inputs. Subtle shadows.

## 2. Pages
| Page | Elements |
|---|---|
| Landing `/` | Hero with Vanni name + tagline, feature highlights, **Sign up** / **Log in** buttons, footer |
| Register | Name, email, password, confirm password, strength hint, errors inline, link to login |
| Login | Email, password (show/hide), remember-me note, error banner, link to register |
| Chat workspace `/app` | Left sidebar (profile chip, search, "New chat", "New group", conversation list with tabs All / Unread / Groups / Archived); right chat pane |
| Chat pane | Header (avatar, name, presence/typing, search, info), message list, composer |
| New chat modal | Debounced user search, result cards, click to open/create direct chat |
| New group modal | Group name, optional description/avatar, multi-select members (chips), Create |
| Group info panel | Avatar, name, description, members list with role badges, add/remove (admin), leave, mute |
| Profile | Avatar upload with preview, name, about, email (read-only), change password, privacy toggles, logout |
| Settings | Theme (system/light/dark), notifications permission, blocked users, sessions (logout all) |
| 404 | Friendly message and link home |

## 3. Layout and responsiveness
| Width | Layout |
|---|---|
| >= 1024 px | Two columns: sidebar 340 px + chat pane; optional third column info panel |
| 640-1023 px | Sidebar 300 px + chat; info panel as drawer |
| < 640 px | Single column: list **or** chat (route-driven), back arrow in header, composer sticky at bottom, safe-area padding, `100dvh` height |

Test at 360, 768, 1024, 1440 px.

## 4. Components and states
- **ConversationItem:** avatar with presence dot, title, last message snippet (with "You:" prefix, attachment icon), time, unread badge, mute/pin icons.
- **MessageBubble:** text, time, status ticks (clock pending, 1 tick sent, 2 ticks delivered, blue 2 ticks read), edited label, reply quote, reactions row, attachment preview, hover/long-press action menu (reply, react, copy, edit, delete, info).
- **MessageComposer:** auto-growing textarea (Enter send, Shift+Enter newline), emoji button, attach button, drag-drop/paste, reply banner, attachment chips with progress and remove, char counter near limit, disabled when offline (queue optional).
- **TypingIndicator:** animated dots; groups show "Asha is typing..." / "3 people are typing...".
- **ConnectionBanner:** "Reconnecting..." amber, "Back online" green (auto-hide).
- **Empty states:** no conversations (CTA to start chat), empty chat ("Say hi"), no search results.
- **Loading:** skeletons for list and messages. **Errors:** toast + inline retry.
- **Toasts** for non-blocking feedback; **Modal** with focus trap and Esc to close.

## 5. Interaction details
- Keyboard: `/` or `Ctrl+K` focus search, `Esc` close panels, `Up` edit last message (optional).
- Tab title: `(3) Vanni` when unread; restore on focus.
- Browser notifications only after explicit user action to enable; suppressed when tab focused or conversation muted.
- Sound toggle (optional, off by default).
- Reduced motion: respect `prefers-reduced-motion`.
- Image attachments open in a lightbox; files show icon, name, size, download.
- Long messages wrap (`break-words`); URLs linkified.

## 6. Accessibility checklist
- [ ] Colour contrast >= 4.5:1 (both themes).
- [ ] All icon buttons have `aria-label`.
- [ ] Logical tab order; visible focus.
- [ ] Message list is `role="log"` with `aria-live="polite"`.
- [ ] Forms announce errors.

## UI additions for Phases 11-17
- **Mention picker:** glass popover above the composer, max 8 rows, avatar + name, arrow/Enter/Tab/Esc. Mention pills use the accent colour; mentions of me get a soft accent outline on the bubble. "@" badge on conversations.
- **Invite link dialog and join page:** expiry/max-use/approval options; QR code card; `/join/:code` is a centred glass card with group avatar, name, member count and a single primary button.
- **Voice recorder / player:** pulsing red dot, live waveform, timer, trash and send; player with 64-bar waveform, scrubbing, speed chip. Voice messages have a distinct bubble with a mic glyph.
- **Link preview card:** rounded glass card, 16:9 image (lazy), site name in tertiary text, title (1 line), description (2 lines).
- **Scheduled:** split send button with chevron menu, "1 scheduled" chip above the composer, `/app/scheduled` list grouped by day with status badges.
- **Catch me up:** glass banner when 15+ unread; side sheet (bottom sheet on mobile) with Overview, Key points, Decisions, Action items, For you; each item has a "Jump" link; footer "AI-generated, may contain mistakes".
- **Calls:** header buttons (voice/video); full-screen incoming-call overlay; call screen with large remote video, draggable self-view, bottom glass control bar (mute, camera, flip, end), quality indicator and "Reconnecting..." state; call-log bubbles with "Call back".
- All new UI must follow the Vanni Glass theme tokens (no hard-coded colours, no purple/indigo) and keep contrast >= 4.5:1 in both themes.
