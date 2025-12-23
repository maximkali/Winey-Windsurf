import { NextResponse } from 'next/server';
import { startGame } from '@/lib/supabaseStore';
import { StartGameSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

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
    return apiError(e);
  }
}
