import type { Matrix } from "@mediapipe/tasks-vision";

const YAW_THRESHOLD_DEG = 30;
const PITCH_THRESHOLD_DEG = 22;
const SUSTAINED_FRAMES = 6; // ~1s at 5-6fps analysis loop

let awayStreak = 0;

function radToDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

/** Extract yaw/pitch from MediaPipe's 4x4 facial transformation (column-major) matrix. */
function yawPitchFromMatrix(matrix: Matrix) {
  const m = matrix.data;
  // column-major 4x4: m[col*4 + row]
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10];
  const yaw = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10));
  const pitch = Math.atan2(r21, r22);
  return { yawDeg: radToDeg(yaw), pitchDeg: radToDeg(pitch) };
}

export function isLookingAway(matrix: Matrix | undefined): boolean {
  if (!matrix) {
    awayStreak = 0;
    return false;
  }
  const { yawDeg, pitchDeg } = yawPitchFromMatrix(matrix);
  const beyondThreshold = Math.abs(yawDeg) > YAW_THRESHOLD_DEG || Math.abs(pitchDeg) > PITCH_THRESHOLD_DEG;

  awayStreak = beyondThreshold ? awayStreak + 1 : 0;
  return awayStreak >= SUSTAINED_FRAMES;
}
