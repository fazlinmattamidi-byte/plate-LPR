import { TrackOcrState } from '../db/types';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface TrackCropSample {
  dataUrl?: string;
  qualityScore: number;
  timestamp: number;
  ocrText?: string;
  ocrConfidence?: number;
}

/**
 * Full per-track state — each detected plate region gets its own independent state machine.
 * This enables true multi-vehicle scanning where every plate is tracked, read and matched independently.
 */
export interface ActiveTrack {
  trackId: string;
  trackNumber: number;                // human-readable display number (#12, #13 etc.)
  bbox: BoundingBox;
  cropSamples: TrackCropSample[];
  lastSeenFrame: number;
  firstSeenFrame: number;
  framesSeen: number;

  // OCR per-track state machine
  ocrState: TrackOcrState;
  ocrRunning: boolean;
  ocrJobQueued: boolean;

  // Per-track consensus voting — isolated, never shared with other tracks
  votes: Map<string, { count: number; totalConfidence: number }>;
  stabilizedPlate?: string;
  stabilizedConfidence?: number;

  // Per-track match result
  matchType?: 'EXACT' | 'POSSIBLE' | 'NONE';
  matchedVehicle?: any;   // VehicleCase but avoid circular import
  possibleMatchVehicles?: any[];

  // Per-track cooldown state
  cooldownActive: boolean;
  lastSearchedAt?: number;
  scanEventId?: string;
}

/**
 * Calculates Intersection over Union between two bounding boxes.
 * Used by the IoU tracker to associate detections across frames.
 */
export function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  if (interArea === 0) return 0;

  const boxAArea = boxA.width * boxA.height;
  const boxBArea = boxB.width * boxB.height;

  return interArea / (boxAArea + boxBArea - interArea);
}

/**
 * SORT-inspired lightweight IoU tracker for real-time plate tracking.
 *
 * Behaviour:
 * - Detections from each frame are matched to existing tracks via IoU.
 * - Tracks survive N frames without a detection before being removed (lostTrackTimeout).
 * - New tracks are created for unmatched detections.
 * - Each track maintains its own voting history, OCR state and match result.
 * - Tracks do NOT reset when briefly lost (e.g. vehicle moves fast or occlusion).
 *
 * This enables:
 * - Moving vehicles to accumulate OCR votes across frames even when detection is intermittent
 * - Camera shake to not create new track IDs on every frame
 * - Multiple simultaneous vehicles to be tracked independently
 */
export class PlateTracker {
  private activeTracks: Map<string, ActiveTrack> = new Map();
  private trackCounter: number = 1;
  private frameIndex: number = 0;
  private iouThreshold: number = 0.25;   // lower threshold for moving vehicle tolerance
  private lostTrackTimeout: number = 15;  // frames before removing a track not seen

  constructor(lostTrackTimeout?: number) {
    if (lostTrackTimeout !== undefined) {
      this.lostTrackTimeout = lostTrackTimeout;
    }
  }

  /**
   * Update tracker with detections from the current frame.
   * Returns all currently active tracks (including briefly lost ones still within timeout).
   */
  public updateTracks(detectedBoxes: BoundingBox[]): ActiveTrack[] {
    this.frameIndex++;

    const unmatchedDetIdx = new Set<number>(detectedBoxes.map((_, i) => i));

    // --- Step 1: Match existing tracks to new detections ---
    this.activeTracks.forEach((track) => {
      let bestIoU = this.iouThreshold;
      let bestIdx = -1;

      detectedBoxes.forEach((box, idx) => {
        if (!unmatchedDetIdx.has(idx)) return;
        const iou = calculateIoU(track.bbox, box);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1) {
        // Successfully matched: update bounding box position
        track.bbox = detectedBoxes[bestIdx];
        track.lastSeenFrame = this.frameIndex;
        track.framesSeen++;
        unmatchedDetIdx.delete(bestIdx);
      }
    });

    // --- Step 2: Create new tracks for unmatched detections ---
    unmatchedDetIdx.forEach((idx) => {
      const box = detectedBoxes[idx];
      // Minimum size filter — ignore very small regions (noise)
      if (box.width < 40 || box.height < 10) return;

      const num = this.trackCounter++;
      const newTrack: ActiveTrack = {
        trackId: `trk-${num}`,
        trackNumber: num,
        bbox: box,
        cropSamples: [],
        lastSeenFrame: this.frameIndex,
        firstSeenFrame: this.frameIndex,
        framesSeen: 1,
        ocrState: 'DETECTED',
        ocrRunning: false,
        ocrJobQueued: false,
        votes: new Map(),
        cooldownActive: false,
      };
      this.activeTracks.set(newTrack.trackId, newTrack);
    });

    // --- Step 3: Remove stale tracks that have exceeded the lost timeout ---
    this.activeTracks.forEach((track, id) => {
      const framesLost = this.frameIndex - track.lastSeenFrame;
      if (framesLost > this.lostTrackTimeout) {
        this.activeTracks.delete(id);
      }
    });

    return Array.from(this.activeTracks.values());
  }

  public getActiveTracks(): ActiveTrack[] {
    return Array.from(this.activeTracks.values());
  }

  public getTrack(trackId: string): ActiveTrack | undefined {
    return this.activeTracks.get(trackId);
  }

  public setLostTrackTimeout(frames: number): void {
    this.lostTrackTimeout = frames;
  }

  public clear(): void {
    this.activeTracks.clear();
    this.frameIndex = 0;
    this.trackCounter = 1;
  }
}
