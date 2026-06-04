# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

A personal platform to spin up API endpoints quickly without bootstrapping a new project each time. The main output is consumable APIs, not a frontend app. The landing page at `home/` is just a fallback and is not a project concern.

Endpoints are served at `endpoints.hckr.mx/<project>`.
The shortener service has its own subdomain: `s.hckr.mx/`.

## Commands

```bash
# Backend dev server (hot reload via nodemon + Babel)
npm run dev

# Scaffold a new endpoint (also accepts a random name suggestion if no name is given)
yarn make <project-name>

# Build everything (backend + frontend fallback)
npm run build
npm run build:server   # Babel compiles src/ → build/
npm run build:client   # cd home && yarn build

# Start production server
npm start

# Format code
npm run format
```

## Architecture

### Two main services

**`src/endpoints/`** — collection of independent mini-projects. Each subfolder is self-contained and exposed automatically at `/{folder-name}`. No registration needed: `src/loader.js` scans the directory and mounts each `router.js`.

**`src/shortener/`** — URL shortening service, routed separately via subdomain (`s.*` / `shortener.*`).

### Endpoint structure

Each endpoint lives in `src/endpoints/{name}/` and must export a default Express `Router` from `router.js`. Beyond that, the structure is up to the endpoint.

Endpoints are **agnostic** — they must not reference or depend on sibling endpoints.

**Shared infrastructure** (available to all endpoints):
- `src/services/` — Supabase, Redis (Upstash), Winston logger, Umami analytics
- `src/helpers/` — common middlewares, validators, crypto utilities

If an endpoint needs something not covered by shared code, it should define its own middleware/service inside its own folder.

**Auth** is handled per-endpoint. There is no global auth mechanism yet.

### Path aliases

`@/*` resolves to `src/*` (configured in `.babelrc.js` and `jsconfig.json`).

### Key integrations

| Service | Purpose |
|---|---|
| Supabase | PostgreSQL DB + auth + file storage |
| Upstash Redis | Rate limiting + caching |
| Resend | Email delivery |
| OpenAI / OpenRouter | LLM features |
| Multer | File uploads |
| Metascraper | Link metadata extraction |

### Environment

Copy `.env.example` to `.env`. Logs are written to `logs/` by Winston.

## Code style

**No overengineering.** Write the simplest thing that works. If a feature needs one fetch call, write one fetch call — not a wrapper, not a class, not a helper. Complexity must be justified by actual need, not anticipated need.

- Plain JS throughout — no TypeScript unless absolutely necessary
- No abstractions, patterns, or extra layers unless the complexity is already there and demands it
