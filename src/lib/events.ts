import { z } from "zod";

export const EVENT_TYPES = [
  "TAB_HIDDEN", "WINDOW_BLUR", "FULLSCREEN_EXIT", "COPY", "PASTE", "RIGHT_CLICK",
  "DEVTOOLS_OPEN", "NETWORK_LOST", "NETWORK_BACK", "MULTIPLE_MONITORS", "RESIZE",
  "FACE_NONE", "FACE_MULTIPLE", "LOOKING_AWAY", "PHONE_DETECTED", "BOOK_DETECTED",
  "MIC_LEVEL_HIGH", "CAMERA_OFF", "PROCTOR_WARNING", "JOINED", "LEFT", "SUBMITTED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const monitorEventSchema = z.object({
  sessionId: z.string().min(1),
  type: z.enum(EVENT_TYPES),
  severity: z.enum(SEVERITIES).default("INFO"),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type MonitorEventPayload = z.infer<typeof monitorEventSchema>;

// client -> server
export interface ClientToServerEvents {
  "session:join": (payload: { sessionId: string }) => void;
  "session:event": (payload: MonitorEventPayload) => void;
  heartbeat: (payload: { sessionId: string; ts: number }) => void;
  "proctor:warn": (payload: { sessionId: string; message: string }) => void;
  "proctor:terminate": (payload: { sessionId: string; reason: string }) => void;
}

// server -> client
export interface ServerToClientEvents {
  "room:candidate_event": (payload: {
    sessionId: string;
    event: { type: EventType; severity: Severity; at: string; meta?: Record<string, unknown> };
  }) => void;
  "room:presence": (payload: { sessionId: string; online: boolean }) => void;
  "proctor:warn": (payload: { sessionId: string; message: string }) => void;
  "proctor:terminate": (payload: { sessionId: string; reason: string }) => void;
}
