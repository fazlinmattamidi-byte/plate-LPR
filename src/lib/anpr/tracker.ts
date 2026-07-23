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

export interface ActiveTrack {
  trackId: string;
  trackNumber: number;
  bbox: BoundingBox;
  predictedBbox?: BoundingBox;
  vx: number; // velocity x (pixels per frame)
  vy: number; // velocity y (pixels per frame)
  cropSamples: TrackCropSample[];
  lastSeenFrame: number;
  firstSeenFrame: number;
  framesSeen: number;

  ocrState: TrackOcrState;
  ocrRunning: boolean;
  ocrJobQueued: boolean;

  votes: Map<string, { count: number; totalConfidence: number }>;
  stabilizedPlate?: string;
  stabilizedConfidence?: number;

  matchType?: 'EXACT' | 'POSSIBLE' | 'NONE';
  matchedVehicle?: any;
  possibleMatchVehicles?: any[];

  cooldownActive: boolean;
  lastSearchedAt?: number;
  scanEventId?: string;

  isConfirmed?: boolean;
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

  const boxAArea = boxA.width * boxA.height;
  const boxBArea = boxB.width * boxB.height;

  return interArea / (boxAArea + boxBArea - interArea);
}

export function calculateCentroidDistance(boxA: BoundingBox, boxB: BoundingBox): number {
  const cxA = boxA.x + boxA.width / 2;
  const cyA = boxA.y + boxA.height / 2;
  const cxB = boxB.x + boxB.width / 2;
  const cyB = boxB.y + boxB.height / 2;
  return Math.sqrt(Math.pow(cxA - cxB, 2) + Math.pow(cyA - cyB, 2));
}

/**
 * ByteTrack-inspired Multi-Object Tracker for Real-Time License Plate Tracking.
 * 
 * Key Features:
 * - High-confidence & low-confidence two-stage association.
 * - Velocity prediction (dx, dy) for moving vehicles & moving cameras.
 * - Max active tracks pool (default 8).
 * - Independent track memory buffer & state machine.
 */
export class PlateTracker {
  private activeTracks: Map<string, ActiveTrack> = new Map();
  private trackCounter: number = 1;
  private frameIndex: number = 0;
  private iouThreshold: number = 0.30; // Changed default from 0.20 to 0.30 based on requirements
  private lostTrackTimeout: number = 8; // Changed default from 20 to 8
  private maxActiveTracks: number = 8;
  private minConfirmationFrames: number = 2; // Default required frames

  constructor(lostTrackTimeout?: number, maxActiveTracks?: number, minConfirmationFrames?: number) {
    if (lostTrackTimeout !== undefined) this.lostTrackTimeout = lostTrackTimeout;
    if (maxActiveTracks !== undefined) this.maxActiveTracks = maxActiveTracks;
    if (minConfirmationFrames !== undefined) this.minConfirmationFrames = minConfirmationFrames;
  }

