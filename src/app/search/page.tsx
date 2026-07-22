'use client';

import React, { useState, useEffect } from 'react';
import { Search, AlertOctagon, AlertTriangle, CheckCircle, Copy, Clock, RotateCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { normalizePlate } from '@/lib/anpr/normaliser';
import { VehicleCase, SearchEvent, MatchType } from '@/lib/db/types';

export default function ManualSearchPage() {
  const [inputVal, setInputVal] = useState('');
  const [searching, setSearching] = useState(false);

  const [result, setResult] = useState<{
    searched: boolean;
    matchType: MatchType;
    matchedVehicle: VehicleCase | null;
    possibleMatches: VehicleCase[];
    normalizedPlate: string;
  }>({
    searched: false,
    matchType: 'NONE',
    matchedVehicle: null,
    possibleMatches: [],
    normalizedPlate: '',
  });

  const [recentSearches, setRecentSearches] = useState<SearchEvent[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchRecentSearches = async () => {
    try {
      const res = await fetch('/api/search');
      const data = await res.json();
      if (data.success) {
        setRecentSearches(data.searches || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRecentSearches();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const norm = normalizePlate(raw);
    setInputVal(norm);
  };

  const handleSearch = async (overridePlate?: string) => {
    const plateToSearch = normalizePlate(overridePlate !== undefined ? overridePlate : inputVal);
    if (!plateToSearch) return;

    setSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plateNumber: plateToSearch, source: 'MANUAL' }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({
          searched: true,
          matchType: data.matchType,
          matchedVehicle: data.matchedVehicle,
          possibleMatches: data.possibleMatches || [],
          normalizedPlate: data.normalizedPlate,
        });
        fetchRecentSearches();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-8">
        {/* Title matching screenshot 2 */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Manual Search</h1>
          <p className="text-sm text-slate-400 mt-1">
            Search for a target vehicle by number plate.
          </p>
        </div>

        {/* Big Search Input Box matching screenshot 2 */}
        <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-4 sm:p-5 shadow-lg mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-3"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputVal}
                onChange={handleInputChange}
                placeholder="ENTER PLATE NUMBER, E.G. ANN7569"
                className="w-full bg-[#0d0e12] border border-[#272a36] rounded-xl px-4 py-4 text-lg sm:text-xl font-mono font-bold tracking-wider text-[#00d8f6] placeholder:text-slate-600 focus:outline-none focus:border-[#00d8f6] focus:ring-1 focus:ring-[#00d8f6] uppercase transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !inputVal}
              className="h-[58px] px-6 bg-[#00d8f6] text-slate-950 rounded-xl font-bold hover:bg-[#22e0fb] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0"
              aria-label="Cari"
            >
              {searching ? (
                <div className="w-6 h-6 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-6 h-6 stroke-[2.5]" />
              )}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-2.5 ml-1">
            Letters and numbers only. Spaces and dashes are removed automatically.
          </p>
        </div>

        {/* Search Results Display */}
        {result.searched && (
          <div className="mb-10">
            {result.matchType === 'EXACT' && result.matchedVehicle && (
              <div className="bg-rose-950/40 border-2 border-rose-600 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-rose-700/50 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="w-8 h-8 text-rose-500 animate-pulse" />
                    <div>
                      <span className="text-xs font-black tracking-widest text-rose-400 uppercase">
                        CRITICAL ALERT
                      </span>
                      <h2 className="text-2xl font-black text-rose-100 tracking-tight">MATCH FOUND</h2>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-rose-600 text-white font-mono font-extrabold text-sm rounded-lg">
                    {result.matchedVehicle.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                  <div className="bg-[#090a0f]/60 p-3.5 rounded-xl border border-rose-900/50">
                    <span className="text-xs text-slate-400 block mb-0.5">NOMBOR PLAT</span>
                    <span className="text-2xl font-mono font-extrabold text-white">
                      {result.matchedVehicle.plateNumber}
                    </span>
                  </div>

                  <div className="bg-[#090a0f]/60 p-3.5 rounded-xl border border-rose-900/50">
                    <span className="text-xs text-slate-400 block mb-0.5">NAMA PELANGGAN</span>
                    <span className="text-lg font-bold text-slate-100">
                      {result.matchedVehicle.customerName}
                    </span>
                  </div>

                  <div className="bg-[#090a0f]/60 p-3.5 rounded-xl border border-rose-900/50">
                    <span className="text-xs text-slate-400 block mb-0.5">KENDERAAN</span>
                    <span className="text-base font-semibold text-slate-200">
                      {result.matchedVehicle.vehicleMake} {result.matchedVehicle.vehicleModel} (
                      {result.matchedVehicle.vehicleColor})
                    </span>
                  </div>

                  <div className="bg-[#090a0f]/60 p-3.5 rounded-xl border border-rose-900/50">
                    <span className="text-xs text-slate-400 block mb-0.5">SYARIKAT KEWANGAN</span>
                    <span className="text-base font-semibold text-slate-200">
                      {result.matchedVehicle.financeCompany}
                    </span>
                  </div>

                  <div className="bg-[#090a0f]/60 p-3.5 rounded-xl border border-rose-900/50">
                    <span className="text-xs text-slate-400 block mb-0.5">JUMLAH TUNGGAKAN</span>
                    <span className="text-xl font-bold text-rose-400">
                      RM {result.matchedVehicle.outstandingAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-[#090a0f]/60 p-3.5 rounded-xl border border-rose-900/50">
                    <span className="text-xs text-slate-400 block mb-0.5">RUJUKAN KES</span>
                    <span className="text-base font-mono font-semibold text-slate-200">
                      {result.matchedVehicle.caseReference}
                    </span>
                  </div>
                </div>

                {result.matchedVehicle.notes && (
                  <div className="bg-[#090a0f]/60 p-3 rounded-xl border border-rose-900/40 mb-6 text-xs text-slate-300">
                    <span className="font-bold text-rose-400 block mb-1">NOTA KES:</span>
                    {result.matchedVehicle.notes}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleCopy(result.matchedVehicle!.plateNumber)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-900/50 hover:bg-rose-900 border border-rose-700 rounded-xl text-xs font-bold text-white transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Plat Disalin!' : 'Copy Plate Number'}
                  </button>
                </div>
              </div>
            )}

            {result.matchType === 'POSSIBLE' && result.possibleMatches.length > 0 && (
              <div className="bg-amber-950/40 border-2 border-amber-500/80 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 border-b border-amber-700/50 pb-4 mb-5">
                  <AlertTriangle className="w-7 h-7 text-amber-400" />
                  <div>
                    <span className="text-xs font-black tracking-widest text-amber-400 uppercase">
                      VERIFY VISUALLY
                    </span>
                    <h2 className="text-xl font-bold text-amber-100">POSSIBLE MATCH</h2>
                  </div>
                </div>

                <p className="text-xs text-amber-200 mb-4">
                  Input nombor plat ({result.normalizedPlate}) hampir sepadan dengan kes aktif berikut.
                  Sila semak semula kenderaan secara visual.
                </p>

                <div className="space-y-3">
                  {result.possibleMatches.map((veh) => (
                    <div
                      key={veh.id}
                      className="bg-[#090a0f]/80 p-4 rounded-xl border border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xl font-mono font-bold text-white">{veh.plateNumber}</span>
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-xs font-bold">
                            {veh.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          {veh.customerName} • {veh.vehicleMake} {veh.vehicleModel} ({veh.vehicleColor}) •{' '}
                          {veh.financeCompany}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Tunggakan</span>
                        <span className="text-base font-bold text-rose-400">
                          RM {veh.outstandingAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.matchType === 'NONE' && (
              <div className="bg-[#16181e] border border-emerald-500/30 rounded-2xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white mb-1">NO ACTIVE CASE FOUND</h2>
                <p className="text-sm text-slate-400">
                  Nombor plat <span className="font-mono font-bold text-[#00d8f6]">{result.normalizedPlate}</span> tiada dalam senarai kes aktif repossession.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recent Searches Section matching screenshot 2 */}
        <div>
          <h2 className="text-base font-bold tracking-tight text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00d8f6]" />
            Recent Searches
          </h2>

          {recentSearches.length === 0 ? (
            <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-8 text-center text-slate-500 text-sm">
              No searches have been performed yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentSearches.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#16181e] border border-[#252833] rounded-xl p-4 flex items-center justify-between hover:border-[#2f3444] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-mono font-bold text-white">{s.normalizedPlate}</span>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
                        s.matchType === 'EXACT'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : s.matchType === 'POSSIBLE'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {s.matchType}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      {new Date(s.searchedAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => {
                        setInputVal(s.normalizedPlate);
                        handleSearch(s.normalizedPlate);
                      }}
                      className="p-2 text-[#00d8f6] hover:bg-[#00d8f6]/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Search again
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
