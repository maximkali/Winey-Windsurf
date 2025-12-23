import { NextResponse } from 'next/server';
import { advanceRound } from '@/lib/supabaseStore';
import { RoundHostActionSchema } from '@/lib/validations';
import { apiError } from '@/app/api/_utils';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RoundHostActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const res = await advanceRound(parsed.data.gameCode.trim().toUpperCase(), parsed.data.uid);
    return NextResponse.json(res);
  } catch (e) {
    return apiError(e);
  }
}
