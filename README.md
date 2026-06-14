# endpoints

A personal platform to spin up API endpoints quickly without bootstrapping a new project each time. Each subfolder in `src/endpoints/` is a self-contained mini-project auto-mounted at `/{folder-name}` — no registration required.

Live at `endpoints.hckr.mx/<project>`. URL shortener at `s.hckr.mx/`.

---

## Getting started

```bash
cp .env.example .env   # fill in secrets
bun install
bun dev                # hot-reload dev server
```

---

## Commands

| Command           | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `bun dev`         | Dev server with hot reload                                  |
| `bun start`       | Production server                                           |
| `bun make <name>` | Scaffold a new endpoint (omit name for a random suggestion) |
| `bun run build`   | Build the home/ frontend                                    |
| `bun run format`  | Format code with Prettier                                   |

---

## Architecture

```
src/
├── index.js          # Express server bootstrap
├── loader.js         # Auto-mounts every endpoint found in src/endpoints/
├── allowed-list.js   # Blacklist for disabled modules
├── endpoints/        # Independent mini-projects
├── shortener/        # URL shortening service (subdomain-routed)
├── services/         # Shared services (Supabase, Redis, logger, ntfy, TOTP)
└── helpers/          # Shared utilities (middlewares, crypto, http, validators)
```

### How endpoints work

`loader.js` scans `src/endpoints/` at startup and mounts any folder that exports a default Express `Router` from `router.js`. The folder name becomes the route prefix. No explicit registration needed.

Each endpoint is **self-contained** — it must not import from sibling endpoints. Shared infrastructure lives in `src/services/` and `src/helpers/`.

Path alias `@/*` → `src/*` is configured in `jsconfig.json` and resolved natively by Bun.

---

## Endpoints

### `GET /health`

Liveness check. Returns `"OK - health"`.

---

### `/bookworms` — AI-powered book library

Curates book collections using LLM agents. Includes fuzzy book matching, AI-generated topics and collections, file uploads, and settings management.

- Auth: `BOOKWORMS__APP_KEY`
- DB: Supabase (`bookworms` schema)
- See [`src/endpoints/bookworms/COLLECTIONS_API.md`](src/endpoints/bookworms/COLLECTIONS_API.md) for full API spec

---

### `/quotes` — Quote management

Multi-space quote storage with publish controls, view tracking, and rate-limited access.

- Auth: `QUOTES_SECRET_TOKEN`
- DB: Supabase (`quotes` schema)
- Cache: Upstash Redis

---

### `/hermes` — Server-Sent Events pub/sub

Real-time event streaming over SSE. Clients subscribe to a topic and receive events pushed by publishers.

| Method | Path                 | Description                      |
| ------ | -------------------- | -------------------------------- |
| `GET`  | `/sub/:topic`        | Subscribe to a topic             |
| `POST` | `/pub/:topic/:event` | Publish event to all subscribers |

- Auth: `APP_KEY`

---

### `/doxer` — Request inspector

Echoes back client metadata for debugging. Returns IP, location, headers, body, query params, cookies, and more. Masks sensitive environment variables.

- Auth: `APP_KEY`

---

### `/manayo` — Japanese language cards

Generates Magic: The Gathering-style Japanese learning cards via LLM. Supports prompt-based or random card generation with duplicate detection.

| Method | Path          | Description         |
| ------ | ------------- | ------------------- |
| `POST` | `/ai/suggest` | Generate a card     |
| `GET`  | `/settings`   | Fetch configuration |

- LLM: OpenRouter
- DB: PocketBase

---

### `/proxys` — HTTP proxy

Forwards requests to upstream services with header/query injection and CORS bypass. Currently proxies:

- `/meteo` → `https://api.open-meteo.com`

---

### `/puedopasar` — CDMX air quality

Scrapes and serves Mexico City air quality status from `ssc.cdmx.gob.mx`. Returns cached data if the scraper fails. Refresh is rate-limited.

