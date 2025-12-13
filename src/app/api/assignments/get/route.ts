import { NextResponse } from 'next/server';
import { getAssignments } from '@/lib/supabaseStore';
import { AssignmentsGetSchema } from '@/lib/validations';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = AssignmentsGetSchema.safeParse({ gameCode: url.searchParams.get('gameCode') });
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const assignments = await getAssignments(parsed.data.gameCode.trim().toUpperCase());
    return NextResponse.json({ assignments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'GAME_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
