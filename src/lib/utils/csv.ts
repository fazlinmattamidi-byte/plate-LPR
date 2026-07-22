import Papa from 'papaparse';
import { VehicleCase, CaseStatus } from '../db/types';
import { normalizePlate } from '../anpr/normaliser';

export interface CsvImportRow {
  plateNumber?: string;
  customerName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  financeCompany?: string;
  outstandingAmount?: string | number;
  caseReference?: string;
  status?: string;
  notes?: string;
}

export interface CsvValidationResult {
  totalRows: number;
  validRows: Array<Omit<VehicleCase, 'id' | 'createdAt' | 'updatedAt' | 'normalizedPlate'>>;
  invalidRows: Array<{ rowNumber: number; data: CsvImportRow; reason: string }>;
  duplicateRows: Array<{ rowNumber: number; plateNumber: string; reason: string }>;
}

export function parseAndValidateVehiclesCsv(
  csvContent: string,
  existingNormalizedPlates: Set<string>
): CsvValidationResult {
  const parsed = Papa.parse<CsvImportRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const validRows: Array<Omit<VehicleCase, 'id' | 'createdAt' | 'updatedAt' | 'normalizedPlate'>> = [];
  const invalidRows: Array<{ rowNumber: number; data: CsvImportRow; reason: string }> = [];
  const duplicateRows: Array<{ rowNumber: number; plateNumber: string; reason: string }> = [];

  const seenInCsv = new Set<string>();

  parsed.data.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1

    const rawPlate = row.plateNumber || (row as any)['Nombor Plat'] || '';
    const normalized = normalizePlate(rawPlate);

    if (!normalized) {
      invalidRows.push({
        rowNumber: rowNum,
        data: row,
        reason: 'Nombor plat tidak sah atau kosong',
      });
      return;
    }

    if (seenInCsv.has(normalized)) {
      duplicateRows.push({
        rowNumber: rowNum,
        plateNumber: rawPlate,
        reason: 'Duplikasi nombor plat dalam fail CSV',
      });
      return;
    }

    if (existingNormalizedPlates.has(normalized)) {
      duplicateRows.push({
        rowNumber: rowNum,
        plateNumber: rawPlate,
        reason: `Nombor plat ${normalized} sudah wujud dalam database`,
      });
      return;
    }

    const customerName = (row.customerName || (row as any)['Nama Pelanggan'] || 'N/A').trim();
    const vehicleMake = (row.vehicleMake || (row as any)['Jenama'] || 'Unknown').trim();
    const vehicleModel = (row.vehicleModel || (row as any)['Model'] || 'Unknown').trim();
    const vehicleColor = (row.vehicleColor || (row as any)['Warna'] || 'Unknown').trim();
    const financeCompany = (row.financeCompany || (row as any)['Syarikat Kewangan'] || 'N/A').trim();
    const caseReference = (row.caseReference || (row as any)['Rujukan Kes'] || `REF-${Date.now()}`).trim();
    const notes = (row.notes || (row as any)['Nota'] || '').trim();

    const rawAmount = row.outstandingAmount || (row as any)['Jumlah Tunggakan'] || '0';
    const amountNum = parseFloat(String(rawAmount).replace(/[^0-9.]/g, ''));

    if (isNaN(amountNum) || amountNum < 0) {
      invalidRows.push({
        rowNumber: rowNum,
        data: row,
        reason: 'Jumlah tunggakan tidak sah',
      });
      return;
    }

    const statusRaw = (row.status || 'ACTIVE').toUpperCase().trim();
    const validStatuses: CaseStatus[] = ['ACTIVE', 'ON_HOLD', 'RECOVERED', 'CLOSED'];
    const status: CaseStatus = validStatuses.includes(statusRaw as CaseStatus)
      ? (statusRaw as CaseStatus)
      : 'ACTIVE';

    seenInCsv.add(normalized);

    validRows.push({
      plateNumber: normalized,
      customerName,
      vehicleMake,
      vehicleModel,
      vehicleColor,
      financeCompany,
      outstandingAmount: amountNum,
      caseReference,
      status,
      notes,
    });
  });

  return {
    totalRows: parsed.data.length,
    validRows,
    invalidRows,
    duplicateRows,
  };
}

export function generateVehiclesCsvTemplate(): string {
  const headers = [
    'plateNumber',
    'customerName',
    'vehicleMake',
    'vehicleModel',
    'vehicleColor',
    'financeCompany',
    'outstandingAmount',
    'caseReference',
    'status',
    'notes',
  ];
  const sampleRow = [
    'ANN7569',
    'Ahmad',
    'Perodua',
    'Bezza',
    'White',
    'CIMB',
    '15000.00',
    'CIMB001',
    'ACTIVE',
    'Priority repossession case',
  ];

  return Papa.unparse([headers, sampleRow]);
}

export function exportVehiclesToCsv(vehicles: VehicleCase[]): string {
  const data = vehicles.map((v) => ({
    plateNumber: v.plateNumber,
    customerName: v.customerName,
    vehicleMake: v.vehicleMake,
    vehicleModel: v.vehicleModel,
    vehicleColor: v.vehicleColor,
    financeCompany: v.financeCompany,
    outstandingAmount: v.outstandingAmount,
    caseReference: v.caseReference,
    status: v.status,
    notes: v.notes || '',
    createdAt: v.createdAt,
  }));

  return Papa.unparse(data);
}
