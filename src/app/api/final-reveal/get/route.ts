import { NextResponse } from 'next/server';
import { getFinalReveal } from '@/lib/supabaseStore';
import { FinalRevealGetSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const body = {
      gameCode: url.searchParams.get('gameCode'),
    };

    const parsed = FinalRevealGetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const uid = req.headers.get('x-uid');
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const data = await getFinalReveal(parsed.data.gameCode.trim().toUpperCase(), uid.trim());
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e);
  }
}


