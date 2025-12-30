import { NextResponse } from 'next/server';
import { listWines } from '@/lib/supabaseStore';
import { WinesGetSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = WinesGetSchema.safeParse({ gameCode: url.searchParams.get('gameCode') });
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const uid = req.headers.get('x-uid');
    if (!uid) throw new Error('UNAUTHORIZED');

    const wines = await listWines(parsed.data.gameCode.trim().toUpperCase(), uid);
    return NextResponse.json({ wines });
  } catch (e) {
    return apiError(e);
  }
}
