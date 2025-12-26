import { NextResponse } from 'next/server';
import { upsertWines } from '@/lib/supabaseStore';
import { WinesUpsertSchema } from '@/lib/validations';
import { apiError, assertRequestUidMatches } from '@/app/api/_utils';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = WinesUpsertSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    assertRequestUidMatches(req, parsed.data.uid);
    await upsertWines(parsed.data.gameCode.trim().toUpperCase(), parsed.data.uid, parsed.data.wines);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
