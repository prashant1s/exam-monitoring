import { prisma } from "../../src/lib/prisma";

const sessionExamCache = new Map<string, string>();

export async function getExamIdForSession(sessionId: string): Promise<string | null> {
  const cached = sessionExamCache.get(sessionId);
  if (cached) return cached;

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    select: { examId: true },
  });
  if (!session) return null;

  sessionExamCache.set(sessionId, session.examId);
  return session.examId;
}

export const examRoom = (examId: string) => `exam:${examId}`;
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;
