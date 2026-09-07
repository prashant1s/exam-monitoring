1. Project Overview

Build a web platform where students take timed exams while proctors monitor them live (video + behavioral signals), and admins manage exams, users, and review flagged sessions afterward.

The three pillars of monitoring:

Live video/audio — the proctor sees a real-time grid of every candidate's webcam feed.
Behavioral integrity signals — tab switches, window blur, fullscreen exit, copy/paste, right-click, dev-tools, multiple monitors, network loss.
AI/vision proctoring (client-side) — face present / no face / multiple faces / looking away / phone or book detected.

Every signal becomes a timestamped event that (a) streams live to the proctor and (b) is persisted for post-exam review with a computed integrity score.

2. Roles & Core User Flows
Role	Can do
Admin	Create/manage exams, questions, users; assign proctors; view all reports
Proctor	Live-monitor assigned exam sessions, receive alerts, flag/annotate, send warnings to candidates, review recordings
Student (Candidate)	Pass a pre-check (camera/mic/network/environment), take the exam in locked-down fullscreen, submit

Student flow: login → pick exam → system pre-check (grant camera+mic, face detected, single monitor, fullscreen) → enter exam (locked down) → answer questions with a countdown timer → auto-submit on time-out or manual submit → session sealed.

Proctor flow: login → dashboard of live/upcoming exams → open an exam room → live grid of candidate tiles (video + live event badges) → click a tile to expand + chat/warn → triage the alert feed → close/flag session.

3. Tech Stack (with rationale)

Chosen to be the best fit, not just the most popular.

Concern	Choice	Why
Framework	Next.js 15 (App Router) + React 19 + TypeScript	Required base; RSC + route handlers cover the app and the REST API in one repo
Styling / UI	Tailwind CSS v4 + shadcn/ui + Radix + lucide-react	Fast, accessible, consistent components
Client state / data	TanStack Query (server data) + Zustand (exam runtime state)	Query for caching/mutations; Zustand for the low-latency in-exam state machine
Auth	Auth.js (NextAuth v5) — credentials + JWT sessions, role claims	Self-hosted, role-based, works with the custom server. (Swap to Clerk if you want managed.)
Database	PostgreSQL via Prisma ORM	Relational data (users, exams, sessions, events); Prisma types end-to-end
Object storage	Cloudflare R2 or AWS S3	Video recordings, snapshot evidence, question media
Live media (WebRTC)	LiveKit (open-source SFU; Cloud or self-hosted) + livekit-client / @livekit/components-react	This is the single most important choice. An SFU scales 1 proctor → many candidates. Do not hand-roll mesh WebRTC for >3 peers. LiveKit also gives server-side Egress recording to S3/R2.
Real-time events	Socket.IO on a custom Node server (colocated with Next via server.ts, or a standalone service)	Behavioral events (tab switch etc.) are tiny, high-frequency messages — a dedicated WS channel beats polling. Serverless functions can't hold sockets, so run a long-lived Node process.
AI vision (in-browser)	MediaPipe Tasks Vision (FaceLandmarker for face/gaze/head-pose) + TensorFlow.js COCO-SSD (detect cell phone, book, laptop)	Runs on the candidate's device → no video egress needed for detection, privacy-friendly, low server cost.
Background jobs	BullMQ + Redis (score computation, recording post-processing, report PDF)	Offload heavy work from request path
Email/notify	Resend (invites, warnings, reports)	Simple transactional email
Validation	Zod everywhere (API input, env, forms via react-hook-form)	One schema, client + server
Deploy	Next app on Vercel (or Node host if using the custom server); Socket.IO + LiveKit + Redis on Railway / Fly.io / a VM; DB on Neon/Supabase/RDS	See §15

Deployment note: If you keep Socket.IO inside Next.js via a custom server.ts, you cannot deploy on Vercel serverless — deploy that server to a Node host (Railway/Fly/Render/EC2). The cleanest production topology is Next.js on Vercel + a separate realtime Node service for Socket.IO. Both are described below; pick one.

