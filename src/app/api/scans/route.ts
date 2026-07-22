import { NextRequest, NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchType = searchParams.get('matchType') as any || undefined;
    const source = searchParams.get('source') as any || undefined;
    const query = searchParams.get('query') || undefined;

    const scans = PlateQRepository.listScans({ matchType, source, query });
    return NextResponse.json({ success: true, count: scans.length, scans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = PlateQRepository.createScanEvent(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (!id || !action) {
      return NextResponse.json({ success: false, error: 'ID dan Tindakan diperlukan' }, { status: 400 });
    }

    if (action === 'CONFIRM') {
      const ok = PlateQRepository.confirmScan(id);
      return NextResponse.json({ success: ok });
    } else if (action === 'REPORT_WRONG') {
      const ok = PlateQRepository.reportWrongScan(id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ success: false, error: 'Tindakan tidak sah' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    PlateQRepository.clearScanHistory();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
