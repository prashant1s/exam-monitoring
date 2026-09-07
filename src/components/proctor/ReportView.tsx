"use client";

import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, severityToBadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventType, Severity } from "@/lib/events";

const SEVERITY_BAR: Record<string, string> = {
  INFO: "bg-blue-300",
  LOW: "bg-yellow-400",
  MEDIUM: "bg-orange-400",
  HIGH: "bg-red-400",
  CRITICAL: "bg-red-600",
};

interface EventRow {
  id: string;
  type: EventType;
  severity: Severity;
  at: string;
  meta: unknown;
}

export function ReportView({
  session,
  candidate,
  exam,
  events,
}: {
  session: {
    id: string;
    status: string;
    integrityScore: number | null;
    startedAt: string | null;
    submittedAt: string | null;
    recordingUrl: string | null;
  };
  candidate: { name: string; email: string };
  exam: { title: string; durationMin: number };
  events: EventRow[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function seekTo(eventAt: string) {
    if (!videoRef.current || !session.startedAt) return;
    const offsetSec = (new Date(eventAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
    videoRef.current.currentTime = Math.max(0, offsetSec);
    videoRef.current.play().catch(() => {});
  }

  const bySeverity: Record<string, number> = {};
  for (const e of events) bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;

  const score = session.integrityScore;
  const scoreTone = score == null ? "text-neutral-400" : score < 60 ? "text-red-600" : score < 85 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{exam.title}</CardTitle>
            <p className="text-sm text-neutral-500">{candidate.name} · {candidate.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={cn("text-3xl font-semibold tabular-nums", scoreTone)}>{score ?? "—"}</p>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Integrity score</p>
            </div>
            <Badge variant={session.status === "FLAGGED" || session.status === "TERMINATED" ? "high" : "default"}>
              {session.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
            {events.length} total event{events.length === 1 ? "" : "s"}
          </span>
          {Object.entries(bySeverity).map(([sev, count]) => (
            <Badge key={sev} variant={severityToBadgeVariant(sev)}>{sev} · {count}</Badge>
          ))}
        </CardContent>
      </Card>

      {session.recordingUrl ? (
        <video
          ref={videoRef}
          src={session.recordingUrl}
          controls
          className="w-full rounded-[--radius-lg] bg-neutral-950 aspect-video shadow-[--shadow-card]"
        />
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-sm text-neutral-500 py-8 text-center">
            No recording available for this session (recording was disabled or storage isn&apos;t configured).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Event timeline</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100 max-h-96 overflow-y-auto">
          {events.length === 0 && <p className="text-sm text-neutral-500">No events recorded.</p>}
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => seekTo(e.at)}
              className="group flex items-center gap-3 py-2.5 pl-3 text-left transition-colors hover:bg-neutral-50"
            >
              <span className={cn("h-full min-h-4 w-1 shrink-0 self-stretch rounded-full", SEVERITY_BAR[e.severity] ?? "bg-neutral-200")} />
              <span className="flex-1 text-sm text-neutral-800">{e.type}</span>
              <div className="flex items-center gap-2">
                <Badge variant={severityToBadgeVariant(e.severity)}>{e.severity}</Badge>
                <span className="text-xs text-neutral-500">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
