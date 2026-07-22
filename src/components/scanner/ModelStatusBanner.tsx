import React from 'react';
import { Cpu, Cloud, AlertTriangle } from 'lucide-react';

interface ModelStatusBannerProps {
  detectorEngine: 'ROBOFLOW_API' | 'LOCAL_ONNX' | 'CV_HEURISTIC';
  confidenceScore?: number;
}

export const ModelStatusBanner: React.FC<ModelStatusBannerProps> = ({
  detectorEngine,
  confidenceScore,
}) => {
  if (detectorEngine === 'ROBOFLOW_API') {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold">Malaysian Plate Detector: Roboflow YOLOv8 Cloud AI</span>
          <span className="px-1.5 py-0.5 bg-emerald-800/60 rounded text-[10px] text-emerald-200">mAP 97.5%</span>
        </div>
        {confidenceScore !== undefined && (
          <span className="text-[10px] text-emerald-400/80">
            Avg Conf: {Math.round(confidenceScore * 100)}%
          </span>
        )}
      </div>
    );
  }

  if (detectorEngine === 'LOCAL_ONNX') {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-950/80 border border-blue-500/40 rounded-lg text-blue-300 text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="font-semibold">Malaysian Plate Detector: Local ONNX Engine</span>
          <span className="px-1.5 py-0.5 bg-blue-800/60 rounded text-[10px] text-blue-200">WASM / WebGL</span>
        </div>
        <span className="text-[10px] text-blue-400/80">Offline Local Inference</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-amber-950/80 border border-amber-500/40 rounded-lg text-amber-300 text-xs backdrop-blur-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="font-semibold">Malaysian Plate Detector: Computer Vision Heuristic</span>
        <span className="px-1.5 py-0.5 bg-amber-900/60 rounded text-[10px] text-amber-200">Fallback</span>
      </div>
      <span className="text-[10px] text-amber-400/80">Edge & Contour Active</span>
    </div>
  );
};
