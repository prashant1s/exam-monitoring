import type { EventType } from "@/lib/events";

const WEIGHTS: Partial<Record<EventType, number>> = {
  FACE_MULTIPLE: 25,
  PHONE_DETECTED: 25,
  FULLSCREEN_EXIT: 10,
  TAB_HIDDEN: 8,
  WINDOW_BLUR: 6,
  LOOKING_AWAY: 3,
  FACE_NONE: 5,
  BOOK_DETECTED: 15,
  COPY: 4,
  PASTE: 6,
  RIGHT_CLICK: 1,
  DEVTOOLS_OPEN: 20,
  NETWORK_LOST: 2,
  MULTIPLE_MONITORS: 15,
  MIC_LEVEL_HIGH: 2,
  CAMERA_OFF: 10,
};

// Caps prevent one noisy/spammy event type from dominating the whole score.
const CAPS: Partial<Record<EventType, number>> = {
  LOOKING_AWAY: 15,
  TAB_HIDDEN: 30,
  WINDOW_BLUR: 24,
  COPY: 12,
  PASTE: 12,
  RIGHT_CLICK: 5,
  NETWORK_LOST: 10,
};

export function scoreSession(events: { type: EventType }[]) {
  const sums: Partial<Record<EventType, number>> = {};
  for (const e of events) {
    sums[e.type] = (sums[e.type] ?? 0) + (WEIGHTS[e.type] ?? 0);
  }
  const total = Object.entries(sums).reduce((acc, [type, value]) => {
    const cap = CAPS[type as EventType];
    return acc + Math.min(value, cap ?? value);
  }, 0);
  return Math.max(0, 100 - total);
}

export const AUTO_FLAG_THRESHOLD = 60;
