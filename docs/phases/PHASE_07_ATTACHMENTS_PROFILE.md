# Phase 7 - Attachments and Profile

**Commit message:** `File Sharing`
**Goal:** safe file/image sharing and complete profile management.
**Read:** `SECURITY.md` (sections 4-5), `API.md` (Attachments, Users avatar), `ARCHITECTURE.md` (5.5)

## Backend tasks
1. Migration `V5__attachments.sql`.
2. `StorageService` interface (`put`, `get/stream`, `delete`, `signedUrl?`) with `LocalStorageService` (dir `STORAGE_LOCAL_DIR`, random keys, no user-supplied paths) and one cloud implementation selected by `STORAGE_PROVIDER` (Cloudinary or S3). Cloud credentials stay server-side.
3. `AttachmentService.upload`: size limit, **content-sniffed MIME** (Apache Tika) vs allowlist, sanitised file name, image dimensions, EXIF strip for images; create unattached row.
4. `MessageService.send` accepts `attachmentIds` (must belong to sender and be unattached); message type `IMAGE`/`FILE`; allow empty text when attachments exist.
5. `GET /attachments/{id}` with membership check, `Content-Disposition`, `nosniff`.
6. Avatar endpoints for user (`POST/DELETE /users/me/avatar`, <= 2 MB images only); `PATCH /users/me` already exists - add `about`.
7. Scheduled job: delete unattached uploads older than 24 h.
8. Rate limit uploads.

## Frontend tasks
1. Attach button, drag-and-drop, paste-image support in `MessageComposer`; chips with progress and cancel; client-side size/type check (server remains authority).
2. `AttachmentPreview` in bubbles: inline image thumbnails, file card (icon, name, size, download).
3. `ProfilePage`: avatar upload with preview, display name, about, email (read-only), change password, logout; `UserAvatar` shows image or initials fallback everywhere.
4. Lightbox for images (basic; full polish in Phase 8).

## Tests
Reject: too large, disallowed type, `.exe` renamed `.png`, path-traversal file name. Authorization: non-member download 403/404; foreign attachmentId in send rejected. Avatar update reflected in conversation DTOs.

## Acceptance checklist
- [ ] Send an image and a PDF; both arrive live and download correctly.
- [ ] Spoofed extension rejected.
- [ ] Another user's conversation attachment URL is inaccessible.
- [ ] Avatar and name changes appear for other users without re-login.
- [ ] No storage credentials in frontend bundle or logs.

## Commit
```bash
git add -A && git commit -m "File Sharing"
```