| Method | Path       | Description              |
| ------ | ---------- | ------------------------ |
| `GET`  | `/data`    | Current air quality data |
| `POST` | `/refresh` | Trigger a data refresh   |

- Auth: `APP_KEY`

---

### `/guestbook` — File download proxy

Proxies file downloads from external URLs with custom filenames.

| Method | Path              | Description             |
| ------ | ----------------- | ----------------------- |
| `GET`  | `/proxy/download` | `?url=...&filename=...` |

---

### `/starfish` — TOTP generator

Generates a Time-based One-Time Password using `APP_KEY` as the secret.

| Method | Path   | Description        |
| ------ | ------ | ------------------ |
| `GET`  | `/otp` | Current TOTP + URI |

---

### URL Shortener (`s.hckr.mx/`)

Routed by subdomain (`s.*` / `shortener.*`).

| Method | Path          | Description                |
| ------ | ------------- | -------------------------- |
| `POST` | `/shorten`    | Create short link          |
| `GET`  | `/:code`      | Redirect to original URL   |
| `GET`  | `/meta/:code` | Link metadata              |
| `GET`  | `/qr/:code`   | QR code PNG                |
| `GET`  | `/all`        | List all links (paginated) |

Features: SHA1 dedup, hit tracking (IP + location + referrer), QR generation, temporary/permanent redirects.

---

## Shared services

| Service  | File                           | Description                                    |
| -------- | ------------------------------ | ---------------------------------------------- |
| Supabase | `services/supabase.js`         | PostgreSQL client, access via `.schema(name)`  |
| Redis    | (via `helpers/middlewares.js`) | Upstash sliding-window rate limiting           |
| Logger   | `services/logger.js`           | Winston — console + file output, custom levels |
| Ntfy     | `services/ntfy.js`             | Push notifications via ntfy.sh WebSocket       |
| Security | `services/security.js`         | TOTP generation                                |

---

## Shared helpers

| Helper                   | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `helpers/middlewares.js` | API key validation, rate limiting, query param parsing |
| `helpers/crypto.js`      | SHA1, nanoid, AES encryption, Base64                   |
| `helpers/http.js`        | Client IP detection, ipinfo.io geolocation             |
| `helpers/strings.js`     | Text manipulation                                      |
| `helpers/validators.js`  | Input validation                                       |
| `helpers/builders.js`    | Subdomain router construction                          |

---

## Adding a new endpoint

```bash
bun make my-endpoint
```

This scaffolds `src/endpoints/my-endpoint/router.js` with a default Express Router. The endpoint is immediately available at `/my-endpoint` — no other changes needed.

To disable an endpoint without deleting it, add its folder name to `src/allowed-list.js`.

---

## Environment

Copy `.env.example` to `.env`. Key variables:

| Variable                        | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `PORT`                          | Server port (default: 3000)          |
| `APP_KEY`                       | Global API key for shared middleware |
| `SUPABASE_URL` / `SUPABASE_KEY` | Supabase connection                  |
| `UPSTASH_REDIS_REST_URL/TOKEN`  | Upstash Redis                        |
| `OPENAI_API_KEY`                | OpenAI                               |
| `OPENROUTER_API_KEY`            | OpenRouter                           |
| `RESEND_API_KEY`                | Email via Resend                     |

Per-endpoint variables follow the pattern `ENDPOINT_NAME__VAR`.

Logs are written to `logs/` by Winston.

---

## Tech stack

| Technology          | Purpose                   |
| ------------------- | ------------------------- |
| Bun                 | Runtime & package manager |
| Express             | HTTP server               |
| Supabase            | PostgreSQL + storage      |
| Upstash Redis       | Rate limiting & caching   |
| OpenAI / OpenRouter | LLM features              |
| Resend              | Email delivery            |
| Winston             | Logging                   |
| OTPAuth             | TOTP                      |
| Plop                | Endpoint scaffolding      |
