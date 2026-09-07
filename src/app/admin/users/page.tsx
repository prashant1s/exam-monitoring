import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8 flex flex-col gap-6">
      <Link href="/admin/exams" className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Exams
      </Link>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Users</h1>

      <Card>
        <CardHeader><CardTitle>Create user</CardTitle></CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All users ({users.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {users.map((u) => (
            <div key={u.id} className="py-3 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{u.name}</p>
                <p className="text-xs text-neutral-500">{u.email}</p>
              </div>
              <Badge variant={u.role === "ADMIN" ? "accent" : "default"}>{u.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
