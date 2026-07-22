import { NextRequest, NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';

export async function POST(request: NextRequest) {
  try {
    const { plateNumber, source = 'MANUAL', confidence = 1.0 } = await request.json();

    if (!plateNumber) {
      return NextResponse.json({ success: false, error: 'Nombor plat carian diperlukan' }, { status: 400 });
    }

    const result = PlateQRepository.searchPlate(plateNumber, source, confidence);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const recentSearches = PlateQRepository.listRecentSearches(10);
    return NextResponse.json({ success: true, searches: recentSearches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
