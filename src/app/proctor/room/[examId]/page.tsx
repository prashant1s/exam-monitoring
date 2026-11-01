"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Signal,
  SignalZero,
  UserRoundPlus,
  UsersRound,
  Wifi,
} from "lucide-react";
import { Room, RoomEvent, RemoteTrack, Track } from "livekit-client";
import { Badge, severityToBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExpandedPanel, SessionTile, severityRank, type TileState } from "@/components/proctor/SessionTile";
import { disconnectSocket, getSocket } from "@/lib/socket-client";
import type { EventType, Severity } from "@/lib/events";
import { cn } from "@/lib/utils";

interface ExamSummary {
  id: string;
  title: string;
  status: string;
  startsAt: string;
}

interface SessionEvent {
  id: string;
  type: EventType;
  severity: Severity;
  at: string;
}

interface SessionRow {
  id: string;
  status: string;
  candidate: { id: string; name: string; email: string };
  events: SessionEvent[];
  _count: { events: number };
}

interface AlertRow {
  id: string;
  sessionId: string;
  candidateName: string;
  type: EventType;
  severity: Severity;
  at: string;
}

type RealtimeState = "connecting" | "connected" | "disconnected" | "error";

export default function ProctorRoomPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const [exam, setExam] = useState<ExamSummary | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tiles, setTiles] = useState<Record<string, TileState>>({});
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Severity | "ALL">("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<"unavailable" | "connecting" | "live">("unavailable");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const sessionNamesRef = useRef<Record<string, string>>({});
  const alertsInitializedRef = useRef(false);

  const loadSessions = useCallback(async () => {
    const response = await fetch(`/api/exams/${examId}/sessions`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Unable to load candidate sessions.");
    if (!Array.isArray(payload)) throw new Error("The session service returned an invalid response.");

    const rows = payload as SessionRow[];
    sessionNamesRef.current = Object.fromEntries(rows.map((row) => [row.id, row.candidate.name]));
    setSessions(rows);
    setTiles((previous) => {
      const next: Record<string, TileState> = {};
      for (const row of rows) {
        const prior = previous[row.id];
        const latestEvent = row.events[0];
        const highestFromHistory = row.events.reduce<Severity>(
          (highest, event) => severityRank(event.severity) > severityRank(highest) ? event.severity : highest,
          "INFO"
        );
        const highestSeverity = prior && severityRank(prior.highestSeverity) > severityRank(highestFromHistory)
          ? prior.highestSeverity
          : highestFromHistory;
        next[row.id] = {
          sessionId: row.id,
          candidateName: row.candidate.name,
          online: prior?.online ?? false,
          highestSeverity,
          status: row.status,
          lastEventType: prior?.lastEventType ?? latestEvent?.type,
          lastEventAt: prior?.lastEventAt ?? latestEvent?.at,
          eventCount: row._count.events,
        };
      }
      return next;
    });

    if (!alertsInitializedRef.current) {
      const historicalAlerts = rows
        .flatMap((row) => row.events.map((event) => ({
          ...event,
          sessionId: row.id,
          candidateName: row.candidate.name,
        })))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 200);
      setAlerts(historicalAlerts);
      alertsInitializedRef.current = true;
    }

    return rows;
  }, [examId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      await loadSessions();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to refresh candidate sessions.");
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions]);

  useEffect(() => {
    let cancelled = false;
    async function loadRoom() {
      setLoading(true);
      setLoadError(null);
      try {
        const [examResponse] = await Promise.all([
          fetch(`/api/exams/${examId}`, { cache: "no-store" }),
          loadSessions(),
        ]);
        const examPayload = await examResponse.json().catch(() => null);
        if (!examResponse.ok) throw new Error(examPayload?.error ?? "Unable to load this exam.");
        if (!cancelled) setExam(examPayload as ExamSummary);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load the proctor room.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRoom();
    return () => { cancelled = true; };
  }, [examId, loadSessions]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadSessions().catch(() => {});
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadSessions]);

  useEffect(() => {
    let cancelled = false;

    async function connectRealtime() {
      setRealtimeState("connecting");
      setRealtimeError(null);
      try {
        const response = await fetch("/api/socket-token", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.token) throw new Error(payload?.error ?? "Unable to authorize realtime monitoring.");
        if (cancelled) return;

        const socket = getSocket(payload.token as string);
        socketRef.current = socket;

        const handleConnect = () => {
          setRealtimeState("connected");
          setRealtimeError(null);
          socket.emit("exam:join", { examId });
          void loadSessions().catch(() => {});
        };
        const handleDisconnect = () => {
          setRealtimeState("disconnected");
          setTiles((previous) => Object.fromEntries(
            Object.entries(previous).map(([id, tile]) => [id, { ...tile, online: false }])
          ));
        };
        const handleConnectError = (error: Error) => {
          setRealtimeState("error");
          setRealtimeError(error.message || "The realtime service is unavailable.");
        };
        const handlePresence = ({ sessionId, online }: { sessionId: string; online: boolean }) => {
          const applyPresence = () => setTiles((previous) => {
            const tile = previous[sessionId];
            return tile ? { ...previous, [sessionId]: { ...tile, online } } : previous;
          });
          if (sessionNamesRef.current[sessionId]) applyPresence();
          else void loadSessions().then(applyPresence).catch(() => {});
        };
        const handleCandidateEvent = ({ sessionId, event }: {
          sessionId: string;
          event: { type: EventType; severity: Severity; at: string };
        }) => {
          const applyEvent = () => {
            setTiles((previous) => {
              const tile = previous[sessionId];
              if (!tile) return previous;
              const highest = severityRank(event.severity) > severityRank(tile.highestSeverity)
                ? event.severity
                : tile.highestSeverity;
              return {
                ...previous,
                [sessionId]: {
                  ...tile,
                  lastEventType: event.type,
                  lastEventAt: event.at,
                  highestSeverity: highest,
                  eventCount: (tile.eventCount ?? 0) + 1,
                },
              };
            });
            setAlerts((previous) => [{
              id: `${sessionId}-${event.at}-${event.type}`,
              sessionId,
              candidateName: sessionNamesRef.current[sessionId] ?? "Candidate",
              type: event.type,
              severity: event.severity,
              at: event.at,
            }, ...previous].slice(0, 200));
          };
          if (sessionNamesRef.current[sessionId]) applyEvent();
          else void loadSessions().then(applyEvent).catch(() => {});
        };
        const handleSessionStatus = ({ sessionId, status }: { sessionId: string; status: string }) => {
          setTiles((previous) => {
            const tile = previous[sessionId];
            return tile ? { ...previous, [sessionId]: { ...tile, status, online: status === "TERMINATED" ? false : tile.online } } : previous;
          });
          setSessions((previous) => previous.map((row) => row.id === sessionId ? { ...row, status } : row));
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.on("room:presence", handlePresence);
        socket.on("room:candidate_event", handleCandidateEvent);
        socket.on("room:session_status", handleSessionStatus);

        if (socket.connected) handleConnect();
      } catch (error) {
        if (cancelled) return;
        setRealtimeState("error");
        setRealtimeError(error instanceof Error ? error.message : "The realtime service is unavailable.");
      }
    }

    void connectRealtime();
    return () => {
      cancelled = true;
      disconnectSocket();
      socketRef.current = null;
    };
  }, [examId, loadSessions]);

  useEffect(() => () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  const expand = useCallback(async (sessionId: string) => {
    setSelected(sessionId);
    setVideoStatus("connecting");
    setMediaError(null);
    roomRef.current?.disconnect();
    roomRef.current = null;

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Live video is unavailable.");

      const room = new Room({ adaptiveStream: true });
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setVideoStatus("live");
          setMediaError(null);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) setVideoStatus("connecting");
      });
      room.on(RoomEvent.Disconnected, () => setVideoStatus("unavailable"));
      await room.connect(payload.url, payload.token);
      roomRef.current = room;

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.track && videoRef.current) {
            publication.track.attach(videoRef.current);
            setVideoStatus("live");
          }
        }
      }
    } catch (error) {
      setVideoStatus("unavailable");
      setMediaError(error instanceof Error ? error.message : "Live video is unavailable.");
    }
  }, []);

  const warn = (sessionId: string, message: string) => {
    if (!socketRef.current?.connected) {
      setActionNotice("Warning not sent: realtime service is disconnected.");
      return;
    }
    socketRef.current.emit("proctor:warn", { sessionId, message });
    setActionNotice("Warning sent to the candidate.");
  };

  const terminate = (sessionId: string) => {
    if (!socketRef.current?.connected) {
      setActionNotice("Session not terminated: realtime service is disconnected.");
      return;
    }
    socketRef.current.emit("proctor:terminate", { sessionId, reason: "Terminated by proctor" });
    setTiles((previous) => previous[sessionId]
      ? { ...previous, [sessionId]: { ...previous[sessionId], status: "TERMINATED", online: false } }
      : previous);
    setActionNotice("Session terminated.");
  };

  const filteredAlerts = alerts.filter((alert) => severityFilter === "ALL" || alert.severity === severityFilter);
  const online = Object.values(tiles).filter((tile) => tile.online).length;
  const flagged = Object.values(tiles).filter((tile) => tile.status === "FLAGGED" || tile.status === "TERMINATED").length;
  const isRealtimeConnected = realtimeState === "connected";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgb(238_242_255_/_0.75),transparent_28rem),#f6f7fb]">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/proctor/dashboard" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-all hover:-translate-x-0.5 hover:text-neutral-900" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold tracking-[-0.025em] text-neutral-950">{exam?.title ?? "Proctor room"}</h1>
                {exam && <Badge variant={exam.status === "LIVE" ? "success" : "default"}>{exam.status}</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">Live candidate monitoring and intervention</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill icon={isRealtimeConnected ? <Signal className="h-3.5 w-3.5" /> : <SignalZero className="h-3.5 w-3.5" />} label={isRealtimeConnected ? "Realtime connected" : realtimeState === "connecting" ? "Connecting…" : "Realtime offline"} tone={isRealtimeConnected ? "success" : "danger"} />
            <StatusPill icon={<Wifi className="h-3.5 w-3.5" />} label={`${online}/${sessions.length} online`} tone="default" />
            <StatusPill icon={<AlertTriangle className="h-3.5 w-3.5" />} label={`${flagged} flagged`} tone={flagged > 0 ? "danger" : "default"} />
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[96rem] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
        <section className="min-w-0 space-y-5">
          {(loadError || realtimeError || actionNotice) && (
            <div className="space-y-2">
              {loadError && <Notice tone="danger">{loadError}</Notice>}
              {realtimeError && <Notice tone="warning">Realtime monitoring is unavailable: {realtimeError}. The room will keep trying to reconnect.</Notice>}
              {actionNotice && <Notice tone="info" onDismiss={() => setActionNotice(null)}>{actionNotice}</Notice>}
            </div>
          )}

          {loading ? (
            <Card>
              <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
                <LoaderCircle className="h-7 w-7 animate-spin text-accent" />
                <p className="mt-3 text-sm font-semibold text-neutral-800">Preparing the proctor room…</p>
                <p className="mt-1 text-xs text-neutral-500">Loading candidates and realtime services.</p>
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card className="border-dashed border-neutral-300 bg-white/80">
              <CardContent className="flex min-h-[28rem] flex-col items-center justify-center px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent ring-1 ring-indigo-100">
                  <UserRoundPlus className="h-7 w-7" />
                </span>
                <h2 className="mt-5 text-lg font-bold tracking-tight text-neutral-950">No candidates enrolled yet</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                  This exam is ready to monitor. Candidate tiles will appear automatically after students start or enroll in the exam.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => void refresh()} disabled={refreshing}>
                    <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                    Check for candidates
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/proctor/dashboard">Return to dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><UsersRound className="h-4 w-4 text-accent" />Candidate grid</h2>
                    <p className="mt-1 text-xs text-neutral-500">Select a candidate to view video and take action.</p>
                  </div>
                  <span className="text-xs font-semibold text-neutral-400">{sessions.length} total</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {Object.values(tiles).map((tile) => (
                    <SessionTile key={tile.sessionId} tile={tile} selected={selected === tile.sessionId} onSelect={() => void expand(tile.sessionId)} />
                  ))}
                </div>
              </div>

              {selected && tiles[selected] && (
                <ExpandedPanel
                  tile={tiles[selected]}
                  videoRef={videoRef}
                  videoStatus={videoStatus}
                  mediaError={mediaError}
                  realtimeConnected={isRealtimeConnected}
                  onClose={() => {
                    setSelected(null);
                    roomRef.current?.disconnect();
                    roomRef.current = null;
                  }}
                  onWarn={(message) => warn(selected, message)}
                  onTerminate={() => terminate(selected)}
                />
              )}
            </>
          )}
        </section>

        <aside className="overflow-hidden rounded-[var(--radius-lg)] border border-neutral-200/80 bg-white shadow-[var(--shadow-card)] lg:sticky lg:top-5 lg:max-h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><BellRing className="h-4 w-4 text-accent" />Alert feed</h2>
              <p className="mt-0.5 text-[11px] text-neutral-400">Live and recent integrity events</p>
            </div>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as Severity | "ALL")}
              aria-label="Filter alerts by severity"
              className="h-8 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 shadow-sm focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring/20"
            >
              <option value="ALL">All alerts</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          <div className="max-h-[32rem] overflow-y-auto p-3 lg:max-h-[calc(100vh-12rem)]">
            {filteredAlerts.length > 0 ? (
              <div className="space-y-2">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => void expand(alert.sessionId)}
                    className="w-full rounded-[var(--radius-sm)] border border-neutral-100 p-3 text-left transition-all hover:border-neutral-200 hover:bg-neutral-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="truncate text-xs font-semibold text-neutral-900">{alert.candidateName}</span>
                      <Badge variant={severityToBadgeVariant(alert.severity)}>{alert.severity}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-neutral-600">{formatEventType(alert.type)}</p>
                    <p className="mt-1 text-[10px] text-neutral-400">{new Date(alert.at).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400"><BellRing className="h-4 w-4" /></span>
                <p className="mt-3 text-xs font-semibold text-neutral-700">No matching alerts</p>
                <p className="mt-1 text-[11px] leading-5 text-neutral-400">Integrity events will appear here as candidates take the exam.</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function StatusPill({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "default" | "success" | "danger" }) {
  const tones = {
    default: "border-neutral-200 bg-white text-neutral-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold", tones[tone])}>{icon}{label}</span>;
}

function Notice({ children, tone, onDismiss }: { children: React.ReactNode; tone: "danger" | "warning" | "info"; onDismiss?: () => void }) {
  const tones = {
    danger: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-xs font-medium", tones[tone])}>
      <span>{children}</span>
      {onDismiss && <button onClick={onDismiss} className="font-bold opacity-60 hover:opacity-100" aria-label="Dismiss message">×</button>}
    </div>
  );
}

function formatEventType(type: string) {
  return type.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}
