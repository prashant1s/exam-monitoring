"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getCandidateStream, MediaAccessError } from "@/lib/media";
import { setSharedStream } from "@/lib/media-singleton";

type CheckState = "pending" | "ok" | "fail";

export default function PrecheckPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [camera, setCamera] = useState<CheckState>("pending");
  const [fullscreenReady, setFullscreenReady] = useState(false);
  const [multiMonitor] = useState(() => {
    if (typeof screen === "undefined") return false;
    return Boolean((screen as Screen & { isExtended?: boolean }).isExtended);
  });
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    let active = true;
    getCandidateStream()
      .then((stream) => {
        if (!active) return;
        setSharedStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamera("ok");
      })
      .catch((err) => {
        setCamera("fail");
        setError(err instanceof MediaAccessError ? err.message : "Camera/mic access failed.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function enterExam() {
    setEntering(true);
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenReady(true);
      await fetch(`/api/sessions/${sessionId}/start`, { method: "POST" });
      router.push(`/student/exam/${sessionId}/live`);
    } catch {
      setError("Fullscreen permission is required to start the exam.");
      setEntering(false);
    }
  }

  const canEnter = camera === "ok" && !multiMonitor;

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center p-6">
      <Card className="shadow-[--shadow-elevated] border-neutral-200/60">
        <CardHeader>
          <CardTitle className="text-base">System check</CardTitle>
          <CardDescription>We verify a few things before the exam begins.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="relative overflow-hidden rounded-[--radius-md] bg-neutral-950 aspect-video">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Preview
            </span>
          </div>

          <ul className="flex flex-col gap-2.5 text-sm">
            <li className="flex items-center justify-between rounded-[--radius-sm] border border-neutral-200 px-3 py-2.5">
              <span className="text-neutral-700">Camera &amp; microphone</span>
              <StatusPill state={camera} />
            </li>
            <li className="flex items-center justify-between rounded-[--radius-sm] border border-neutral-200 px-3 py-2.5">
              <span className="text-neutral-700">Single monitor</span>
              <StatusPill state={multiMonitor ? "fail" : "ok"} />
            </li>
          </ul>

          {error && <p className="rounded-[--radius-sm] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button onClick={enterExam} disabled={!canEnter || entering || fullscreenReady} className="w-full">
            {entering ? "Entering…" : "Enter exam (fullscreen)"}
          </Button>
          <p className="text-xs text-neutral-500">
            Once you enter, the exam runs in locked-down fullscreen and your activity is monitored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ state }: { state: CheckState }) {
  if (state === "pending")
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-300" /> checking…
      </span>
    );
  if (state === "ok")
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ready
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> blocked
    </span>
  );
}
