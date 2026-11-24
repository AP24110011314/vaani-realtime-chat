# Vanni - Git Workflow

## Rules
1. **One commit at the end of each phase.** Commit only after the phase's acceptance checklist is fully ticked and builds/tests pass.
2. **Commit messages are 2-3 words**, Title Case, no prefixes, no punctuation. Use exactly the messages in the table below.
3. Never commit secrets (`.env`, keys, `uploads/`, `node_modules/`, `target/`).
4. Do not amend or rewrite history unless asked. Do not push unless asked.

## Commit table
| Phase | Message |
|---|---|
| 1. Project setup | `Project Setup` |
| 2. Authentication | `Add Authentication` |
| 3. Direct chat | `Direct Conversations` |
| 4. Real-time messaging | `Realtime Messaging` |
| 5. Groups and presence | `Groups Presence` |
| 6. Receipts and unread | `Read Receipts` |
| 7. Attachments and profile | `File Sharing` |
| 8. Message enhancements | `Message Features` |
| 9. Quality and security | `Security Testing` |
| 10. Deployment and docs | `Production Ready` |

## Commands at the end of a phase
```bash
git status                         # review what changed
git add -A
git commit -m "Add Authentication"  # use the message from the table
git log --oneline -n 3             # verify
```

## First-time repository setup (Phase 1)
```bash
cd vanni
git init -b main
# create .gitignore first (see below), then do the Phase 1 commit
git remote add origin git@github.com:<you>/vanni.git    # optional, push later when asked
```

## `.gitignore`
```gitignore
# env and secrets
.env
.env.*
!.env.example
# backend
backend/target/
backend/uploads/
*.log
# frontend
frontend/node_modules/
frontend/dist/
frontend/coverage/
playwright-report/
test-results/
# IDE / OS
.idea/
.vscode/
*.iml
.DS_Store
```

## Branching (optional if working alone)
`main` is always working. If you prefer branches: `phase/02-auth` -> merge (squash) into `main` and keep the final single commit message as above.
