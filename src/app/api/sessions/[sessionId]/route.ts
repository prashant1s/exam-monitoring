import { NextResponse } from "next/server";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await authorizeExamSession(user, sessionId);

    const full = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: { include: { questions: { orderBy: { order: "asc" } } } },
        answers: true,
      },
    });
    if (!full) throw new ApiError(404, "Session not found");

    if (user.role === "STUDENT") {
      return NextResponse.json({
        ...full,
        exam: {
          ...full.exam,
          questions: full.exam.questions.map(({ answer, ...q }) => q),
        },
      });
    }

    return NextResponse.json(full);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
