import { NextResponse } from 'next/server';
import { submitRound } from '@/lib/supabaseStore';
import { RoundSubmitSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RoundSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    await submitRound(
      parsed.data.gameCode.trim().toUpperCase(),
      parsed.data.roundId,
      parsed.data.uid,
      parsed.data.notes,
      parsed.data.ranking
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'NOT_IN_GAME' ? 403 : msg === 'GAME_NOT_FOUND' || msg === 'ROUND_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