4. High-Level Architecture
┌──────────────────────────────────────────────────────────────────────┐
│                         CANDIDATE BROWSER                              │
│  Next.js exam UI (fullscreen, locked)                                  │
│   • getUserMedia → local camera/mic                                    │
│   • MediaPipe FaceLandmarker + TFJS COCO-SSD  (runs on-device)         │
│   • Integrity hooks: visibility/blur/fullscreen/copy/paste/devtools    │
│         │ publish media                    │ emit tiny JSON events     │
│         ▼                                   ▼                          │
└─────────┼───────────────────────────────────┼─────────────────────────┘
          │ WebRTC (SFU)                       │ WebSocket
          ▼                                    ▼
   ┌─────────────┐                    ┌────────────────────┐
   │  LiveKit    │  server egress →   │  Socket.IO service │
   │  SFU (media)│  ───────────────►  │  (event fan-out)   │
   └─────┬───────┘        R2/S3       └─────────┬──────────┘
         │ subscribe                             │ live events + alerts
         ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          PROCTOR BROWSER                               │
│  Live grid of candidate video tiles + real-time alert feed + chat      │
└──────────────────────────────────────────────────────────────────────┘

           ┌───────────────── Next.js App (Vercel) ─────────────────┐
           │  RSC pages • Route Handlers (REST) • Auth.js           │
           │  Prisma ──► PostgreSQL      BullMQ ──► Redis (jobs)     │
           └────────────────────────────────────────────────────────┘

Why events and media are separate channels: media is heavy and needs an SFU; behavioral events are hundreds of tiny messages that need sub-second fan-out and durable logging. Splitting them keeps each simple and independently scalable.

5. Directory Structure (monorepo-lite, single repo)
exam-proctor/
├─ apps/
│  ├─ web/                         # Next.js 15 app (App Router)
│  │  ├─ app/
│  │  │  ├─ (auth)/login/…
│  │  │  ├─ (student)/
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ exam/[sessionId]/precheck/
│  │  │  │  └─ exam/[sessionId]/live/      # the locked-down exam runtime
│  │  │  ├─ (proctor)/
│  │  │  │  ├─ dashboard/
│  │  │  │  └─ room/[examId]/               # live monitoring grid
│  │  │  ├─ (admin)/
│  │  │  │  ├─ exams/  users/  reports/
│  │  │  ├─ api/                            # Route Handlers (REST)
│  │  │  │  ├─ auth/[...nextauth]/
│  │  │  │  ├─ livekit/token/               # mints LiveKit JWTs
│  │  │  │  ├─ sessions/…  events/…  exams/…
│  │  │  └─ layout.tsx
│  │  ├─ components/  (ui/, exam/, proctor/, precheck/)
│  │  ├─ lib/
│  │  │  ├─ auth.ts  prisma.ts  livekit.ts  socket-client.ts
│  │  │  ├─ vision/ (face-landmarker.ts, object-detector.ts, gaze.ts)
│  │  │  └─ integrity/ (useProctorGuards.ts, events.ts, scoring.ts)
│  │  ├─ stores/ (examStore.ts)             # Zustand
│  │  └─ …
│  └─ realtime/                    # standalone Socket.IO service (Node)
│     ├─ src/index.ts  rooms.ts  auth.ts  persist.ts
│     └─ package.json
├─ packages/
│  ├─ db/           # Prisma schema + client (shared)
│  └─ shared/       # zod schemas, event types, enums (shared web ↔ realtime)
├─ prisma/schema.prisma
├─ docker-compose.yml               # postgres + redis + livekit (local dev)
└─ turbo.json
6. Data Model (Prisma)
prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { ADMIN PROCTOR STUDENT }
enum ExamStatus { DRAFT SCHEDULED LIVE ENDED }
enum SessionStatus { PENDING PRECHECK IN_PROGRESS SUBMITTED FLAGGED TERMINATED }
enum EventType {
  TAB_HIDDEN WINDOW_BLUR FULLSCREEN_EXIT COPY PASTE RIGHT_CLICK
  DEVTOOLS_OPEN NETWORK_LOST NETWORK_BACK MULTIPLE_MONITORS RESIZE
  FACE_NONE FACE_MULTIPLE LOOKING_AWAY PHONE_DETECTED BOOK_DETECTED
  MIC_LEVEL_HIGH CAMERA_OFF PROCTOR_WARNING JOINED LEFT SUBMITTED
}
enum Severity { INFO LOW MEDIUM HIGH CRITICAL }

model User {
  id        String  @id @default(cuid())
  email     String  @unique
  name      String
  role      Role    @default(STUDENT)
  password  String                       // argon2 hash
  sessions  ExamSession[] @relation("candidate")
  proctored ExamSession[] @relation("proctor")
  createdAt DateTime @default(now())
}

