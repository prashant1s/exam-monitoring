import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnrollButton } from "@/components/exam/EnrollButton";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const session = await auth();
  const userId = session!.user.id;

  const exams = await prisma.exam.findMany({
    where: { status: { in: ["SCHEDULED", "LIVE"] } },
    orderBy: { startsAt: "asc" },
    include: {
      sessions: { where: { candidateId: userId } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-sm] bg-neutral-900 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Your exams</h1>
            <p className="text-sm text-neutral-500">Signed in as {session!.user.name}</p>
          </div>
        </div>
        <SignOutButton />
      </div>

      <div className="flex flex-col gap-3">
        {exams.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-neutral-500">
              No exams are scheduled or live right now.
            </CardContent>
          </Card>
        )}
        {exams.map((exam) => {
          const mySession = exam.sessions[0];
          const isLive = exam.status === "LIVE";
          return (
            <Card
              key={exam.id}
              className={cn(
                "overflow-hidden transition-shadow hover:shadow-[--shadow-card-hover]",
                isLive && "border-emerald-200 ring-1 ring-emerald-100"
              )}
            >
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2.5">
                  {isLive && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                  <div>
                    <CardTitle>{exam.title}</CardTitle>
                    <CardDescription>
                      {exam.durationMin} min · starts {new Date(exam.startsAt).toLocaleString()}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={isLive ? "success" : "default"}>{exam.status}</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-sm text-neutral-600">{exam.description}</p>
                <EnrollButton examId={exam.id} existingSessionId={mySession?.id} status={mySession?.status} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
