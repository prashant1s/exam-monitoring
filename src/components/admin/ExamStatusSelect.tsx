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
      className="rounded-[--radius-sm] border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
