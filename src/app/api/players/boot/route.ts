import { NextResponse } from 'next/server';
import { bootPlayer } from '@/lib/supabaseStore';
import { BootPlayerSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BootPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    await bootPlayer(
      parsed.data.gameCode.trim().toUpperCase(),
      parsed.data.uid,
      parsed.data.playerUid
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'NOT_HOST' ? 403 : msg === 'GAME_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
