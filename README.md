# Smart Notes

A smart, open-source notes application with a clean API and modern stack.

**Current version / Docker image tag:** `v0.0.0` *(updated automatically on release)*

## Features

- **Google sign-in (Supabase Auth)** — no password to remember.
- **Colorful, Keep-like UI** — responsive grid of pastel note cards, animated background.
- **Folders & organization** — create custom folders (e.g. `/Groceries`, `/Bills`) and move/copy notes between them.
- **Search & pinning** — full-text search on title/content and pinned notes at the top.
- **Tags (Pinned / Important / Todo)** — quick icon tags visible in the list and editor.
- **Recently deleted (Trash)** — soft deletes backed by Supabase `deleted_at`, with restore and delete-forever.
- **Dark mode** — persisted per user/device.
- **Open-source friendly** — typed React hooks, Supabase migrations, and CI for lint + typecheck + tests.

## Structure

- **`frontend/`** — React + TypeScript + Vite UI
- **`supabase/`** — Database schema + migrations (Auth, notes, folders, tags)
- **`docs/`** — Architecture, API reference, and contribution guides

## Quick start (local dev)

1. Create a Supabase project and enable **Google** provider.

2. Create `frontend/.env` with your Supabase connection:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

3. Install deps & run the app:

```bash
cd frontend
npm install
npm run dev
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting issues or pull requests.

## Running via Docker

The repo includes a multi-stage `Dockerfile` at the root. It:

- Builds the React app with **Node 20**.
- Bakes in **Supabase env vars** at build time (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Serves the static build with **nginx** (SPA-ready config).

### Build an image (using your Supabase project)

If you want **everyone using this image to hit your Supabase DB**, pass *your* project’s URL + anon key here:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY \
  -t smart-notes-frontend .
```

> Warning: the Supabase **anon** key is intended for public clients, but it still has access to whatever you allow via RLS. Make sure your Supabase Row Level Security rules are locked down before sharing an image that embeds your anon key.

### Run the container

```bash
docker run --restart=always -p 4173:80 smart-notes-frontend
```

Then open:

- `http://localhost:4173`

All users hitting this container will authenticate and store notes **against the same Supabase project** you configured at build time.

If someone wants to use *their own* Supabase project instead of yours, they can rebuild the image with their own `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.

### Publish your image

If you want to push the image to Docker Hub (so others can just `docker pull` it), tag it under your username first:

```bash
docker tag smart-notes-frontend YOUR_DOCKERHUB_USERNAME/smart-notes-frontend:latest
docker push YOUR_DOCKERHUB_USERNAME/smart-notes-frontend:latest
```

Others can then run:

```bash
docker pull YOUR_DOCKERHUB_USERNAME/smart-notes-frontend:latest
docker run --restart=always -p 4173:80 YOUR_DOCKERHUB_USERNAME/smart-notes-frontend:latest
```

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

### Releasing a new version

1. Create and push a tag (e.g. `v1.2.3`) from the commit you want to release:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```
2. The **Release** workflow will run: it builds the frontend, runs tests, creates a GitHub Release with the build artifact, and updates `README.md` and `DOCKER_COMMANDS.txt` with the new version, then pushes that commit back to the branch.

## License

MIT — see [LICENSE](LICENSE).
