# Smart Notes

A smart, open-source notes application with a clean API and modern stack.

**Current Docker image tag:** `v0.0.0`

## Features

- **Google sign-in** — no password to remember.
- **Colorful, Keep-like UI** — responsive grid of pastel note cards, animated background.
- **Folders & organization** — create custom folders (e.g. `/Groceries`, `/Bills`) and move/copy notes between them.
- **Search & pinning** — full-text search on title/content and pinned notes at the top.
- **Tags (Pinned / Important / Todo)** — quick icon tags visible in the list and editor.
- **Recently deleted (Trash)** — soft deletes with restore and delete-forever.
- **Dark mode** — persisted per user/device.
- **Open-source friendly** — typed React hooks and CI for lint + typecheck + tests.

## Structure

- **`frontend/`** — React + TypeScript + Vite UI
- **`docs/`** — Architecture, API reference, and contribution guides

## Quick start (local dev)

1. Install dependencies and run the app:

```bash
cd frontend
npm install
npm run dev
```

For backend/database setup and environment configuration, see the documentation in `docs/`.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting issues or pull requests.

## Running via Docker

The repo includes a multi-stage `Dockerfile` at the root. It:

- Builds the React app with **Node 20**.
- Serves the static build with **nginx** (SPA-ready config).

You can find ready-to-copy build, run, push, and pull commands in `DOCKER_COMMANDS.txt`. Those commands will automatically use the current released version tag.

## CI and tests

GitHub Actions runs on each push/PR:

- `npm run lint`
- `npm run typecheck`
- `npm test`

You can run the same locally from `frontend/`:

```bash
cd frontend
npm run lint
npm run typecheck
npm test
```

## License

MIT — see [LICENSE](LICENSE).
