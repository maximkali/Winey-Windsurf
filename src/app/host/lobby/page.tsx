'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { WineySectionHeading, WineySubtitle, WineyTitle } from '@/components/winey/Typography';
import {
  LOCAL_STORAGE_BOTTLE_COUNT_KEY,
  LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY,
  LOCAL_STORAGE_PLAYER_COUNT_KEY,
  LOCAL_STORAGE_ROUND_COUNT_KEY,
} from '@/utils/constants';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { ConfirmModal } from '@/components/winey/ConfirmModal';

type GameState = {
  gameCode: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  setupPlayers?: number | null;
  setupBottles?: number | null;
  setupBottlesPerRound?: number | null;
  setupOzPerPersonPerBottle?: number | null;
  players: Array<{ uid: string; name: string; joinedAt: number }>;
  isHost: boolean;
};

export default function HostLobbyPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const tastingConfig = useMemo(() => {
    const standard750mlBottleOz = 25.36;

    const setupBottlesPerRound = state?.setupBottlesPerRound;
    const setupBottles = state?.setupBottles;
    const setupOz = state?.setupOzPerPersonPerBottle;
    const setupRounds = state?.totalRounds;

    const bottlesPerRoundFallback =
      typeof window === 'undefined' ? NaN : Number(window.localStorage.getItem(LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY) ?? '4');
    const bottlesFallback = typeof window === 'undefined' ? NaN : Number(window.localStorage.getItem(LOCAL_STORAGE_BOTTLE_COUNT_KEY) ?? '0');
    const roundsFallback = typeof window === 'undefined' ? NaN : Number(window.localStorage.getItem(LOCAL_STORAGE_ROUND_COUNT_KEY) ?? '0');

    const bottlesPerRound =
      typeof setupBottlesPerRound === 'number' && Number.isFinite(setupBottlesPerRound) && setupBottlesPerRound > 0
        ? setupBottlesPerRound
        : Number.isFinite(bottlesPerRoundFallback) && bottlesPerRoundFallback > 0
          ? bottlesPerRoundFallback
          : 4;

    const bottles =
      typeof setupBottles === 'number' && Number.isFinite(setupBottles) && setupBottles > 0
        ? setupBottles
        : Number.isFinite(bottlesFallback) && bottlesFallback > 0
          ? bottlesFallback
          : 0;

    const rounds =
      typeof setupRounds === 'number' && Number.isFinite(setupRounds) && setupRounds > 0
        ? setupRounds
        : Number.isFinite(roundsFallback) && roundsFallback > 0
          ? roundsFallback
          : 0;

    const ozPerPersonPerBottle = typeof setupOz === 'number' && Number.isFinite(setupOz) && setupOz > 0 ? setupOz : null;
    const totalOzPerPerson = ozPerPersonPerBottle !== null && bottles ? bottles * ozPerPersonPerBottle : null;
    const percentOfStandardBottle =
      totalOzPerPerson !== null ? Math.round((totalOzPerPerson / standard750mlBottleOz) * 100) : null;

    return {
      bottlesPerRound,
      bottles,
      rounds,
      ozPerPersonPerBottle,
      totalOzPerPerson,
      percentOfStandardBottle,
    };
  }, [state?.setupBottles, state?.setupBottlesPerRound, state?.setupOzPerPersonPerBottle, state?.totalRounds]);

  async function copyInviteLink(code: string) {
    const normalized = code.trim().toUpperCase();
    const url = `${window.location.origin}/player/join?gameCode=${encodeURIComponent(normalized)}`;
    try {
      await navigator.clipboard?.writeText(url);
      return;
    } catch {
      // ignore
    }
    const ta = document.createElement('textarea');
    ta.value = url;
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

  async function copyAdminReturnLink(code: string, hostUid: string) {
    const normalized = code.trim().toUpperCase();
    const url = `${window.location.origin}/host/lobby?gameCode=${encodeURIComponent(normalized)}&uid=${encodeURIComponent(hostUid)}`;
    try {
      await navigator.clipboard?.writeText(url);
      return;
    } catch {
      // ignore
    }
    const ta = document.createElement('textarea');
    ta.value = url;
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

  function showCopied() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function showCopiedAdmin() {
    setCopiedAdmin(true);
    window.setTimeout(() => setCopiedAdmin(false), 1200);
  }

  const { gameCode, uid } = useUrlBackedIdentity();

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const organizeRoundsHref = useMemo(() => {
    if (!qs) return '/host/organize-rounds';
    return `/host/organize-rounds?${qs}`;
  }, [qs]);

  const targetPlayers = useMemo(() => {
    const fromState = state?.setupPlayers;
    if (typeof fromState === 'number' && Number.isFinite(fromState) && fromState > 0) return fromState;
    if (typeof window === 'undefined') return 8;
    const raw = window.localStorage.getItem(LOCAL_STORAGE_PLAYER_COUNT_KEY);
    const n = Number(raw ?? '8');
    return Number.isFinite(n) && n > 0 ? n : 8;
  }, [state?.setupPlayers]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (!cancelled) setState(s);
        if (!cancelled) setError(null);

        const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
        if (s.status === 'in_progress') router.push(`/game/round/1?${qs}`);
        if (s.status === 'finished') router.push(`/game/leaderboard?${qs}`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load lobby');
      }
    }

    tick();
    const id = window.setInterval(tick, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, router, uid]);

  async function onStart() {
    if (!gameCode || !uid) return;
    setLoadingStart(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/game/start`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setLoadingStart(false);
    }
  }

  async function onBoot(playerUid: string) {
    if (!gameCode || !uid) return;
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/players/boot`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid, playerUid }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to boot');
    }
  }

  const joinedPlayers = state?.players?.length ?? 0;
  const remainingPlayers = playersRemaining(state?.players?.length, targetPlayers);
  const isReady = Boolean(state) && remainingPlayers === 0;
  const statusLabel = !state ? 'Loading lobby…' : isReady ? 'Ready to start' : `Waiting for ${remainingPlayers}`;
  const statusTone = !state ? 'bg-[#6f7f6a]/15' : isReady ? 'bg-[#6f7f6a]/25' : 'bg-[#e9e5dd]';
  const progressPct =
    targetPlayers > 0 ? Math.max(0, Math.min(100, Math.round((joinedPlayers / targetPlayers) * 100))) : 0;

  return (
    <WineyShell maxWidthClassName="max-w-[1040px]">
      <main className="pt-6 pb-28 lg:pb-0">
        <div className="mx-auto w-full space-y-4">
          <WineyCard className="px-6 py-5">
            <div className="text-center">
              <WineyTitle>Lobby</WineyTitle>
              <WineySubtitle className="mt-1">Share the player link, confirm everyone joined, then start.</WineySubtitle>
            </div>

            <div className="mt-4 flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
              <div
                className={[
                  'flex items-center justify-between gap-3 rounded-[999px] border border-[#2f2f2f] px-3 py-2 text-[12px] shadow-[2px_2px_0_rgba(0,0,0,0.25)]',
                  statusTone,
                ].join(' ')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[#b08a3c] font-semibold">●</span>
                  <span className="font-semibold truncate">{statusLabel}</span>
                </div>
                <span className="text-[#3d3d3d] tabular-nums">
                  {joinedPlayers}/{targetPlayers}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2 w-full max-w-[220px] flex-1 overflow-hidden rounded-[999px] border border-[#2f2f2f] bg-white shadow-[2px_2px_0_rgba(0,0,0,0.25)]">
                  <div className="h-full bg-[#6f7f6a]" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-[11px] text-[#3d3d3d] tabular-nums">{progressPct}%</span>
              </div>
            </div>
          </WineyCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <WineyCard className="px-6 py-5">
              <div className="space-y-4">
                <section className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] px-4 py-3">
                  <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="text-center sm:text-left">
                      <p className="text-[12px]">
                        <span className="text-[#b08a3c] font-semibold">●</span>{' '}
                        <span className="font-semibold">Game Code:</span> {state?.gameCode ?? gameCode ?? '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                    <Button
                      variant="outline"
                      className="w-full py-3"
                      onClick={() => {
                        const code = state?.gameCode ?? gameCode;
                        if (!code) return;
                        setError(null);
                        copyInviteLink(code)
                          .then(() => showCopied())
                          .catch(() => setError('Failed to copy link'));
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy Player Link'}
                    </Button>

                    <Button
                      className="w-full py-3"
                      onClick={() => setConfirmStartOpen(true)}
                      disabled={loadingStart || !state?.isHost}
                      title={!state?.isHost ? 'Only the host can start' : undefined}
                    >
                      {loadingStart ? 'Starting…' : 'Start Game'}
                    </Button>
                  </div>

                  {uid ? (
                    <details className="mt-3 rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-2">
                      <summary className="cursor-pointer select-none text-[12px] font-semibold text-[#2b2b2b]">
                        Host tools <span className="text-[11px] font-normal text-[#3d3d3d]">(advanced)</span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        <Button
                          className="w-full"
                          title="Private admin return link (keep secret)"
                          onClick={() => {
                            const code = state?.gameCode ?? gameCode;
                            if (!code || !uid) return;
                            setError(null);
                            copyAdminReturnLink(code, uid)
                              .then(() => showCopiedAdmin())
                              .catch(() => setError('Failed to copy admin link'));
                          }}
                        >
                          {copiedAdmin ? 'Copied!' : 'Copy Admin Return Link'}
                        </Button>
                        <p className="text-[11px] leading-snug text-[#3d3d3d]">
                          Save this somewhere safe so you can resume hosting later (even if you close this tab).
                          This private link contains your host key and gives access to your saved setup + wine list.
                          Anyone with it can act as the host—treat it like a password.
                        </p>
                      </div>
                    </details>
                  ) : null}
                </section>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <section>
                  <div className="flex items-baseline justify-between gap-3">
                    <WineySectionHeading>Players</WineySectionHeading>
                    {state?.isHost ? <WineySubtitle>Remove if needed.</WineySubtitle> : <WineySubtitle>Waiting for the host.</WineySubtitle>}
                  </div>

                  <div className="mt-2 lg:max-h-[420px] lg:overflow-auto lg:pr-1">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {(state?.players ?? []).map((p) => (
                      <div
                        key={p.uid}
                        className="group flex items-center justify-between rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[12px] font-semibold">{p.name}</p>
                          {p.uid === uid ? <span className="text-[10px] text-[#3d3d3d]">(Me)</span> : null}
                        </div>

                        {state?.isHost && p.uid !== uid ? (
                          <button
                            type="button"
                            onClick={() => onBoot(p.uid)}
                            className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] text-[14px] leading-none shadow-[2px_2px_0_rgba(0,0,0,0.35)] lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                            aria-label={`Boot ${p.name}`}
                            title="Boot player"
                          >
                            ×
                          </button>
                        ) : (
                          <span className="ml-3 text-[10px] text-[#3d3d3d]">{p.uid === uid ? '(Admin)' : ''}</span>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="text-center">
                    <Link href={organizeRoundsHref} className="text-[12px] text-blue-700 underline">
                      Back to Organize Rounds
                    </Link>
                  </div>
                </section>
              </div>
            </WineyCard>

            <WineyCard className="px-6 py-5">
              <div className="rounded-[4px] border border-[#2f2f2f] bg-[#f4f1ea] px-4 py-3">
                <p className="text-center text-[13px] font-semibold">Tasting Details</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a]/20 px-3 py-2 text-center">
                    <p className="text-[10px] text-[#2b2b2b]">Tastings / Round</p>
                    <p className="text-[14px] font-semibold">{tastingConfig.bottlesPerRound} Wines</p>
                  </div>
                  <div className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a]/20 px-3 py-2 text-center">
                    <p className="text-[10px] text-[#2b2b2b]">Max Pour Per Tasting</p>
                    <p className="text-[14px] font-semibold">
                      {tastingConfig.ozPerPersonPerBottle === null ? '—' : `${tastingConfig.ozPerPersonPerBottle.toFixed(2)} Oz`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-[#3d3d3d]">
                  <p>
                    In this blind tasting, you’ll sample {tastingConfig.bottlesPerRound} different wines across {tastingConfig.rounds || '—'} rounds –{' '}
                    {tastingConfig.bottles || '—'} wines total. For each wine, pour up to{' '}
                    {tastingConfig.ozPerPersonPerBottle === null ? '—' : tastingConfig.ozPerPersonPerBottle.toFixed(2)} oz. That adds up to{' '}
                    {tastingConfig.totalOzPerPerson === null ? '—' : tastingConfig.totalOzPerPerson.toFixed(2)} oz per person over the full game (roughly{' '}
                    {tastingConfig.percentOfStandardBottle === null ? '—' : tastingConfig.percentOfStandardBottle}% of a standard 750ml bottle).
                  </p>
                  <p>
                    After each round, write down quick notes on aroma, flavor, and finish. Then, rank the {tastingConfig.bottlesPerRound} wines from most to
                    least expensive based on what you think they’re worth. Once everyone submits their rankings, the game shows the correct price order – without
                    revealing labels or actual prices – and updates the live leaderboard.
                  </p>
                  <p>
                    You get one point for each wine you rank correctly. The player with the highest total score wins.
                  </p>
                </div>
              </div>
            </WineyCard>
          </div>
        </div>
      </main>

      {/* Mobile sticky primary action */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-20 border-t border-[#2f2f2f] bg-[#f4f1ea]/95 backdrop-blur px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-[560px]">
          <Button
            className="w-full py-3 text-base"
            onClick={() => setConfirmStartOpen(true)}
            disabled={loadingStart || !state?.isHost}
          >
            {loadingStart ? 'Starting…' : 'Start Game'}
          </Button>
          <p className="mt-2 text-center text-[11px] text-[#3d3d3d]">
            {state?.isHost ? (isReady ? 'Everyone’s in — you’re good to go.' : 'You can start anytime.') : 'Waiting for the host to start.'}
          </p>
        </div>
      </div>

      <ConfirmModal
        open={confirmStartOpen}
        title="Start the game now?"
        description="This will send everyone to Round 1."
        confirmLabel="Start Game"
        confirmVariant="danger"
        loading={loadingStart}
        onCancel={() => setConfirmStartOpen(false)}
        onConfirm={() => {
          setConfirmStartOpen(false);
          void onStart();
        }}
      />
    </WineyShell>
  );
}

function playersRemaining(count: number | undefined, target: number) {
  const joined = count ?? 0;
  return Math.max(0, target - joined);
}
