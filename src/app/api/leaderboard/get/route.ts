import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/supabaseStore';
import { apiError } from '@/app/api/_utils';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameCode = url.searchParams.get('gameCode')?.trim().toUpperCase();

    if (!gameCode) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const uid = req.headers.get('x-uid');
    const data = await getLeaderboard(gameCode, uid);
    return NextResponse.json(data);
  } catch (e) {
    return apiError(e);
  }
}
