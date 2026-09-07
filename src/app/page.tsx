import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const HOME_BY_ROLE: Record<string, string> = {
  ADMIN: "/admin/exams",
  PROCTOR: "/proctor/dashboard",
  STUDENT: "/student/dashboard",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(HOME_BY_ROLE[session.user.role] ?? "/login");
  }
  redirect("/login");
}
