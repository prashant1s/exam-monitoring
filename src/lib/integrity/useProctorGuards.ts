"use client";

import { useEffect, useRef } from "react";
import type { EventType, Severity } from "@/lib/events";
import type { ExamSettings } from "@/lib/schemas";

export type EmitFn = (type: EventType, severity: Severity, meta?: Record<string, unknown>) => void;

/** Debounce a given event type so a burst of the same signal only fires once per window. */
function debounced(emit: EmitFn, windowMs = 2000) {
  const last = new Map<EventType, number>();
  return (type: EventType, severity: Severity, meta?: Record<string, unknown>) => {
    const now = Date.now();
    const prev = last.get(type) ?? 0;
    if (now - prev < windowMs) return;
    last.set(type, now);
    emit(type, severity, meta);
  };
}

export function useProctorGuards(sessionId: string, emit: EmitFn, cfg: ExamSettings) {
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  useEffect(() => {
    const safeEmit = debounced((type, sev, meta) => emitRef.current(type, sev, meta));

    const onVisibility = () => {
      if (document.hidden) safeEmit("TAB_HIDDEN", "MEDIUM");
    };
    const onBlur = () => safeEmit("WINDOW_BLUR", "MEDIUM");
    const onFullscreenChange = () => {
      if (cfg.requireFullscreen && !document.fullscreenElement) {
        safeEmit("FULLSCREEN_EXIT", "HIGH");
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      if (cfg.blockCopyPaste) {
        e.preventDefault();
        safeEmit("COPY", "LOW");
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (cfg.blockCopyPaste) {
        e.preventDefault();
        safeEmit("PASTE", "LOW");
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      safeEmit("RIGHT_CLICK", "LOW");
    };
    const onOnline = () => safeEmit("NETWORK_BACK", "MEDIUM");
    const onOffline = () => safeEmit("NETWORK_LOST", "MEDIUM");
    const onResize = () => safeEmit("RESIZE", "INFO");

    const threshold = 160;
    const devtoolsInterval = setInterval(() => {
      const widthDelta = window.outerWidth - window.innerWidth > threshold;
      const heightDelta = window.outerHeight - window.innerHeight > threshold;
      if (widthDelta || heightDelta) {
        safeEmit("DEVTOOLS_OPEN", "MEDIUM", { confidence: 0.5 });
      }
    }, 3000);

    const checkMonitors = async () => {
      const scr = screen as Screen & { isExtended?: boolean };
      if (scr.isExtended) safeEmit("MULTIPLE_MONITORS", "HIGH");
    };
    checkMonitors();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("resize", onResize);
      if (devtoolsInterval) clearInterval(devtoolsInterval);
    };
  }, [sessionId, cfg.requireFullscreen, cfg.blockCopyPaste]);
}