model Exam {
  id          String     @id @default(cuid())
  title       String
  description String?
  startsAt    DateTime
  durationMin Int
  status      ExamStatus @default(DRAFT)
  settings    Json       // { requireFullscreen, blockCopyPaste, allowedTabSwitches, aiProctoring:{face,object,gaze}, recording }
  questions   Question[]
  sessions    ExamSession[]
  createdBy   String
  createdAt   DateTime   @default(now())
}

model Question {
  id       String @id @default(cuid())
  examId   String
  exam     Exam   @relation(fields:[examId], references:[id], onDelete: Cascade)
  order    Int
  type     String  // MCQ | MULTI | SHORT | LONG | CODE
  prompt   String
  options  Json?   // for MCQ/MULTI
  answer   Json?   // correct answer (never sent to client)
  points   Int     @default(1)
}

model ExamSession {
  id            String        @id @default(cuid())
  examId        String
  exam          Exam          @relation(fields:[examId], references:[id])
  candidateId   String
  candidate     User          @relation("candidate", fields:[candidateId], references:[id])
  proctorId     String?
  proctor       User?         @relation("proctor", fields:[proctorId], references:[id])
  status        SessionStatus @default(PENDING)
  startedAt     DateTime?
  submittedAt   DateTime?
  integrityScore Int?         // 0–100, computed
  livekitRoom   String        @unique
  recordingUrl  String?
  answers       Answer[]
  events        MonitorEvent[]
  @@unique([examId, candidateId])
}

model Answer {
  id        String      @id @default(cuid())
  sessionId String
  session   ExamSession @relation(fields:[sessionId], references:[id], onDelete: Cascade)
  questionId String
  value     Json
  updatedAt DateTime    @updatedAt
  @@unique([sessionId, questionId])
}

model MonitorEvent {
  id        String      @id @default(cuid())
  sessionId String
  session   ExamSession @relation(fields:[sessionId], references:[id], onDelete: Cascade)
  type      EventType
  severity  Severity    @default(INFO)
  at        DateTime    @default(now())
  meta      Json?       // { durationMs, confidence, snapshotUrl, count }
  @@index([sessionId, at])
}
7. Authentication & Authorization
Auth.js (NextAuth v5) with a Credentials provider; passwords hashed with argon2. JWT session carries role and userId.
Middleware (middleware.ts) gates route groups by role: /(admin) → ADMIN, /(proctor) → PROCTOR|ADMIN, /(student) → STUDENT.
API route handlers re-check the session server-side (never trust the client). A candidate can only read/write their own session; a proctor only sessions for exams they're assigned to.
LiveKit tokens are minted server-side per session (/api/livekit/token) with scoped grants: candidates get canPublish, proctors get canSubscribe only. Never expose the LiveKit API secret to the browser.
Socket.IO handshake is authenticated with the same JWT; the server derives room membership from the DB, not from client claims.
8. Core Feature Specs
8.1 Exam management (Admin)

CRUD for exams and questions; a JSON settings blob toggles enforcement (fullscreen required, copy/paste blocked, max tab switches before auto-flag, which AI checks are on, recording on/off). Schedule window (startsAt + durationMin). Assign proctors.

8.2 Student exam runtime
Enter fullscreen on start; a Zustand examStore holds {questions, currentIndex, answers, timeLeft, status}.
Answers autosave (debounced) to /api/sessions/:id/answers; server is source of truth for the timer (compute timeLeft from startedAt + durationMin — never trust client clock).
Question navigator, flag-for-review, autosubmit at timeLeft === 0.
Runtime never receives correct answers.
8.3 Camera & mic access

getUserMedia({ video, audio }) during pre-check; stream is (a) published to LiveKit and (b) fed to the vision loop. Handle NotAllowedError / NotFoundError gracefully — no permission ⇒ can't start the exam (configurable). See snippet §10.1.

8.4 Live video monitoring (LiveKit)
Each session = one LiveKit room (livekitRoom). Candidate publishes video+audio; proctor subscribes to N rooms (or one room per exam with all candidates — pick room-per-session for isolation and simpler recording).
Proctor grid uses @livekit/components-react with adaptive stream + dynamic simulcast layers so 30 tiles don't melt the CPU (request low-res for the grid, high-res on tile expand).
Recording: LiveKit Egress records each room to R2/S3; store recordingUrl on the session for post-exam playback synced to the event timeline.
8.5 Behavioral / lockdown detection (candidate side)

