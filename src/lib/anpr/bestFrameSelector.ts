/**
 * PlateQ — Best Frame Selection Engine
 * 
 * Manages an sliding memory buffer of plate crops per track.
 * Automatically selects the crispest, highest-quality frame crop for OCR recognition.
 */

import { assessCropQuality, CropQualityReport } from './qualityAssessor';

export interface FrameCropEntry {
  id: string;
  canvas: HTMLCanvasElement;
  quality: CropQualityReport;
  timestamp: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export class BestFrameSelector {
  private trackBuffers: Map<number, FrameCropEntry[]> = new Map();
  private maxBufferSize: number = 6;

  /**
   * Add a new frame crop candidate for a specific track ID.
   */
  public addCropCandidate(
    trackId: number,
    canvas: HTMLCanvasElement,
    bbox: { x: number; y: number; width: number; height: number }
  ): CropQualityReport {
    const quality = assessCropQuality(canvas);
    const entry: FrameCropEntry = {
      id: `${trackId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      canvas,
      quality,
      timestamp: Date.now(),
      bbox,
    };

    if (!this.trackBuffers.has(trackId)) {
      this.trackBuffers.set(trackId, []);
    }

    const buffer = this.trackBuffers.get(trackId)!;
    buffer.push(entry);

    // Keep buffer size within max limit, prioritizing higher quality scores
    if (buffer.length > this.maxBufferSize) {
      buffer.sort((a, b) => b.quality.overallScore - a.quality.overallScore);
      buffer.pop(); // Remove the lowest quality crop
    }

    return quality;
  }

  /**
   * Get the absolute best frame crop for OCR processing for a given track ID.
   */
  public getBestCrop(trackId: number): FrameCropEntry | null {
    const buffer = this.trackBuffers.get(trackId);
    if (!buffer || buffer.length === 0) return null;

    // Return the entry with highest overall quality score
    let best = buffer[0];
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].quality.overallScore > best.quality.overallScore) {
        best = buffer[i];
      }
    }
    return best;
  }

  /**
   * Clear frame candidates for a specific track ID.
   */
  public clearTrack(trackId: number): void {
    this.trackBuffers.delete(trackId);
  }

  /**
   * Reset all track frame buffers.
   */
  public resetAll(): void {
    this.trackBuffers.clear();
  }
}

export const globalBestFrameSelector = new BestFrameSelector();
