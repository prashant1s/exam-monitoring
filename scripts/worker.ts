import { Worker } from "bullmq";
import { prisma } from "../src/lib/prisma";
import { scoreSession, AUTO_FLAG_THRESHOLD } from "../src/lib/integrity/scoring";
import type { EventType } from "../src/lib/events";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.log("REDIS_URL not set — background worker has nothing to connect to, exiting.");
  process.exit(0);
}

const worker = new Worker(
  "scoring",
  async (job) => {
    const { sessionId } = job.data as { sessionId: string };
    const events = await prisma.monitorEvent.findMany({
      where: { sessionId },
      select: { type: true },
    });
    const score = scoreSession(events as { type: EventType }[]);
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const status = score < AUTO_FLAG_THRESHOLD ? "FLAGGED" : session.status;
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { integrityScore: score, status },
    });
    console.log(`[worker] scored session ${sessionId} -> ${score}`);
  },
  { connection: { url: REDIS_URL } }
);

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed`, err);
});

console.log("[worker] scoring worker started, waiting for jobs...");
