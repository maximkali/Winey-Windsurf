'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';

type GameState = {
  gameCode: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  players: Array<{ uid: string; name: string; joinedAt: number }>;
  isHost: boolean;
};

type RoundProgress = {
  roundId: number;
  submissionsCount: number;
  playersDoneCount?: number;
  playersTotalCount?: number;
  submittedUids?: string[];
  submittedAtByUid?: Record<string, number> | null;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
    return;
  } catch {
    // ignore
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

export default function ManagePlayersPage() {
  const router = useRouter();
  const { gameCode, uid } = useUrlBackedIdentity();

  const [state, setState] = useState<GameState | null>(null);
  const [roundProgress, setRoundProgress] = useState<RoundProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [bootingUid, setBootingUid] = useState<string | null>(null);
  const [confirmBootUid, setConfirmBootUid] = useState<string | null>(null);

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const [fromHref] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    return from && from.startsWith('/') ? from : null;
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (cancelled) return;
        setState(s);
        setError(null);

        if (s.isHost) {
          try {
            const rp = await apiFetch<RoundProgress>(
              `/api/round/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(s.currentRound))}`
            );
            if (cancelled) return;
            setRoundProgress(rp);
          } catch {
            // Round progress is a nice-to-have; don't block the page if it fails.
            if (cancelled) return;
            setRoundProgress(null);
          }
        } else {
          setRoundProgress(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    }

    load();
    const id = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode]);

  async function onBoot(playerUid: string) {
    if (!gameCode || !uid) return;
    setError(null);
    setBootingUid(playerUid);
    try {
      await apiFetch<{ ok: true }>(`/api/players/boot`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid, playerUid }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to boot');
    } finally {
      setBootingUid(null);
    }
  }

  async function onCopyPlayerLink(playerUid: string) {
    if (!gameCode) return;
    const normalized = gameCode.trim().toUpperCase();
    const url = `${window.location.origin}/player/lobby?gameCode=${encodeURIComponent(normalized)}&uid=${encodeURIComponent(playerUid)}`;
    setError(null);
    try {
      await copyText(url);
      setCopiedUid(playerUid);
      window.setTimeout(() => setCopiedUid((prev) => (prev === playerUid ? null : prev)), 1200);
    } catch {
      setError('Failed to copy link');
    }
  }

  function onBackToLatestRound() {
    if (!gameCode) {
      router.back();
      return;
    }

    // If we came from a specific round, prefer returning there.
    if (fromHref && fromHref.startsWith('/game/round/')) {
      router.push(fromHref);
      return;
    }

    const round = state?.currentRound ?? 1;
    if (qs) router.push(`/game/round/${round}?${qs}`);
    else router.push(`/game/round/${round}?gameCode=${encodeURIComponent(gameCode)}`);
  }

  if (error === 'You were removed from the lobby.') {
    return (
      <WineyShell maxWidthClassName="max-w-[860px]">
        <main className="pt-6">
          <div className="mx-auto w-full max-w-[480px]">
            <WineyCard className="px-5 py-5">
              <div className="text-center">
                <h1 className="text-[18px] font-semibold">Manage Players</h1>
                <p className="mt-1 text-[11px] text-[#3d3d3d]">You’re no longer in this game.</p>
              </div>
              <div className="mt-4 text-center">
                {gameCode ? (
                  <Link href={`/player/join?gameCode=${encodeURIComponent(gameCode)}`} className="text-[11px] text-blue-700 underline">
                    Rejoin
                  </Link>
                ) : (
                  <button type="button" onClick={() => router.back()} className="text-[11px] text-blue-700 underline">
                    Back
                  </button>
                )}
              </div>
            </WineyCard>
          </div>
        </main>
      </WineyShell>
    );
  }

  const isHost = !!state?.isHost;
  const confirmBootPlayer = confirmBootUid ? (state?.players ?? []).find((p) => p.uid === confirmBootUid) ?? null : null;
  const submittedSet = useMemo(() => new Set(roundProgress?.submittedUids ?? []), [roundProgress?.submittedUids]);
  const doneCount = roundProgress?.playersDoneCount ?? roundProgress?.submissionsCount ?? null;
  const totalCount = roundProgress?.playersTotalCount ?? null;

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[560px] space-y-4">
          <WineyCard className="px-6 py-5">
            <div className="text-center">
              <h1 className="text-[18px] font-semibold">Manage Players</h1>
              <p className="mt-1 text-[11px] text-[#3d3d3d]">Copy a player’s rejoin link or remove them from the game.</p>
            </div>

            {!isHost ? (
              <div className="mt-4 rounded-[4px] border border-[#2f2f2f] bg-[#f4f1ea] px-4 py-3 text-center">
                <p className="text-[12px] font-semibold">Admin access only.</p>
                <p className="mt-1 text-[11px] text-[#3d3d3d]">Open this from the host account.</p>
              </div>
            ) : null}

            {isHost ? (
              <div className="mt-4 rounded-[4px] border border-[#2f2f2f] bg-[#f4f1ea] px-4 py-3 text-center">
                <p className="text-[12px] font-semibold">Round {state?.currentRound ?? '—'} progress</p>
                <p className="mt-1 text-[11px] text-[#3d3d3d]">
                  {typeof doneCount === 'number' ? doneCount : '—'}/{typeof totalCount === 'number' ? totalCount : '—'} players submitted
                </p>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 rounded-[4px] border border-[#2f2f2f] bg-white">
              {(state?.players ?? []).map((p) => {
                const isMe = !!uid && p.uid === uid;
                const submitted = !isMe && isHost ? submittedSet.has(p.uid) : false;
                return (
                  <div
                    key={p.uid}
                    className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#2f2f2f] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[12px] font-semibold truncate">{p.name}</p>
                        {isMe ? <span className="text-[10px] text-[#3d3d3d]">(Admin)</span> : null}
                        {!isMe && isHost ? (
                          <span
                            className={[
                              'rounded-[4px] border border-[#2f2f2f] px-2 py-[2px] text-[10px] font-semibold',
                              submitted ? 'bg-green-700 text-white' : 'bg-[#b44b35] text-white',
                            ].join(' ')}
                            title={submitted ? 'This player submitted their answers.' : 'This player has not submitted yet.'}
                          >
                            {submitted ? 'Submitted' : 'Waiting'}
                          </span>
                        ) : null}
                      </div>
                      {!isMe ? (
                        <p className="mt-[2px] text-[10px] text-[#3d3d3d] truncate">
                          /player/lobby?gameCode=…&amp;uid={p.uid}
                        </p>
                      ) : null}
                    </div>

                    {!isMe ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onCopyPlayerLink(p.uid)}
                          className={[
                            'rounded-[4px] border border-[#2f2f2f] px-2 py-1 text-[11px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] transition-colors',
                            copiedUid === p.uid ? 'bg-green-700 animate-pulse' : 'bg-[#6f7f6a]',
                          ].join(' ')}
                          disabled={!isHost}
                        >
                          {copiedUid === p.uid ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBootUid(p.uid)}
                          className="h-7 w-7 rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] text-[14px] leading-none shadow-[2px_2px_0_rgba(0,0,0,0.35)] disabled:opacity-60"
                          aria-label="Boot"
                          disabled={!isHost || bootingUid === p.uid}
                          title="Boot player"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="text-center">
                <button type="button" onClick={onBackToLatestRound} className="text-[11px] text-blue-700 underline">
                  Back to Latest Round
                </button>
              </div>
            </div>

            <div className="mt-2 text-center">
              <Link href={qs ? `/game/leaderboard?${qs}` : '/game/leaderboard'} className="text-[11px] text-blue-700 underline">
                View Leaderboard
              </Link>
            </div>
          </WineyCard>
        </div>
      </main>

      <ConfirmModal
        open={!!confirmBootUid && !!confirmBootPlayer}
        title={`Boot ${confirmBootPlayer?.name ?? 'this player'}?`}
        description="They’ll be removed immediately. They can only rejoin if you invite them back."
        cancelLabel="Keep player"
        confirmLabel="Boot player"
        confirmVariant="danger"
        loading={bootingUid === confirmBootUid}
        onCancel={() => setConfirmBootUid(null)}
        onConfirm={() => {
          const id = confirmBootUid;
          setConfirmBootUid(null);
          if (id) void onBoot(id);
        }}
      />
    </WineyShell>
  );
}


