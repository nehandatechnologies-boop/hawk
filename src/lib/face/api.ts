import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  })();
  return loadingPromise;
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

export type Descriptor = number[];

export interface DetectedFace {
  descriptor: Descriptor;
  box: { x: number; y: number; width: number; height: number };
}

export async function detectSingleDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<DetectedFace | null> {
  const res = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!res) return null;
  return {
    descriptor: Array.from(res.descriptor),
    box: {
      x: res.detection.box.x,
      y: res.detection.box.y,
      width: res.detection.box.width,
      height: res.detection.box.height,
    },
  };
}

export async function detectAllDescriptors(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<DetectedFace[]> {
  const res = await faceapi
    .detectAllFaces(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();
  return res.map((r) => ({
    descriptor: Array.from(r.descriptor),
    box: {
      x: r.detection.box.x,
      y: r.detection.box.y,
      width: r.detection.box.width,
      height: r.detection.box.height,
    },
  }));
}

export function euclideanDistance(a: Descriptor, b: Descriptor): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export interface Candidate {
  personnelId: string;
  personnelName: string;
  descriptor: Descriptor;
}

export interface Match {
  candidate: Candidate;
  distance: number;
  confidence: number; // 0..1
}

export const MATCH_THRESHOLD = 0.55;

export function findBestMatch(target: Descriptor, candidates: Candidate[]): Match | null {
  let best: Match | null = null;
  for (const c of candidates) {
    const d = euclideanDistance(target, c.descriptor);
    if (!best || d < best.distance) {
      best = { candidate: c, distance: d, confidence: Math.max(0, 1 - d) };
    }
  }
  if (!best || best.distance > MATCH_THRESHOLD) return null;
  return best;
}

export function captureCanvas(
  source: HTMLVideoElement | HTMLImageElement,
  maxSize = 320,
): string {
  const w = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth;
  const h = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight;
  if (!w || !h) return "";
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // revoke later — caller may still need img
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
