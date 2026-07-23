import { describe, it, expect, beforeEach } from 'vitest';
import { PlateTracker, BoundingBox } from '../lib/anpr/tracker';
import { validateMalaysianPattern } from '../lib/anpr/patterns';

describe('FAT Tests: Tracker Scenarios and Plate Types', () => {
  let tracker: PlateTracker;

  beforeEach(() => {
    tracker = new PlateTracker(20, 8); // lostTrackTimeout = 20, max tracks = 8
  });

  it('FAT Scenario 1: Static one vehicle', () => {
    // Frame 1
    const t1 = tracker.updateTracks([{ x: 100, y: 100, width: 80, height: 30, confidence: 0.9 }]);
    expect(t1.length).toBe(1);
    const trackId = t1[0].trackId;

    // Frame 2-10 (Static)
    for (let i = 0; i < 9; i++) {
      const tracks = tracker.updateTracks([{ x: 100, y: 100, width: 80, height: 30, confidence: 0.9 }]);
      expect(tracks.length).toBe(1);
      expect(tracks[0].trackId).toBe(trackId);
    }
  });

  it('FAT Scenario 2: Moving one vehicle', () => {
    // Frame 1
    const t1 = tracker.updateTracks([{ x: 10, y: 10, width: 80, height: 30, confidence: 0.9 }]);
    expect(t1.length).toBe(1);
    const trackId = t1[0].trackId;

    // Moving diagonally across frames
    for (let i = 1; i < 10; i++) {
      const tracks = tracker.updateTracks([{ x: 10 + i * 5, y: 10 + i * 5, width: 80, height: 30, confidence: 0.9 }]);
      expect(tracks.length).toBe(1);
      expect(tracks[0].trackId).toBe(trackId);
      expect(tracks[0].framesSeen).toBe(i + 1);
    }
  });

  it('FAT Scenario 3: Static multiple vehicles', () => {
    // 3 static vehicles
    const boxes = [
      { x: 50, y: 50, width: 80, height: 30, confidence: 0.9 },
      { x: 200, y: 50, width: 80, height: 30, confidence: 0.9 },
      { x: 350, y: 50, width: 80, height: 30, confidence: 0.9 }
    ];

    const t1 = tracker.updateTracks(boxes);
    expect(t1.length).toBe(3);
    const trackIds = t1.map(t => t.trackId);

    // Frame 2-5 (Static)
    for (let i = 0; i < 4; i++) {
      const tracks = tracker.updateTracks(boxes);
      expect(tracks.length).toBe(3);
      expect(tracks.map(t => t.trackId).sort()).toEqual(trackIds.sort());
    }
  });

  it('FAT Scenario 4: Moving multiple vehicles', () => {
    let boxes = [
      { x: 10, y: 50, width: 80, height: 30, confidence: 0.9 },
      { x: 10, y: 150, width: 80, height: 30, confidence: 0.9 }
    ];

    const t1 = tracker.updateTracks(boxes);
    expect(t1.length).toBe(2);
    const trackIds = t1.map(t => t.trackId);

    // Vehicles moving at different speeds
    for (let i = 1; i < 10; i++) {
      boxes = [
        { x: 10 + i * 10, y: 50, width: 80, height: 30, confidence: 0.9 }, // Moves faster
        { x: 10 + i * 5, y: 150, width: 80, height: 30, confidence: 0.9 }  // Moves slower
      ];
      const tracks = tracker.updateTracks(boxes);
      expect(tracks.length).toBe(2);
      expect(tracks.map(t => t.trackId).sort()).toEqual(trackIds.sort());
    }
  });

  it('FAT Scenario 5: Moving camera live (one or more vehicles)', () => {
    // Camera panning means the relative positions of all vehicles shift simultaneously
    let boxes = [
      { x: 100, y: 100, width: 80, height: 30, confidence: 0.9 },
      { x: 300, y: 100, width: 80, height: 30, confidence: 0.9 }
    ];

    const t1 = tracker.updateTracks(boxes);
    expect(t1.length).toBe(2);
    const trackIds = t1.map(t => t.trackId);

    // Camera pans left (vehicles appear to move right)
    for (let i = 1; i < 5; i++) {
      boxes = boxes.map(box => ({ ...box, x: box.x + 20 }));
      const tracks = tracker.updateTracks(boxes);
      expect(tracks.length).toBe(2);
      expect(tracks.map(t => t.trackId).sort()).toEqual(trackIds.sort());
    }
  });

  it('FAT Scenario 6: EV Plate and Normal Plate validation', () => {
    // EV Plate
    const evPlate = validateMalaysianPattern('EV1234');
    expect(evPlate.category).toBe('EV_SPECIAL');
    expect(evPlate.isValid).toBe(true);

    // Normal Plate (Standard)
    const normalPlate = validateMalaysianPattern('BKP1234');
    expect(normalPlate.category).toBe('STANDARD');
    expect(normalPlate.isValid).toBe(true);
  });
});
