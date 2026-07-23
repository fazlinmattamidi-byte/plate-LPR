/**
 * PlateQ — PP-OCR ONNX Recognition Engine
 * Model: PP-OCRv4 / PP-OCRv5 Recognition (public/models/ppocr-rec.onnx)
 * 
 * Performance & Features:
 * - Runs locally via ONNX Runtime Web using WebGPU (fallback to WASM / CPU)
 * - Zero cloud API calls — 100% offline production execution
 * - Greedy CTC Decoder with per-character confidence scores
 * - Supports Single-Line, Two-Line, Square, Motorcycle & Special Malaysian Plates
 */

import { CharacterConfidence, PlateCategory, PlateLayout } from '../db/types';
import { normalizePlate, formatDisplayPlate, generateCandidatePlates } from './normaliser';
import { validateMalaysianPattern } from './patterns';

export interface PpOcrRecognitionResult {
  text: string;
  normalizedPlate: string;
  displayPlate: string;
  confidence: number;
  characterConfidences: CharacterConfidence[];
  alternativeCandidates: string[];
  layout: PlateLayout;
  category: PlateCategory;
  patternScore: number;
  hasTrailingSuffix: boolean;
  engineUsed: 'PP_OCR' | 'TESSERACT';
}

let ppOcrSession: any = null;
let dictLines: string[] = [];
let isSessionLoading = false;
let sessionLoadFailures = 0;       // Track failures — allow retry after transient errors
const MAX_SESSION_FAILURES = 3;    // Give up permanently after 3 consecutive failures

/**
 * Initialize PP-OCR ONNX Session with WebGPU -> WASM fallback
 */
export async function initPpOcrSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (ppOcrSession) return true;
  // Allow retries on transient failures; give up only after MAX_SESSION_FAILURES
  if (sessionLoadFailures >= MAX_SESSION_FAILURES) return false;
  // Prevent concurrent load races
  if (isSessionLoading) return false;

  isSessionLoading = true;

  try {
    // 1. Fetch character dictionary
    const dictRes = await fetch('/models/ppocr-dict.txt');
    if (!dictRes.ok) {
      console.warn('[PP-OCR] Dictionary /models/ppocr-dict.txt not found.');
      sessionLoadFailures++;
      isSessionLoading = false;
      return false;
    }
    const dictText = await dictRes.text();
    dictLines = dictText.split(/\r?\n/).map(l => l.trim());
    // Append space character at index dictLines.length (index 6624 for ppocr_keys_v1)
    dictLines.push(' ');

    // 2. Load ONNX Runtime Web
    const loadOrt = new Function('return import("onnxruntime-web")');
    const ort = await loadOrt();
    // Use locally-served WASM files — avoids CDN dependency on mobile.
    ort.env.wasm.wasmPaths = '/ort-wasm/';
    ort.env.wasm.numThreads = 1; // Single-threaded WASM for iOS/mobile compatibility

    // Try WebGPU first, then WebGL, then WASM
    try {
      ppOcrSession = await ort.InferenceSession.create('/models/ppocr-rec.onnx', {
        executionProviders: ['webgpu', 'webgl', 'wasm'],
        graphOptimizationLevel: 'all',
      });
      console.log('[PP-OCR] ONNX Session initialized successfully with WebGPU/WebGL!');
    } catch (e) {
      console.warn('[PP-OCR] WebGPU/WebGL init failed, falling back to WASM:', e);
      ppOcrSession = await ort.InferenceSession.create('/models/ppocr-rec.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      console.log('[PP-OCR] ONNX Session initialized successfully with WASM!');
    }

    sessionLoadFailures = 0; // Reset on success
    isSessionLoading = false;
    return true;
  } catch (err) {
    sessionLoadFailures++;
    console.warn(
      `[PP-OCR] Failed to initialize ONNX session (attempt ${sessionLoadFailures}/${MAX_SESSION_FAILURES}):`,
      err
    );
    isSessionLoading = false;
    return false;
  }
}

