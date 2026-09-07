"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function EnrollButton({
  examId,
  existingSessionId,
  status,
}: {
  examId: string;
  existingSessionId?: string;
  status?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (existingSessionId) {
    if (status === "SUBMITTED" || status === "FLAGGED" || status === "TERMINATED") {
      return (
        <Button variant="outline" size="sm" onClick={() => router.push(`/student/exam/${existingSessionId}/live`)}>
          View submission
        </Button>
      );
    }
    return (
      <Button size="sm" onClick={() => router.push(`/student/exam/${existingSessionId}/precheck`)}>
        Continue
      </Button>
    );
  }

  async function enroll() {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to enroll");
      router.push(`/student/exam/${data.id}/precheck`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to enroll");
      setLoading(false);
    }
  }

  return (
    <Button size="sm" onClick={enroll} disabled={loading}>
      {loading ? "Starting…" : "Start"}
    </Button>
  );
}
