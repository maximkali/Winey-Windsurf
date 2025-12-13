import { NextResponse } from 'next/server';
import { joinGame } from '@/lib/supabaseStore';
import { JoinGameSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = JoinGameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const gameCode = parsed.data.gameCode.trim().toUpperCase();
    const { uid } = await joinGame(gameCode, parsed.data.playerName);
    return NextResponse.json({ uid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'GAME_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
