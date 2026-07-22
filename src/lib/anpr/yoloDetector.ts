/**
 * PlateQ — Primary Malaysian License Plate Detection Engine
 * Model: YOLOv8 Object Detection (Universe Roboflow: fyp-hq4ka/license-plate-malaysia-kqy48)
 * 
 * Supports:
 * 1. Roboflow Hosted Inference API (Real-time Cloud AI)
 * 2. Local ONNX Web Runtime (onnxruntime-web /models/plate-detector.onnx)
 * 3. Computer Vision Heuristic Fallback
 */

import { detectPlateCandidatesCV } from './imageProcessor';

export interface BoundingBox {
  x: number;      // top-left x in canvas pixels
  y: number;      // top-left y in canvas pixels
  width: number;  // width in canvas pixels
  height: number; // height in canvas pixels
}

export interface DetectedPlateBox {
  bbox: BoundingBox;
  confidence: number;
  label: string;
  sourceEngine: 'ROBOFLOW_API' | 'LOCAL_ONNX' | 'CV_HEURISTIC';
}

export interface DetectionOptions {
  apiKey?: string;
  minConfidence?: number;
  iouThreshold?: number;
  enginePreference?: 'AUTO' | 'ROBOFLOW_API' | 'LOCAL_ONNX' | 'CV_HEURISTIC';
}

const DEFAULT_API_KEY = 'QhgkpEMcagyM4hkiKOVl';
const MODEL_ENDPOINT = 'https://detect.roboflow.com/license-plate-malaysia-kqy48/2';

let localOnnxSession: any = null;
let isOnnxLoading = false;
let onnxLoadAttempted = false;

/**
 * Initialize Local ONNX Session if model exists in /models/plate-detector.onnx
 */
export async function initLocalOnnxSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (localOnnxSession) return true;
  if (onnxLoadAttempted) return false;

  onnxLoadAttempted = true;
  isOnnxLoading = true;

  try {
    const loadOrt = new Function('return import("onnxruntime-web")');
    const ort = await loadOrt();
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';

    const res = await fetch('/models/plate-detector.onnx', { method: 'HEAD' });
    if (!res.ok) {
      isOnnxLoading = false;
      return false;
    }

    localOnnxSession = await ort.InferenceSession.create('/models/plate-detector.onnx', {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all',
    });

    isOnnxLoading = false;
    return true;
  } catch (err) {
    console.warn('[ANPR YoloDetector] Local ONNX model not loaded, using API/CV fallback:', err);
    isOnnxLoading = false;
    return false;
  }
}

/**
 * Detect all visible Malaysian vehicle number plates across the full camera frame.
 */
export async function detectMalaysianPlates(
  canvas: HTMLCanvasElement,
  options: DetectionOptions = {}
): Promise<DetectedPlateBox[]> {
  const minConf = options.minConfidence ?? 0.25;
  const apiKey = options.apiKey || DEFAULT_API_KEY;
  const pref = options.enginePreference || 'AUTO';

  // 1. Try Local ONNX if requested or AUTO
  if (pref === 'LOCAL_ONNX' || (pref === 'AUTO' && localOnnxSession)) {
    try {
      const onnxDetections = await runLocalOnnxDetection(canvas, minConf);
      if (onnxDetections.length > 0) {
        return onnxDetections;
      }
    } catch (err) {
      console.warn('[ANPR YoloDetector] Local ONNX error:', err);
    }
  }

  // 2. Try Roboflow Hosted Inference API (Primary Roboflow Model)
  if (pref === 'ROBOFLOW_API' || pref === 'AUTO') {
    try {
      const apiDetections = await runRoboflowApiDetection(canvas, apiKey, minConf);
      if (apiDetections.length > 0) {
        return apiDetections;
      }
    } catch (err) {
      // Quiet fail to fallback
    }
  }

  // 3. Computer Vision Heuristic Fallback
  const cvCandidates = detectPlateCandidatesCV(canvas);
  return cvCandidates.map((c) => ({
    bbox: {
      x: c.crop.x,
      y: c.crop.y,
      width: c.crop.width,
      height: c.crop.height,
    },
    confidence: c.confidence,
    label: 'License-Plate',
    sourceEngine: 'CV_HEURISTIC',
  }));
}

/**
 * Run Roboflow Hosted Inference API on Canvas frame
 */
