import { createWorker, Worker } from 'tesseract.js';
import { normalizePlate, formatDisplayPlate } from './normaliser';
import { generateAdaptiveCrops } from './imageProcessor';
import { validateMalaysianPattern } from './patterns';
import { CharacterConfidence, PlateCategory, PlateLayout } from '../db/types';

let workerPromise: Promise<Worker> | null = null;

export async function getOCRWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const worker = await createWorker('eng', 1, {
      logger: () => {}, // silent
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      tessedit_pageseg_mode: '7' as any, // Single line mode
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
  layout: PlateLayout;
  category: PlateCategory;
  patternScore: number;
  hasTrailingSuffix: boolean;
}

/**
 * Recognizes characters from a cropped canvas region using Tesseract.js.
 * Handles 1-line, 2-line, and adaptive contrast/inverted variants.
 */
export async function recognizePlateFromCanvas(
  cropCanvas: HTMLCanvasElement,
  isTwoLineHint?: boolean
): Promise<OcrRecognitionResult> {
  try {
    const worker = await getOCRWorker();

    // ── Check if 2-line layout hint is present or aspect ratio < 2.3 ──
    const ar = cropCanvas.width / (cropCanvas.height || 1);
    const isTwoLine = isTwoLineHint || ar < 2.3;

    if (isTwoLine) {
      // 2-line plate processing: read top half (letters), then bottom half (numbers)
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

      const mergedText = `${topText}${botText}`;
      const normMerged = normalizePlate(mergedText);

      if (normMerged && normMerged.length >= 3) {
        const topConf = (topRes.data.confidence || 0) / 100;
        const botConf = (botRes.data.confidence || 0) / 100;
        const avgConf = Math.min(1.0, (topConf + botConf) / 2);

        const patternVal = validateMalaysianPattern(normMerged);

        // Build character confidences
        const charConfs: CharacterConfidence[] = normMerged.split('').map((char, i) => ({
          char,
          confidence: i < topText.length ? topConf : botConf,
          position: i,
        }));

        return {
          text: normMerged,
          normalizedPlate: normMerged,
          displayPlate: formatDisplayPlate(normMerged, patternVal.category),
          confidence: avgConf,
          characterConfidences: charConfs,
          layout: ar < 1.6 ? 'SQUARE' : 'TWO_LINE',
          category: patternVal.category,
          patternScore: patternVal.score,
          hasTrailingSuffix: patternVal.hasTrailingSuffix,
        };
      }
    }

    // ── Single-line standard OCR ──
    const result = await worker.recognize(cropCanvas);
    const rawText = result.data.text || '';
    const normText = normalizePlate(rawText);
    const fullConf = Math.min(1.0, (result.data.confidence || 0) / 100);

    const patternVal = validateMalaysianPattern(normText);

    // Build per-character confidence array from Tesseract symbols if available
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
      // Uniform confidence fallback
      normText.split('').forEach((char, pos) => {
        charConfs.push({
          char,
          confidence: fullConf,
          position: pos,
        });
      });
    }

    return {
      text: normText,
      normalizedPlate: normText,
      displayPlate: formatDisplayPlate(normText, patternVal.category),
      confidence: fullConf,
      characterConfidences: charConfs,
      layout: 'SINGLE_LINE',
      category: patternVal.category,
      patternScore: patternVal.score,
      hasTrailingSuffix: patternVal.hasTrailingSuffix,
    };
  } catch (err) {
    console.warn('OCR processing error:', err);
    return {
      text: '',
      normalizedPlate: '',
      displayPlate: '',
      confidence: 0,
      characterConfidences: [],
      layout: 'SINGLE_LINE',
      category: 'UNKNOWN_VALID_CANDIDATE',
      patternScore: 0,
      hasTrailingSuffix: false,
    };
  }
}
