import { NextRequest, NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';
import { parseAndValidateVehiclesCsv } from '@/lib/utils/csv';

export async function POST(request: NextRequest) {
  try {
    const { csvContent } = await request.json();
    if (!csvContent) {
      return NextResponse.json({ success: false, error: 'Fail CSV diperlukan' }, { status: 400 });
    }

    const existingVehicles = PlateQRepository.listVehicles();
    const existingPlatesSet = new Set(existingVehicles.map((v) => v.normalizedPlate));

    const validationResult = parseAndValidateVehiclesCsv(csvContent, existingPlatesSet);

    // Import valid rows into database
    let importedCount = 0;
    const importedVehicles = [];

    for (const validRow of validationResult.validRows) {
      const res = PlateQRepository.createVehicle(validRow);
      if (res.success && res.vehicle) {
        importedCount++;
        importedVehicles.push(res.vehicle);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: validationResult.totalRows,
        importedCount,
        invalidRowsCount: validationResult.invalidRows.length,
        duplicateRowsCount: validationResult.duplicateRows.length,
      },
      invalidRows: validationResult.invalidRows,
      duplicateRows: validationResult.duplicateRows,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
