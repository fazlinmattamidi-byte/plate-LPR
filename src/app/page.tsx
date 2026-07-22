'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Database,
  Activity,
  CheckCircle2,
  Search,
  Camera,
  AlertTriangle,
  Calendar,
  Car,
  FileSpreadsheet,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardStats } from '@/lib/db/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    activeCases: 0,
    matchesFound: 0,
    manualSearches: 0,
    cameraScans: 0,
    possibleMatches: 0,
    scansToday: 0,
  });

  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Gagal memuatkan statistik:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleResetDemo = async () => {
    if (confirm('Adakah anda pasti mahu mereset semula data demo? Semua rekod carian dan scan akan dipadamkan.')) {
      try {
        const res = await fetch('/api/demo', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          fetchStats();
          alert('Data demo telah berjaya di-reset.');
        }
      } catch (e) {
        alert('Ralat semasa mereset data demo.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <Header />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-8">
        {/* Title & Subtext matching screenshot */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Overview</h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitor system activity and database statistics.
            </p>
          </div>

          <button
            onClick={handleResetDemo}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-[#16181e] border border-[#252833] rounded-lg hover:text-white hover:border-[#00d8f6]/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data
          </button>
        </div>

        {/* 7 Stat Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
          <StatCard title="TOTAL VEHICLES" value={loading ? '...' : stats.totalVehicles} icon={Database} />
          <StatCard
            title="ACTIVE CASES"
            value={loading ? '...' : stats.activeCases}
            icon={Activity}
            accentColor="text-[#00d8f6]"
          />
          <StatCard
            title="MATCHES FOUND"
            value={loading ? '...' : stats.matchesFound}
            icon={CheckCircle2}
            accentColor="text-emerald-400"
          />
          <StatCard title="MANUAL SEARCHES" value={loading ? '...' : stats.manualSearches} icon={Search} />
          <StatCard title="CAMERA SCANS" value={loading ? '...' : stats.cameraScans} icon={Camera} />
          <StatCard
            title="POSSIBLE MATCHES"
            value={loading ? '...' : stats.possibleMatches}
            icon={AlertTriangle}
            accentColor="text-amber-400"
          />
          <StatCard title="SCANS TODAY" value={loading ? '...' : stats.scansToday} icon={Calendar} />
        </div>

        {/* Quick Actions matching screenshot */}
        <div>
          <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4">
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Action Button - Camera Scanner */}
            <Link
              href="/scanner"
              className="md:col-span-1 flex flex-col items-center justify-center p-8 rounded-2xl bg-[#00d8f6] text-slate-950 shadow-lg shadow-[#00d8f6]/20 transition-all hover:bg-[#22e0fb] hover:scale-[1.01] active:scale-[0.99] group"
            >
              <Camera className="w-10 h-10 mb-3 stroke-[2.2] transition-transform group-hover:scale-110" />
              <span className="text-base font-extrabold tracking-wide">Camera Scanner</span>
            </Link>

            {/* Manual Search */}
            <Link
              href="/search"
              className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[#16181e] border border-[#252833] text-slate-200 transition-all hover:border-[#2f3444] hover:bg-[#1b1e27] hover:scale-[1.01] active:scale-[0.99] group"
            >
              <Search className="w-9 h-9 mb-3 text-[#00d8f6] transition-transform group-hover:scale-110" />
              <span className="text-base font-bold">Manual Search</span>
            </Link>

            {/* Manage Vehicles */}
            <Link
              href="/manage"
              className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[#16181e] border border-[#252833] text-slate-200 transition-all hover:border-[#2f3444] hover:bg-[#1b1e27] hover:scale-[1.01] active:scale-[0.99] group"
            >
              <Car className="w-9 h-9 mb-3 text-[#00d8f6] transition-transform group-hover:scale-110" />
              <span className="text-base font-bold">Manage Vehicles</span>
            </Link>

            {/* Additional Quick Actions */}
            <Link
              href="/manage?action=import"
              className="flex items-center gap-3 p-4 rounded-xl bg-[#16181e] border border-[#252833] text-slate-300 hover:border-[#00d8f6]/50 hover:text-white transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5 text-[#00d8f6]" />
              <span className="text-sm font-semibold">Import CSV Data</span>
            </Link>

            <Link
              href="/history"
              className="flex items-center gap-3 p-4 rounded-xl bg-[#16181e] border border-[#252833] text-slate-300 hover:border-[#00d8f6]/50 hover:text-white transition-colors"
            >
              <History className="w-5 h-5 text-[#00d8f6]" />
              <span className="text-sm font-semibold">Scan & Search History</span>
            </Link>


          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
