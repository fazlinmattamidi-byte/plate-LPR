import React from 'react';
import { Cpu, Cloud, AlertTriangle, Zap } from 'lucide-react';

interface ModelStatusBannerProps {
  detectorEngine: 'LOCAL_ONNX' | 'CV_HEURISTIC';
  ocrEngine?: 'ONNX_MODEL' | 'PP_OCR' | 'TESSERACT';
  confidenceScore?: number;
}

export const ModelStatusBanner: React.FC<ModelStatusBannerProps> = ({
  detectorEngine,
  ocrEngine = 'ONNX_MODEL',
  confidenceScore,
}) => {
  const isPpOcr = ocrEngine === 'ONNX_MODEL' || ocrEngine === 'PP_OCR';

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 px-3 py-1.5 bg-slate-950/90 border border-slate-800 rounded-lg text-xs backdrop-blur-md">
      {/* DETECTOR STATUS */}
      <div className="flex items-center gap-2">
        {detectorEngine === 'LOCAL_ONNX' ? (
          <>
            <Cpu className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <span className="font-bold text-emerald-400">YOLO ONNX Detector</span>
            <span className="px-1.5 py-0.5 bg-emerald-950 border border-emerald-800 rounded text-[9px] font-mono text-emerald-300">
              LOCAL WASM
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-amber-400">CV Detector</span>
            <span className="px-1.5 py-0.5 bg-amber-950 border border-amber-800 rounded text-[9px] font-mono text-amber-300">
              HEURISTIC
            </span>
          </>
        )}

        {confidenceScore !== undefined && confidenceScore > 0 && (
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
            Conf: {Math.round(confidenceScore * 100)}%
          </span>
        )}
      </div>

      {/* DIVIDER */}
      <div className="hidden sm:block w-px h-4 bg-slate-800" />

      {/* OCR ENGINE STATUS */}
      <div className="flex items-center gap-2">
        <Zap className={`w-4 h-4 shrink-0 ${isPpOcr ? 'text-[#00d8f6]' : 'text-amber-400'}`} />
        <span className={`font-bold ${isPpOcr ? 'text-[#00d8f6]' : 'text-amber-300'}`}>
          {isPpOcr ? 'PP-OCRv5 ONNX' : 'Tesseract.js'}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
          isPpOcr 
            ? 'bg-[#00d8f6]/10 border-[#00d8f6]/30 text-[#00d8f6]' 
            : 'bg-amber-950 border-amber-800 text-amber-300'
        }`}>
          {isPpOcr ? 'WebGPU / WASM' : 'FALLBACK'}
        </span>
      </div>
    </div>
  );
};