  public updateTracks(detectedBoxes: BoundingBox[]): ActiveTrack[] {
    this.frameIndex++;

    // 1. Separate detections into High Confidence and Low Confidence
    const highConfDets: { box: BoundingBox; idx: number }[] = [];
    const lowConfDets: { box: BoundingBox; idx: number }[] = [];

    detectedBoxes.forEach((box, idx) => {
      if (box.confidence >= 0.40) {
        highConfDets.push({ box, idx });
      } else {
        lowConfDets.push({ box, idx });
      }
    });

    const unassignedHigh = new Set<number>(highConfDets.map(d => d.idx));
    const unassignedLow = new Set<number>(lowConfDets.map(d => d.idx));

    // 2. Predict next position for active tracks using velocity (Kalman/Constant Velocity model)
    this.activeTracks.forEach((track) => {
      const dt = this.frameIndex - track.lastSeenFrame;
      track.predictedBbox = {
        x: track.bbox.x + track.vx * dt,
        y: track.bbox.y + track.vy * dt,
        width: track.bbox.width,
        height: track.bbox.height,
        confidence: track.bbox.confidence,
      };
    });

    // 3. First Stage Association: Match Active Tracks with High Confidence Detections
    this.activeTracks.forEach((track) => {
      let bestMatchScore = 0;
      let bestIdx = -1;

      highConfDets.forEach(({ box, idx }) => {
        if (!unassignedHigh.has(idx)) return;
        const targetBox = track.predictedBbox || track.bbox;
        const iou = calculateIoU(targetBox, box);
        const dist = calculateCentroidDistance(targetBox, box);
        const maxDist = Math.max(targetBox.width, targetBox.height) * 3.0; // Allow jump up to 3.0x size for slow detectors

        let score = 0;
        if (iou > this.iouThreshold) {
          score = 1.0 + iou; // prioritize IoU
        } else if (dist < maxDist) {
          score = 1.0 - (dist / maxDist); // fallback to distance
        }

        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1) {
        const matchedBox = detectedBoxes[bestIdx];
        // Calculate velocity update
        const dx = matchedBox.x - track.bbox.x;
        const dy = matchedBox.y - track.bbox.y;
        track.vx = track.vx * 0.7 + dx * 0.3; // Smooth velocity
        track.vy = track.vy * 0.7 + dy * 0.3;

        track.bbox = matchedBox;
        track.lastSeenFrame = this.frameIndex;
        track.framesSeen++;
        if (track.framesSeen >= this.minConfirmationFrames || track.bbox.confidence >= 0.70) track.isConfirmed = true;
        unassignedHigh.delete(bestIdx);
      }
    });

    // 4. Second Stage Association: Match Unassigned Tracks with Low Confidence Detections
    this.activeTracks.forEach((track) => {
      if (track.lastSeenFrame === this.frameIndex) return; // Already updated in Stage 1

      let bestMatchScore = 0;
      let bestIdx = -1;

      lowConfDets.forEach(({ box, idx }) => {
        if (!unassignedLow.has(idx)) return;
        const targetBox = track.predictedBbox || track.bbox;
        const iou = calculateIoU(targetBox, box);
        const dist = calculateCentroidDistance(targetBox, box);
        const maxDist = Math.max(targetBox.width, targetBox.height) * 3.0;

        let score = 0;
        if (iou > this.iouThreshold * 0.8) {
          score = 1.0 + iou;
        } else if (dist < maxDist) {
          score = 1.0 - (dist / maxDist);
        }

        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1) {
        const matchedBox = detectedBoxes[bestIdx];
        track.bbox = matchedBox;
        track.lastSeenFrame = this.frameIndex;
        track.framesSeen++;
        if (track.framesSeen >= this.minConfirmationFrames || track.bbox.confidence >= 0.70) track.isConfirmed = true;
        unassignedLow.delete(bestIdx);
      }
    });

    // 5. Create New Tracks for Unassigned High Confidence Detections
    unassignedHigh.forEach((idx) => {
      // Enforce max active tracks limit
      if (this.activeTracks.size >= this.maxActiveTracks) return;

      const box = detectedBoxes[idx];
      if (box.width < 35 || box.height < 10) return;

      const num = this.trackCounter++;
      const newTrack: ActiveTrack = {
        trackId: `trk-${num}`,
        trackNumber: num,
        bbox: box,
        vx: 0,
        vy: 0,
        cropSamples: [],
        lastSeenFrame: this.frameIndex,
        firstSeenFrame: this.frameIndex,
        framesSeen: 1,
        ocrState: 'DETECTED',
        ocrRunning: false,
        ocrJobQueued: false,
        votes: new Map(),
        cooldownActive: false,
        isConfirmed: box.confidence >= 0.70, // Instantly confirm high confidence plates
      };
      this.activeTracks.set(newTrack.trackId, newTrack);
    });

    // 6. Remove Stale Tracks
    this.activeTracks.forEach((track, id) => {
      const framesLost = this.frameIndex - track.lastSeenFrame;
      const timeout = track.isConfirmed ? this.lostTrackTimeout : 2; // Unconfirmed expire quickly
      if (framesLost > timeout) {
        this.activeTracks.delete(id);
      }
    });

    return Array.from(this.activeTracks.values());
  }

  public getActiveTracks(confirmedOnly: boolean = false): ActiveTrack[] {
    const all = Array.from(this.activeTracks.values());
    if (confirmedOnly) return all.filter(t => t.isConfirmed);
    return all;
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
