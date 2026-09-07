import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import type { EmitFn } from "@/lib/integrity/useProctorGuards";
import { isLookingAway } from "@/lib/vision/gaze";

export interface VisionModels {
  face: FaceLandmarker;
  objects: cocoSsd.ObjectDetection;
}

// Hosted by Google/MediaPipe over CDN so no local model files need to be bundled.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function initVision(): Promise<VisionModels> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const face = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
    numFaces: 3,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
    runningMode: "VIDEO",
  });
  const objects = await cocoSsd.load({ base: "lite_mobilenet_v2" });
  return { face, objects };
}

export function analyze(video: HTMLVideoElement, models: VisionModels, emit: EmitFn) {
  if (video.readyState < 2) return;
  const now = performance.now();

  const result = models.face.detectForVideo(video, now);
  const faceCount = result.faceLandmarks.length;

  if (faceCount === 0) {
    emit("FACE_NONE", "HIGH");
  } else if (faceCount >= 2) {
    emit("FACE_MULTIPLE", "CRITICAL");
  } else if (isLookingAway(result.facialTransformationMatrixes?.[0])) {
    emit("LOOKING_AWAY", "MEDIUM");
  }

  models.objects.detect(video).then((preds) => {
    for (const p of preds) {
      if (p.score < 0.6) continue;
      if (p.class === "cell phone") emit("PHONE_DETECTED", "CRITICAL", { confidence: p.score });
      if (p.class === "book") emit("BOOK_DETECTED", "HIGH", { confidence: p.score });
      if (p.class === "laptop") emit("PHONE_DETECTED", "MEDIUM", { confidence: p.score, note: "laptop" });
    }
  }).catch(() => {});
}
