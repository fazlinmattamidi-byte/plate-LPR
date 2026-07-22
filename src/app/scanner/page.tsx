'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  SwitchCamera,
  Zap,
  ZapOff,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
} from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/BottomNav';
import { PlateTracker, ActiveTrack, BoundingBox } from '@/lib/anpr/tracker';
import {
  detectPlatesFullFrame,
  cropCanvasRegion,
  calculateCropQualityScore,
} from '@/lib/anpr/imageProcessor';
import { recognizePlateFromCanvas } from '@/lib/anpr/ocrEngine';
import { addOcrVoteToTrack, evaluateConsensus, getTrackReadingDisplay } from '@/lib/anpr/consensus';
import { normalizePlate } from '@/lib/anpr/normaliser';
import { playAlertSound, triggerVibration } from '@/lib/utils/audio';
import { VehicleCase, ScannerSettings } from '@/lib/db/types';
import { INITIAL_SETTINGS } from '@/lib/db/settingsDefaults';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MatchEntry {
  type: 'EXACT' | 'POSSIBLE';
  plate: string;
  trackId: string;
  vehicle: VehicleCase | null;
  possibleMatches: VehicleCase[];
  confidence: number;
  scanId?: string;
  timestamp: number;
  dismissed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers for track overlay
// ─────────────────────────────────────────────────────────────────────────────
function getTrackColor(track: ActiveTrack): string {
  if (track.matchType === 'EXACT') return '#ef4444';   // red
  if (track.matchType === 'POSSIBLE') return '#f59e0b'; // amber
  if (track.matchType === 'NONE') return '#10b981';    // green
  if (track.ocrState === 'COOLDOWN') return '#6b7280'; // grey
  return '#00d8f6';  // cyan — default / reading
}

function getTrackStatusLabel(track: ActiveTrack): string {
  if (track.matchType === 'EXACT') return 'MATCH';
  if (track.matchType === 'POSSIBLE') return 'POSSIBLE';
  if (track.matchType === 'NONE') return 'NO CASE';
  switch (track.ocrState) {
    case 'DETECTED': return 'DETECTED';
    case 'COLLECTING': return 'COLLECTING';
    case 'OCR_RUNNING': return 'READING…';
    case 'CONSENSUS_BUILDING': return 'ANALYSING';
    case 'DB_CHECKING': return 'CHECKING…';
    case 'COOLDOWN': return 'COOLDOWN';
    default: return 'SCANNING';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Scanner Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<PlateTracker>(new PlateTracker(15));
  const streamRef = useRef<MediaStream | null>(null);

  // Camera state
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Scanner control
  const isPausedRef = useRef<boolean>(false);
  const [isPaused, setIsPaused] = useState(false);

  // Performance metrics
  const [camFps, setCamFps] = useState(0);
  const [detFps, setDetFps] = useState(0);
  const [platesVisible, setPlatesVisible] = useState(0);
  const [activeTracks, setActiveTracks] = useState(0);

  // Active tracks for results tray
  const [tracksList, setTracksList] = useState<ActiveTrack[]>([]);
  const [trayExpanded, setTrayExpanded] = useState(true);

  // Match queue — all active matches, shown simultaneously
  const [matchQueue, setMatchQueue] = useState<MatchEntry[]>([]);
  const [viewingMatch, setViewingMatch] = useState<MatchEntry | null>(null);

  // Settings (loaded from API)
  const settingsRef = useRef<ScannerSettings>({ ...INITIAL_SETTINGS });

  // Refs for performance-critical loop data (no re-render on change)
  const camFrameCount = useRef(0);
  const detFrameCount = useRef(0);
  const lastFpsTs = useRef(Date.now());
  const cooldownMap = useRef<Map<string, number>>(new Map());
  const activeOcrCount = useRef(0);

  // ─── 1. Load Settings ───────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.settings) {
          settingsRef.current = { ...settingsRef.current, ...data.settings };
          trackerRef.current.setLostTrackTimeout(data.settings.lostTrackTimeout ?? 15);
        }
      })
      .catch(() => {});
  }, []);

  // ─── 2. Initialise Camera ────────────────────────────────────────────────
  const initCamera = useCallback(async (deviceId?: string) => {
    setCameraError(null);
    setCameraReady(false);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const s = settingsRef.current;
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: s.preferredResolution === '1080p' ? 1920 : 1280 },
              height: { ideal: s.preferredResolution === '1080p' ? 1080 : 720 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevs);

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities() as any;
        setTorchSupported(!!caps?.torch);
      }

      setCameraReady(true);
    } catch (err: any) {
      let msg = 'Gagal mengakses kamera.';
      if (err.name === 'NotAllowedError')
        msg = 'Camera permission denied. Allow camera access in browser settings and retry.';
      else if (err.name === 'NotFoundError')
        msg = 'No camera device found on this device.';
      else if (err.name === 'NotReadableError')
        msg = 'Camera is already in use by another application.';
      setCameraError(msg);
    }
  }, []);

  useEffect(() => {
    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [initCamera]);

  // ─── 3. Torch Toggle ────────────────────────────────────────────────────
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(v => !v);
    } catch {}
  };

  // ─── 4. Camera Switch ────────────────────────────────────────────────────
  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex(d => d.deviceId === selectedDeviceId);
    const next = devices[(idx + 1) % devices.length];
    setSelectedDeviceId(next.deviceId);
    initCamera(next.deviceId);
    trackerRef.current.clear();
  };

  // ─── 5. Pause / Resume ──────────────────────────────────────────────────
  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  };

  // ─── 6. Per-Track Database Match ─────────────────────────────────────────
  const runDatabaseMatch = useCallback(async (track: ActiveTrack, plate: string, confidence: number) => {
    const cooldownMs = settingsRef.current.duplicateCooldown * 1000;
    const now = Date.now();
    const lastSearch = cooldownMap.current.get(plate) ?? 0;

    if (now - lastSearch < cooldownMs) return; // Duplicate suppression per-plate
    cooldownMap.current.set(plate, now);

    track.ocrState = 'DB_CHECKING';

    try {
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plateNumber: plate, source: 'CAMERA', confidence }),
      }).then(r => r.json());

      if (!searchRes.success) return;

      // Log scan event (each plate gets its own ScanEvent)
      const scanRes = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detectedPlate: plate,
          normalizedPlate: plate,
          confidence,
          matchType: searchRes.matchType,
          matchedVehicleId: searchRes.matchedVehicle?.id ?? undefined,
          source: 'CAMERA',
          trackId: track.trackId,
          frameCount: track.framesSeen,
          firstSeenAt: new Date(Date.now() - track.framesSeen * 33).toISOString(),
        }),
      }).then(r => r.json());

      track.matchType = searchRes.matchType === 'EXACT' ? 'EXACT' : searchRes.matchType === 'POSSIBLE' ? 'POSSIBLE' : 'NONE';
      track.matchedVehicle = searchRes.matchedVehicle ?? undefined;
      track.possibleMatchVehicles = searchRes.possibleMatches ?? [];
      // Map to valid TrackOcrState values
      track.ocrState = track.matchType === 'EXACT' ? 'MATCHED' : track.matchType === 'POSSIBLE' ? 'POSSIBLE_MATCH' : 'NOT_FOUND';

      if (searchRes.matchType === 'EXACT') {
        if (settingsRef.current.soundEnabled) playAlertSound('EXACT_MATCH');
        if (settingsRef.current.vibrationEnabled) triggerVibration([200, 100, 200, 100]);

        // Add to match queue — does NOT stop scanner
        const entry: MatchEntry = {
          type: 'EXACT',
          plate,
          trackId: track.trackId,
          vehicle: searchRes.matchedVehicle,
          possibleMatches: [],
          confidence,
          scanId: scanRes.scanEvent?.id,
          timestamp: now,
          dismissed: false,
        };
        setMatchQueue(q => [...q.filter(m => m.plate !== plate), entry]);

      } else if (searchRes.matchType === 'POSSIBLE') {
        if (settingsRef.current.soundEnabled) playAlertSound('POSSIBLE_MATCH');
        const entry: MatchEntry = {
          type: 'POSSIBLE',
          plate,
          trackId: track.trackId,
          vehicle: null,
          possibleMatches: searchRes.possibleMatches ?? [],
          confidence,
          scanId: scanRes.scanEvent?.id,
          timestamp: now,
          dismissed: false,
        };
        setMatchQueue(q => [...q.filter(m => m.plate !== plate), entry]);
      }

      track.ocrState = 'COOLDOWN';
      track.cooldownActive = true;
      track.scanEventId = scanRes.scanEvent?.id;
    } catch (err) {
      console.warn('[Scanner] DB match error:', err);
      track.ocrState = 'COLLECTING';
    }
  }, []);

  // ─── 7. Main ANPR Loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return;

    let animId: number;
    let detectionInterval: ReturnType<typeof setInterval>;
    let detTs = Date.now();
    let detCount = 0;

    // Detection runs at ~10 FPS independently from render loop
    const runDetection = async () => {
      if (!videoRef.current || !canvasRef.current || isPausedRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < 2 || video.videoWidth === 0) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw current video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ── Full-frame plate detection ──
      const s = settingsRef.current;
      const detectedBoxes = detectPlatesFullFrame(canvas, s.detectionThreshold, s.maxTracks);

      // ── Update tracker with all detections ──
      const allTracks = trackerRef.current.updateTracks(detectedBoxes);

      setPlatesVisible(detectedBoxes.length);
      setActiveTracks(allTracks.length);

      // ── Draw overlays ──
      drawOverlays(ctx, canvas.width, canvas.height, allTracks, s.showCenterGuide, s.debugMode);

      // ── OCR priority queue — max N concurrent jobs ──
      const { prioritiseTracks: getPriority } = await import('@/lib/anpr/imageProcessor');
      const priorityIds = getPriority(
        allTracks.map(t => ({ trackId: t.trackId, bbox: t.bbox, framesSeen: t.framesSeen, ocrState: t.ocrState })),
        canvas.width,
        canvas.height,
        s.maxOcrConcurrency
      );

      for (const trackId of priorityIds) {
        const track = trackerRef.current.getTrack(trackId);
        if (!track || track.ocrRunning || track.cooldownActive) continue;
        if (activeOcrCount.current >= s.maxOcrConcurrency) break;

        // Collect enough frames before OCR
        if (track.framesSeen < 3) {
          track.ocrState = 'COLLECTING';
          continue;
        }

        // Crop the plate region
        const cropCanvas = cropCanvasRegion(canvas, track.bbox);
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
        if (!cropCtx) continue;

        const quality = calculateCropQualityScore(cropCtx, cropCanvas.width, cropCanvas.height);
        if (quality < 0.20) {
          track.ocrState = 'COLLECTING';
          continue;
        }

        // Store best crop
        if (track.cropSamples.length < 5) {
          track.cropSamples.push({
            qualityScore: quality,
            timestamp: Date.now(),
          });
        }

        // Launch OCR asynchronously — non-blocking
        track.ocrRunning = true;
        track.ocrState = 'OCR_RUNNING';
        activeOcrCount.current++;

        (async () => {
          try {
            const { text, confidence: conf } = await recognizePlateFromCanvas(cropCanvas);
            const updatedTrack = trackerRef.current.getTrack(trackId);
            if (!updatedTrack || updatedTrack.cooldownActive) return;

            if (text && conf >= 0.50) {
              addOcrVoteToTrack(updatedTrack, text, conf);
              updatedTrack.ocrState = 'CONSENSUS_BUILDING';

              const consensus = evaluateConsensus(
                updatedTrack,
                s.consensusVotes,
                s.recognitionThreshold
              );

              if (consensus.isStabilized) {
                updatedTrack.stabilizedPlate = consensus.normalizedPlate;
                updatedTrack.stabilizedConfidence = consensus.confidence;
                await runDatabaseMatch(updatedTrack, consensus.normalizedPlate, consensus.confidence);
              }
            } else {
              if (updatedTrack.votes.size === 0) updatedTrack.ocrState = 'COLLECTING';
            }
          } catch (e) {
            console.warn('[OCR] Error:', e);
          } finally {
            const t = trackerRef.current.getTrack(trackId);
            if (t) t.ocrRunning = false;
            activeOcrCount.current = Math.max(0, activeOcrCount.current - 1);
          }
        })();
      }

      // Update tracks state for results tray (throttled)
      setTracksList([...allTracks]);

      // Detection FPS
      detCount++;
      const now = Date.now();
      if (now - detTs >= 1000) {
        setDetFps(detCount);
        detCount = 0;
        detTs = now;
      }
    };

    // Camera render FPS counter
    const renderLoop = () => {
      if (!isPausedRef.current) {
        camFrameCount.current++;
        const now = Date.now();
        if (now - lastFpsTs.current >= 1000) {
          setCamFps(camFrameCount.current);
          camFrameCount.current = 0;
          lastFpsTs.current = now;
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    detectionInterval = setInterval(runDetection, 100); // 10 FPS target for detection

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(detectionInterval);
    };
  }, [cameraReady, runDatabaseMatch]);

  // ─── 8. Canvas Overlay Drawing ────────────────────────────────────────────
  function drawOverlays(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    tracks: ActiveTrack[],
    showGuide: boolean,
    debug: boolean
  ) {
    // Optional very subtle center guide (disabled by default)
    if (showGuide) {
      ctx.strokeStyle = 'rgba(0, 216, 246, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      const gW = W * 0.6, gH = gW / 4;
      ctx.strokeRect((W - gW) / 2, (H - gH) / 2, gW, gH);
      ctx.setLineDash([]);
    }

    // Draw per-track bounding boxes
    tracks.forEach(track => {
      const { x, y, width, height } = track.bbox;
      const color = getTrackColor(track);
      const label = getTrackStatusLabel(track);
      const reading = track.stabilizedPlate || getTrackReadingDisplay(track);
      const displayNum = track.trackNumber;

      // Main bounding box stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.strokeRect(x, y, width, height);

      // Corner accent marks
      const cl = Math.min(14, width * 0.15, height * 0.25);
      ctx.lineWidth = 4;
      ctx.beginPath();
      // TL
      ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y);
      // TR
      ctx.moveTo(x + width - cl, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cl);
      // BL
      ctx.moveTo(x, y + height - cl); ctx.lineTo(x, y + height); ctx.lineTo(x + cl, y + height);
      // BR
      ctx.moveTo(x + width - cl, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cl);
      ctx.stroke();

      // Label badge — position above or below depending on space
      const labelY = y > 70 ? y - 4 : y + height + 4;
      const labelAnchor = y > 70 ? 'bottom' : 'top';

      const badgeText = reading
        ? `#${displayNum} ${reading} ${Math.round((track.stabilizedConfidence ?? track.bbox.confidence) * 100)}%`
        : `#${displayNum} ${label}`;

      ctx.font = 'bold 11px monospace';
      const textW = ctx.measureText(badgeText).width;
      const badgeH = 20;
      const badgeY = labelAnchor === 'bottom' ? labelY - badgeH : labelY;
      const badgeX = Math.max(0, Math.min(W - textW - 10, x));

      // Badge background
      ctx.fillStyle = color + 'dd';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, textW + 10, badgeH, 4);
      ctx.fill();

      // Badge text
      ctx.fillStyle = track.matchType === 'EXACT' || track.matchType === 'POSSIBLE' ? '#fff' : '#0a0a0f';
      ctx.fillText(badgeText, badgeX + 5, badgeY + 14);

      // Status word below
      if (reading && reading !== label) {
        const statusText = label;
        ctx.font = 'bold 9px monospace';
        const sw = ctx.measureText(statusText).width;
        const sbY = labelAnchor === 'bottom' ? badgeY - 16 : badgeY + badgeH + 2;
        ctx.fillStyle = color + 'bb';
        ctx.fillRect(badgeX, sbY, sw + 8, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(statusText, badgeX + 4, sbY + 10);
      }

      // Debug confidence on box
      if (debug) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '9px monospace';
        ctx.fillText(`det:${Math.round(track.bbox.confidence * 100)}%`, x + 2, y + height - 3);
      }
    });
  }

  // ─── 9. Match Actions ─────────────────────────────────────────────────────
  const confirmVehicle = async (entry: MatchEntry) => {
    if (entry.scanId) {
      await fetch('/api/scans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.scanId, action: 'CONFIRM' }),
      });
    }
    setMatchQueue(q => q.filter(m => m.plate !== entry.plate));
    setViewingMatch(null);
  };

  const reportWrong = async (entry: MatchEntry) => {
    if (entry.scanId) {
      await fetch('/api/scans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.scanId, action: 'REPORT_WRONG' }),
      });
    }
    setMatchQueue(q => q.filter(m => m.plate !== entry.plate));
    setViewingMatch(null);
  };

  const dismissMatch = (plate: string) => {
    setMatchQueue(q => q.filter(m => m.plate !== plate));
    if (viewingMatch?.plate === plate) setViewingMatch(null);
  };

  const activeMatches = matchQueue.filter(m => !m.dismissed);

  // ─── 10. Render ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden" style={{ zIndex: 100 }}>

      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-black/70 backdrop-blur-sm border-b border-white/10 z-20">
        {/* Left: Back */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>

        {/* Centre: Title */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00d8f6] animate-ping" />
          <span className="text-xs sm:text-sm font-black tracking-widest text-white uppercase">
            Live Multi-Vehicle Scanner
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg border text-xs transition-colors ${torchOn ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'}`}
              aria-label="Torch"
            >
              {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}
          {devices.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="p-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 hover:text-white"
              aria-label="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={togglePause}
            className={`p-2 rounded-lg border transition-colors ${isPaused ? 'bg-[#00d8f6]/20 text-[#00d8f6] border-[#00d8f6]/30' : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'}`}
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <Link
            href="/settings"
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 hover:text-white"
            aria-label="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── DEBUG PERFORMANCE CHIP ── */}
      {settingsRef.current?.debugMode !== false && (
        <div className="absolute top-14 left-3 z-30 flex items-center gap-1.5 text-[10px] font-mono font-bold pointer-events-none">
          <span className="px-2 py-0.5 bg-black/70 text-[#00d8f6] rounded border border-[#00d8f6]/30">
            CAM {camFps} FPS
          </span>
          <span className="px-2 py-0.5 bg-black/70 text-amber-400 rounded border border-amber-400/30">
            DET {detFps} FPS
          </span>
          <span className="px-2 py-0.5 bg-black/70 text-emerald-400 rounded border border-emerald-400/30">
            PLATES {platesVisible}
          </span>
          <span className="px-2 py-0.5 bg-black/70 text-slate-300 rounded border border-slate-700">
            TRACKS {activeTracks}
          </span>
          <span className="px-2 py-0.5 bg-black/70 text-purple-400 rounded border border-purple-400/30">
            CV ENGINE
          </span>
        </div>
      )}

      {/* ── MAIN CAMERA AREA ── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Camera Error State */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#090a0f] z-10 p-6">
            <div className="max-w-sm text-center">
              <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">Camera Error</h3>
              <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
              <button
                onClick={() => initCamera()}
                className="px-5 py-2.5 bg-[#00d8f6] text-slate-950 text-xs font-bold rounded-xl"
              >
                Retry Camera
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!cameraError && !cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090a0f] z-10 gap-4">
            <div className="w-12 h-12 border-4 border-[#00d8f6]/20 border-t-[#00d8f6] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Initialising camera…</p>
          </div>
        )}

        {/* Video feed (hidden — canvas is displayed over it) */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0 }}
        />

        {/* Canvas — full-frame ANPR overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: cameraReady ? 'block' : 'none' }}
        />

        {/* Paused overlay */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <div className="flex flex-col items-center gap-2">
              <Pause className="w-14 h-14 text-white/60" />
              <span className="text-lg font-bold text-white/70">Paused</span>
              <button
                onClick={togglePause}
                className="mt-2 px-6 py-2.5 bg-[#00d8f6] text-slate-950 font-bold text-sm rounded-xl"
              >
                Resume Scanning
              </button>
            </div>
          </div>
        )}

        {/* ── MATCH NOTIFICATION BADGES (top-right) ── */}
        {activeMatches.length > 0 && !viewingMatch && (
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
            {activeMatches.map(entry => (
              <button
                key={entry.plate}
                onClick={() => setViewingMatch(entry)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-2xl border backdrop-blur-sm transition-all hover:scale-105 ${
                  entry.type === 'EXACT'
                    ? 'bg-rose-600/90 border-rose-500 text-white shadow-rose-900/60'
                    : 'bg-amber-500/90 border-amber-400 text-slate-950 shadow-amber-900/60'
                }`}
              >
                {entry.type === 'EXACT' ? (
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span className="font-mono">{entry.plate}</span>
                <span>{entry.type === 'EXACT' ? 'MATCH' : 'POSSIBLE'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── LIVE RESULTS TRAY ── */}
      <div className={`flex-shrink-0 bg-[#090a0f]/95 backdrop-blur-lg border-t border-[#252833] transition-all ${trayExpanded ? 'max-h-52' : 'max-h-12'} overflow-hidden`}>
        {/* Tray Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#252833]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-white tracking-wide">LIVE RESULTS</span>
            {activeTracks > 0 && (
              <span className="px-1.5 py-0.5 bg-[#00d8f6] text-slate-950 text-[10px] font-black rounded">
                {activeTracks}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">
              {platesVisible} plates visible
            </span>
            <button
              onClick={() => setTrayExpanded(v => !v)}
              className="p-1 text-slate-400 hover:text-white"
            >
              {trayExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Track Rows */}
        {trayExpanded && (
          <div className="overflow-y-auto max-h-36 divide-y divide-[#252833]">
            {tracksList.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                No plates detected. Point camera toward vehicles.
              </div>
            ) : (
              tracksList.map(track => (
                <div
                  key={track.trackId}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[#16181e] transition-colors"
                >
                  {/* Track number badge */}
                  <span
                    className="w-8 text-center text-[10px] font-black rounded px-1 py-0.5 shrink-0"
                    style={{ background: getTrackColor(track) + '22', color: getTrackColor(track), border: `1px solid ${getTrackColor(track)}44` }}
                  >
                    #{track.trackNumber}
                  </span>

                  {/* Plate reading */}
                  <span className="font-mono font-extrabold text-sm text-white w-24 truncate shrink-0">
                    {track.stabilizedPlate ?? getTrackReadingDisplay(track) ?? '–'}
                  </span>

                  {/* Status */}
                  <span
                    className="text-[10px] font-bold w-16 shrink-0"
                    style={{ color: getTrackColor(track) }}
                  >
                    {getTrackStatusLabel(track)}
                  </span>

                  {/* Confidence */}
                  <span className="text-xs text-slate-400 font-mono shrink-0 w-10">
                    {track.stabilizedConfidence != null
                      ? `${Math.round(track.stabilizedConfidence * 100)}%`
                      : track.bbox.confidence > 0
                      ? `~${Math.round(track.bbox.confidence * 100)}%`
                      : '–'}
                  </span>

                  {/* Match vehicle name */}
                  {track.matchedVehicle && (
                    <span className="text-xs text-slate-400 truncate hidden sm:block">
                      {track.matchedVehicle.vehicleMake} {track.matchedVehicle.vehicleModel} · {track.matchedVehicle.financeCompany}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── MATCH DETAIL MODAL (non-blocking — scanner continues) ── */}
      {viewingMatch && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" style={{ pointerEvents: 'auto' }}>
          <div
            className={`max-w-md w-full rounded-2xl p-6 shadow-2xl border-2 ${
              viewingMatch.type === 'EXACT'
                ? 'bg-rose-950/95 border-rose-600'
                : 'bg-amber-950/95 border-amber-500'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {viewingMatch.type === 'EXACT'
                  ? <AlertOctagon className="w-7 h-7 text-rose-400 animate-bounce" />
                  : <AlertTriangle className="w-7 h-7 text-amber-400" />}
                <div>
                  <div className="text-[10px] font-black text-white/60 tracking-widest uppercase">Track #{viewingMatch.trackId.replace('trk-', '')}</div>
                  <h2 className="text-xl font-black text-white">
                    {viewingMatch.type === 'EXACT' ? 'MATCH FOUND' : 'POSSIBLE MATCH'}
                  </h2>
                </div>
              </div>
              <span className="text-xl font-mono font-black text-white bg-black/50 px-3 py-1 rounded-xl border border-white/20">
                {viewingMatch.plate}
              </span>
            </div>

            {/* Exact match vehicle details */}
            {viewingMatch.type === 'EXACT' && viewingMatch.vehicle && (
              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                {[
                  ['Pelanggan', viewingMatch.vehicle.customerName],
                  ['Kenderaan', `${viewingMatch.vehicle.vehicleMake} ${viewingMatch.vehicle.vehicleModel} (${viewingMatch.vehicle.vehicleColor})`],
                  ['Syarikat Kewangan', viewingMatch.vehicle.financeCompany],
                  ['Rujukan Kes', viewingMatch.vehicle.caseReference],
                ].map(([label, value]) => (
                  <div key={label} className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 block mb-0.5">{label}</span>
                    <span className="text-white font-semibold">{value}</span>
                  </div>
                ))}
                <div className="col-span-2 bg-black/50 p-2.5 rounded-lg border border-rose-900/40">
                  <span className="text-slate-400 block mb-0.5">Jumlah Tunggakan</span>
                  <span className="text-rose-400 font-black text-lg">
                    RM {viewingMatch.vehicle.outstandingAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Possible match list */}
            {viewingMatch.type === 'POSSIBLE' && viewingMatch.possibleMatches.length > 0 && (
              <div className="mb-4 text-xs space-y-2">
                <p className="text-amber-200 mb-2">
                  Nombor plat <span className="font-mono font-bold text-white">{viewingMatch.plate}</span> hampir sepadan. Sahkan secara visual.
                </p>
                {viewingMatch.possibleMatches.map(v => (
                  <div key={v.id} className="bg-black/50 p-2.5 rounded-lg border border-amber-900/30">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-white">{v.plateNumber}</span>
                      <span className="text-rose-400 font-bold">RM {v.outstandingAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-slate-300 mt-0.5">{v.customerName} · {v.vehicleMake} {v.vehicleModel} ({v.vehicleColor})</div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-slate-400 mb-4">
              Confidence: {Math.round(viewingMatch.confidence * 100)}% · Scanner masih berjalan di belakang.
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => reportWrong(viewingMatch)}
                className="px-3 py-2 bg-black/60 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold hover:bg-black"
              >
                Report Wrong Reading
              </button>
              <button
                onClick={() => { setViewingMatch(null); }}
                className="px-4 py-2 bg-slate-700 text-white rounded-xl text-xs font-semibold hover:bg-slate-600"
              >
                Continue Scanning
              </button>
              {viewingMatch.type === 'EXACT' && (
                <button
                  onClick={() => confirmVehicle(viewingMatch)}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs"
                >
                  Confirm Vehicle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scanner stays on full screen — BottomNav hidden to maximise camera area */}
    </div>
  );
}