A single useProctorGuards() hook wires all of these and emits events (snippet §10.2):

Tab hidden / return: document.visibilitychange → TAB_HIDDEN.
Window blur/focus: window.blur/focus → WINDOW_BLUR (catches alt-tab, second app).
Fullscreen exit: fullscreenchange → FULLSCREEN_EXIT (offer re-enter; count strikes).
Copy/paste/right-click: block + log when settings.blockCopyPaste.
DevTools heuristic: window-size delta + debugger timing check → DEVTOOLS_OPEN (best-effort, mark low confidence).
Multiple monitors: window.screen.isExtended (Window Management API, where available) → MULTIPLE_MONITORS.
Network: navigator.onLine + heartbeat gaps → NETWORK_LOST/BACK.

Enforcement policy comes from exam.settings (e.g., 3 tab switches ⇒ auto-flag; fullscreen exit ⇒ warn then terminate).

8.6 AI vision proctoring (candidate side, on-device)

Run a throttled loop (~4–6 fps, not every frame) on the local camera stream:

Face presence & count via MediaPipe FaceLandmarker → FACE_NONE (no face > 3s), FACE_MULTIPLE (≥2 faces).
Gaze / head-pose from landmarks (eye + nose vectors) → LOOKING_AWAY when yaw/pitch exceed threshold for a sustained window (debounce to kill false positives).
Object detection via TFJS COCO-SSD → flag cell phone, book, laptop with confidence.
On a HIGH event, capture a snapshot (canvas → JPEG), upload to R2, attach snapshotUrl to the event as evidence.
All inference is client-side; only compact event JSON (+ optional snapshot) leaves the device. See §10.3.
8.7 Proctor live dashboard
Left: live grid of candidate tiles, each showing name, a rolling severity badge, and last event.
Right: unified alert feed (all sessions, newest first, filterable by severity) — click to jump to that tile.
Tile actions: expand (hi-res), send warning (writes PROCTOR_WARNING, pushes a toast to the candidate over Socket.IO), flag or terminate session.
Live counters: online/total, flagged count, avg integrity.
8.8 Event logging & integrity scoring

Every event is (1) broadcast to the proctor immediately and (2) persisted to MonitorEvent. A weighted score starts at 100 and subtracts per event by severity, with per-type caps (snippet §10.5). Score recomputed on submit via a BullMQ job; sessions below a threshold auto-FLAGGED.

8.9 Recording & post-exam review

Review page = video player (from recordingUrl) with a timeline track of event markers; clicking a marker seeks the video and shows the snapshot. Export a PDF report (candidate, score, event table, key snapshots) via a background job.

9. Real-time Event Protocol (Socket.IO)

Shared types in packages/shared/events.ts (used by web + realtime service):

ts
// client → server
"session:join"      { sessionId }
"session:event"     { sessionId, type: EventType, severity, meta? }   // candidate emits
"heartbeat"         { sessionId, ts }

// server → proctor
"room:candidate_event"  { sessionId, event }        // fan-out to proctors of that exam
"room:presence"         { sessionId, online: boolean }

// proctor → server → candidate
"proctor:warn"      { sessionId, message }
"proctor:terminate" { sessionId, reason }

Server validates membership from DB, persists via a batched writer (buffer events, bulk-insert every ~1s to protect Postgres), and fans out to the exam's proctor sockets.

10. Key Implementation Snippets
10.1 Camera/mic + LiveKit publish
ts
// lib/media.ts
export async function getCandidateStream() {
  return navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, frameRate: 15, facingMode: "user" },
    audio: { echoCancellation: true, noiseSuppression: true },
  }); // wrap caller in try/catch for NotAllowedError / NotFoundError
}

