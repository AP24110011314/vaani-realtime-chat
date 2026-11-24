# Vanni - Frontend Guide (React)

## Setup
```bash
cd frontend
npm create vite@latest . -- --template react      # JavaScript + React
npm i react-router-dom @tanstack/react-query axios @stomp/stompjs react-hook-form zod @hookform/resolvers date-fns lucide-react emoji-picker-react
npm i tailwindcss @tailwindcss/vite
npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw eslint prettier
```
`src/styles/index.css`:
```css
@import "tailwindcss";
@theme {
  --color-brand-50:#eef6ff; --color-brand-500:#2563eb; --color-brand-600:#1d4ed8; --color-brand-700:#1e40af;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
@custom-variant dark (&:where(.dark, .dark *));
```

## Conventions
- Function components + hooks only. Files are PascalCase for components, camelCase for hooks/utils.
- One component per file; keep under ~200 lines; extract hooks for logic.
- **Server state** (conversations, messages, users) -> TanStack Query. **Realtime events** update the Query cache with `queryClient.setQueryData` (append message, bump conversation, update receipts).
- **Client state** -> contexts: `AuthContext` (user, login, logout), `SocketContext` (status, subscribe/publish), `ThemeContext`.
- API modules wrap axios; components never call axios directly.
- Forms: React Hook Form + Zod; show inline errors and disable submit while pending.
- Never use `dangerouslySetInnerHTML`. Render content as text; linkify with a safe helper.
- Never put secrets in `VITE_*` variables.
- Accessibility: buttons are `<button>`, inputs have labels, focus rings visible, `aria-live="polite"` for new-message announcements and connection banner.

## Axios setup (`api/http.js`)
```js
import axios from 'axios'
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
  withXSRFToken: true,               // reads XSRF-TOKEN cookie -> X-XSRF-TOKEN header
})
// 401 interceptor: call /auth/refresh once (single-flight), retry original request, else logout.
```

## STOMP client (`lib/socket.js`)
```js
import { Client } from '@stomp/stompjs'
export function createSocket({ onConnect, onEvent, onStatus }) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const client = new Client({
    brokerURL: `${proto}://${location.host}${import.meta.env.VITE_WS_PATH || '/ws'}`,
    reconnectDelay: 2000,
    heartbeatIncoming: 10000, heartbeatOutgoing: 10000,
    onConnect: () => {
      client.subscribe('/user/queue/events', f => onEvent(JSON.parse(f.body)))
      onConnect?.()
    },
    onWebSocketClose: () => onStatus?.('reconnecting'),
    onStompError: f => console.warn('STOMP error', f.headers['message']),
  })
  return client
}
```

## Event handling map (`SocketContext`)
| Event | Cache update |
|---|---|
| `message.created` | append to `['messages', convId]`; bump & re-sort `['conversations']`; increment unread if not open; ack delivered; replace pending by `clientMessageId` |
| `message.updated` / `message.deleted` | patch message in cache |
| `receipt.updated` | patch status on my messages |
| `typing` | set in local typing map; auto-clear after 4 s |
| `presence.changed` | update `['presence']` map |
| `conversation.*` | update/remove in `['conversations']` |
| `unread.updated` | set unread count |

## Message list behaviour
- Render oldest -> newest; load older messages when scrolled to top (`useInfiniteScrollUp`, keep scroll position after prepend).
- Auto-scroll to bottom only if user is already near bottom; otherwise show "New messages" pill.
- Group consecutive bubbles by sender within 5 min; date separators ("Today", "Yesterday", date).
- Pending/failed states: clock icon / red "!" with Retry.

## Routing
`/` Landing - `/login`, `/register` (public only) - `/app` (protected shell) - `/app/c/:conversationId` - `/app/profile` - `/app/settings` - `*` NotFound.
On mobile, `/app` shows the list; `/app/c/:id` shows the chat with a back button.

## Testing
Vitest + RTL for components/hooks, MSW for API mocking, Playwright for E2E with two browser contexts. See `TESTING.md`.
