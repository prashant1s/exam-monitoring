import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL;

let scoringQueue: Queue | null = null;
function getScoringQueue() {
  if (!REDIS_URL) return null;
  if (!scoringQueue) {
    scoringQueue = new Queue("scoring", { connection: { url: REDIS_URL } });
  }
  return scoringQueue;
}

/** Enqueue a recompute of session score/report. No-ops silently if Redis isn't configured yet. */
export async function enqueueScoring(sessionId: string) {
  const queue = getScoringQueue();
  if (!queue) return;
  await queue.add("score-session", { sessionId }, { removeOnComplete: true, removeOnFail: 20 });
}
