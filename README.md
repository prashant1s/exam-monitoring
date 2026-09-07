# Exam Proctor

Live-proctored online examinations: students take timed exams in locked-down fullscreen while
behavioral signals (tab switches, copy/paste, fullscreen exits, etc.) and on-device AI vision
(face/gaze/object detection) are captured, streamed to a proctor in real time, and persisted for
post-exam review with a computed integrity score. See [project.md](./project.md) for the full spec.

## Running locally

Two processes: the Next.js app, and the Socket.IO realtime service.

```bash
npm install
npm run db:push     # sync Prisma schema to Postgres
npm run db:seed      # create admin/proctor/student test accounts + a sample exam

npm run dev          # Next.js app on :3000
npm run realtime     # Socket.IO service on :4000 (separate terminal)
```

Seed accounts (password `password123`): `admin@example.com`, `proctor@example.com`, `student@example.com`.

### Database

`DATABASE_URL` in `.env` points at a local PostgreSQL database (`examdb`, role `exam_app`). Any
Postgres works — a local install, or `docker compose up -d postgres redis` using the included
`docker-compose.yml` if you'd rather run it in a container. `REDIS_URL` is optional: scoring runs
inline on submit either way, and `npm run worker` only does anything once `REDIS_URL` is set.

### Optional integrations (left blank in `.env`)

These are stubbed to fail gracefully (503 with a clear message) until configured — nothing else
depends on them for local development:

- **LiveKit** (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) — candidate video/audio and
  the proctor's live grid. Get free dev credentials at [livekit.io](https://livekit.io), or run
  `livekit-server --dev` / the `livekit` service in `docker-compose.yml`.
- **R2/S3** (`R2_*`) — recording storage and AI-proctoring snapshot evidence uploads.
- **Resend** (`RESEND_API_KEY`) — invite/warning/report emails (not yet wired into any route).

## Deploying

Three independent deploy targets. You can do just the first one and the app is still fully usable
(auth, exam CRUD, the student/admin flows) — live video and realtime proctor alerts need the other
two as well.

### 1. Web app → Vercel

```bash
npm i -g vercel      # if you don't have it
vercel login
vercel link          # run from the repo root
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add NEXT_PUBLIC_APP_URL production        # your vercel URL, e.g. https://your-app.vercel.app
vercel env add NEXT_PUBLIC_SOCKET_URL production      # from step 2, e.g. https://your-realtime.up.railway.app
vercel env add SOCKET_JWT_SECRET production            # must match the realtime service's value
vercel deploy --prod
```

Notes:
- `postinstall` runs `prisma generate` automatically on every install, so Vercel's build always has
  a matching client — nothing extra to configure there.
- `serverExternalPackages: ["argon2"]` in `next.config.ts` keeps argon2's native binding out of the
  serverless bundle; it's a no-op locally, just required for Vercel.
- Any Postgres works for `DATABASE_URL`. [Neon](https://neon.tech) has a free tier and a one-click
  Vercel integration (Storage tab → Connect Database → Neon). **Use Neon's pooled connection string**
  (`-pooler` in the hostname) — serverless functions open far more concurrent connections than a
  long-lived server does, and the direct (non-pooled) string will exhaust Postgres's connection limit
  under load.
- `NEXT_PUBLIC_*` vars are baked in at build time — set them *before* `vercel deploy --prod`, not after.
- LiveKit/R2/Resend env vars: add them the same way once you have those accounts; every route that
  needs them already checks and returns a clear 503 instead of crashing when they're unset.

### 2. Realtime service → Railway

```bash
npm i -g @railway/cli   # if you don't have it
railway login
railway init             # or: railway link, if a project already exists
railway variables set DATABASE_URL="..." AUTH_SECRET="..." SOCKET_JWT_SECRET="..." NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
railway up
```

`railway.json` at the repo root already points Railway's start command at
`npm run start:realtime` (Nixpacks build, health check on `/health`) — no dashboard configuration
needed beyond the env vars above. `SOCKET_JWT_SECRET` here must be the exact same value you set on
Vercel; it's how the Next.js app's `/api/socket-token` route and this service agree on a signed JWT.
Once it's up, set `NEXT_PUBLIC_SOCKET_URL` on Vercel to this service's Railway URL and redeploy.

### 3. Video → LiveKit Cloud (optional)

Sign up at [livekit.io](https://livekit.io), create a project, and set `LIVEKIT_URL`,
`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (server-side only, on Vercel — the client gets the LiveKit
URL dynamically from `/api/livekit/token`, not a public env var). Recordings need `R2_*` (or any
S3-compatible bucket) set the same way.

### What's implemented vs. simplified

Implemented end-to-end and verified: auth + RBAC (admin/proctor/student), exam & question CRUD,
student exam runtime (server-authoritative timer, autosave, autosubmit), the Socket.IO event
pipeline (behavioral guard hook → realtime fan-out → batched Postgres persistence → live proctor
alert feed), proctor warn/terminate, integrity scoring, and the post-exam report/timeline view.

Simplified from the original spec for a single-repo, no-monorepo setup: the realtime service is a
second entry point in this same package (not a separate deployable workspace) so it shares Prisma
and types via relative imports. The proctor grid subscribes to LiveKit video only on tile-expand
rather than all tiles at once. Background scoring recompute (BullMQ) is best-effort — submit
already computes the score inline, so the worker is optional.
