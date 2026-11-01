import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  FileQuestion,
  Plus,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminExamsPage() {
  const session = await auth();
  const exams = await prisma.exam.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { sessions: true, questions: true } } },
  });

  const liveExams = exams.filter((exam) => exam.status === "LIVE").length;
  const totalCandidates = exams.reduce((total, exam) => total + exam._count.sessions, 0);
  const totalQuestions = exams.reduce((total, exam) => total + exam._count.questions, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgb(238_242_255_/_0.85),transparent_32rem),linear-gradient(to_bottom,#fafafa,#f6f7fb)]">
      <AdminTopbar userName={session!.user.name ?? "Admin"} />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Assessment workspace
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-neutral-950 sm:text-4xl">Exam command center</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500 sm:text-base">
              Create assessments, monitor participation, and review every exam from one focused workspace.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/admin/exams/new">
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Create new exam
            </Link>
          </Button>
        </section>

        <section aria-label="Exam overview" className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            label="Total exams"
            value={exams.length}
            detail={liveExams > 0 ? `${liveExams} live now` : "No exams live"}
            tone="indigo"
          />
          <MetricCard
            icon={<UsersRound className="h-5 w-5" />}
            label="Candidates"
            value={totalCandidates}
            detail="Across all exams"
            tone="emerald"
          />
          <MetricCard
            icon={<FileQuestion className="h-5 w-5" />}
            label="Question bank"
            value={totalQuestions}
            detail="Questions published"
            tone="amber"
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-neutral-950">All exams</h2>
              <p className="mt-0.5 text-sm text-neutral-500">Select an exam to manage sessions and questions.</p>
            </div>
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-500 shadow-sm">
              {exams.length} {exams.length === 1 ? "exam" : "exams"}
            </span>
          </div>

          {exams.length === 0 ? (
            <Card className="border-dashed border-neutral-300 bg-white/70">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <BookOpenCheck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">Create your first exam</h3>
                <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">
                  Add questions, configure proctoring rules, and invite candidates when you are ready.
                </p>
                <Button asChild className="mt-5">
                  <Link href="/admin/exams/new"><Plus className="h-4 w-4" />New exam</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {exams.map((exam) => {
                const startDate = new Date(exam.startsAt);
                return (
                  <Link key={exam.id} href={`/admin/exams/${exam.id}`} className="group block">
                    <Card className="relative h-full overflow-hidden bg-white hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[var(--shadow-card-hover)]">
                      <div className={statusAccent(exam.status)} />
                      <CardContent className="flex h-full flex-col gap-5 p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Badge variant={statusVariant(exam.status)}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {exam.status}
                            </Badge>
                            <h3 className="mt-3 truncate text-lg font-bold tracking-[-0.025em] text-neutral-950 transition-colors group-hover:text-accent">
                              {exam.title}
                            </h3>
                            <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-neutral-500">
                              {exam.description || "No description has been added for this exam."}
                            </p>
                          </div>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-400 transition-all group-hover:border-accent/20 group-hover:bg-accent-soft group-hover:text-accent">
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>

                        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-100 bg-neutral-50/80 p-3.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white text-accent shadow-sm ring-1 ring-neutral-200/70">
                            <CalendarDays className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-800">
                              {startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              Starts at {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-4 text-xs font-semibold text-neutral-500">
                          <span className="flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5 text-neutral-400" />{exam._count.questions} questions</span>
                          <span className="flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5 text-neutral-400" />{exam._count.sessions} enrolled</span>
                          <span className="ml-auto flex items-center gap-1.5 text-neutral-400"><Clock3 className="h-3.5 w-3.5" />Manage exam</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "indigo" | "emerald" | "amber";
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
  };

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-neutral-200/80 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-[-0.04em] text-neutral-950">{value}</span>
          <span className="truncate text-xs text-neutral-400">{detail}</span>
        </div>
      </div>
    </div>
  );
}

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "LIVE") return "success";
  if (status === "SCHEDULED") return "info";
  if (status === "DRAFT") return "accent";
  return "default";
}

function statusAccent(status: string) {
  const color = status === "LIVE" ? "bg-emerald-500" : status === "SCHEDULED" ? "bg-blue-500" : status === "DRAFT" ? "bg-indigo-500" : "bg-neutral-300";
  return `absolute inset-x-0 top-0 h-1 ${color}`;
}
