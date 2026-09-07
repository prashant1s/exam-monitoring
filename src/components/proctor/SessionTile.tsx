"use client";

import { Badge, severityToBadgeVariant } from "@/components/ui/badge";
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
  const isCritical =
    tile.highestSeverity === "CRITICAL" || tile.highestSeverity === "HIGH" || tile.status === "FLAGGED" || tile.status === "TERMINATED";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-[--radius-md] border p-3 flex flex-col gap-2.5 transition-all bg-white",
        selected
          ? "border-accent ring-2 ring-accent-ring/30 shadow-[--shadow-card-hover]"
          : isCritical
          ? "border-red-200 hover:shadow-[--shadow-card-hover]"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-[--shadow-card-hover]"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate text-neutral-900">{tile.candidateName}</span>
        <span className="relative flex h-2 w-2">
          {tile.online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", tile.online ? "bg-emerald-500" : "bg-neutral-300")} />
        </span>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-[--radius-sm] bg-neutral-950 flex items-center justify-center">
        <span className="text-[11px] font-medium text-neutral-500">{tile.online ? "live" : "offline"}</span>
        {isCritical && <div className="absolute inset-0 ring-2 ring-inset ring-red-500/60" />}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={statusBadgeVariant(tile)}>{tile.status}</Badge>
        {tile.lastEventType && (
          <span className="text-[10px] text-neutral-400 truncate max-w-32">{tile.lastEventType}</span>
        )}
      </div>
    </button>
  );
}

export function severityRank(sev: Severity) {
  return { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[sev];
}

function statusBadgeVariant(tile: TileState) {
  if (tile.status === "FLAGGED" || tile.status === "TERMINATED") return "high";
  return severityToBadgeVariant(tile.highestSeverity);
}

const VIDEO_STATUS_LABEL: Record<"unavailable" | "connecting" | "live", string> = {
  unavailable: "No live video (LiveKit isn't configured, or this candidate isn't connected)",
  connecting: "Connecting…",
  live: "",
};

export function ExpandedPanel({
  tile,
  onWarn,
  onTerminate,
  videoRef,
  videoStatus,
}: {
  tile: TileState;
  onWarn: (message: string) => void;
  onTerminate: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoStatus: "unavailable" | "connecting" | "live";
}) {
  return (
    <div className="rounded-[--radius-lg] border border-neutral-200 bg-white p-5 shadow-[--shadow-card] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h3 className="text-sm font-semibold text-neutral-900">{tile.candidateName}</h3>
        </div>
        <Badge variant={statusBadgeVariant(tile)}>{tile.status}</Badge>
      </div>
      <div className="relative w-full max-w-md aspect-video rounded-[--radius-md] bg-neutral-950 overflow-hidden ring-1 ring-neutral-800">
        <video ref={videoRef} autoPlay playsInline className="h-full w-full" />
        {videoStatus !== "live" && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-neutral-400">
            {VIDEO_STATUS_LABEL[videoStatus]}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="warning"
          size="sm"
          onClick={() => {
            const message = prompt("Warning message to send to the candidate:");
            if (message) onWarn(message);
          }}
        >
          Send warning
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => confirm("Terminate this session?") && onTerminate()}
        >
          Terminate
        </Button>
      </div>
    </div>
  );
}
