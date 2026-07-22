'use client';

import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Trash2, CheckCircle, AlertTriangle, XCircle, Camera, User } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { ScanEvent, MatchType } from '@/lib/db/types';

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [matchFilter, setMatchFilter] = useState<MatchType | 'ALL'>('ALL');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let url = `/api/scans?matchType=${matchFilter}`;
      if (query) url += `&query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setScans(data.scans || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [query, matchFilter]);

  const handleClearHistory = async () => {
    if (confirm('Adakah anda pasti mahu memadamkan semua rekod sejarah carian dan scan?')) {
      try {
        const res = await fetch('/api/scans', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          fetchHistory();
        }
      } catch (e) {
        alert('Gagal memadam sejarah');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Scan & Search History</h1>
            <p className="text-sm text-slate-400 mt-1">
              Audit logs of all live camera scans and manual search queries.
            </p>
          </div>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-xl hover:bg-rose-900/50 transition-colors self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Scan History
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history by plate..."
              className="w-full bg-[#16181e] border border-[#252833] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00d8f6]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'EXACT', 'POSSIBLE', 'NONE'].map((ft) => (
              <button
                key={ft}
                onClick={() => setMatchFilter(ft as any)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border shrink-0 ${
                  matchFilter === ft
                    ? 'bg-[#00d8f6] text-slate-950 border-[#00d8f6]'
                    : 'bg-[#16181e] text-slate-400 border-[#252833] hover:text-white'
                }`}
              >
                {ft === 'ALL' ? 'All Records' : ft}
              </button>
            ))}
          </div>
        </div>

        {/* History Log List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuatkan rekod sejarah...</div>
        ) : scans.length === 0 ? (
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-12 text-center text-slate-500">
            Tiada rekod sejarah pengesanan atau carian.
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map((s) => (
              <div
                key={s.id}
                className="bg-[#16181e] border border-[#252833] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#2f3444] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      s.matchType === 'EXACT'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : s.matchType === 'POSSIBLE'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {s.source === 'CAMERA' ? <Camera className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-mono font-extrabold text-white">{s.normalizedPlate}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          s.matchType === 'EXACT'
                            ? 'bg-rose-500/20 text-rose-400'
                            : s.matchType === 'POSSIBLE'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {s.matchType}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-0.5">
                      Sumber: {s.source} • Keyakinan: {Math.round(s.confidence * 100)}%
                      {s.confirmed && <span className="ml-2 text-emerald-400 font-bold">✓ Disahkan</span>}
                      {s.reportedWrong && <span className="ml-2 text-rose-400 font-bold">⚠ Salah Baca</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500">
                  {new Date(s.detectedAt).toLocaleDateString('ms-MY')}{' '}
                  {new Date(s.detectedAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
