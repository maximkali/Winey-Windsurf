'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import {
  LOCAL_STORAGE_BOTTLE_COUNT_KEY,
  LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY,
  LOCAL_STORAGE_PLAYER_COUNT_KEY,
  LOCAL_STORAGE_ROUND_COUNT_KEY,
} from '@/utils/constants';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { useVisiblePoll } from '@/utils/useVisiblePoll';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { TastingDetails } from '@/components/winey/TastingDetails';
import { WineyTitle } from '@/components/winey/Typography';

type GameState = {
  gameCode: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  setupPlayers?: number | null;
  setupBottles?: number | null;
  setupBottlesPerRound?: number | null;
  setupOzPerPersonPerBottle?: number | null;
  players: Array<{ uid: string; name: string; joinedAt: number; isCompeting?: boolean }>;
  isHost: boolean;
};

export default function HostLobbyPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingCompeting, setLoadingCompeting] = useState(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [hostToolsOpen, setHostToolsOpen] = useState(false);

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

  const adminIsCompeting = useMemo(() => {
    if (!uid) return true;
    const me = state?.players?.find((p) => p.uid === uid);
    return typeof me?.isCompeting === 'boolean' ? me.isCompeting : true;
  }, [state?.players, uid]);

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const organizeRoundsHref = useMemo(() => {
    if (!qs) return '/host/organize-rounds';
    return `/host/organize-rounds?${qs}`;
  }, [qs]);

  const wineListHref = useMemo(() => {
    if (!qs) return '/host/wine-list';
    return `/host/wine-list?${qs}`;
  }, [qs]);

  const targetPlayers = useMemo(() => {
    const fromState = state?.setupPlayers;
    if (typeof fromState === 'number' && Number.isFinite(fromState) && fromState > 0) return fromState;
    if (typeof window === 'undefined') return 8;
    const raw = window.localStorage.getItem(LOCAL_STORAGE_PLAYER_COUNT_KEY);
    const n = Number(raw ?? '8');
    return Number.isFinite(n) && n > 0 ? n : 8;
  }, [state?.setupPlayers]);

  useVisiblePoll(
    async () => {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        setState(s);
        setError(null);

        const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
        if (s.status === 'in_progress') router.push(`/game/round/1?${qs}`);
        if (s.status === 'gambit') router.push(`/game/gambit?${qs}`);
        if (s.status === 'finished') router.push(`/game/leaderboard?${qs}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load lobby');
      }
    },
    [gameCode, router, uid]
  );

  async function onStart() {
    if (!gameCode || !uid) return;
    setLoadingStart(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/game/start`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
      // Don’t wait for the polling loop to notice the status change – take the host straight to Round 1.
      router.push(`/${['game', 'round', '1'].join('/')}?gameCode=${encodeURIComponent(gameCode)}&uid=${encodeURIComponent(uid)}`);
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

  async function onSetAdminCompeting(next: boolean) {
    if (!gameCode || !uid) return;
    setLoadingCompeting(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/players/competing/set`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid, isCompeting: next }),
      });
      // Optimistic local update; polling will also refresh state.
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => (p.uid === uid ? { ...p, isCompeting: next } : p)),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update setting');
    } finally {
      setLoadingCompeting(false);
    }
  }

  const joinedPlayers = state?.players?.length ?? 0;
  const remainingPlayers = playersRemaining(state?.players?.length, targetPlayers);
  const isReady = Boolean(state) && remainingPlayers === 0;

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6 pb-10">
        <div className="mx-auto w-full max-w-[560px] space-y-5">
          <WineyCard className="px-6 py-5">
            <div className="text-center">
              <WineyTitle>Lobby</WineyTitle>
            </div>

            <div className="mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-4 pt-3 pb-4 text-center shadow-[var(--winey-shadow-sm)]">
              <p className="text-[12px]">
                <span className="text-[#b08a3c] font-semibold">●</span>{' '}
                <span className="font-semibold">Game Code:</span> {state?.gameCode ?? gameCode ?? ' – '}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--winey-muted)] tabular-nums">
                {joinedPlayers} Players Joined{targetPlayers ? ` / ${targetPlayers}` : ''}
              </p>
              <p className="text-[11px] text-[color:var(--winey-muted)]">
                {state?.isHost ? (isReady ? 'Everyone’s in – you’re good to go.' : null) : 'Waiting for the host to start the game…'}
              </p>

              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    {copied ? 'Copied!' : 'Copy Share Link'}
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
                  <div>
                    <Button
                      className="w-full py-3"
                      onClick={() => setHostToolsOpen((v) => !v)}
                      title="Advanced host tools"
                    >
                      {hostToolsOpen ? 'Hide Host Tools' : 'Host Tools (Advanced)'}
                    </Button>

                    {hostToolsOpen ? (
                      <div className="mt-2 space-y-2 text-left">
                        <div className="flex items-center justify-between gap-3 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-3 py-2 shadow-[var(--winey-shadow-sm)]">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-[color:var(--winey-muted-2)]">Admin competing?</p>
                            <p className="text-[11px] text-[color:var(--winey-muted)]">
                              If ‘No’, you’ll be excluded from the leaderboard and from winning, but you can still earn points, track progress, and mess around.
                            </p>
                          </div>
                          <select
                            className={[
                              'w-[120px] rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-2 py-1 text-[12px] leading-none',
                              'shadow-[inset_0_-1px_0_rgba(0,0,0,0.10)]',
                              'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
                            ].join(' ')}
                            value={adminIsCompeting ? 'yes' : 'no'}
                            disabled={!state?.isHost || loadingCompeting}
                            onChange={(e) => onSetAdminCompeting(e.target.value === 'yes')}
                            aria-label="Admin competing"
                            title={!state?.isHost ? 'Only the host can change this' : undefined}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </div>

                        <Button
                          className="w-full py-3"
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
                        <p className="text-[11px] leading-snug text-[color:var(--winey-muted)]">
                          Save this somewhere safe so you can resume hosting later (even if you close this tab). This private link contains your host key and gives
                          access to your saved setup + wine list. Anyone with it can act as the host.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(state?.players ?? []).map((p) => (
                <div
                  key={p.uid}
                  className="flex items-center justify-between gap-2 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white px-3 py-2 shadow-[var(--winey-shadow-sm)]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[12px] font-semibold truncate">{p.name}</p>
                    {uid && p.uid === uid ? <span className="text-[10px] text-[color:var(--winey-muted)]">(Me)</span> : null}
                    {p.uid === uid ? <span className="text-[10px] text-[color:var(--winey-muted)]">(Admin)</span> : null}
                  {p.uid === uid && p.isCompeting === false ? (
                    <span className="text-[10px] text-[color:var(--winey-muted)]">(Not playing)</span>
                  ) : null}
                  </div>

                  {state?.isHost && p.uid !== uid ? (
                    <button
                      type="button"
                      onClick={() => onBoot(p.uid)}
                      className="h-7 w-7 shrink-0 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] bg-[color:var(--winey-surface)] text-[14px] leading-none shadow-[var(--winey-shadow-sm)]"
                      aria-label={`Boot ${p.name}`}
                      title="Boot player"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Link href={organizeRoundsHref} className="text-[12px] text-blue-700 underline">
                Back to Organize Rounds
              </Link>
              <span className="mx-2 text-[12px] text-[color:var(--winey-muted)]">·</span>
              <Link href={wineListHref} className="text-[12px] text-blue-700 underline">
                Edit Wine List
              </Link>
            </div>
          </WineyCard>

          <WineyCard className="px-6 py-5">
            <TastingDetails tastingConfig={tastingConfig} />
            </WineyCard>
        </div>
      </main>

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
