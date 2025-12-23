import { NextResponse } from 'next/server';
import { closeRound } from '@/lib/supabaseStore';
import { RoundHostActionSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RoundHostActionSchema.safeParse(body);
    if (!parsed.success || !parsed.data.roundId) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    await closeRound(parsed.data.gameCode.trim().toUpperCase(), parsed.data.uid, parsed.data.roundId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
