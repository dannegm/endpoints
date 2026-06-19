# Bins — Project Context

## What is this

**Bins** is a real-time collaborative code editor and playground (Pastebin meets VS Code). Hosted at `bins.hckr.mx`, deployed on Vercel. Frontend-only React app — no custom backend. All persistence and real-time sync goes through Supabase directly from the client.

---

## Identity model

There is **no authentication**. Each user gets a UUID generated on first visit, stored in `localStorage`. This UUID is the user's permanent identity — it never changes.

Every Supabase request sends the UUID as a custom header:

```
x-client-id: <uuid>
```

Supabase RLS policies use `current_setting('request.headers')::json->>'x-client-id'` to identify the caller. Currently all RLS policies are permissive (`using (true)`); access control is enforced client-side.

The admin role is a user who has `VITE_ADMIN_KEY` stored in their `localStorage`. There is no server-side admin verification — it's trust-based for personal/self-hosted use.

---

## Database

**Supabase project**, schema: `bins` (not `public`). All tables are under `bins.*`.

### Tables

```sql
-- Anonymous user profiles
bins.profiles (
  uuid         uuid PRIMARY KEY,
  name         text NOT NULL,                    -- e.g. "lazy-panda"
  color_light  text NOT NULL DEFAULT '#e67e22',  -- cursor color on light themes
  color_dark   text NOT NULL DEFAULT '#f39c12',  -- cursor color on dark themes
  ip_hash      text,                             -- hashed public IP (first visit only)
  country      text,                             -- e.g. "MX"
  city         text,                             -- e.g. "Mexico City"
  user_agent   text,                             -- full UA string
  is_bot       boolean NOT NULL DEFAULT false,   -- true if webdriver or bot UA pattern
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
)

-- Bins (like a "paste" or "project")
bins.bins (
  id           text PRIMARY KEY,                 -- nanoid short ID, e.g. "xK3mPq"
  title        text DEFAULT 'Untitled',
  author_id    uuid NOT NULL REFERENCES bins.profiles(uuid) ON DELETE CASCADE,
  visibility   text DEFAULT 'public',            -- 'public' | 'unlisted' | 'private'
  is_readonly  boolean DEFAULT true,             -- only author can edit by default
  views        int DEFAULT 0,
  expires_at   timestamptz,                      -- null = never expires; set to now()+5min on create, cleared on first save
  packages     jsonb DEFAULT '[]'::jsonb,        -- npm packages used in runners
  forked_from  text REFERENCES bins.bins(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
)

-- Files inside a bin (max 10 per bin, max 500KB each)
bins.bin_files (
  id          text PRIMARY KEY,
  bin_id      text REFERENCES bins.bins(id) ON DELETE CASCADE,
  name        text NOT NULL,                     -- filename, e.g. "index.js"
  language    text DEFAULT 'markdown',           -- language ID
  content     text,                              -- plain text snapshot (for previews)
  ydoc_state  bytea,                             -- Yjs CRDT state (binary)
  position    int DEFAULT 0,                     -- tab order
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)

-- Collaborators (users who have opened a bin)
bins.bin_collaborators (
  bin_id    text REFERENCES bins.bins(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (bin_id, user_id)
)
```

### Key constraints

- `bin_file_max_size`: `CHECK (octet_length(content) <= 512000)` — 500KB max per file
- `enforce_bin_files_limit`: trigger that raises if a bin already has 10 files on INSERT

### Cron jobs

```sql
-- Every 5 minutes: delete expired bins (created but never saved)
'*/5 * * * *' → DELETE FROM bins.bins WHERE expires_at IS NOT NULL AND expires_at < now()

-- Every Monday 3am: delete bot profiles (cascades to their bins and files)
'0 3 * * 1' → DELETE FROM bins.profiles WHERE is_bot = true
```

---

## Supabase client

```js
// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';
import { settings } from './settings.js';

export const supabase = () => {
    const { uuid } = settings.get('user') ?? {};
    return createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { global: { headers: { 'x-client-id': uuid ?? '' } } }
    );
};
```

Always call `supabase()` as a function — it creates a fresh client with the current UUID. Use `supabase().from('bins')` — no `.schema('bins')` needed because `bins` is in the exposed schemas list.

---

## Real-time sync

Two Supabase Realtime channels per open bin:

| Channel | Purpose |
|---|---|
| `bin:{binId}:awareness` | Supabase Presence — who is online, which file they have active |
| `bin:{binId}:structure` | Broadcast — file CRUD events, bin metadata changes, cursor moves, nudge |

Yjs CRDT sync (actual document content) runs over a third channel per file:
`bin:{binId}:file:{fileId}` — Broadcast, carries binary Yjs update messages.

### Awareness payload (what each user broadcasts about themselves)

```js
{
  uuid: string,
  name: string,
  colorLight: string,   // hex
  colorDark: string,    // hex
  activeFileId: string,
  cursor: { lineNumber: number, column: number } | null
}
```

---

## Environment variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ADMIN_KEY=          # stored in localStorage to unlock admin mode
VITE_HTTP_PROXY_URL=     # e.g. https://endpoints.hckr.mx/proxys/custom — for HTTP runner
BINS_JWT_SECRET=     # secret for signing session transfer JWTs (jose)
```

---

## Key business rules

- A bin is created with `expires_at = now() + 5 minutes`. On the first save, `expires_at` is set to `null`. A cron job deletes bins that never got saved.
- `is_readonly = true` by default. Only the author (matched by `x-client-id === author_id`) can toggle it.
- Visibility `'private'` kicks all collaborators and removes them from `bin_collaborators`.
- `ydoc_state` (bytea) stores the full Yjs document state so late-joining users get the current document without replaying history.
- `content` (text) is a plain-text snapshot updated on every save — used for previews and search without loading Yjs.
- Fingerprint data (`ip_hash`, `country`, `city`, `user_agent`, `is_bot`) is written **only on first profile creation**, never updated on subsequent visits.
- `ip_hash` is a hex-encoded hash of the raw IP — raw IPs are never stored.

---

## HTTP proxy

The HTTP runner sends requests through a proxy to avoid CORS. The proxy endpoint is `VITE_HTTP_PROXY_URL` and expects the full target URL in the `x-proxy-target` header:

```
GET  {VITE_HTTP_PROXY_URL}
x-proxy-target: https://api.example.com/endpoint?foo=bar
```

For POST/PUT/PATCH: same header, body passes through as-is.

---

## Session transfer (planned, not yet implemented)

The plan is to sign a short-lived JWT containing `{ uuid }` using `BINS_JWT_SECRET` via the `jose` library. The user copies the link `https://bins.hckr.mx/login?token=eyJ...` to the new device. On `/login`, the token is verified, the UUID is extracted, and it overwrites the `uuid` in localStorage.

`BINS_JWT_SECRET` is a frontend env var and therefore visible in the bundle — this is acceptable for personal/self-hosted use.
