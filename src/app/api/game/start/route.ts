import { NextResponse } from 'next/server';
import { startGame } from '@/lib/supabaseStore';
import { StartGameSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = StartGameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    await startGame(parsed.data.gameCode.trim().toUpperCase(), parsed.data.uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'NOT_HOST' ? 403 : msg === 'GAME_NOT_FOUND' ? 404 : msg === 'WINE_LIST_INCOMPLETE' ? 409 : 400;
    const error =
      msg === 'WINE_LIST_INCOMPLETE'
        ? 'Please complete your Wine List (matching your Setup Tasting bottle count) before starting the game.'
        : msg;
    return NextResponse.json({ error }, { status });
  }
}
