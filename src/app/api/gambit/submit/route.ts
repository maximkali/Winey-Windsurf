import { NextResponse } from 'next/server';
import { submitGambit } from '@/lib/supabaseStore';
import { GambitSubmitSchema } from '@/lib/validations';
import { apiError, assertRequestUidMatches } from '@/app/api/_utils';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = GambitSubmitSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    assertRequestUidMatches(req, parsed.data.uid);
    const gameCode = parsed.data.gameCode.trim().toUpperCase();
    await submitGambit(
      gameCode,
      parsed.data.uid,
      parsed.data.cheapestWineId,
      parsed.data.mostExpensiveWineId,
      parsed.data.favoriteWineIds
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}


