import { NextResponse } from 'next/server';
import { getRound } from '@/lib/supabaseStore';
import { RoundGetSchema } from '@/lib/validations';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const body = {
      gameCode: url.searchParams.get('gameCode'),
      roundId: url.searchParams.get('roundId'),
    };

    const parsed = RoundGetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const uid = req.headers.get('x-uid');
    const round = await getRound(parsed.data.gameCode.trim().toUpperCase(), parsed.data.roundId, uid);
    return NextResponse.json(round);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'GAME_NOT_FOUND' || msg === 'ROUND_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
