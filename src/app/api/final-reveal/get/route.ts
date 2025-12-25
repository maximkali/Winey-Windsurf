import { NextResponse } from 'next/server';
import { getFinalRevealExport } from '@/lib/supabaseStore';
import { FinalRevealGetSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = FinalRevealGetSchema.safeParse({ gameCode: url.searchParams.get('gameCode') });
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const uid = req.headers.get('x-uid');
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const data = await getFinalRevealExport(parsed.data.gameCode.trim().toUpperCase(), uid);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e);
  }
}


