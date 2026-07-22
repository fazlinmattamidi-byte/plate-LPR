import { NextRequest, NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';

export async function POST() {
  try {
    PlateQRepository.resetDemoData();
    return NextResponse.json({ success: true, message: 'Data demo telah di-reset semula' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
