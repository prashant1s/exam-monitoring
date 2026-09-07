import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProctorDashboard() {
  const session = await auth();

  const exams = await prisma.exam.findMany({
    where: { status: { in: ["SCHEDULED", "LIVE"] } },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-sm] bg-accent text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Proctor dashboard</h1>
            <p className="text-sm text-neutral-500">Signed in as {session!.user.name}</p>
          </div>
        </div>
        <SignOutButton />
      </div>

      <div className="flex flex-col gap-3">
        {exams.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-neutral-500">No live or scheduled exams.</CardContent>
          </Card>
        )}
        {exams.map((exam) => {
          const isLive = exam.status === "LIVE";
          return (
            <Link key={exam.id} href={`/proctor/room/${exam.id}`}>
              <Card
                className={cn(
                  "group transition-all hover:shadow-[--shadow-card-hover] hover:border-neutral-300",
                  isLive && "border-emerald-200 ring-1 ring-emerald-100"
                )}
              >
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2.5">
                    {isLive && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                    <div>
                      <CardTitle>{exam.title}</CardTitle>
                      <CardDescription>
                        {exam._count.sessions} candidate{exam._count.sessions === 1 ? "" : "s"} enrolled ·{" "}
                        {new Date(exam.startsAt).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isLive ? "success" : "default"}>{exam.status}</Badge>
                    <svg className="h-4 w-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" viewBox="0 0 24 24" fill="none">
                      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600">{exam.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
