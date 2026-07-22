'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  Car,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  User,
  Building2,
  FileText,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { VehicleCase, CaseStatus } from '@/lib/db/types';
import { normalizePlate } from '@/lib/anpr/normaliser';

function ManageVehiclesContent() {
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<VehicleCase[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'ALL'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Card Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleCase | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleCase | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    plateNumber: '',
    customerName: '',
    customerReference: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: '',
    vehicleType: 'Sedan',
    chassisNumber: '',
    financeCompany: '',
    outstandingAmount: '',
    caseReference: '',
    status: 'ACTIVE' as CaseStatus,
    notes: '',
  });
  const [formError, setFormError] = useState('');

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      let url = `/api/vehicles?status=${statusFilter}`;
      if (query) url += `&query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setVehicles(data.vehicles);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [query, statusFilter]);

  useEffect(() => {
    if (searchParams.get('action') === 'import') {
      setShowImportModal(true);
    }
  }, [searchParams]);

  const resetForm = () => {
    setFormData({
      plateNumber: '',
      customerName: '',
      customerReference: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleColor: '',
      vehicleYear: '',
      vehicleType: 'Sedan',
      chassisNumber: '',
      financeCompany: '',
      outstandingAmount: '',
      caseReference: '',
      status: 'ACTIVE',
      notes: '',
    });
    setFormError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingVehicle(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (v: VehicleCase) => {
    setEditingVehicle(v);
    setFormData({
      plateNumber: v.plateNumber,
      customerName: v.customerName,
      customerReference: v.customerReference || '',
      vehicleMake: v.vehicleMake,
      vehicleModel: v.vehicleModel,
      vehicleColor: v.vehicleColor,
      vehicleYear: v.vehicleYear ? String(v.vehicleYear) : '',
      vehicleType: v.vehicleType || 'Sedan',
      chassisNumber: v.chassisNumber || '',
      financeCompany: v.financeCompany,
      outstandingAmount: String(v.outstandingAmount),
      caseReference: v.caseReference,
      status: v.status,
      notes: v.notes || '',
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const norm = normalizePlate(formData.plateNumber);
    if (!norm) {
      setFormError('Nombor plat wajib diisi');
      return;
    }
    if (!formData.customerName) {
      setFormError('Nama pelanggan wajib diisi');
      return;
    }
    if (!formData.financeCompany) {
      setFormError('Syarikat kewangan wajib diisi');
      return;
    }

    const amount = parseFloat(formData.outstandingAmount);
    if (isNaN(amount) || amount < 0) {
      setFormError('Jumlah tunggakan tidak sah');
      return;
    }

    const payload = {
      plateNumber: norm,
      customerName: formData.customerName,
      customerReference: formData.customerReference || undefined,
      vehicleMake: formData.vehicleMake || 'Unknown',
      vehicleModel: formData.vehicleModel || 'Unknown',
      vehicleColor: formData.vehicleColor || 'Unknown',
      vehicleYear: formData.vehicleYear ? parseInt(formData.vehicleYear) : undefined,
      vehicleType: formData.vehicleType || 'Sedan',
      chassisNumber: formData.chassisNumber || undefined,
      financeCompany: formData.financeCompany,
      outstandingAmount: amount,
      caseReference: formData.caseReference || `REF-${Date.now()}`,
      status: formData.status,
      notes: formData.notes || undefined,
    };

    try {
      let res;
      if (editingVehicle) {
        res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || 'Gagal menyimpan rekod');
        return;
      }

      setShowAddModal(false);
      fetchVehicles();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!deletingVehicle) return;
    try {
      const res = await fetch(`/api/vehicles/${deletingVehicle.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setDeletingVehicle(null);
        fetchVehicles();
      } else {
        alert(data.error || 'Gagal memadam kenderaan');
      }
    } catch (e) {
      alert('Ralat semasa memadam kenderaan');
    }
  };

  const handleExportCsv = () => {
    window.open(`/api/vehicles/export?query=${encodeURIComponent(query)}&status=${statusFilter}`, '_blank');
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const csvText = evt.target?.result as string;
      if (!csvText) return;

      try {
        const res = await fetch('/api/vehicles/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent: csvText }),
        });
        const data = await res.json();
        if (data.success) {
          setCsvPreview(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <Header />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        {/* Title and Top Actions matching screenshot 3 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Manage Vehicles</h1>
            <p className="text-sm text-slate-400 mt-1">
              Add, edit, import or search target vehicles in repository.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#16181e] text-slate-300 border border-[#252833] rounded-xl hover:text-white hover:border-[#00d8f6]/50 transition-colors"
            >
              <Upload className="w-4 h-4 text-[#00d8f6]" />
              Import CSV
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#16181e] text-slate-300 border border-[#252833] rounded-xl hover:text-white hover:border-[#00d8f6]/50 transition-colors"
            >
              <Download className="w-4 h-4 text-[#00d8f6]" />
              Export CSV
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-[#00d8f6] text-slate-950 rounded-xl hover:bg-[#22e0fb] shadow-md shadow-[#00d8f6]/20 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Add Vehicle
            </button>
          </div>
        </div>

        {/* Search Bar & Filters matching screenshot 3 */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by plate, customer, vehicle or finance company..."
              className="w-full bg-[#16181e] border border-[#252833] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00d8f6] transition-colors"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
              showFilters || statusFilter !== 'ALL'
                ? 'bg-[#00d8f6]/10 text-[#00d8f6] border-[#00d8f6]/40'
                : 'bg-[#16181e] text-slate-300 border-[#252833] hover:border-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters {statusFilter !== 'ALL' && `(${statusFilter})`}
          </button>
        </div>

        {/* Expandable Filter Panel */}
        {showFilters && (
          <div className="bg-[#16181e] border border-[#252833] rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 mr-2">STATUS:</span>
            {['ALL', 'ACTIVE', 'ON_HOLD', 'RECOVERED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  statusFilter === st
                    ? 'bg-[#00d8f6] text-slate-950 border-[#00d8f6]'
                    : 'bg-[#090a0f] text-slate-400 border-[#252833] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-slate-400 mb-4">{vehicles.length} vehicles found</div>

        {/* Vehicle Cards List matching screenshot 3 */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuatkan senarai kenderaan...</div>
        ) : vehicles.length === 0 ? (
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl p-12 text-center text-slate-400">
            Tiada rekod kenderaan dijumpai.
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => {
              const isExpanded = expandedId === v.id;

              return (
                <div
                  key={v.id}
                  className="bg-[#16181e] border border-[#252833] rounded-2xl p-4 sm:p-5 hover:border-[#2f3444] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {/* Plate & Status Badge matching screenshot 3 */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-mono font-extrabold tracking-wider text-white">
                          {v.plateNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
                            v.status === 'ACTIVE'
                              ? 'bg-[#00d8f6]/20 text-[#00d8f6] border border-[#00d8f6]/40'
                              : v.status === 'ON_HOLD'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {v.status === 'ACTIVE' ? 'Active' : v.status === 'ON_HOLD' ? 'On Hold' : v.status}
                        </span>
                      </div>

                      {/* Details Row 1 matching screenshot 3 */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {v.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-500" />
                          {v.vehicleMake} {v.vehicleModel} {v.vehicleColor}
                        </span>
                      </div>

                      {/* Details Row 2 matching screenshot 3 */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {v.financeCompany}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-rose-400">
                          $ RM{v.outstandingAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 font-mono">
                          <FileText className="w-3.5 h-3.5" />
                          {v.caseReference}
                        </span>
                      </div>
                    </div>

                    {/* Right Action Icons matching screenshot 3 */}
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        className="p-2 hover:text-[#00d8f6] hover:bg-[#252833] rounded-lg transition-colors"
                        aria-label="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingVehicle(v)}
                        className="p-2 hover:text-rose-400 hover:bg-[#252833] rounded-lg transition-colors"
                        aria-label="Padam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : v.id)}
                        className="p-2 hover:text-white hover:bg-[#252833] rounded-lg transition-colors"
                        aria-label="Perincian"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[#252833] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-[#0d0e13] p-4 rounded-xl">
                      <div>
                        <span className="text-slate-500 block">ID Pelanggan</span>
                        <span className="text-slate-200 font-mono">{v.customerReference || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tahun / Jenis</span>
                        <span className="text-slate-200">{v.vehicleYear || 'N/A'} ({v.vehicleType || 'Sedan'})</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Nombor Casis</span>
                        <span className="text-slate-200 font-mono">{v.chassisNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tarikh Kes Dibuat</span>
                        <span className="text-slate-200">{new Date(v.createdAt).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Kekerapan Dikesan</span>
                        <span className="text-slate-200">{v.detectionCount || 0} kali</span>
                      </div>
                      {v.notes && (
                        <div className="col-span-full">
                          <span className="text-slate-500 block">Nota Kes:</span>
                          <span className="text-amber-200">{v.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-4">
              {editingVehicle ? 'Edit Rekod Kenderaan' : 'Tambah Kenderaan Baharu'}
            </h2>

            {formError && (
              <div className="bg-rose-950/60 border border-rose-600/60 p-3 rounded-xl text-xs text-rose-300 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">NOMBOR PLAT *</label>
                  <input
                    type="text"
                    required
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                    placeholder="ANN7569"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-sm font-mono text-[#00d8f6] font-bold focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-bold">STATUS KES *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CaseStatus })}
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d8f6]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="RECOVERED">RECOVERED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">NAMA PELANGGAN *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="Ahmad"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">ID PELANGGAN (OPTIONAL)</label>
                  <input
                    type="text"
                    value={formData.customerReference}
                    onChange={(e) => setFormData({ ...formData, customerReference: e.target.value })}
                    placeholder="CUST-001"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">JENAMA *</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleMake}
                    onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                    placeholder="Perodua"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">MODEL *</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleModel}
                    onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    placeholder="Bezza"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">WARNA *</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleColor}
                    onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                    placeholder="White"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">SYARIKAT KEWANGAN *</label>
                  <input
                    type="text"
                    required
                    value={formData.financeCompany}
                    onChange={(e) => setFormData({ ...formData, financeCompany: e.target.value })}
                    placeholder="CIMB / Maybank"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">JUMLAH TUNGGAKAN (RM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.outstandingAmount}
                    onChange={(e) => setFormData({ ...formData, outstandingAmount: e.target.value })}
                    placeholder="15000.00"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-rose-400 font-bold focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">RUJUKAN KES *</label>
                  <input
                    type="text"
                    required
                    value={formData.caseReference}
                    onChange={(e) => setFormData({ ...formData, caseReference: e.target.value })}
                    placeholder="CIMB001"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">TAHUN KENDERAAN</label>
                  <input
                    type="number"
                    value={formData.vehicleYear}
                    onChange={(e) => setFormData({ ...formData, vehicleYear: e.target.value })}
                    placeholder="2021"
                    className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">NOTA KES (OPTIONAL)</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Priority repossession case..."
                  className="w-full bg-[#090a0f] border border-[#252833] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#00d8f6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#090a0f] border border-[#252833] rounded-xl text-slate-300 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00d8f6] text-slate-950 font-bold rounded-xl hover:bg-[#22e0fb]"
                >
                  {editingVehicle ? 'Kemaskini' : 'Simpan Kenderaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181e] border border-rose-600/40 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Padam Rekod Kenderaan?</h3>
            <p className="text-xs text-slate-300 mb-4">
              Adakah anda pasti mahu memadam nombor plat{' '}
              <span className="font-mono font-bold text-rose-400">{deletingVehicle.plateNumber}</span> daripada database?
              Rekod sejarah carian/scan sedia ada akan kekal disimpan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingVehicle(null)}
                className="px-4 py-2 bg-[#090a0f] border border-[#252833] rounded-xl text-xs font-semibold text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteVehicle}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Padam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181e] border border-[#252833] rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowImportModal(false);
                setCsvPreview(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="w-7 h-7 text-[#00d8f6]" />
              <div>
                <h2 className="text-xl font-bold text-white">Import Fail CSV</h2>
                <p className="text-xs text-slate-400">Muat naik fail CSV mengikut format standard.</p>
              </div>
            </div>

            <div className="mb-6 bg-[#090a0f] border border-dashed border-[#252833] rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="hidden"
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 text-[#00d8f6] mb-2" />
                <span className="text-sm font-semibold text-white mb-1">
                  {csvFile ? csvFile.name : 'Pilih fail CSV dari peranti'}
                </span>
                <span className="text-xs text-slate-500">
                  {csvFile ? 'Klik untuk tukar fail' : 'Format: plateNumber, customerName, vehicleMake...'}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between mb-6">
              <a
                href="data:text/csv;charset=utf-8,plateNumber,customerName,vehicleMake,vehicleModel,vehicleColor,financeCompany,outstandingAmount,caseReference,status,notes%0AANN7569,Ahmad,Perodua,Bezza,White,CIMB,15000.00,CIMB001,ACTIVE,Priority%20repossession%20case"
                download="plateq_template.csv"
                className="text-xs text-[#00d8f6] underline hover:text-[#22e0fb]"
              >
                Muat Turun Template CSV
              </a>
            </div>

            {csvPreview && (
              <div className="bg-[#090a0f] p-4 rounded-xl border border-[#252833] text-xs space-y-2 mb-6">
                <div className="flex items-center justify-between font-bold text-white border-b border-[#252833] pb-2">
                  <span>RINGKASAN IMPORT CSV</span>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Jumlah Baris:</span>
                  <span className="font-bold">{csvPreview.summary.totalRows}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Baris Berjaya Diimport:</span>
                  <span className="font-bold">{csvPreview.summary.importedCount}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Baris Tidak Sah:</span>
                  <span className="font-bold">{csvPreview.summary.invalidRowsCount}</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>Duplikasi Dikesan:</span>
                  <span className="font-bold">{csvPreview.summary.duplicateRowsCount}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvPreview(null);
                  fetchVehicles();
                }}
                className="px-5 py-2.5 bg-[#00d8f6] text-slate-950 font-bold rounded-xl hover:bg-[#22e0fb]"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function ManageVehiclesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090a0f] text-slate-400 p-8 text-center">Memuatkan...</div>}>
      <ManageVehiclesContent />
    </Suspense>
  );
}

