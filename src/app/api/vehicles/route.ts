import { NextRequest, NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || undefined;
    const status = searchParams.get('status') as any || undefined;
    const financeCompany = searchParams.get('financeCompany') || undefined;
    const vehicleMake = searchParams.get('vehicleMake') || undefined;

    const vehicles = PlateQRepository.listVehicles({ query, status, financeCompany, vehicleMake });
    return NextResponse.json({ success: true, count: vehicles.length, vehicles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = PlateQRepository.createVehicle(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, vehicle: result.vehicle });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
