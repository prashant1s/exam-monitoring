import "dotenv/config";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { prisma } from "../../src/lib/prisma";
import { monitorEventSchema } from "../../src/lib/events";
import type { ClientToServerEvents, ServerToClientEvents } from "../../src/lib/events";
import { socketAuthMiddleware } from "./auth";
import { bufferEvent, startPersistLoop, flushNow } from "./persist";
import { examRoom, sessionRoom } from "./rooms";

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

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 5000;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const candidateSessionsBySocket = new Map<string, Set<string>>();
const candidateSocketsBySession = new Map<string, Set<string>>();

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

function isStaff(role: string) {
  return role === "PROCTOR" || role === "ADMIN";
}

function trackCandidatePresence(socketId: string, sessionId: string) {
  const socketSessions = candidateSessionsBySocket.get(socketId) ?? new Set<string>();
  socketSessions.add(sessionId);
  candidateSessionsBySocket.set(socketId, socketSessions);

  const sessionSockets = candidateSocketsBySession.get(sessionId) ?? new Set<string>();
  sessionSockets.add(socketId);
  candidateSocketsBySession.set(sessionId, sessionSockets);
}

async function clearCandidatePresence(socketId: string) {
  const sessions = candidateSessionsBySocket.get(socketId);
  candidateSessionsBySocket.delete(socketId);
  if (!sessions) return;

  for (const sessionId of sessions) {
    const sockets = candidateSocketsBySession.get(sessionId);
    sockets?.delete(socketId);
    if (sockets && sockets.size > 0) continue;

    candidateSocketsBySession.delete(sessionId);
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { examId: true },
    });
    if (session) io.to(examRoom(session.examId)).emit("room:presence", { sessionId, online: false });
  }
}

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  const user = socket.user!;

  socket.on("exam:join", async ({ examId }) => {
    try {
      if (!isStaff(user.role)) return;
      const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
      if (!exam) return;

      await socket.join(examRoom(examId));
      const sessions = await prisma.examSession.findMany({
        where: { examId },
        select: { id: true },
      });
      for (const session of sessions) {
        socket.emit("room:presence", {
          sessionId: session.id,
          online: (candidateSocketsBySession.get(session.id)?.size ?? 0) > 0,
        });
      }
    } catch (error) {
      console.error("[realtime] failed to join exam room", error);
    }
  });

  socket.on("session:join", async ({ sessionId }) => {
    try {
      const session = await prisma.examSession.findUnique({
        where: { id: sessionId },
        select: { candidateId: true, examId: true },
      });
      if (!session) return;

      const isOwner = session.candidateId === user.id;
      if (!isOwner && !isStaff(user.role)) return;

      await socket.join(sessionRoom(sessionId));
      await socket.join(examRoom(session.examId));

      if (isOwner) {
        trackCandidatePresence(socket.id, sessionId);
        io.to(examRoom(session.examId)).emit("room:presence", { sessionId, online: true });
      }
    } catch (error) {
      console.error("[realtime] failed to join session room", error);
    }
  });

  socket.on("session:event", async (payload) => {
    try {
      if (isRateLimited(socket.id)) return;
      const parsed = monitorEventSchema.safeParse(payload);
      if (!parsed.success) return;

      const session = await prisma.examSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: { candidateId: true, examId: true },
      });
      if (!session || session.candidateId !== user.id) return;

      const at = new Date().toISOString();
      bufferEvent(parsed.data);
      io.to(examRoom(session.examId)).emit("room:candidate_event", {
        sessionId: parsed.data.sessionId,
        event: { type: parsed.data.type, severity: parsed.data.severity, at, meta: parsed.data.meta },
      });
    } catch (error) {
      console.error("[realtime] failed to process candidate event", error);
    }
  });

  socket.on("heartbeat", ({ sessionId }) => {
    if (candidateSessionsBySocket.get(socket.id)?.has(sessionId)) return;
    // A reconnect can race the join event. The next session:join restores presence.
  });

  socket.on("proctor:warn", async ({ sessionId, message }) => {
    try {
      if (!isStaff(user.role)) return;
      const session = await prisma.examSession.findUnique({
        where: { id: sessionId },
        select: { examId: true },
      });
      if (!session) return;

      const at = new Date().toISOString();
      const event = { sessionId, type: "PROCTOR_WARNING" as const, severity: "MEDIUM" as const, meta: { message } };
      bufferEvent(event);
      io.to(sessionRoom(sessionId)).emit("proctor:warn", { sessionId, message });
      io.to(examRoom(session.examId)).emit("room:candidate_event", {
        sessionId,
        event: { type: event.type, severity: event.severity, at, meta: event.meta },
      });
    } catch (error) {
      console.error("[realtime] failed to send proctor warning", error);
    }
  });

  socket.on("proctor:terminate", async ({ sessionId, reason }) => {
    try {
      if (!isStaff(user.role)) return;
      const session = await prisma.examSession.update({
        where: { id: sessionId },
        data: { status: "TERMINATED" },
        select: { examId: true },
      });
      io.to(sessionRoom(sessionId)).emit("proctor:terminate", { sessionId, reason });
      io.to(examRoom(session.examId)).emit("room:session_status", { sessionId, status: "TERMINATED" });
    } catch (error) {
      console.error("[realtime] failed to terminate session", error);
    }
  });

  socket.on("disconnect", () => {
    rateBuckets.delete(socket.id);
    void clearCandidatePresence(socket.id).catch((error) => {
      console.error("[realtime] failed to clear candidate presence", error);
    });
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
