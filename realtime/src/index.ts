import "dotenv/config";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { prisma } from "../../src/lib/prisma";
import { monitorEventSchema } from "../../src/lib/events";
import type { ClientToServerEvents, ServerToClientEvents } from "../../src/lib/events";
import { socketAuthMiddleware } from "./auth";
import { bufferEvent, startPersistLoop, flushNow } from "./persist";
import { getExamIdForSession, examRoom, sessionRoom } from "./rooms";

const PORT = Number(process.env.REALTIME_PORT ?? process.env.PORT ?? 4000);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: process.env.NEXT_PUBLIC_APP_URL ?? "*", credentials: true },
});

io.use(socketAuthMiddleware);

// Simple per-socket token bucket to stop a runaway candidate client from flooding the server.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 5000;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
function isRateLimited(socketId: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(socketId);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(socketId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

io.on("connection", (socket: Socket) => {
  const user = socket.user!;

  socket.on("session:join", async ({ sessionId }) => {
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const isOwner = session.candidateId === user.id;
    // Any proctor/admin account may observe a session's exam room (mirrors the REST API's
    // exam-sessions listing, which is scoped by role rather than per-session assignment).
    const isProctor = user.role === "PROCTOR" || user.role === "ADMIN";
    if (!isOwner && !isProctor) return;

    await socket.join(sessionRoom(sessionId));
    await socket.join(examRoom(session.examId));

    if (isOwner) {
      io.to(examRoom(session.examId)).emit("room:presence", { sessionId, online: true });
    }
  });

  socket.on("session:event", async (payload) => {
    if (isRateLimited(socket.id)) return;
    const parsed = monitorEventSchema.safeParse(payload);
    if (!parsed.success) return;

    const examId = await getExamIdForSession(parsed.data.sessionId);
    if (!examId) return;

    const event = { ...parsed.data, at: new Date().toISOString() };
    bufferEvent(parsed.data);
    io.to(examRoom(examId)).emit("room:candidate_event", {
      sessionId: parsed.data.sessionId,
      event: { type: event.type, severity: event.severity, at: event.at, meta: event.meta },
    });
  });

  socket.on("heartbeat", () => {
    // Presence liveness signal only; no-op for now beyond keeping the socket connection alive.
  });

  socket.on("proctor:warn", async ({ sessionId, message }) => {
    if (user.role !== "PROCTOR" && user.role !== "ADMIN") return;
    bufferEvent({ sessionId, type: "PROCTOR_WARNING", severity: "MEDIUM", meta: { message } });
    io.to(sessionRoom(sessionId)).emit("proctor:warn", { sessionId, message });
  });

  socket.on("proctor:terminate", async ({ sessionId, reason }) => {
    if (user.role !== "PROCTOR" && user.role !== "ADMIN") return;
    await prisma.examSession.update({ where: { id: sessionId }, data: { status: "TERMINATED" } });
    io.to(sessionRoom(sessionId)).emit("proctor:terminate", { sessionId, reason });
  });

  socket.on("disconnect", async () => {
    rateBuckets.delete(socket.id);
    // Best-effort presence-offline notification; we don't know the sessionId here without
    // tracking socket->session, so candidates rely on heartbeats/JOINED-LEFT events instead.
  });
});

startPersistLoop();

httpServer.listen(PORT, () => {
  console.log(`[realtime] Socket.IO service listening on :${PORT}`);
});

process.on("SIGTERM", async () => {
  await flushNow();
  process.exit(0);
});
