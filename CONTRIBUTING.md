# Contributing to Smart Notes

Thanks for your interest in contributing.

## Development setup

1. Fork and clone the repo.
2. Install dependencies (see [backend/README.md](backend/README.md) for the API).
3. Copy `.env.example` to `.env` and set required variables.

## Workflow

- Open an issue for bugs or features (use the issue templates when possible).
- Create a branch from `main`: `git checkout -b feature/your-feature` or `fix/your-fix`.
- Make small, focused commits. Follow existing code style.
- Add or update tests as needed.
- Open a pull request and link the related issue.

## Code style

- Use the existing formatting (Prettier/ESLint in backend).
- Keep the backend layered: routes → controllers → services → DB.

## Questions

Open a discussion or issue if something is unclear.
