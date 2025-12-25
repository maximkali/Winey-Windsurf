import { NextResponse } from 'next/server';
import { getGambitState } from '@/lib/supabaseStore';
import { GambitOptionsGetSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = GambitOptionsGetSchema.safeParse({ gameCode: url.searchParams.get('gameCode') });
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const uid = req.headers.get('x-uid');
    if (!uid) throw new Error('UNAUTHORIZED');

    const res = await getGambitState(parsed.data.gameCode.trim().toUpperCase(), uid);
    return NextResponse.json(res);
  } catch (e) {
    return apiError(e);
  }
}