// join room with a server-minted token
import { Room } from "livekit-client";
export async function joinAsCandidate(url: string, token: string, stream: MediaStream) {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(url, token);
  for (const t of stream.getTracks()) await room.localParticipant.publishTrack(t);
  return room;
}
10.2 Integrity guards hook
ts
// lib/integrity/useProctorGuards.ts
export function useProctorGuards(sessionId: string, emit: EmitFn, cfg: ExamSettings) {
  useEffect(() => {
    const onVis = () => document.hidden && emit("TAB_HIDDEN", "MEDIUM");
    const onBlur = () => emit("WINDOW_BLUR", "MEDIUM");
    const onFs = () => { if (!document.fullscreenElement) emit("FULLSCREEN_EXIT", "HIGH"); };
    const block = (e: Event) => { if (cfg.blockCopyPaste) { e.preventDefault();
      emit(e.type.toUpperCase() as EventType, "LOW"); } };
    const onCtx = (e: MouseEvent) => { e.preventDefault(); emit("RIGHT_CLICK", "LOW"); };
    const onNet = () => emit(navigator.onLine ? "NETWORK_BACK" : "NETWORK_LOST", "MEDIUM");

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", block); document.addEventListener("paste", block);
    document.addEventListener("contextmenu", onCtx);
    window.addEventListener("online", onNet); window.addEventListener("offline", onNet);
    return () => { /* remove all listeners */ };
  }, [sessionId]);
}
10.3 Vision loop (face + objects)
ts
// lib/vision/loop.ts  (runs at ~5fps via setInterval/rAF throttle)
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export async function initVision() {
  const fileset = await FilesetResolver.forVisionTasks("/wasm");
  const face = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
    numFaces: 3, outputFaceBlendshapes: false, runningMode: "VIDEO",
  });
  const objects = await cocoSsd.load();
  return { face, objects };
}

export function analyze(video: HTMLVideoElement, m, emit: EmitFn) {
  const now = performance.now();
  const f = m.face.detectForVideo(video, now);
  const n = f.faceLandmarks.length;
  if (n === 0) emit("FACE_NONE", "HIGH");             // debounce >3s upstream
  else if (n >= 2) emit("FACE_MULTIPLE", "CRITICAL");
  else if (isLookingAway(f.facialTransformationMatrixes?.[0])) emit("LOOKING_AWAY", "MEDIUM");

  m.objects.detect(video).then(preds => {
    for (const p of preds) {
      if (p.score < 0.6) continue;
      if (p.class === "cell phone") emit("PHONE_DETECTED", "CRITICAL", { confidence: p.score });
      if (p.class === "book")       emit("BOOK_DETECTED",  "HIGH",     { confidence: p.score });
    }
  });
}

Wrap emit in per-type debounce/cooldown (e.g., don't fire FACE_NONE more than once per 5s) to avoid alert spam. Consider running detectors in a Web Worker + OffscreenCanvas to keep the exam UI smooth.

10.4 LiveKit token route (server)
ts
// app/api/livekit/token/route.ts
import { AccessToken } from "livekit-server-sdk";
export async function POST(req: Request) {
  const { sessionId } = await req.json();
  const user = await requireSession();                 // Auth.js, throws if unauth
  const s = await authorizeSession(user, sessionId);   // checks ownership/assignment
  const isCandidate = user.role === "STUDENT";
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!,
    { identity: user.id, name: user.name });
  at.addGrant({ room: s.livekitRoom, roomJoin: true,
    canPublish: isCandidate, canSubscribe: !isCandidate });
  return Response.json({ token: await at.toJwt(), url: process.env.LIVEKIT_URL });
}
10.5 Integrity scoring
ts
// lib/integrity/scoring.ts
const W: Record<EventType, number> = {
  FACE_MULTIPLE: 25, PHONE_DETECTED: 25, FULLSCREEN_EXIT: 10, TAB_HIDDEN: 8,
  WINDOW_BLUR: 6, LOOKING_AWAY: 3, FACE_NONE: 5, BOOK_DETECTED: 15,
  COPY: 4, PASTE: 6, DEVTOOLS_OPEN: 20, /* …others → 0 */
} as any;
const CAP: Partial<Record<EventType, number>> = { LOOKING_AWAY: 15, TAB_HIDDEN: 30 };

export function scoreSession(events: {type: EventType}[]) {
  const sums: Record<string, number> = {};
  for (const e of events) sums[e.type] = (sums[e.type] ?? 0) + (W[e.type] ?? 0);
  const total = Object.entries(sums)
    .reduce((acc, [t, v]) => acc + Math.min(v, CAP[t as EventType] ?? v), 0);
  return Math.max(0, 100 - total);
}
11. REST API (Route Handlers)
POST   /api/auth/[...nextauth]
GET    /api/exams                      # role-scoped list
POST   /api/exams                      # admin
GET    /api/exams/:id
POST   /api/exams/:id/questions        # admin
POST   /api/sessions                   # create/enroll candidate session
GET    /api/sessions/:id               # candidate(own)/proctor(assigned)/admin
POST   /api/sessions/:id/start         # sets startedAt, status IN_PROGRESS
PUT    /api/sessions/:id/answers       # autosave (debounced)
POST   /api/sessions/:id/submit        # seal + enqueue scoring job
GET    /api/sessions/:id/events        # timeline for review
POST   /api/livekit/token
POST   /api/uploads/snapshot           # signed URL for evidence upload
GET    /api/reports/:sessionId         # computed report / PDF

