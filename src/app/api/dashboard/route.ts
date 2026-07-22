import { NextResponse } from 'next/server';
import { PlateQRepository } from '@/lib/db/repository';

export async function GET() {
  try {
    const stats = PlateQRepository.getDashboardStats();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
