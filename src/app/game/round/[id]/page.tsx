'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTextarea } from '@/components/winey/fields';

type RoundState = {
  gameCode: string;
  roundId: number;
  totalRounds: number;
  bottlesPerRound: number;
  wineNicknames: string[];
  state: 'open' | 'closed';
  isHost: boolean;
  submissionsCount: number;
  mySubmission: { uid: string; notes: string; ranking: string[]; submittedAt: number } | null;
};

export default function RoundPage() {
  const params = useParams();
  const router = useRouter();

  const roundId = useMemo(() => {
    const raw = params?.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const num = Number(value);
    return Number.isFinite(num) ? num : 1;
  }, [params]);

  const [data, setData] = useState<RoundState | null>(null);
  const [notes, setNotes] = useState<string[]>(['', '', '', '']);
  const [rankingText, setRankingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const gameCode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  }, []);

  const uid = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<RoundState>(
          `/api/round/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(roundId))}`
        );
        if (cancelled) return;
        setData(s);
        setError(null);

        if (s.mySubmission) {
          try {
            const parsed = JSON.parse(s.mySubmission.notes) as unknown;
            if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
              setNotes(normalizeNotes(parsed as string[], s.bottlesPerRound ?? 4));
            } else {
              setNotes(normalizeNotes([s.mySubmission.notes], s.bottlesPerRound ?? 4));
            }
          } catch {
            setNotes(normalizeNotes([s.mySubmission.notes], s.bottlesPerRound ?? 4));
          }
          setRankingText(s.mySubmission.ranking.join(', '));
        } else {
          setNotes((prev) => normalizeNotes(prev, s.bottlesPerRound ?? 4));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load round');
      }
    }

    tick();
    const id = window.setInterval(tick, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, roundId]);

  async function onSubmit() {
    if (!gameCode || !uid) return;
    setLoading(true);
    setError(null);

    const ranking = rankingText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await apiFetch<{ ok: true }>(`/api/round/submit`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid, notes: JSON.stringify(notes), ranking }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  async function onAdminCloseAndProceed() {
    if (!gameCode || !uid) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/round/close`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid }),
      });

      const res = await apiFetch<{ ok: true; finished: boolean; nextRound: number | null }>(
        `/api/round/advance`,
        {
          method: 'POST',
          body: JSON.stringify({ gameCode, uid }),
        }
      );

      if (res.finished) router.push('/game/leaderboard');
      else if (res.nextRound) router.push(`/game/round/${res.nextRound}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to proceed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#b08a3c]">
                Round {roundId} / {data?.totalRounds ?? 5}
              </p>
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 space-y-3">
              {Array.from({ length: data?.bottlesPerRound ?? 4 }, (_, idx) => idx + 1).map((n) => (
                <div key={n} className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold">{data?.wineNicknames?.[n - 1] || 'Nickname'}</p>
                    <span className="rounded-[4px] border border-[#2f2f2f] bg-white px-2 py-[2px] text-[10px] font-semibold">
                      {data?.state === 'closed' ? '✓' : '$$'}
                    </span>
                  </div>
                  <WineyTextarea
                    value={notes[n - 1] ?? ''}
                    onChange={(e) =>
                      setNotes((prev) => {
                        const next = [...prev];
                        next[n - 1] = e.target.value;
                        return next;
                      })
                    }
                    className="mt-2 min-h-[72px]"
                    disabled={data?.state === 'closed'}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              {data?.isHost ? (
                <Button className="w-full py-3" onClick={onAdminCloseAndProceed} disabled={loading}>
                  (Admin) Close Round &amp; Proceed
                </Button>
              ) : (
                <Button
                  className="w-full py-3"
                  onClick={onSubmit}
                  disabled={loading || data?.state === 'closed' || !!data?.mySubmission}
                >
                  Done ✅
                </Button>
              )}
            </div>

            <div className="mt-3 text-center">
              {data?.isHost ? (
                <Link href="/game/leaderboard" className="text-[11px] text-blue-700 underline">
                  (Admin) View Leaderboard
                </Link>
              ) : null}
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}

function normalizeNotes(input: string[], length: number) {
  const len = Number.isFinite(length) && length > 0 ? length : 4;
  const out = input.slice(0, len);
  while (out.length < len) out.push('');
  return out;
}
