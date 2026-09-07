"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExamStore } from "@/stores/examStore";
import { useProctorGuards, type EmitFn } from "@/lib/integrity/useProctorGuards";
import { useVisionLoop } from "@/lib/vision/useVisionLoop";
import { getSharedStream } from "@/lib/media-singleton";
import { getSocket, disconnectSocket } from "@/lib/socket-client";
import { joinRoom } from "@/lib/livekit";
import type { ExamSettings } from "@/lib/schemas";
import type { EventType, Severity } from "@/lib/events";
import { cn } from "@/lib/utils";

interface SessionData {
  id: string;
  status: string;
  startedAt: string | null;
  exam: {
    title: string;
    durationMin: number;
    settings: ExamSettings;
    questions: {
      id: string;
      order: number;
      type: "MCQ" | "MULTI" | "SHORT" | "LONG" | "CODE";
      prompt: string;
      options?: string[] | null;
      points: number;
    }[];
  };
  answers: { questionId: string; value: unknown }[];
}

export default function LiveExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const [data, setData] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [strikes, setStrikes] = useState(0);

  const { sessionId: storeSessionId, questions, currentIndex, answers, timeLeft, status, init, setAnswer, goto, next, prev, tick, setStatus } =
    useExamStore();

  // Load session + set up the video preview from the shared precheck stream.
  useEffect(() => {
    const stream = getSharedStream();
    if (!stream) {
      router.replace(`/student/exam/${sessionId}/precheck`);
      return;
    }
    if (videoRef.current) videoRef.current.srcObject = stream;

    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((s: SessionData) => {
        if (s.status === "SUBMITTED" || s.status === "FLAGGED" || s.status === "TERMINATED") {
          setStatus("submitted");
          setData(s);
          return;
        }
        setData(s);
        const startedAt = s.startedAt ? new Date(s.startedAt).getTime() : Date.now();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, s.exam.durationMin * 60 - elapsed);
        init(
          sessionId,
          s.exam.questions.map((q) => ({ ...q })),
          remaining
        );
        for (const a of s.answers) setAnswer(a.questionId, a.value);
      })
      .catch(() => setLoadError("Failed to load exam session."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const emit: EmitFn = useCallback(
    (type: EventType, severity: Severity, meta?: Record<string, unknown>) => {
      socketRef.current?.emit("session:event", { sessionId, type, severity, meta });
      if (severity === "HIGH" || severity === "CRITICAL") {
        setStrikes((s) => s + 1);
      }
    },
    [sessionId]
  );

  // Socket connection + proctor warning/terminate handling.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/socket-token")
      .then((r) => r.json())
      .then(({ token }) => {
        if (cancelled) return;
        const socket = getSocket(token);
        socketRef.current = socket;
        socket.emit("session:join", { sessionId });
        socket.on("proctor:warn", ({ message }) => setWarning(message));
        socket.on("proctor:terminate", () => {
          setStatus("submitted");
          alert("Your session has been terminated by a proctor.");
          router.push("/student/dashboard");
        });
      });
    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, [sessionId, router, setStatus]);

  // LiveKit publish — silently skipped if the server isn't configured with LiveKit creds yet.
  useEffect(() => {
    let room: Awaited<ReturnType<typeof joinRoom>> | null = null;
    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res) return;
        const stream = getSharedStream();
        if (!stream) return;
        return joinRoom(res.url, res.token, stream);
      })
      .then((r) => {
        room = r ?? null;
      })
      .catch(() => {});
    return () => {
      room?.disconnect();
    };
  }, [sessionId]);

  const settings = data?.exam.settings;
  useProctorGuards(sessionId, emit, settings ?? {
    requireFullscreen: true,
    blockCopyPaste: true,
    allowedTabSwitches: 3,
    aiProctoring: { face: true, object: true, gaze: true },
    recording: false,
  });

  const visionEnabled = Boolean(settings?.aiProctoring.face || settings?.aiProctoring.object || settings?.aiProctoring.gaze);
  useVisionLoop(videoRef, visionEnabled && status === "in_progress", emit);

  // Countdown timer — client display only; the server recomputes the authoritative remaining time.
  useEffect(() => {
    if (status !== "in_progress") return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, tick]);

  const submit = useCallback(async () => {
    setStatus("submitting");
    await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })) }),
    });
    await fetch(`/api/sessions/${sessionId}/submit`, { method: "POST" });
    socketRef.current?.emit("session:event", { sessionId, type: "SUBMITTED", severity: "INFO" });
    setStatus("submitted");
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    router.push("/student/dashboard");
  }, [answers, sessionId, setStatus, router]);

  // Autosubmit at time-out.
  useEffect(() => {
    if (status === "in_progress" && timeLeft === 0) submit();
  }, [status, timeLeft, submit]);

  // Autosave (debounced).
  useEffect(() => {
    if (status !== "in_progress" || Object.keys(answers).length === 0) return;
    const handle = setTimeout(() => {
      fetch(`/api/sessions/${sessionId}/answers`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
        }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
  }, [answers, sessionId, status]);

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!data || storeSessionId !== sessionId) return <div className="p-6">Loading exam…</div>;

  if (status === "submitted") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Session complete</h1>
        <p className="text-sm text-neutral-600">Your answers have been recorded. You may close this window.</p>
        <Button onClick={() => router.push("/student/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  const q = questions[currentIndex];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const answeredCount = questions.filter((qq) => answers[qq.id] !== undefined).length;
  const timeCritical = timeLeft <= 60;

  return (
    <div className="flex flex-1">
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />

      <aside className="w-64 border-r border-neutral-200 bg-neutral-50/60 p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{data.exam.title}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {answeredCount}/{questions.length} answered
          </p>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex flex-col gap-1">
          {questions.map((question, i) => {
            const isActive = i === currentIndex;
            const isAnswered = answers[question.id] !== undefined;
            return (
              <button
                key={question.id}
                onClick={() => goto(i)}
                className={cn(
                  "flex items-center gap-2 rounded-[--radius-sm] px-2.5 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-white shadow-[--shadow-card] ring-1 ring-neutral-200" : "hover:bg-white/70"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    isAnswered ? "bg-accent" : "bg-neutral-300"
                  )}
                />
                <span className={cn("truncate", isActive ? "font-medium text-neutral-900" : "text-neutral-500")}>
                  Q{i + 1}. {question.prompt.slice(0, 22)}
                  {question.prompt.length > 22 ? "…" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <Badge variant={strikes > 0 ? "high" : "accent"}>
            <span className={cn("h-1.5 w-1.5 rounded-full", strikes > 0 ? "bg-red-600" : "bg-accent")} />
            Integrity monitoring active
          </Badge>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-mono text-lg tabular-nums",
              timeCritical ? "bg-red-50 text-red-700" : "text-neutral-900"
            )}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </header>

        {warning && (
          <div className="flex items-center justify-between bg-amber-50 px-6 py-2.5 text-sm text-amber-900">
            <span>Proctor message: {warning}</span>
            <button onClick={() => setWarning(null)} className="underline underline-offset-2">
              dismiss
            </button>
          </div>
        )}

        <div className="flex-1 p-8 max-w-2xl">
          {q && (
            <div className="flex flex-col gap-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Question {currentIndex + 1} of {questions.length} · {q.points} pt{q.points === 1 ? "" : "s"}
              </p>
              <p className="text-lg font-medium leading-snug text-neutral-900">{q.prompt}</p>
              <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-neutral-200 bg-white px-6 py-3">
          <div className="flex gap-2">
            <Button variant="outline" onClick={prev} disabled={currentIndex === 0}>
              Previous
            </Button>
            <Button variant="outline" onClick={next} disabled={currentIndex === questions.length - 1}>
              Next
            </Button>
          </div>
          <Button variant="destructive" onClick={() => confirm("Submit the exam now?") && submit()}>
            Submit exam
          </Button>
        </footer>
      </main>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: SessionData["exam"]["questions"][number];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "MCQ") {
    return (
      <div className="flex flex-col gap-2">
        {(question.options ?? []).map((opt) => {
          const checked = value === opt;
          return (
            <label
              key={opt}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[--radius-sm] border px-3.5 py-2.5 text-sm transition-colors",
                checked ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-neutral-200 hover:bg-neutral-50"
              )}
            >
              <input
                type="radio"
                name={question.id}
                checked={checked}
                onChange={() => onChange(opt)}
                className="h-4 w-4 accent-accent"
              />
              {opt}
            </label>
          );
        })}
      </div>
    );
  }
  if (question.type === "MULTI") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-col gap-2">
        {(question.options ?? []).map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[--radius-sm] border px-3.5 py-2.5 text-sm transition-colors",
                checked ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-neutral-200 hover:bg-neutral-50"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt))
                }
                className="h-4 w-4 accent-accent"
              />
              {opt}
            </label>
          );
        })}
      </div>
    );
  }
  if (question.type === "LONG" || question.type === "CODE") {
    return (
      <textarea
        className="w-full h-48 rounded-[--radius-sm] border border-neutral-300 p-3 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className="w-full rounded-[--radius-sm] border border-neutral-300 p-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
