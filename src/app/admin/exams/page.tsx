import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminExamsPage() {
  const session = await auth();
  const exams = await prisma.exam.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { sessions: true, questions: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-sm] bg-neutral-900 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M3 9h18M8 4v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Exams</h1>
            <p className="text-sm text-neutral-500">Signed in as {session!.user.name} (admin)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">Users</Button>
          </Link>
          <Link href="/admin/exams/new">
            <Button size="sm">New exam</Button>
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {exams.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-neutral-500">No exams yet — create one.</CardContent>
          </Card>
        )}
        {exams.map((exam) => (
          <Link key={exam.id} href={`/admin/exams/${exam.id}`}>
            <Card className="group transition-all hover:shadow-[--shadow-card-hover] hover:border-neutral-300">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    {exam._count.questions} question{exam._count.questions === 1 ? "" : "s"} ·{" "}
                    {exam._count.sessions} enrolled · {new Date(exam.startsAt).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={exam.status === "LIVE" ? "success" : "default"}>{exam.status}</Badge>
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
        ))}
      </div>
    </div>
  );
}
