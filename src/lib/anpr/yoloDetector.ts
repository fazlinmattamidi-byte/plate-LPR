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
  sourceEngine: 'LOCAL_ONNX' | 'CV_HEURISTIC';
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
let onnxLoadFailures = 0;        // Track failures — allow retry after transient errors
const MAX_ONNX_FAILURES = 3;     // Give up permanently after 3 consecutive failures

/**
 * Initialize Local ONNX Session if model exists in /models/plate-detector.onnx
 */
export async function initLocalOnnxSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (localOnnxSession) return true;
  // Allow retries on transient failures; give up only after MAX_ONNX_FAILURES
  if (onnxLoadFailures >= MAX_ONNX_FAILURES) return false;
  // Prevent concurrent load races
  if (isOnnxLoading) return false;

  isOnnxLoading = true;

  try {
    const loadOrt = new Function('return import("onnxruntime-web")');
    const ort = await loadOrt();
    // Use locally-served WASM files (copied from node_modules at build time)
    // — avoids CDN dependency which is unreliable / slow on mobile networks.
    ort.env.wasm.wasmPaths = '/ort-wasm/';

    localOnnxSession = await ort.InferenceSession.create('/models/plate-detector.onnx', {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all',
    });

    console.log('[ANPR YoloDetector] Local ONNX model loaded successfully.');
    onnxLoadFailures = 0; // Reset on success
    isOnnxLoading = false;
    return true;
  } catch (err) {
    onnxLoadFailures++;
    console.warn(
      `[ANPR YoloDetector] Local ONNX load failed (attempt ${onnxLoadFailures}/${MAX_ONNX_FAILURES}):`,
      err
    );
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
  const pref = options.enginePreference || 'AUTO';
  const iouThreshold = options.iouThreshold ?? 0.40;

  // 1. Try Local ONNX if requested or AUTO
  if (pref === 'LOCAL_ONNX' || pref === 'AUTO') {
    // Attempt (re-)initialization if session is not yet loaded
    if (!localOnnxSession) {
      await initLocalOnnxSession();
    }
    const validation = await validateDetector();
    if (validation.valid) {
      try {
        const onnxDetections = await runLocalOnnxDetection(canvas, minConf, iouThreshold);
        if (onnxDetections.length > 0) return onnxDetections;
        // ONNX loaded but found nothing — still try CV in AUTO mode below
      } catch (err) {
        console.warn('[ANPR YoloDetector] Local ONNX error:', err);
      }
    }
  }

  // 2. Computer Vision Heuristic
  // - Always engaged when pref === 'CV_HEURISTIC'
  // - Also engaged in AUTO mode when ONNX is unavailable or finds nothing
  if (pref === 'CV_HEURISTIC' || pref === 'AUTO') {
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

  return []; // Only reached if pref === 'LOCAL_ONNX' and model unavailable
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

  const dims = outputTensor.dims;
  const rawData = outputTensor.data as Float32Array;
  const scaleX = canvas.width / targetSize;
  const scaleY = canvas.height / targetSize;

  let numAnchors = 8400;
  let numChannels = 5;
  let isTransposed = false;

  if (dims.length >= 2) {
    const d1 = dims[dims.length - 2];
    const d2 = dims[dims.length - 1];
    if (d1 > d2) {
      numAnchors = d1;
      numChannels = d2;
      isTransposed = true; // e.g. [1, 8400, 5]
    } else {
      numChannels = d1;
      numAnchors = d2;
      isTransposed = false; // e.g. [1, 5, 8400]
    }
  }

  const hasObjectness = (numChannels === 6 || numChannels === 85);
  const detections: DetectedPlateBox[] = [];

  // NOTE: Ultralytics YOLOv8 ONNX export (simplify=True) bakes sigmoid activation
  // into the model graph. Output class confidence values are already in [0,1].
  // Do NOT apply sigmoid again — double-sigmoid pushes near-zero logits to ~0.5,
  // flooding the output with thousands of false positive detections.

  for (let i = 0; i < numAnchors; i++) {
    let cx, cy, w, h, objConf, classConf;

    if (isTransposed) {
      cx = rawData[i * numChannels + 0] * scaleX;
      cy = rawData[i * numChannels + 1] * scaleY;
      w = rawData[i * numChannels + 2] * scaleX;
      h = rawData[i * numChannels + 3] * scaleY;
      if (hasObjectness) {
        objConf = rawData[i * numChannels + 4];  // already sigmoid
        classConf = rawData[i * numChannels + 5]; // already sigmoid
      } else {
        objConf = 1.0;
        classConf = rawData[i * numChannels + 4]; // already sigmoid
      }
    } else {
      cx = rawData[0 * numAnchors + i] * scaleX;
      cy = rawData[1 * numAnchors + i] * scaleY;
      w = rawData[2 * numAnchors + i] * scaleX;
      h = rawData[3 * numAnchors + i] * scaleY;
      if (hasObjectness) {
        objConf = rawData[4 * numAnchors + i];  // already sigmoid
        classConf = rawData[5 * numAnchors + i]; // already sigmoid
      } else {
        objConf = 1.0;
        classConf = rawData[4 * numAnchors + i]; // already sigmoid
      }
    }

    const conf = objConf * classConf;

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

  // 2. Non-Maximum Suppression with a raised IoU threshold to aggressively
  //    merge nearby overlapping boxes from the same plate.
  return applyNMS(filtered, Math.max(iouThreshold, 0.50));
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
