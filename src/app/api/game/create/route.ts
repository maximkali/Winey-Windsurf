import { NextResponse } from 'next/server';
import { createGame } from '@/lib/supabaseStore';
import { CreateGameSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

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
    return apiError(e);
  }
}
