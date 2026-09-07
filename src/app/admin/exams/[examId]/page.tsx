import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignProctorSelect } from "@/components/admin/AssignProctorSelect";
import { ExamStatusSelect } from "@/components/admin/ExamStatusSelect";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const [exam, proctors] = await Promise.all([
    prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: { orderBy: { order: "asc" } },
        sessions: { include: { candidate: true, proctor: true }, orderBy: { startedAt: "asc" } },
      },
    }),
    prisma.user.findMany({ where: { role: "PROCTOR" }, select: { id: true, name: true } }),
  ]);
  if (!exam) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8 flex flex-col gap-6">
      <Link href="/admin/exams" className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Exams
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{exam.title}</h1>
          <p className="text-sm text-neutral-500">
            {exam.durationMin} min · {exam.questions.length} questions · starts {new Date(exam.startsAt).toLocaleString()}
          </p>
        </div>
        <ExamStatusSelect examId={exam.id} status={exam.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>{exam.sessions.length} candidate(s) enrolled</CardDescription>
        </CardHeader>
        <CardContent>
          {exam.sessions.length === 0 && <p className="text-sm text-neutral-500">No candidates enrolled yet.</p>}
          <div className="flex flex-col divide-y divide-neutral-100">
            {exam.sessions.map((s) => (
              <div key={s.id} className="py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{s.candidate.name}</p>
                  <p className="text-xs text-neutral-500">{s.candidate.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {s.integrityScore != null && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        s.integrityScore < 60 ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"
                      )}
                    >
                      score {s.integrityScore}
                    </span>
                  )}
                  <Badge
                    variant={
                      s.status === "FLAGGED" || s.status === "TERMINATED"
                        ? "high"
                        : s.status === "SUBMITTED"
                        ? "success"
                        : "default"
                    }
                  >
                    {s.status}
                  </Badge>
                  <AssignProctorSelect sessionId={s.id} proctors={proctors} currentProctorId={s.proctorId} />
                  <Link href={`/reports/${s.id}`} className="text-xs font-medium text-accent hover:text-accent-hover">
                    Report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Questions</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {exam.questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-500">
                {i + 1}
              </span>
              <span className="flex-1 text-neutral-800">{q.prompt}</span>
              <span className="shrink-0 text-xs text-neutral-400">{q.type} · {q.points}pt</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
