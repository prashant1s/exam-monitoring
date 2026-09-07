import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { authorizeExamSession, ApiError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ReportView } from "@/components/proctor/ReportView";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/reports/${sessionId}`);

  try {
    await authorizeExamSession(session.user, sessionId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    redirect("/");
  }

  const full = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      candidate: { select: { name: true, email: true } },
      exam: { select: { title: true, durationMin: true } },
      events: { orderBy: { at: "asc" } },
    },
  });
  if (!full) notFound();

  const backHref = session.user.role === "ADMIN" ? "/admin/exams" : session.user.role === "PROCTOR" ? "/proctor/dashboard" : "/student/dashboard";

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8 flex flex-col gap-4">
      <Link href={backHref} className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back
      </Link>
      <ReportView
        session={{
          id: full.id,
          status: full.status,
          integrityScore: full.integrityScore,
          startedAt: full.startedAt?.toISOString() ?? null,
          submittedAt: full.submittedAt?.toISOString() ?? null,
          recordingUrl: full.recordingUrl,
        }}
        candidate={full.candidate}
        exam={full.exam}
        events={full.events.map((e) => ({ ...e, at: e.at.toISOString() }))}
      />
    </div>
  );
}
