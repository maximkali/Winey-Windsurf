import { NextResponse } from 'next/server';
import { getGamePublic } from '@/lib/supabaseStore';
import { apiError } from '@/app/api/_utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameCode = url.searchParams.get('gameCode')?.trim().toUpperCase();

    if (!gameCode) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const uid = req.headers.get('x-uid');
    const state = await getGamePublic(gameCode, uid);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e);
  }
}