async function runRoboflowApiDetection(
  canvas: HTMLCanvasElement,
  apiKey: string,
  minConfidence: number
): Promise<DetectedPlateBox[]> {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  const url = `${MODEL_ENDPOINT}?api_key=${apiKey}&confidence=${Math.round(minConfidence * 100)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: base64Data,
  });

  if (!response.ok) {
    throw new Error(`Roboflow API returned status ${response.status}`);
  }

  const result = await response.json();
  if (!result.predictions || !Array.isArray(result.predictions)) {
    return [];
  }

  const origWidth = canvas.width;
  const origHeight = canvas.height;
  const modelWidth = result.image?.width || origWidth;
  const modelHeight = result.image?.height || origHeight;

  const scaleX = origWidth / modelWidth;
  const scaleY = origHeight / modelHeight;

  const detections: DetectedPlateBox[] = [];

  for (const pred of result.predictions) {
    if (pred.confidence < minConfidence) continue;

    const width = pred.width * scaleX;
    const height = pred.height * scaleY;
    const x = (pred.x * scaleX) - (width / 2);
    const y = (pred.y * scaleY) - (height / 2);

    const clampedX = Math.max(0, Math.min(x, origWidth - 10));
    const clampedY = Math.max(0, Math.min(y, origHeight - 10));
    const clampedW = Math.min(width, origWidth - clampedX);
    const clampedH = Math.min(height, origHeight - clampedY);

    if (clampedW < 15 || clampedH < 10) continue;

    detections.push({
      bbox: {
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        width: Math.round(clampedW),
        height: Math.round(clampedH),
      },
      confidence: pred.confidence,
      label: pred.class || 'License-Plate',
      sourceEngine: 'ROBOFLOW_API',
    });
  }

  return applyNMS(detections, 0.45);
}

/**
 * Run Local ONNX Inference on Canvas frame
 */
async function runLocalOnnxDetection(
  canvas: HTMLCanvasElement,
  minConfidence: number
): Promise<DetectedPlateBox[]> {
  if (!localOnnxSession || typeof window === 'undefined') return [];

  const loadOrt = new Function('return import("onnxruntime-web")');
  const ort = await loadOrt();
  const targetSize = 640;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetSize;
  tempCanvas.height = targetSize;
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return [];

  ctx.drawImage(canvas, 0, 0, targetSize, targetSize);
  const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
  const { data } = imgData;

  const float32Data = new Float32Array(3 * targetSize * targetSize);
  const channelSize = targetSize * targetSize;

  for (let i = 0; i < channelSize; i++) {
    float32Data[i] = data[i * 4] / 255.0;
    float32Data[channelSize + i] = data[i * 4 + 1] / 255.0;
    float32Data[2 * channelSize + i] = data[i * 4 + 2] / 255.0;
  }

  const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]);
  const inputName = localOnnxSession.inputNames[0] || 'images';
  const results = await localOnnxSession.run({ [inputName]: inputTensor });

  const outputName = localOnnxSession.outputNames[0] || 'output0';
  const outputTensor = results[outputName];
  if (!outputTensor) return [];

  const rawData = outputTensor.data as Float32Array;
  const scaleX = canvas.width / targetSize;
  const scaleY = canvas.height / targetSize;

  const detections: DetectedPlateBox[] = [];
  const numDetections = 8400;

  for (let i = 0; i < numDetections; i++) {
    const cx = rawData[i] * scaleX;
    const cy = rawData[numDetections + i] * scaleY;
    const w = rawData[2 * numDetections + i] * scaleX;
    const h = rawData[3 * numDetections + i] * scaleY;
    const conf = rawData[4 * numDetections + i];

    if (conf >= minConfidence && w > 15 && h > 10) {
      detections.push({
        bbox: {
          x: Math.round(Math.max(0, cx - w / 2)),
          y: Math.round(Math.max(0, cy - h / 2)),
          width: Math.round(w),
          height: Math.round(h),
        },
        confidence: conf,
        label: 'License-Plate',
        sourceEngine: 'LOCAL_ONNX',
      });
    }
  }

  return applyNMS(detections, 0.45);
}

function applyNMS(boxes: DetectedPlateBox[], iouThreshold: number): DetectedPlateBox[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const selected: DetectedPlateBox[] = [];

  for (const box of sorted) {
    let keep = true;
    for (const sel of selected) {
      if (calculateIoU(box.bbox, sel.bbox) > iouThreshold) {
        keep = false;
        break;
      }
    }
    if (keep) {
      selected.push(box);
    }
  }

  return selected;
}

export function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  if (interArea === 0) return 0;

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  return interArea / (areaA + areaB - interArea);
}
