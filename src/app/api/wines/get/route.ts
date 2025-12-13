import { NextResponse } from 'next/server';
import { listWines } from '@/lib/supabaseStore';
import { WinesGetSchema } from '@/lib/validations';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = WinesGetSchema.safeParse({ gameCode: url.searchParams.get('gameCode') });
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const wines = await listWines(parsed.data.gameCode.trim().toUpperCase());
    return NextResponse.json({ wines });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'GAME_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
