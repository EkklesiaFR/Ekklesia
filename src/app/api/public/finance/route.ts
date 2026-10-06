import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { readPublicFinance } from '@/lib/server/finance/finance-read-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await readPublicFinance(getAdminDb());
    return NextResponse.json(data, { status: data.status === 'unavailable' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
