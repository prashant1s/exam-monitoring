"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Badge, severityToBadgeVariant } from "@/components/ui/badge";
import { SessionTile, ExpandedPanel, severityRank, type TileState } from "@/components/proctor/SessionTile";
import { getSocket, disconnectSocket } from "@/lib/socket-client";
import { Room, RoomEvent, RemoteTrack } from "livekit-client";
import type { EventType, Severity } from "@/lib/events";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  status: string;
  candidate: { id: string; name: string; email: string };
}

interface AlertRow {
  id: string;
  sessionId: string;
  candidateName: string;
  type: EventType;
  severity: Severity;
  at: string;
}

export default function ProctorRoomPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tiles, setTiles] = useState<Record<string, TileState>>({});
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Severity | "ALL">("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<"unavailable" | "connecting" | "live">("unavailable");
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    fetch(`/api/exams/${examId}/sessions`)
      .then((r) => r.json())
      .then((rows: SessionRow[]) => {
        setSessions(rows);
        const initialTiles: Record<string, TileState> = {};
        for (const s of rows) {
          initialTiles[s.id] = {
            sessionId: s.id,
            candidateName: s.candidate.name,
            online: false,
            highestSeverity: "INFO",
            status: s.status,
          };
        }
        setTiles(initialTiles);
      });
  }, [examId]);

  useEffect(() => {
    if (sessions.length === 0) return;
    let cancelled = false;
    fetch("/api/socket-token")
      .then((r) => r.json())
      .then(({ token }) => {
        if (cancelled) return;
        const socket = getSocket(token);
        socketRef.current = socket;
        socket.emit("session:join", { sessionId: sessions[0].id });

        socket.on("room:presence", ({ sessionId, online }) => {
          setTiles((prev) => ({ ...prev, [sessionId]: { ...prev[sessionId], online } }));
        });

        socket.on("room:candidate_event", ({ sessionId, event }) => {
          setTiles((prev) => {
            const tile = prev[sessionId];
            if (!tile) return prev;
            const highest =
              severityRank(event.severity) > severityRank(tile.highestSeverity) ? event.severity : tile.highestSeverity;
            return {
              ...prev,
              [sessionId]: { ...tile, lastEventType: event.type, lastEventAt: event.at, highestSeverity: highest },
            };
          });
          setAlerts((prev) => [
            {
              id: `${sessionId}-${event.at}-${Math.random()}`,
              sessionId,
              candidateName: tiles[sessionId]?.candidateName ?? "Candidate",
              type: event.type,
              severity: event.severity,
              at: event.at,
            },
            ...prev,
          ].slice(0, 200));
        });
      });
    return () => {
      cancelled = true;
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const expand = useCallback(async (sessionId: string) => {
    setSelected(sessionId);
    setVideoStatus("connecting");
    roomRef.current?.disconnect();
    roomRef.current = null;

    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      setVideoStatus("unavailable"); // LiveKit not configured, or candidate not published yet
      return;
    }
    const { url, token } = await res.json();

    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === "video" && videoRef.current) {
        track.attach(videoRef.current);
        setVideoStatus("live");
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, () => setVideoStatus("connecting"));
    room.on(RoomEvent.Disconnected, () => setVideoStatus("unavailable"));
    await room.connect(url, token);
    roomRef.current = room;
  }, []);

  const warn = (sessionId: string, message: string) => {
    socketRef.current?.emit("proctor:warn", { sessionId, message });
  };
  const terminate = (sessionId: string) => {
    socketRef.current?.emit("proctor:terminate", { sessionId, reason: "Terminated by proctor" });
  };

  const filteredAlerts = alerts.filter((a) => severityFilter === "ALL" || a.severity === severityFilter);
  const online = Object.values(tiles).filter((t) => t.online).length;
  const flagged = Object.values(tiles).filter((t) => t.status === "FLAGGED").length;

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <Link href="/proctor/dashboard" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Dashboard
        </Link>
        <div className="flex gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online <strong className="font-semibold text-neutral-900">{online}</strong>/{sessions.length}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
              flagged > 0 ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-700"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", flagged > 0 ? "bg-red-500" : "bg-neutral-400")} /> Flagged{" "}
            <strong className="font-semibold">{flagged}</strong>
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.values(tiles).map((tile) => (
              <SessionTile key={tile.sessionId} tile={tile} selected={selected === tile.sessionId} onSelect={() => expand(tile.sessionId)} />
            ))}
          </div>

          {selected && tiles[selected] && (
            <div className="mt-4">
              <ExpandedPanel
                tile={tiles[selected]}
                videoRef={videoRef}
                videoStatus={videoStatus}
                onWarn={(m) => warn(selected, m)}
                onTerminate={() => terminate(selected)}
              />
            </div>
          )}
        </div>

        <aside className="w-80 border-l border-neutral-200 bg-white overflow-y-auto p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <h3 className="text-sm font-semibold text-neutral-900">Alert feed</h3>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as Severity | "ALL")}
              className="rounded-[--radius-sm] border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring/40"
            >
              <option value="ALL">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          {filteredAlerts.map((a) => (
            <button
              key={a.id}
              onClick={() => expand(a.sessionId)}
              className="text-left text-xs rounded-[--radius-sm] border border-neutral-100 p-2.5 transition-colors hover:border-neutral-200 hover:bg-neutral-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-900">{a.candidateName}</span>
                <Badge variant={severityToBadgeVariant(a.severity)}>{a.severity}</Badge>
              </div>
              <div className="mt-0.5 text-neutral-500">
                {a.type} · {new Date(a.at).toLocaleTimeString()}
              </div>
            </button>
          ))}
          {filteredAlerts.length === 0 && (
            <p className="px-1 py-6 text-center text-xs text-neutral-400">No events yet.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
