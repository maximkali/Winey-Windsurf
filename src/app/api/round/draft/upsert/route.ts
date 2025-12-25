import { NextResponse } from 'next/server';
import { upsertRoundDraft } from '@/lib/supabaseStore';
import { RoundDraftUpsertSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RoundDraftUpsertSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const gameCode = parsed.data.gameCode.trim().toUpperCase();
    await upsertRoundDraft(gameCode, parsed.data.roundId, parsed.data.uid, parsed.data.notes, parsed.data.ranking);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}


