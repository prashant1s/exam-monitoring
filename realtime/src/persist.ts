import { prisma } from "../../src/lib/prisma";
import type { EventType, Severity } from "../../src/lib/events";

interface BufferedEvent {
  sessionId: string;
  type: EventType;
  severity: Severity;
  meta?: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 1000;
let buffer: BufferedEvent[] = [];

export function bufferEvent(event: BufferedEvent) {
  buffer.push(event);
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    await prisma.monitorEvent.createMany({
      data: batch.map((e) => ({
        sessionId: e.sessionId,
        type: e.type,
        severity: e.severity,
        meta: (e.meta ?? undefined) as never,
      })),
    });
  } catch (err) {
    console.error("[persist] failed to flush events batch", err);
  }
}

export function startPersistLoop() {
  return setInterval(flush, FLUSH_INTERVAL_MS);
}

export async function flushNow() {
  await flush();
}
