import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser, ApiError } from "@/lib/api-auth";
import { createExamSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await requireUser();

    if (user.role === "ADMIN") {
      const exams = await prisma.exam.findMany({ orderBy: { startsAt: "desc" } });
      return NextResponse.json(exams);
    }
    if (user.role === "STUDENT") {
      const exams = await prisma.exam.findMany({
        where: { status: { in: ["SCHEDULED", "LIVE"] } },
        orderBy: { startsAt: "asc" },
      });
      return NextResponse.json(exams);
    }
    // PROCTOR: exams where they proctor at least one session, plus any live/scheduled exam
    const exams = await prisma.exam.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
      orderBy: { startsAt: "asc" },
    });
    return NextResponse.json(exams);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = await req.json();
    const parsed = createExamSchema.parse(body);

    const exam = await prisma.exam.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        startsAt: parsed.startsAt,
        durationMin: parsed.durationMin,
        settings: parsed.settings,
        createdBy: user.id,
        questions: {
          create: parsed.questions.map((q) => ({
            order: q.order,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            answer: q.answer as never,
            points: q.points,
          })),
        },
      },
      include: { questions: true },
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: err.message }, { status: 400 });
    }
    throw err;
  }
}
