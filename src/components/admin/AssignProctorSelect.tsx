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
      className="rounded-[--radius-sm] border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
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
