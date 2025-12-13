import { NextResponse } from 'next/server';
import { setAssignments } from '@/lib/supabaseStore';
import { AssignmentsSetSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = AssignmentsSetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    await setAssignments(parsed.data.gameCode.trim().toUpperCase(), parsed.data.uid, parsed.data.assignments);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const status = msg === 'NOT_HOST' ? 403 : msg === 'GAME_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
