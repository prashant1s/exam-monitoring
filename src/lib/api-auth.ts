import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  return session.user;
}

export async function requireRole(...roles: Array<"ADMIN" | "PROCTOR" | "STUDENT">) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ApiError(403, "Forbidden");
  return user;
}

/** Load a session and verify the current user may access it (own session, assigned proctor, or admin). */
export async function authorizeExamSession(
  user: { id: string; role: string },
  sessionId: string
) {
  const examSession = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { exam: true },
  });
  if (!examSession) throw new ApiError(404, "Session not found");

  const isOwner = examSession.candidateId === user.id;
  const isProctor = examSession.proctorId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isProctor && !isAdmin) throw new ApiError(403, "Forbidden");

  return examSession;
}
