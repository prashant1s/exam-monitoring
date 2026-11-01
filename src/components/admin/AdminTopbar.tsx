import Link from "next/link";
import { BookOpenCheck, ShieldCheck, Users } from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

export function AdminTopbar({
  userName,
  active = "exams",
}: {
  userName: string;
  active?: "exams" | "users";
}) {
  return (
    <header className="border-b border-neutral-200/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/admin/exams" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-neutral-950 text-white shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
              <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <span className="hidden leading-none sm:block">
              <span className="block text-sm font-bold tracking-[-0.02em] text-neutral-950">Exam Monitor</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Admin console</span>
            </span>
          </Link>

          <nav aria-label="Admin navigation" className="flex items-center gap-1">
            <NavLink href="/admin/exams" active={active === "exams"}>
              <BookOpenCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Exams</span>
            </NavLink>
            <NavLink href="/admin/users" active={active === "users"}>
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </NavLink>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="max-w-40 truncate text-xs font-semibold text-neutral-800">{userName}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Administrator</p>
          </div>
          <div className="hidden h-8 w-px bg-neutral-200 md:block" />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold transition-colors",
        active
          ? "bg-accent-soft text-accent-soft-foreground"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      )}
    >
      {children}
    </Link>
  );
}
