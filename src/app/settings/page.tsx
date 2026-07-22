'use client';

import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Camera, Sliders, Database, RotateCcw, Save, ShieldAlert } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { ScannerSettings } from '@/lib/db/types';
import { INITIAL_SETTINGS } from '@/lib/db/settingsDefaults';

export default function SettingsPage() {
  const [settings, setSettings] = useState<ScannerSettings>({ ...INITIAL_SETTINGS });

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2500);
      }
    } catch (e) {
      alert('Gagal menyimpan tetapan.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    if (confirm('Adakah anda pasti mahu mereset semula data demo ke asal?')) {
      await fetch('/api/demo', { method: 'POST' });
      alert('Data demo telah di-reset.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <Header />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-[#00d8f6]" />
              Settings
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure camera, AI detection thresholds, sound, and data settings.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00d8f6] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#22e0fb] shadow-lg shadow-[#00d8f6]/20 transition-all"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            {saving ? 'Simpan...' : 'Save Settings'}
          </button>
        </div>

        {savedMsg && (
          <div className="bg-emerald-950/60 border border-emerald-500/50 p-3 rounded-xl text-xs text-emerald-300 mb-6 text-center font-bold">
            ✓ Tetapan berjaya disimpan!
          </div>
        )}

        <div className="space-y-6 text-xs">
          {/* Scanner Settings */}
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-6">
            <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#00d8f6]" />
              Tetapan Kamera & Detection
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Resolusi Kamera</label>
                  <select
                    value={settings.preferredResolution}
                    onChange={(e) => setSettings({ ...settings, preferredResolution: e.target.value as any })}
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="720p">720p HD (Disyorkan)</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="480p">480p SD (Peranti perlahan)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Mod Scanner</label>
                  <select
                    value={settings.scannerMode}
                    onChange={(e) => setSettings({ ...settings, scannerMode: e.target.value as any })}
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="MULTI_VEHICLE">Multi-Vehicle Full Frame (Disyorkan)</option>
                    <option value="SINGLE_TARGET">Single Target (Legasi)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
                    className="w-4 h-4 accent-[#00d8f6]"
                  />
                  <span className="text-slate-200 font-semibold">Bunyi Amaran Alert</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.vibrationEnabled}
                    onChange={(e) => setSettings({ ...settings, vibrationEnabled: e.target.checked })}
                    className="w-4 h-4 accent-[#00d8f6]"
                  />
                  <span className="text-slate-200 font-semibold">Getaran (Vibration)</span>
                </label>
              </div>
            </div>
          </div>

          {/* AI & Consensus Thresholds */}
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-6">
            <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00d8f6]" />
              Ambang Ambang AI (Thresholds)
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Duplicate Alert Cooldown</span>
                  <span className="font-mono text-[#00d8f6] font-bold">{settings.duplicateCooldown} saat</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={settings.duplicateCooldown}
                  onChange={(e) => setSettings({ ...settings, duplicateCooldown: parseInt(e.target.value) })}
                  className="w-full accent-[#00d8f6]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Minimum Consensus Undi</span>
                  <span className="font-mono text-[#00d8f6] font-bold">{settings.consensusVotes} undi</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="5"
                  step="1"
                  value={settings.consensusVotes}
                  onChange={(e) => setSettings({ ...settings, consensusVotes: parseInt(e.target.value) })}
                  className="w-full accent-[#00d8f6]"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.debugMode}
                    onChange={(e) => setSettings({ ...settings, debugMode: e.target.checked })}
                    className="w-4 h-4 accent-[#00d8f6]"
                  />
                  <span className="text-slate-200 font-semibold">Tunjukkan Mod Debug (FPS / Detection Time)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Database & System Reset */}
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-6">
            <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-[#00d8f6]" />
              Pengurusan Data & Reset
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleResetDemo}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#090a0f] border border-[#252833] hover:border-slate-700 text-slate-200 rounded-xl font-semibold"
              >
                <RotateCcw className="w-4 h-4 text-[#00d8f6]" />
                Reset Demo Data Sedia Ada
              </button>
            </div>
          </div>

          {/* Legal Disclaimer matching specification */}
          <div className="bg-[#090a0f] border border-amber-500/30 p-4 rounded-xl text-[11px] text-amber-200/80 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Penafian Undang-undang:</strong> PlateQ ialah alat Proof-of-Concept. Semua nombor plat yang
              dikesan dan padanan mungkin hendaklah disahkan secara visual sebelum sebarang tindakan repossession diambil.
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
