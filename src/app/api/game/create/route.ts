import { NextResponse } from 'next/server';
import { createGame } from '@/lib/supabaseStore';
import { CreateGameSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateGameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const { gameCode, hostUid } = await createGame(parsed.data.hostName, parsed.data.totalRounds, {
      players: parsed.data.players,
      bottles: parsed.data.bottles,
      bottlesPerRound: parsed.data.bottlesPerRound,
      bottleEqPerPerson: parsed.data.bottleEqPerPerson,
      ozPerPersonPerBottle: parsed.data.ozPerPersonPerBottle,
    });
    return NextResponse.json({ gameCode, hostUid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'SUPABASE_NOT_CONFIGURED' ? 500 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
