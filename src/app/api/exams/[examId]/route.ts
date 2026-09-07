import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, ApiError } from "@/lib/api-auth";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "LIVE", "ENDED"]),
});

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await requireUser();
    const { examId } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!exam) throw new ApiError(404, "Exam not found");

    // Never leak correct answers to a student runtime.
    if (user.role === "STUDENT") {
      const sanitized = {
        ...exam,
        questions: exam.questions.map(({ answer, ...q }) => q),
      };
      return NextResponse.json(sanitized);
    }

    return NextResponse.json(exam);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    await requireRole("ADMIN");
    const { examId } = await params;
    const { status } = patchSchema.parse(await req.json());
    const exam = await prisma.exam.update({ where: { id: examId }, data: { status } });
    return NextResponse.json(exam);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    await requireRole("ADMIN");
    const { examId } = await params;
    await prisma.exam.delete({ where: { id: examId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
