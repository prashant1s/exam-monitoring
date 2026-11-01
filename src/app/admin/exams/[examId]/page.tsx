import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileQuestion,
  Flag,
  ListChecks,
  UsersRound,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AssignProctorSelect } from "@/components/admin/AssignProctorSelect";
import { ExamStatusSelect } from "@/components/admin/ExamStatusSelect";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const [session, exam, proctors] = await Promise.all([
    auth(),
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

  const startsAt = new Date(exam.startsAt);
  const totalPoints = exam.questions.reduce((total, question) => total + question.points, 0);
  const submittedSessions = exam.sessions.filter((item) => item.status === "SUBMITTED").length;
  const flaggedSessions = exam.sessions.filter((item) => item.status === "FLAGGED" || item.status === "TERMINATED").length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgb(238_242_255_/_0.85),transparent_30rem),linear-gradient(to_bottom,#fafafa,#f6f7fb)]">
      <AdminTopbar userName={session!.user.name ?? "Admin"} />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <Link
          href="/admin/exams"
          className="group flex w-fit items-center gap-2 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-950"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft className="h-3.5 w-3.5" />
          </span>
          Back to exams
        </Link>

        <section className="relative overflow-hidden rounded-[var(--radius-xl)] bg-neutral-950 px-5 py-6 text-white shadow-[0_24px_60px_-28px_rgb(15_23_42_/_0.65)] sm:px-8 sm:py-8">
          <div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
          <div aria-hidden className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant={examStatusVariant(exam.status)} className="border-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {exam.status}
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Exam overview</span>
              </div>
              <h1 className="text-2xl font-bold tracking-[-0.04em] text-white sm:text-4xl">{exam.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
                {exam.description || "No description has been added for this exam."}
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-neutral-300 sm:text-sm">
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-indigo-300" />{startsAt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
                <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-indigo-300" />{startsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-white/10 bg-white/8 p-3 backdrop-blur-sm lg:flex-col lg:items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Exam status</p>
                <p className="mt-0.5 text-xs text-neutral-300">Update availability</p>
              </div>
              <ExamStatusSelect examId={exam.id} status={exam.status} />
            </div>
          </div>
        </section>

        <section aria-label="Exam metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryStat icon={<Clock3 className="h-[18px] w-[18px]" />} label="Duration" value={`${exam.durationMin} min`} />
          <SummaryStat icon={<FileQuestion className="h-[18px] w-[18px]" />} label="Questions" value={exam.questions.length} />
          <SummaryStat icon={<UsersRound className="h-[18px] w-[18px]" />} label="Candidates" value={exam.sessions.length} />
          <SummaryStat icon={<Award className="h-[18px] w-[18px]" />} label="Total points" value={totalPoints} />
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.75fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><UsersRound className="h-[18px] w-[18px] text-accent" />Candidate sessions</CardTitle>
                <CardDescription>{exam.sessions.length} {exam.sessions.length === 1 ? "candidate" : "candidates"} enrolled in this exam</CardDescription>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="success">{submittedSessions} submitted</Badge>
                {flaggedSessions > 0 && <Badge variant="high">{flaggedSessions} flagged</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              {exam.sessions.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                    <UsersRound className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-neutral-800">No candidates yet</p>
                  <p className="mt-1 text-xs text-neutral-500">Enrolled candidates will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {exam.sessions.map((candidateSession) => (
                    <div key={candidateSession.id} className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-neutral-50/70 sm:px-6 xl:flex-row xl:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100">
                          {candidateSession.candidate.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">{candidateSession.candidate.name}</p>
                          <p className="mt-0.5 truncate text-xs text-neutral-500">{candidateSession.candidate.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pl-[3.25rem] xl:justify-end xl:pl-0">
                        {candidateSession.integrityScore != null && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                              candidateSession.integrityScore < 60
                                ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                                : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200/70"
                            )}
                          >
                            <Award className="h-3 w-3" />
                            {candidateSession.integrityScore}
                          </span>
                        )}
                        <Badge variant={sessionStatusVariant(candidateSession.status)}>{candidateSession.status}</Badge>
                        <AssignProctorSelect sessionId={candidateSession.id} proctors={proctors} currentProctorId={candidateSession.proctorId} />
                        <Link
                          href={`/reports/${candidateSession.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                        >
                          Report <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListChecks className="h-[18px] w-[18px] text-accent" />Session snapshot</CardTitle>
              <CardDescription>Current candidate progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressRow icon={<UsersRound className="h-4 w-4" />} label="Enrolled" value={exam.sessions.length} />
              <ProgressRow icon={<CheckCircle2 className="h-4 w-4" />} label="Submitted" value={submittedSessions} tone="success" />
              <ProgressRow icon={<Flag className="h-4 w-4" />} label="Needs review" value={flaggedSessions} tone={flaggedSessions > 0 ? "danger" : "default"} />
              <div className="rounded-[var(--radius-md)] bg-indigo-50/70 p-4 ring-1 ring-indigo-100">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-indigo-500">Completion</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-2xl font-bold tracking-tight text-indigo-950">
                    {exam.sessions.length > 0 ? Math.round((submittedSessions / exam.sessions.length) * 100) : 0}%
                  </span>
                  <span className="text-xs text-indigo-500">{submittedSessions} of {exam.sessions.length}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-indigo-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width]"
                    style={{ width: `${exam.sessions.length > 0 ? (submittedSessions / exam.sessions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2"><FileQuestion className="h-[18px] w-[18px] text-accent" />Question set</CardTitle>
              <CardDescription>{exam.questions.length} questions worth {totalPoints} points</CardDescription>
            </div>
            <Badge variant="accent">{totalPoints} pts</Badge>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            {exam.questions.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-500">No questions have been added.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {exam.questions.map((question, index) => (
                  <div key={question.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-neutral-50/70 sm:px-6">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-neutral-100 text-xs font-bold text-neutral-500 ring-1 ring-neutral-200/80">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-6 text-neutral-900">{question.prompt}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{questionTypeLabel(question.type)}</span>
                        <span className="text-xs text-neutral-400">{question.points} {question.points === 1 ? "point" : "points"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-neutral-200/80 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">{label}</p>
        <p className="mt-0.5 truncate text-base font-bold text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

function ProgressRow({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: number; tone?: "default" | "success" | "danger" }) {
  const tones = {
    default: "bg-neutral-100 text-neutral-500",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-red-50 text-red-600",
  };
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>{icon}</span>
      <span className="flex-1 text-sm font-medium text-neutral-600">{label}</span>
      <span className="text-sm font-bold text-neutral-900">{value}</span>
    </div>
  );
}

function examStatusVariant(status: string): BadgeProps["variant"] {
  if (status === "LIVE") return "success";
  if (status === "SCHEDULED") return "info";
  if (status === "DRAFT") return "accent";
  return "default";
}

function sessionStatusVariant(status: string): BadgeProps["variant"] {
  if (status === "FLAGGED" || status === "TERMINATED") return "high";
  if (status === "SUBMITTED") return "success";
  if (status === "IN_PROGRESS") return "info";
  return "default";
}

function questionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    MCQ: "Multiple choice",
    MULTI: "Multi-select",
    SHORT: "Short answer",
    LONG: "Long answer",
    CODE: "Code",
  };
  return labels[type] ?? type;
}
