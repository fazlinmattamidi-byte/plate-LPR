import { NextRequest, NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';
import { exportVehiclesToCsv } from '@/lib/utils/csv';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || undefined;
    const status = searchParams.get('status') as any || undefined;
    const financeCompany = searchParams.get('financeCompany') || undefined;

    const vehicles = PlateQRepository.listVehicles({ query, status, financeCompany });
    const csvContent = exportVehiclesToCsv(vehicles);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="plateq_vehicles_${new Date().toISOString().substring(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
