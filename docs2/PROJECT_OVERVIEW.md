# Vanni - Project Overview

## 1. What is Vanni?
Vanni is a browser-based, real-time messaging **web application**. Users open a URL, sign up, and chat without installing anything. It supports private chats, group chats, file sharing, live presence, typing indicators and read receipts.

## 2. Problem statement
People need a simple way to talk across devices without installing a dedicated app. A basic messenger needs secure accounts, reliable message storage, fast delivery and a clear conversation UI. Vanni provides this as a responsive web application.

## 3. Objectives
1. Responsive UI for modern desktop, tablet and mobile browsers.
2. Secure registration, login, logout and protected sessions.
3. One-to-one and group conversations.
4. Instant delivery via WebSocket (STOMP).
5. Persist users, conversations, messages and receipts in MySQL.
6. Presence, typing indicators and read receipts.
7. File/image attachments through managed storage.
8. Modular backend so features can be extended and tested.

## 4. User roles
| Role | Capabilities |
|---|---|
| Guest | View landing page, register, log in. No access to chats. |
| Registered user | Manage profile, search users, start direct chats, send messages, create/join groups, share attachments, read history. |
| Group member | Read/send in group, view members, receive group updates, leave group. |
| Group admin (creator + promoted) | Rename group, change group avatar, add/remove members, promote/demote admins. |

Release 1 has **no platform-wide admin dashboard**. The group creator administers their group.

## 5. Functional requirements
| ID | Requirement | Expected behaviour |
|---|---|---|
| FR-01 | Registration | Name, email, password; unique email; password rules. |
| FR-02 | Authentication | Login/logout; reject bad credentials; session refresh. |
| FR-03 | Profile | View/update display name, avatar, about text. |
| FR-04 | User search | Find users by name/email (min 2 chars, rate limited, excludes self). |
| FR-05 | Private chat | Start or reopen a one-to-one chat; never duplicates. |
| FR-06 | Group chat | Create group; add/remove members by permission. |
| FR-07 | Live messaging | Messages delivered in real time to online members. |
| FR-08 | History | Paginated (cursor) history, newest last, infinite scroll upward. |
| FR-09 | Presence | Online/offline and last seen (respecting privacy setting). |
| FR-10 | Typing | Temporary "typing..." indicator. |
| FR-11 | Receipts | Sent / delivered / read per recipient. |
| FR-12 | Attachments | Upload allowed files, send a secure reference. |
| FR-13 | Notifications | Unread badges, tab-title count, optional browser notification. |
| FR-14 | Message actions | Edit, delete (soft), reply, react. |
| FR-15 | Conversation controls | Mute, archive, pin, leave group. |
| FR-16 | Search | Search inside a conversation and across conversations. |
| FR-17 | Privacy | Block user, hide last seen / read receipts. |

## 6. Non-functional requirements
| Area | Requirement |
|---|---|
| Security | BCrypt, HttpOnly cookies, CSRF protection, membership checks everywhere. |
| Performance | Cursor pagination (page size 30), indexes on hot queries, lazy loading. |
| Reliability | Persist before broadcast; client auto-reconnect and resync missed messages. |
| Usability | Loading, empty, error and "reconnecting" states on every screen. |
| Responsiveness | 360px phone up to 1920px desktop. |
| Maintainability | Layered backend, DTOs, Flyway migrations, tests. |
| Accessibility | Keyboard navigable, ARIA labels, sufficient contrast, reduced-motion respected. |
| Scalability | Real-time layer isolated so an external broker can replace the in-memory one later. |

## 7. MVP (build these first)
1. Register and log in securely.
2. Search another user.
3. Create/reopen a one-to-one conversation.
4. Send/receive text in real time.
5. Store messages and load history.
6. Show basic online/offline status.
7. Responsive chat interface.

Then: groups, typing, receipts, attachments, notifications, edit/delete, and the extended features in `FEATURES.md`.

## 8. Deliverables
- React frontend, Spring Boot backend.
- MySQL schema (Flyway) and seed data.
- REST + WebSocket documentation (`API.md`, `WEBSOCKET.md`).
- Unit and integration tests.
- README with setup/run instructions.
- Screenshots and (optionally) a deployed demo URL.
