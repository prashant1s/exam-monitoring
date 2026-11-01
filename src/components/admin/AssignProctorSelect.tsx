"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssignProctorSelect({
  sessionId,
  proctors,
  currentProctorId,
}: {
  sessionId: string;
  proctors: { id: string; name: string }[];
  currentProctorId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentProctorId ?? "");
  const [saving, setSaving] = useState(false);

  async function onChange(proctorId: string) {
    setValue(proctorId);
    if (!proctorId) return;
    setSaving(true);
    await fetch(`/api/sessions/${sessionId}/proctor`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proctorId }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Assign proctor"
      className="h-8 max-w-36 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-sm transition-all hover:border-neutral-300 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring/20 disabled:cursor-wait"
    >
      <option value="">Unassigned</option>
      {proctors.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
