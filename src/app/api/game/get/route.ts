import { NextResponse } from 'next/server';
import { getGamePublic } from '@/lib/supabaseStore';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameCode = url.searchParams.get('gameCode')?.trim().toUpperCase();

    if (!gameCode) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const uid = req.headers.get('x-uid');
    const state = await getGamePublic(gameCode, uid);
    return NextResponse.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'NOT_IN_GAME' ? 403 : msg === 'GAME_NOT_FOUND' ? 404 : 400;
    const error = msg === 'NOT_IN_GAME' ? 'You were removed from the lobby.' : msg;
    return NextResponse.json({ error }, { status });
  }
}
