/**
 * PlateQ — Primary Malaysian License Plate Detection Engine
 * Model: YOLOv8 Object Detection (Universe Roboflow: fyp-hq4ka/license-plate-malaysia-kqy48)
 * 
 * Supports:
 * 1. Local ONNX Web Runtime (onnxruntime-web /models/plate-detector.onnx)
 * 2. Computer Vision Heuristic Fallback
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
  minConfidence?: number;
  iouThreshold?: number;
  enginePreference?: 'AUTO' | 'LOCAL_ONNX' | 'CV_HEURISTIC';
  developerMode?: boolean;
}

export interface PlateDetector {
  initialize(): Promise<boolean>;
  validate(): Promise<{ valid: boolean; provider?: string }>;
  detect(canvas: HTMLCanvasElement, options: DetectionOptions): Promise<DetectedPlateBox[]>;
}


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
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

    // Remove HEAD request check because Vercel/CDNs sometimes block HEAD requests for static files
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

export async function validateDetector(): Promise<{ valid: boolean; provider?: string }> {
  if (!localOnnxSession) return { valid: false };
  try {
    if (!localOnnxSession.inputNames || !localOnnxSession.outputNames) return { valid: false };
    // Basic structural checks pass
    return { valid: true, provider: 'ONNX Web Runtime' };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Detect all visible Malaysian vehicle number plates across the full camera frame.
 */
export async function detectMalaysianPlates(
  canvas: HTMLCanvasElement,
  options: DetectionOptions = {}
): Promise<DetectedPlateBox[]> {
  const minConf = options.minConfidence ?? 0.45;
  const apiKey = options.apiKey || DEFAULT_API_KEY;
  const pref = options.enginePreference || 'AUTO';
  const iouThreshold = options.iouThreshold ?? 0.40;

  // 1. Try Local ONNX if requested or AUTO
  if (pref === 'LOCAL_ONNX' || pref === 'AUTO') {
    const validation = await validateDetector();
    if (validation.valid) {
      try {
        const onnxDetections = await runLocalOnnxDetection(canvas, minConf, iouThreshold);
        if (onnxDetections.length > 0) return onnxDetections;
      } catch (err) {
        console.warn('[ANPR YoloDetector] Local ONNX error:', err);
      }
    }
  }

  // 2. Computer Vision Heuristic (Explicit Fallback ONLY)
  if (pref === 'CV_HEURISTIC') {
    const cvCandidates = detectPlateCandidatesCV(canvas, minConf);
    const mapped = cvCandidates.map((c) => ({
      bbox: {
        x: c.crop.x,
        y: c.crop.y,
        width: c.crop.width,
        height: c.crop.height,
      },
      confidence: c.confidence,
      label: 'License-Plate',
      sourceEngine: 'CV_HEURISTIC' as const,
    }));
    return applyFiltersAndNMS(mapped, iouThreshold);
  }

  return []; // Show Detector Unavailable if nothing works
}



/**
 * Run Local ONNX Inference on Canvas frame
 */
async function runLocalOnnxDetection(
  canvas: HTMLCanvasElement,
  minConfidence: number,
  iouThreshold: number
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

  // Memory Protection: Dispose input tensor after inference
  if (inputTensor.dispose) inputTensor.dispose();

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

    if (conf >= minConfidence) {
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

  // Memory Protection: Dispose output tensor
  if (outputTensor.dispose) outputTensor.dispose();

  return applyFiltersAndNMS(detections, iouThreshold);
}

function applyFiltersAndNMS(boxes: DetectedPlateBox[], iouThreshold: number): DetectedPlateBox[] {
  // 1. Size & Aspect Ratio Filtering
  const filtered = boxes.filter(box => {
    const { width, height } = box.bbox;
    if (width < 30 || height < 10) return false;
    
    const ar = width / height;
    // single line (~2.0 to 6.0), two line (~0.8 to 2.5) -> overall 0.8 to 6.0
    if (ar < 0.8 || ar > 6.0) return false;
    
    return true;
  });

  // 2. Non-Maximum Suppression
  return applyNMS(filtered, iouThreshold);
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
