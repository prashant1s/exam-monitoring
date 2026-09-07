import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";
import { answerUpsertSchema } from "@/lib/schemas";

export async function PUT(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    const examSession = await authorizeExamSession(user, sessionId);

    if (examSession.candidateId !== user.id) throw new ApiError(403, "Only the candidate can submit answers");
    if (examSession.status !== "IN_PROGRESS") throw new ApiError(409, "Session is not in progress");

    const { answers } = answerUpsertSchema.parse(await req.json());

    await prisma.$transaction(
      answers.map((a) =>
        prisma.answer.upsert({
          where: { sessionId_questionId: { sessionId, questionId: a.questionId } },
          create: { sessionId, questionId: a.questionId, value: a.value as never },
          update: { value: a.value as never },
        })
      )
    );

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}
