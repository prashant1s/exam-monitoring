// Holds the candidate's camera/mic MediaStream across client-side navigation
// from /precheck to /live (module state survives soft nav; a hard refresh clears it,
// so the live page re-checks and bounces back to precheck if it's missing).
let stream: MediaStream | null = null;

export function setSharedStream(s: MediaStream | null) {
  stream = s;
}

export function getSharedStream() {
  return stream;
}
