import React from 'react';
import { Cpu, AlertTriangle, Zap, RefreshCw, AlertOctagon, HelpCircle } from 'lucide-react';
import { ANPRRuntimeState, AdmissionBenchmarkResult } from '@/lib/anpr/runtimeManager';

interface ModelStatusBannerProps {
  runtimeState: ANPRRuntimeState;
  detectorProvider?: 'WebGPU' | 'WASM' | 'NONE';
  ocrProvider?: 'WebGPU' | 'WASM' | 'NONE';
  benchmark?: AdmissionBenchmarkResult | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  onManualSearch?: () => void;
}

export const ModelStatusBanner: React.FC<ModelStatusBannerProps> = ({
  runtimeState,
  detectorProvider = 'WASM',
  ocrProvider = 'WASM',
  benchmark,
  errorMessage,
  onRetry,
  onManualSearch,
}) => {
  const isReady = runtimeState === 'READY_WEBGPU' || runtimeState === 'READY_WASM';
  const isDegraded = runtimeState === 'DEGRADED_PERFORMANCE';
  const isUnavailable = runtimeState === 'DETECTOR_UNAVAILABLE' || runtimeState === 'OCR_UNAVAILABLE' || runtimeState === 'RUNTIME_ERROR';
  const isLoading = runtimeState === 'LOADING_MODELS' || runtimeState === 'VALIDATING_MODELS' || runtimeState === 'BENCHMARKING_DEVICE';

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-950/95 border border-slate-800 rounded-xl text-xs backdrop-blur-md shadow-2xl">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* DETECTOR STATUS */}
        <div className="flex items-center gap-2">
          {isReady ? (
            <>
              <Cpu className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
              <span className="font-bold text-emerald-400">YOLO ONNX Detector</span>
              <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 rounded text-[9px] font-mono text-emerald-300 font-bold">
                {runtimeState === 'READY_WEBGPU' ? 'READY (WEBGPU)' : 'READY (WASM)'}
              </span>
            </>
          ) : isDegraded ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-400">DEGRADED PERFORMANCE</span>
              <span className="px-2 py-0.5 bg-amber-950 border border-amber-800 rounded text-[9px] font-mono text-amber-300">
                WASM &lt; 3 FPS
              </span>
            </>
          ) : isUnavailable ? (
            <>
              <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-bold text-rose-400">DETECTOR UNAVAILABLE</span>
              <span className="px-2 py-0.5 bg-rose-950 border border-rose-800 rounded text-[9px] font-mono text-rose-300">
                AUTO SCANNING DISABLED
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 text-[#00d8f6] animate-spin shrink-0" />
              <span className="font-bold text-[#00d8f6]">
                {runtimeState === 'LOADING_MODELS' ? 'Loading ONNX Models...' : runtimeState === 'VALIDATING_MODELS' ? 'Validating Tensors...' : 'Benchmarking Device...'}
              </span>
            </>
          )}
        </div>

        {/* OCR ENGINE STATUS */}
        {isReady && (
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00d8f6] shrink-0" />
            <span className="font-bold text-[#00d8f6]">PP-OCRv5 ONNX</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border bg-[#00d8f6]/10 border-[#00d8f6]/30 text-[#00d8f6]">
              {ocrProvider !== 'NONE' ? ocrProvider : 'WASM'}
            </span>
          </div>
        )}
      </div>

      {/* BENCHMARK DIAGNOSTICS CHIP */}
      {benchmark && isReady && (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-900 pt-1.5 px-1">
          <span>Det P95: {benchmark.detectorP95Ms}ms</span>
          <span>OCR P95: {benchmark.ocrP95Ms}ms</span>
          <span>Throughput: {benchmark.estimatedFps} FPS</span>
        </div>
      )}

      {/* ERROR & ACTIONS BANNER WHEN UNAVAILABLE OR DEGRADED */}
      {(isUnavailable || isDegraded) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-300 leading-snug">
            {errorMessage || (isUnavailable 
              ? 'Automatic plate scanning cannot operate on this device.' 
              : 'Device performance is below minimum admission threshold for live continuous scanning.')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            {onManualSearch && (
              <button
                onClick={onManualSearch}
                className="px-2.5 py-1 bg-[#00d8f6] hover:bg-[#22e0fb] text-slate-950 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                Manual Search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
