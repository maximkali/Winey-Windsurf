'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { apiFetch } from '@/lib/api';
import { useVisiblePoll } from '@/utils/useVisiblePoll';

type GameState = {
  gameCode: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  players: Array<{ uid: string; name: string; joinedAt: number }>;
  isHost: boolean;
};

type RoundProgress = {
  roundId?: number;
  kind?: 'round' | 'gambit';
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

type Props = {
  gameCode: string | null;
  uid?: string | null;

  /** Inline mode: show a small header row with a Close button and avoid page-level navigation */
  variant?: 'inline' | 'page';
  onClose?: () => void;

  showBackToGameButton?: boolean;
  onBackToGame?: () => void;
};

export function ManagePlayersPanel({
  gameCode,
  uid,
  variant = 'inline',
  onClose,
  showBackToGameButton,
  onBackToGame,
}: Props) {
  const router = useRouter();

  const [state, setState] = useState<GameState | null>(null);
  const [roundProgress, setRoundProgress] = useState<RoundProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [bootingUid, setBootingUid] = useState<string | null>(null);
  const [confirmBootUid, setConfirmBootUid] = useState<string | null>(null);

  useVisiblePoll(
    async ({ isCancelled }) => {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (isCancelled()) return;
        setState(s);
        setError(null);

        if (s.isHost) {
          try {
            const rp =
              s.status === 'gambit'
                ? await apiFetch<RoundProgress>(`/api/gambit/progress?gameCode=${encodeURIComponent(gameCode)}`)
                : await apiFetch<RoundProgress>(
                    `/api/round/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(s.currentRound))}`
                  );
            if (isCancelled()) return;
            setRoundProgress({ ...rp, kind: s.status === 'gambit' ? 'gambit' : 'round', roundId: s.currentRound });
          } catch {
            if (isCancelled()) return;
            setRoundProgress(null);
          }
        } else {
          setRoundProgress(null);
        }
      } catch (e) {
        if (!isCancelled()) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    },
    [gameCode]
  );

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

  const isHost = !!state?.isHost;
  const confirmBootPlayer = confirmBootUid ? (state?.players ?? []).find((p) => p.uid === confirmBootUid) ?? null : null;
  const submittedSet = new Set(roundProgress?.submittedUids ?? []);
  const doneCount = roundProgress?.playersDoneCount ?? roundProgress?.submissionsCount ?? null;
  const totalCount = roundProgress?.playersTotalCount ?? null;
  const isGambitPhase = state?.status === 'gambit' || roundProgress?.kind === 'gambit';

  if (error === 'You were removed from the lobby.') {
    return (
      <div
        className={
          variant === 'inline'
            ? 'mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white p-3 shadow-[var(--winey-shadow-sm)]'
            : ''
        }
      >
        <div className="text-center">
          <p className="text-[12px] font-semibold">You’re no longer in this game.</p>
          <div className="mt-2 text-center">
            {gameCode ? (
              <Link href={`/player/join?gameCode=${encodeURIComponent(gameCode)}`} className="text-[11px] text-blue-700 underline">
                Rejoin
              </Link>
            ) : (
              <button type="button" onClick={() => (onClose ? onClose() : router.back())} className="text-[11px] text-blue-700 underline">
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        variant === 'inline'
          ? 'mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white p-3 shadow-[var(--winey-shadow-sm)]'
          : ''
      }
    >
      {variant === 'inline' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold">Manage Players</p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white text-[14px] leading-none shadow-[var(--winey-shadow-sm)]"
              aria-label="Close Manage Players"
              title="Close"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-[18px] font-semibold">Manage Players</p>
          <p className="mt-1 text-[11px] text-[color:var(--winey-muted)]">Copy a player’s rejoin link or remove them from the game.</p>
        </div>
      )}

      {!isHost ? (
        <div className="mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-4 py-3 text-center shadow-[var(--winey-shadow-sm)]">
          <p className="text-[12px] font-semibold">Admin access only.</p>
          <p className="mt-1 text-[11px] text-[color:var(--winey-muted)]">Open this from the host account.</p>
        </div>
      ) : null}

      {isHost ? (
        <div className="mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-4 py-3 text-center shadow-[var(--winey-shadow-sm)]">
          <p className="text-[12px] font-semibold">
            {isGambitPhase ? "Sommelier's Gambit progress" : `Round ${state?.currentRound ?? ' – '} progress`}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--winey-muted)]">
            {typeof doneCount === 'number' ? doneCount : ' – '}/{typeof totalCount === 'number' ? totalCount : ' – '} players submitted
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white shadow-[var(--winey-shadow-sm)]">
        {(state?.players ?? []).map((p) => {
          const isMe = !!uid && p.uid === uid;
          const submitted = isHost ? submittedSet.has(p.uid) : false;
          return (
            <div
              key={p.uid}
              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[color:var(--winey-border)] last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[12px] font-semibold truncate">{p.name}</p>
                  {isMe ? <span className="text-[10px] text-[color:var(--winey-muted)]">(Admin)</span> : null}
                  {isHost ? (
                    <span
                      className={[
                        'rounded-[999px] border border-[color:var(--winey-border-strong)] px-2 py-[2px] text-[10px] font-semibold shadow-[var(--winey-shadow-sm)]',
                        submitted ? 'bg-green-700 text-white' : 'bg-[#b44b35] text-white',
                      ].join(' ')}
                      title={submitted ? 'This player submitted their answers.' : 'This player has not submitted yet.'}
                    >
                      {submitted ? 'Submitted' : 'Waiting'}
                    </span>
                  ) : null}
                </div>
                {!isMe ? (
                  <p className="mt-[2px] text-[10px] text-[color:var(--winey-muted)] truncate">
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
                      'rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] px-2 py-1 text-[11px] font-semibold text-white shadow-[var(--winey-shadow-sm)] transition-colors',
                      copiedUid === p.uid ? 'bg-green-700 animate-pulse' : 'bg-[#6f7f6a]',
                    ].join(' ')}
                    disabled={!isHost}
                  >
                    {copiedUid === p.uid ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBootUid(p.uid)}
                    className="h-7 w-7 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] bg-[color:var(--winey-surface)] text-[14px] leading-none shadow-[var(--winey-shadow-sm)] disabled:opacity-60"
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

      {showBackToGameButton ? (
        <div className="mt-2">
          <Button
            variant="outline"
            className="w-full py-3"
            onClick={() => {
              if (onBackToGame) onBackToGame();
              else if (onClose) onClose();
              else router.back();
            }}
          >
            Continue to Game
          </Button>
        </div>
      ) : null}

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
    </div>
  );
}


