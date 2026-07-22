import { createWorker, Worker } from 'tesseract.js';
import { normalizePlate, formatDisplayPlate, generateCandidatePlates } from './normaliser';
import { validateMalaysianPattern } from './patterns';
import { CharacterConfidence, PlateCategory, PlateLayout } from '../db/types';

let workerPromise: Promise<Worker> | null = null;

export async function getOCRWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const worker = await createWorker('eng', 1, {
      logger: () => {},
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      tessedit_pageseg_mode: '7' as any,
    });
    return worker;
  })();

  return workerPromise;
}

export interface OcrRecognitionResult {
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
  engineUsed: 'ONNX_MODEL' | 'TESSERACT';
}

/**
 * Primary OCR Router:
 * 1. Checks if an ONNX OCR Model (PP-OCR or CRNN) is available
 * 2. Fallback to Tesseract.js
 */
export async function recognizePlateFromCanvas(
  cropCanvas: HTMLCanvasElement,
  isTwoLineHint?: boolean
): Promise<OcrRecognitionResult> {
  try {
    // 1. Check for custom ONNX OCR model if available
    const onnxResult = await tryOnnxOcrModel(cropCanvas);
    if (onnxResult) {
      return onnxResult;
    }

    // 2. Tesseract.js Production Baseline
    return await recognizeWithTesseract(cropCanvas, isTwoLineHint);
  } catch (err) {
    console.warn('[ANPR OcrEngine] Error in recognition router:', err);
    return createEmptyResult();
  }
}

/**
 * Tesseract.js OCR engine execution with character-level details & 2-line layout handling.
 */
async function recognizeWithTesseract(
  cropCanvas: HTMLCanvasElement,
  isTwoLineHint?: boolean
): Promise<OcrRecognitionResult> {
  const worker = await getOCRWorker();
  const ar = cropCanvas.width / (cropCanvas.height || 1);
  const isTwoLine = isTwoLineHint || ar < 2.3;

  if (isTwoLine) {
    const halfH = Math.round(cropCanvas.height * 0.52);

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
      worker.recognize(topCanvas),
      worker.recognize(botCanvas),
    ]);

    const topText = normalizePlate(topRes.data.text || '');
    const botText = normalizePlate(botRes.data.text || '');
    const normMerged = normalizePlate(`${topText}${botText}`);

    if (normMerged && normMerged.length >= 3) {
      const topConf = (topRes.data.confidence || 0) / 100;
      const botConf = (botRes.data.confidence || 0) / 100;
      const avgConf = Math.min(1.0, (topConf + botConf) / 2);

      const patternVal = validateMalaysianPattern(normMerged);
      const charConfs: CharacterConfidence[] = normMerged.split('').map((char, i) => ({
        char,
        confidence: i < topText.length ? topConf : botConf,
        position: i,
      }));

      const alternatives = generateCandidatePlates(normMerged);

      return {
        text: normMerged,
        normalizedPlate: normMerged,
        displayPlate: formatDisplayPlate(normMerged, patternVal.category),
        confidence: avgConf,
        characterConfidences: charConfs,
        alternativeCandidates: alternatives,
        layout: ar < 1.6 ? 'SQUARE' : 'TWO_LINE',
        category: patternVal.category,
        patternScore: patternVal.score,
        hasTrailingSuffix: patternVal.hasTrailingSuffix,
        engineUsed: 'TESSERACT',
      };
    }
  }

  // Single-line OCR
  const result = await worker.recognize(cropCanvas);
  const normText = normalizePlate(result.data.text || '');
  const fullConf = Math.min(1.0, (result.data.confidence || 0) / 100);

  const patternVal = validateMalaysianPattern(normText);
  const charConfs: CharacterConfidence[] = [];

  if (result.data.symbols && result.data.symbols.length > 0) {
    let pos = 0;
    for (const sym of result.data.symbols) {
      const cleanSym = normalizePlate(sym.text);
      if (cleanSym) {
        charConfs.push({
          char: cleanSym,
          confidence: Math.min(1.0, (sym.confidence || 0) / 100),
          position: pos++,
        });
      }
    }
  } else {
    normText.split('').forEach((char, pos) => {
      charConfs.push({
        char,
        confidence: fullConf,
        position: pos,
      });
    });
  }

  const alternatives = generateCandidatePlates(normText);

  return {
    text: normText,
    normalizedPlate: normText,
    displayPlate: formatDisplayPlate(normText, patternVal.category),
    confidence: fullConf,
    characterConfidences: charConfs,
    alternativeCandidates: alternatives,
    layout: 'SINGLE_LINE',
    category: patternVal.category,
    patternScore: patternVal.score,
    hasTrailingSuffix: patternVal.hasTrailingSuffix,
    engineUsed: 'TESSERACT',
  };
}

/**
 * Placeholder hook to support custom PP-OCR or CRNN ONNX models placed in /models/
 */
async function tryOnnxOcrModel(_cropCanvas: HTMLCanvasElement): Promise<OcrRecognitionResult | null> {
  // If an ONNX OCR model is added in /models/crnn-malaysia.onnx, execute here
  return null;
}

function createEmptyResult(): OcrRecognitionResult {
  return {
    text: '',
    normalizedPlate: '',
    displayPlate: '',
    confidence: 0,
    characterConfidences: [],
    alternativeCandidates: [],
    layout: 'SINGLE_LINE',
    category: 'UNKNOWN_VALID_CANDIDATE',
    patternScore: 0,
    hasTrailingSuffix: false,
    engineUsed: 'TESSERACT',
  };
}
