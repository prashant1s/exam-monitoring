"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["DRAFT", "SCHEDULED", "LIVE", "ENDED"] as const;

export function ExamStatusSelect({ examId, status }: { examId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    setValue(next);
    setSaving(true);
    await fetch(`/api/exams/${examId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 min-w-32 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-xs font-bold tracking-wide text-neutral-800 shadow-sm transition-all hover:border-neutral-300 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring/20 disabled:cursor-wait"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
