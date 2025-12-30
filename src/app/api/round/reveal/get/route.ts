import { NextResponse } from 'next/server';
import { getRoundReveal } from '@/lib/supabaseStore';
import { RoundRevealGetSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const body = {
      gameCode: url.searchParams.get('gameCode'),
      roundId: url.searchParams.get('roundId'),
    };

    const parsed = RoundRevealGetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const uid = req.headers.get('x-uid');
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const data = await getRoundReveal(parsed.data.gameCode.trim().toUpperCase(), parsed.data.roundId, uid);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e);
  }
}


