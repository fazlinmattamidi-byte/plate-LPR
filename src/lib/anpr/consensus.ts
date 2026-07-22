import { ActiveTrack } from './tracker';
import { normalizePlate, formatDisplayPlate } from './normaliser';
import { validateMalaysianPattern } from './patterns';
import { CharacterConfidence, PlateCategory } from '../db/types';

export interface ConsensusResult {
  isStabilized: boolean;
  plateNumber: string;
  displayPlate: string;
  normalizedPlate: string;
  confidence: number;
  voteCount: number;
  totalVotes: number;
  category: PlateCategory;
  characterConfidences?: CharacterConfidence[];
}

/**
 * Evaluates multi-frame voting consensus for a single track.
 * Each track maintains its own isolated vote map — votes are never shared between tracks.
 */
export function evaluateConsensus(
  track: ActiveTrack,
  minRequiredVotes: number = 3,
  minConfidenceThreshold: number = 0.65
): ConsensusResult {
  if (!track.votes || track.votes.size === 0) {
    return {
      isStabilized: false,
      plateNumber: '',
      displayPlate: '',
      normalizedPlate: '',
      confidence: 0,
      voteCount: 0,
      totalVotes: 0,
      category: 'UNKNOWN_VALID_CANDIDATE',
    };
  }

  let totalVotes = 0;
  let topPlate = '';
  let topCount = 0;
  let topTotalConf = 0;

  track.votes.forEach((data, plateStr) => {
    totalVotes += data.count;
    if (data.count > topCount || (data.count === topCount && data.totalConfidence > topTotalConf)) {
      topPlate = plateStr;
      topCount = data.count;
      topTotalConf = data.totalConfidence;
    }
  });

  const avgConfidence = topCount > 0 ? topTotalConf / topCount : 0;
  const normalized = normalizePlate(topPlate);
  const patternVal = validateMalaysianPattern(normalized);

  const isStabilized =
    topCount >= minRequiredVotes &&
    avgConfidence >= minConfidenceThreshold &&
    normalized.length >= 2;

  return {
    isStabilized,
    plateNumber: topPlate,
    displayPlate: formatDisplayPlate(normalized, patternVal.category),
    normalizedPlate: normalized,
    confidence: Math.min(1.0, Math.round(avgConfidence * 100) / 100),
    voteCount: topCount,
    totalVotes,
    category: patternVal.category,
  };
}

/**
 * Adds an OCR result as a vote to a specific track's isolated vote map.
 */
export function addOcrVoteToTrack(
  track: ActiveTrack,
  ocrText: string,
  confidence: number
): void {
  const norm = normalizePlate(ocrText);
  if (!norm || norm.length < 2) return;

  const current = track.votes.get(norm) || { count: 0, totalConfidence: 0 };
  current.count += 1;
  current.totalConfidence += confidence;
  track.votes.set(norm, current);
}

/**
 * Returns display string for track's current reading.
 */
export function getTrackReadingDisplay(track: ActiveTrack): string {
  if (track.stabilizedPlate) return formatDisplayPlate(track.stabilizedPlate);
  if (!track.votes || track.votes.size === 0) return '';

  let topPlate = '';
  let topCount = 0;
  track.votes.forEach((data, plateStr) => {
    if (data.count > topCount) { topPlate = plateStr; topCount = data.count; }
  });

  return topPlate ? formatDisplayPlate(topPlate) : '';
}