All inputs validated with Zod; all handlers re-authorize server-side.

12. Environment Variables
bash
DATABASE_URL=postgres://…
AUTH_SECRET=…                 # openssl rand -base64 32
NEXT_PUBLIC_APP_URL=https://…
# LiveKit
LIVEKIT_URL=wss://…           # exposed to client via token route
LIVEKIT_API_KEY=…
LIVEKIT_API_SECRET=…
# Realtime
NEXT_PUBLIC_SOCKET_URL=wss://realtime.yourdomain.com
SOCKET_JWT_SECRET=…           # shared with realtime service
# Storage
R2_ACCOUNT_ID=…  R2_ACCESS_KEY_ID=…  R2_SECRET_ACCESS_KEY=…  R2_BUCKET=…
# Jobs / email
REDIS_URL=redis://…
RESEND_API_KEY=…

Validate at boot with a Zod env.ts so a missing var fails fast.

13. Security & Privacy
Consent first: explicit banner before camera/mic; store consent timestamp. Show a persistent "recording" indicator. Retention policy for recordings (auto-delete after N days).
Least privilege tokens: candidates can't subscribe, proctors can't publish; LiveKit secret never leaves the server.
Server is source of truth: timer, correct answers, and scoring are computed server-side; the client only reports events.
Rate-limit event emission per socket to prevent flooding; batch-write to DB.
PII/GDPR: minimize data, encrypt at rest (DB + bucket), signed time-limited URLs for evidence, DSAR/delete endpoints.
Treat AI signals as assistive, not conclusive — flag for human review, never auto-fail on a single low-confidence detection.
Detection is best-effort; document known evasions (VMs, external devices) and don't over-promise.
14. Build Roadmap (phased)
Foundations — Next.js + TS + Tailwind + shadcn, Prisma schema + migrations, Auth.js with roles, seed users. RBAC middleware.
Exam CRUD — admin exam/question builder, student exam list, session creation.
Exam runtime — fullscreen locked UI, Zustand store, server-authoritative timer, autosave, submit + basic scoring stub.
Camera + pre-check — getUserMedia flow, permission handling, device selection.
LiveKit media — token route, candidate publish, proctor subscribe grid, adaptive stream.
Realtime events — Socket.IO service, useProctorGuards, live alert feed on proctor dashboard.
AI vision — MediaPipe FaceLandmarker + COCO-SSD in a Web Worker, debounced events, snapshot evidence.
Recording + review — LiveKit Egress → R2, playback with event-marked timeline, PDF report job.
Scoring + flags — weighted scoring job, auto-flag thresholds, proctor warn/terminate actions.
Hardening — rate limits, load test the grid (30+ tiles), consent/retention, e2e tests, deploy.
15. Deployment
Next.js app → Vercel (recommended) or a Node host if you inline the custom server.
Realtime (Socket.IO) → Railway / Fly.io / Render (long-lived Node process; enable WS; sticky sessions or a single instance + Redis adapter for horizontal scale).
LiveKit → LiveKit Cloud (fastest) or self-host on a VM with TURN configured.
Postgres → Neon / Supabase / RDS; Redis → Upstash / Railway; Storage → Cloudflare R2.
Local dev: docker-compose up for Postgres + Redis + LiveKit; turbo dev runs web + realtime.
16. Testing
Unit: scoring, gaze thresholding, Zod schemas (Vitest).
Integration: API authz (candidate can't read others' sessions), timer math.
E2E (Playwright): full exam happy path; grant fake camera via --use-fake-device-for-media-stream; simulate tab switch/blur/fullscreen exit and assert events reach the proctor.
Load: headless candidates joining LiveKit + emitting events to validate the grid and DB batch writer.
do not ask questions first build end to end leave the env credentials empty we will fill at end .use tech what fits the most for this project keep things simple.