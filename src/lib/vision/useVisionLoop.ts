"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { initVision, analyze, type VisionModels } from "@/lib/vision/loop";
import type { EmitFn } from "@/lib/integrity/useProctorGuards";

const ANALYZE_INTERVAL_MS = 200; // ~5fps

export function useVisionLoop(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean, emit: EmitFn) {
  const [ready, setReady] = useState(false);
  const modelsRef = useRef<VisionModels | null>(null);
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    initVision()
      .then((m) => {
        if (cancelled) return;
        modelsRef.current = m;
        setReady(true);
      })
      .catch((err) => console.error("[vision] failed to initialize models", err));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && modelsRef.current) analyze(video, modelsRef.current, (t, s, m) => emitRef.current(t, s, m));
    }, ANALYZE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, ready, videoRef]);

  return { ready };
}