/**
 * Check if PP-OCR ONNX engine is initialized and ready
 */
export function isPpOcrReady(): boolean {
  return ppOcrSession !== null && dictLines.length > 0;
}

/**
 * Run PP-OCR ONNX inference on a crop canvas
 */
export async function recognizeWithPpOcr(
  cropCanvas: HTMLCanvasElement,
  isTwoLineHint?: boolean
): Promise<PpOcrRecognitionResult | null> {
  if (!ppOcrSession || dictLines.length === 0) {
    const ready = await initPpOcrSession();
    if (!ready || !ppOcrSession) return null;
  }

  const ar = cropCanvas.width / (cropCanvas.height || 1);
  const isTwoLine = isTwoLineHint || ar < 2.3;

  if (isTwoLine) {
    const halfH = Math.round(cropCanvas.height * 0.54);

    const topCanvas = document.createElement('canvas');
    topCanvas.width = cropCanvas.width;
    topCanvas.height = halfH;
    const topCtx = topCanvas.getContext('2d');
    if (topCtx) topCtx.drawImage(cropCanvas, 0, 0, cropCanvas.width, halfH, 0, 0, topCanvas.width, halfH);

    const botCanvas = document.createElement('canvas');
    botCanvas.width = cropCanvas.width;
    botCanvas.height = cropCanvas.height - halfH;
    const botCtx = botCanvas.getContext('2d');
    if (botCtx) botCtx.drawImage(cropCanvas, 0, halfH, cropCanvas.width, cropCanvas.height - halfH, 0, 0, botCanvas.width, botCanvas.height);

    const [topRes, botRes] = await Promise.all([
      runSingleCropPpOcr(topCanvas),
      runSingleCropPpOcr(botCanvas),
    ]);

    const topText = normalizePlate(topRes.rawText);
    const botText = normalizePlate(botRes.rawText);
    const mergedRaw = normalizePlate(`${topText}${botText}`);

    if (mergedRaw && mergedRaw.length >= 2) {
      const avgConf = Math.min(1.0, (topRes.confidence + botRes.confidence) / 2);
      const patternVal = validateMalaysianPattern(mergedRaw);
      const charConfs: CharacterConfidence[] = mergedRaw.split('').map((char, i) => ({
        char,
        confidence: i < topText.length ? topRes.confidence : botRes.confidence,
        position: i,
      }));

      const alternatives = generateCandidatePlates(mergedRaw, charConfs);

      return {
        text: mergedRaw,
        normalizedPlate: mergedRaw,
        displayPlate: formatDisplayPlate(mergedRaw, patternVal.category),
        confidence: avgConf,
        characterConfidences: charConfs,
        alternativeCandidates: alternatives,
        layout: ar < 1.6 ? 'SQUARE' : 'TWO_LINE',
        category: patternVal.category,
        patternScore: patternVal.score,
        hasTrailingSuffix: patternVal.hasTrailingSuffix,
        engineUsed: 'PP_OCR',
      };
    }
  }

  // Single line plate recognition
  const res = await runSingleCropPpOcr(cropCanvas);
  const normText = normalizePlate(res.rawText);
  if (!normText) return null;

  const patternVal = validateMalaysianPattern(normText);
  const charConfs: CharacterConfidence[] = res.characterConfidences.map((c, i) => ({
    char: c.char,
    confidence: c.confidence,
    position: i,
  }));

  const alternatives = generateCandidatePlates(normText, charConfs);

  return {
    text: normText,
    normalizedPlate: normText,
    displayPlate: formatDisplayPlate(normText, patternVal.category),
    confidence: res.confidence,
    characterConfidences: charConfs,
    alternativeCandidates: alternatives,
    layout: 'SINGLE_LINE',
    category: patternVal.category,
    patternScore: patternVal.score,
    hasTrailingSuffix: patternVal.hasTrailingSuffix,
    engineUsed: 'PP_OCR',
  };
}

