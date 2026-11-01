"use client";

import { useState } from "react";
import { AlertTriangle, BellRing, Radio, VideoOff, X } from "lucide-react";
import { Badge, severityToBadgeVariant, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/events";

export interface TileState {
  sessionId: string;
  candidateName: string;
  online: boolean;
  lastEventType?: string;
  lastEventAt?: string;
  highestSeverity: Severity;
  status: string;
  eventCount?: number;
}

export function SessionTile({
  tile,
  onSelect,
  selected,
}: {
  tile: TileState;
  onSelect: () => void;
  selected: boolean;
}) {
  const isCritical = tile.highestSeverity === "CRITICAL"
    || tile.highestSeverity === "HIGH"
    || tile.status === "FLAGGED"
    || tile.status === "TERMINATED";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-3 rounded-[var(--radius-md)] border bg-white p-3 text-left transition-all",
        selected
          ? "border-accent ring-3 ring-accent-ring/20 shadow-[var(--shadow-card-hover)]"
          : isCritical
            ? "border-red-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
            : "border-neutral-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[var(--shadow-card-hover)]"
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
            {tile.candidateName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-900">{tile.candidateName}</span>
            <span className={cn("mt-0.5 flex items-center gap-1 text-[10px] font-semibold", tile.online ? "text-emerald-600" : "text-neutral-400")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", tile.online ? "bg-emerald-500" : "bg-neutral-300")} />
              {tile.online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        {tile.online && <Radio className="h-4 w-4 shrink-0 text-emerald-500" />}
      </div>

      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-neutral-950">
        <div className="flex flex-col items-center gap-1.5 text-neutral-500">
          {tile.online ? <Radio className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider">{tile.online ? "Open live view" : "Candidate offline"}</span>
        </div>
        {isCritical && <div className="absolute inset-0 ring-2 ring-inset ring-red-500/60" />}
        {tile.eventCount != null && tile.eventCount > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            {tile.eventCount} alert{tile.eventCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-2">
        <Badge variant={statusBadgeVariant(tile)}>{tile.status}</Badge>
        {tile.lastEventType ? (
          <span className="max-w-32 truncate text-[10px] font-medium text-neutral-400">{formatEventType(tile.lastEventType)}</span>
        ) : (
          <span className="text-[10px] text-neutral-300">No alerts</span>
        )}
      </div>
    </button>
  );
}

export function severityRank(severity: Severity) {
  return { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity];
}

function statusBadgeVariant(tile: TileState): BadgeProps["variant"] {
  if (tile.status === "FLAGGED" || tile.status === "TERMINATED") return "high";
  if (tile.status === "SUBMITTED") return "success";
  if (tile.status === "IN_PROGRESS") return "info";
  return severityToBadgeVariant(tile.highestSeverity);
}

export function ExpandedPanel({
  tile,
  onWarn,
  onTerminate,
  onClose,
  videoRef,
  videoStatus,
  mediaError,
  realtimeConnected,
}: {
  tile: TileState;
  onWarn: (message: string) => void;
  onTerminate: () => void;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoStatus: "unavailable" | "connecting" | "live";
  mediaError: string | null;
  realtimeConnected: boolean;
}) {
  const [warningMessage, setWarningMessage] = useState("");
  const isTerminated = tile.status === "TERMINATED";

  function sendWarning(event: React.FormEvent) {
    event.preventDefault();
    const message = warningMessage.trim();
    if (!message) return;
    onWarn(message);
    setWarningMessage("");
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100">
            {tile.candidateName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-neutral-900">{tile.candidateName}</h3>
            <p className={cn("mt-0.5 text-[11px] font-medium", tile.online ? "text-emerald-600" : "text-neutral-400")}>
              {tile.online ? "Candidate is online" : "Candidate is offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(tile)}>{tile.status}</Badge>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700" aria-label="Close candidate panel">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-md)] bg-neutral-950 ring-1 ring-neutral-800">
          <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
          {videoStatus !== "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {videoStatus === "connecting" ? (
                <Radio className="h-6 w-6 animate-pulse text-indigo-300" />
              ) : (
                <VideoOff className="h-6 w-6 text-neutral-500" />
              )}
              <p className="mt-3 text-xs font-semibold text-neutral-300">
                {videoStatus === "connecting" ? "Connecting to candidate video…" : "Live video unavailable"}
              </p>
              <p className="mt-1 max-w-sm text-[11px] leading-5 text-neutral-500">
                {mediaError ?? (tile.online ? "The candidate has not published a video track yet." : "The candidate must be online before video can be viewed.")}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500"><BellRing className="h-3.5 w-3.5" />Send warning</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-400">The message appears immediately in the candidate&apos;s exam.</p>
          </div>
          <form onSubmit={sendWarning} className="space-y-2">
            <textarea
              value={warningMessage}
              onChange={(event) => setWarningMessage(event.target.value)}
              placeholder="Example: Please keep your eyes on the screen."
              rows={3}
              disabled={!realtimeConnected || isTerminated}
              className="w-full resize-none rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-3 text-sm shadow-sm transition-all placeholder:text-neutral-400 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring/20 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
            <Button type="submit" variant="warning" size="sm" disabled={!realtimeConnected || isTerminated || !warningMessage.trim()} className="w-full">
              <BellRing className="h-3.5 w-3.5" />Send warning
            </Button>
          </form>

          <div className="mt-auto border-t border-neutral-100 pt-4">
            <Button
              variant="destructive"
              size="sm"
              disabled={!realtimeConnected || isTerminated}
              onClick={() => window.confirm("Terminate this candidate's exam session? This cannot be undone.") && onTerminate()}
              className="w-full"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {isTerminated ? "Session terminated" : "Terminate session"}
            </Button>
            {!realtimeConnected && <p className="mt-2 text-center text-[10px] text-red-500">Actions are disabled while realtime is offline.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEventType(type: string) {
  return type.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}
