import { describe, it, expect } from 'vitest';
import { normalizePlate, formatDisplayPlate, generateCandidatePlates } from '../lib/anpr/normaliser';
import { validateMalaysianPattern } from '../lib/anpr/patterns';

interface LabeledOcrTestCase {
  id: string;
  category: 'REPEATED_CHARS' | 'SUFFIX_LETTER' | 'TWO_LINE' | 'WHITE_BG' | 'BLURRED' | 'NO_TEXT';
  rawTextInput: string;
  expectedPlate: string;
  expectedCategory: string;
  shouldPass: boolean;
}

describe('PP-OCR Labeled Recognition & Pattern Test Suite', () => {

  const testCases: LabeledOcrTestCase[] = [
    // Repeated Character Cases
    {
      id: 'rep-1',
      category: 'REPEATED_CHARS',
      rawTextInput: 'JSD8888',
      expectedPlate: 'JSD8888',
      expectedCategory: 'STANDARD',
      shouldPass: true,
    },
    {
      id: 'rep-2',
      category: 'REPEATED_CHARS',
      rawTextInput: 'AAA1111',
      expectedPlate: 'AAA1111',
      expectedCategory: 'STANDARD',
      shouldPass: true,
    },
    {
      id: 'rep-3',
      category: 'REPEATED_CHARS',
      rawTextInput: 'WXY7788',
      expectedPlate: 'WXY7788',
      expectedCategory: 'STANDARD',
      shouldPass: true,
    },

    // Suffix Letter Plates
    {
      id: 'suf-1',
      category: 'SUFFIX_LETTER',
      rawTextInput: 'KV1234E',
      expectedPlate: 'KV1234E',
      expectedCategory: 'LANGKAWI',
      shouldPass: true,
    },
    {
      id: 'suf-2',
      category: 'SUFFIX_LETTER',
      rawTextInput: 'W1234A',
      expectedPlate: 'W1234A',
      expectedCategory: 'STANDARD',
      shouldPass: true,
    },

    // Two-Line Plates (Combined Raw Inputs)
    {
      id: 'twoline-1',
      category: 'TWO_LINE',
      rawTextInput: 'WAA\n8888',
      expectedPlate: 'WAA8888',
      expectedCategory: 'STANDARD',
      shouldPass: true,
    },

    // White Background JPJePlate / Diplomatic / EV Plates
    {
      id: 'whitebg-1',
      category: 'WHITE_BG',
      rawTextInput: '12-34-DC',
      expectedPlate: '1234DC',
      expectedCategory: 'DIPLOMATIC',
      shouldPass: true,
    },

    // Blurred / Low Confidence Input
    {
      id: 'blur-1',
      category: 'BLURRED',
      rawTextInput: 'V B 1 2 3',
      expectedPlate: 'VB123',
      expectedCategory: 'STANDARD',
      shouldPass: true,
    },

    // No Text Crop
    {
      id: 'notext-1',
      category: 'NO_TEXT',
      rawTextInput: '',
      expectedPlate: '',
      expectedCategory: 'UNKNOWN',
      shouldPass: false,
    },
  ];

  testCases.forEach((tc) => {
    it(`[${tc.category}] ${tc.id}: ${tc.rawTextInput || 'BLANK'} -> ${tc.expectedPlate}`, () => {
      const norm = normalizePlate(tc.rawTextInput);
      expect(norm).toBe(tc.expectedPlate);

      if (tc.shouldPass) {
        const pattern = validateMalaysianPattern(norm);
        expect(pattern.score).toBeGreaterThan(0.0);
        
        const display = formatDisplayPlate(norm, pattern.category);
        expect(display).toBeTruthy();

        // Verify alternative candidates generation works without infinite loops
        const mockCharConfs = norm.split('').map((char, i) => ({ char, confidence: 0.9, position: i }));
        const alts = generateCandidatePlates(norm, mockCharConfs);
        expect(Array.isArray(alts)).toBe(true);
      }
    });
  });
});