/**
 * Execute PP-OCR on a single cropped canvas region
 */
async function runSingleCropPpOcr(
  canvas: HTMLCanvasElement
): Promise<{ rawText: string; confidence: number; characterConfidences: { char: string; confidence: number }[] }> {
  if (!ppOcrSession) {
    return { rawText: '', confidence: 0, characterConfidences: [] };
  }

  const loadOrt = new Function('return import("onnxruntime-web")');
  const ort = await loadOrt();

  // PP-OCR input size: height = 48, width = 320 (or padded)
  const targetH = 48;
  const targetW = 320;

  const prepCanvas = document.createElement('canvas');
  prepCanvas.width = targetW;
  prepCanvas.height = targetH;
  const ctx = prepCanvas.getContext('2d');
  if (!ctx) return { rawText: '', confidence: 0, characterConfidences: [] };

  // Fill background neutral gray
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, targetW, targetH);

  // Maintain aspect ratio scaling
  const scale = Math.min(targetW / canvas.width, targetH / canvas.height);
  const drawW = Math.round(canvas.width * scale);
  const drawH = Math.round(canvas.height * scale);
  const offsetX = 0;
  const offsetY = Math.round((targetH - drawH) / 2);

  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, offsetX, offsetY, drawW, drawH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const { data } = imgData;

  // Transform HWC RGBA to CHW Float32Array normalized: (val / 255.0 - 0.5) / 0.5
  const float32Data = new Float32Array(3 * targetH * targetW);
  const channelArea = targetH * targetW;

  for (let i = 0; i < channelArea; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    // Standard PaddleOCR normalization
    float32Data[i] = (r / 255.0 - 0.5) / 0.5;
    float32Data[channelArea + i] = (g / 255.0 - 0.5) / 0.5;
    float32Data[2 * channelArea + i] = (b / 255.0 - 0.5) / 0.5;
  }

  const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, targetH, targetW]);
  const inputName = ppOcrSession.inputNames[0] || 'x';

  const results = await ppOcrSession.run({ [inputName]: inputTensor });
  
  if (inputTensor.dispose) inputTensor.dispose(); // Memory Protection
  
  const outputName = ppOcrSession.outputNames[0];
  const outputTensor = results[outputName];

  if (!outputTensor) {
    return { rawText: '', confidence: 0, characterConfidences: [] };
  }

  const rawOutput = outputTensor.data as Float32Array; // shape: [1, seqLen, numClasses]
  const dims = outputTensor.dims; // e.g. [1, 40, 6625]
  const seqLen = dims[1] || 40;
  const numClasses = dims[2] || dictLines.length + 1;

  // CTC Greedy Decoding
  // PP-OCR ONNX models output softmax_11 probabilities directly.
  const charList: string[] = [];
  const charConfs: { char: string; confidence: number }[] = [];
  let prevIdx = 0;

  for (let t = 0; t < seqLen; t++) {
    const offset = t * numClasses;
    let maxIdx = 0;
    let maxProb = -1;

    for (let c = 0; c < numClasses; c++) {
      const prob = rawOutput[offset + c];
      if (prob > maxProb) {
        maxProb = prob;
        maxIdx = c;
      }
    }

    if (maxIdx !== 0 && maxIdx !== prevIdx) {
      if (maxIdx - 1 < dictLines.length) {
        const char = dictLines[maxIdx - 1];
        if (char && char !== ' ') {
          charList.push(char);
          charConfs.push({ char, confidence: Math.min(1.0, Math.max(0.0, maxProb)) });
        }
      }
    }
    prevIdx = maxIdx;
  }

  const rawText = charList.join('');
  const avgConf = charConfs.length > 0
    ? charConfs.reduce((sum, c) => sum + c.confidence, 0) / charConfs.length
    : 0;

  if (outputTensor.dispose) outputTensor.dispose(); // Memory Protection

  return {
    rawText,
    confidence: avgConf,
    characterConfidences: charConfs,
  };
}
