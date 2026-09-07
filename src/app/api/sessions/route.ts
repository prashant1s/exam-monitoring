import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ApiError } from "@/lib/api-auth";
import { z } from "zod";

const createSessionSchema = z.object({ examId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");
    const { examId } = createSessionSchema.parse(await req.json());

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new ApiError(404, "Exam not found");

    const existing = await prisma.examSession.findUnique({
      where: { examId_candidateId: { examId, candidateId: user.id } },
    });
    if (existing) return NextResponse.json(existing, { status: 200 });

    const session = await prisma.examSession.create({
      data: {
        examId,
        candidateId: user.id,
        livekitRoom: `sess_${examId}_${user.id}`,
      },
    });
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}
