'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Maximize2, Minimize2, Sparkles, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';

interface DemoPlateItem {
  plate: string;
  expectedResult: 'Exact Match' | 'Possible Match' | 'No Match' | 'Closed Case';
  description: string;
  badgeColor: string;
}

const DEMO_PLATES: DemoPlateItem[] = [
  {
    plate: 'JSD8888',
    expectedResult: 'Exact Match',
    description: 'Honda City (Black) - Maybank - RM22,000.00 Outstanding',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  },
  {
    plate: 'ANN7569',
    expectedResult: 'Exact Match',
    description: 'Perodua Bezza (White) - CIMB - RM15,000.00 Outstanding',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  },
  {
    plate: 'VAB1234',
    expectedResult: 'Exact Match',
    description: 'Perodua Bezza (White) - CIMB - RM15,000.00 Outstanding',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  },
  {
    plate: 'BQH4281',
    expectedResult: 'Exact Match',
    description: 'Proton X50 (Red) - Public Bank - RM28,500.00 Outstanding',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  },
  {
    plate: 'WXY7788',
    expectedResult: 'Exact Match',
    description: 'Toyota Vios (Silver) - Toyota Capital (Status: ON_HOLD)',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  },
  {
    plate: 'WXY77B8',
    expectedResult: 'Possible Match',
    description: 'Simulation plate (OCR 1-char candidate for WXY7788)',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  },
  {
    plate: 'ABC9999',
    expectedResult: 'No Match',
    description: 'Random plate - Not registered in repository database',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  },
  {
    plate: 'KV1234E',
    expectedResult: 'Closed Case',
    description: 'Nissan Almera - Hong Leong Bank (Case status: CLOSED)',
    badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
  },
];

export default function DemoPlatesPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const current = DEMO_PLATES[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? DEMO_PLATES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === DEMO_PLATES.length - 1 ? 0 : prev + 1));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28 print:bg-white print:text-black print:pb-0">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-8 print:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-[#00d8f6]" />
              Demo License Plates
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Use these Malaysian plate samples to test the live camera scanner on another phone or screen.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16181e] text-slate-300 border border-[#252833] rounded-xl hover:text-white transition-colors text-xs font-semibold"
            >
              <Printer className="w-4 h-4 text-[#00d8f6]" />
              Cetak / Print
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00d8f6] text-slate-950 rounded-xl font-bold text-xs hover:bg-[#22e0fb] transition-all"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFullscreen ? 'Tutup Fullscreen' : 'Fullscreen Viewer'}
            </button>
          </div>
        </div>

        {/* Main Display Plate Frame matching Malaysian License Plate font & black background */}
        <div
          className={`${
            isFullscreen
              ? 'fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6'
              : 'bg-[#16181e] border border-[#252833] rounded-2xl p-6 sm:p-10 mb-8 shadow-2xl relative'
          }`}
        >
          {isFullscreen && (
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 p-3 bg-slate-900 text-white rounded-xl font-bold"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
          )}

          <div className="flex flex-col items-center">
            {/* Expected Result Badge */}
            <div className="mb-6 flex items-center gap-2">
              <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase border ${current.badgeColor}`}>
                EXPECTED: {current.expectedResult}
              </span>
              <span className="text-xs text-slate-400">
                ({currentIndex + 1} / {DEMO_PLATES.length})
              </span>
            </div>

            {/* Authentic Malaysian License Plate Graphic Component */}
            <div className="w-full max-w-[500px] h-[160px] sm:h-[200px] bg-black border-4 border-slate-700 rounded-2xl p-4 flex items-center justify-center shadow-2xl mb-6 relative">
              <div className="border border-white/20 rounded-xl w-full h-full flex items-center justify-center bg-black">
                <span className="text-6xl sm:text-7xl md:text-8xl font-mono font-extrabold text-white tracking-widest uppercase select-all font-sans">
                  {current.plate}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm font-semibold text-slate-300 text-center max-w-md mb-8">
              {current.description}
            </p>

            {/* Navigation Controls */}
            <div className="flex items-center gap-4 print:hidden">
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-5 py-3 bg-[#090a0f] border border-[#252833] rounded-xl text-slate-200 hover:text-white hover:border-[#00d8f6] transition-colors font-bold text-sm"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous Plate
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-[#00d8f6] text-slate-950 rounded-xl font-extrabold text-sm hover:bg-[#22e0fb] transition-all shadow-lg shadow-[#00d8f6]/20"
              >
                Next Plate
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail Selector Grid */}
        <div className="print:hidden">
          <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4">
            Semua Nombor Plat Demo
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DEMO_PLATES.map((item, idx) => (
              <button
                key={item.plate}
                onClick={() => setCurrentIndex(idx)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  currentIndex === idx
                    ? 'bg-[#00d8f6]/15 border-[#00d8f6] shadow-md shadow-[#00d8f6]/10'
                    : 'bg-[#16181e] border-[#252833] hover:border-slate-700'
                }`}
              >
                <span className="text-lg font-mono font-extrabold text-white block">{item.plate}</span>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{item.expectedResult}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      <div className="print:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
