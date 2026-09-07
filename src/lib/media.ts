export class MediaAccessError extends Error {
  constructor(public kind: "denied" | "not-found" | "unknown", message: string) {
    super(message);
  }
}

export async function getCandidateStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: 15, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError") {
        throw new MediaAccessError("denied", "Camera/microphone access was denied.");
      }
      if (err.name === "NotFoundError") {
        throw new MediaAccessError("not-found", "No camera/microphone device was found.");
      }
    }
    throw new MediaAccessError("unknown", "Unable to access camera/microphone.");
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
