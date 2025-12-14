'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyInput } from '@/components/winey/fields';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_BOTTLE_COUNT_KEY, LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import type { Wine } from '@/types/wine';

type GameState = {
  setupBottles?: number | null;
};

function nextLetter(existing: Wine[]) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const used = new Set(existing.map((w) => w.letter));
  for (const c of alphabet) if (!used.has(c)) return c;
  return alphabet[existing.length % alphabet.length];
}

function initWines(count: number): Wine[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const now = Date.now();
  return Array.from({ length: count }, (_, idx) => ({
    id: `${now}-${idx}-${alphabet[idx % alphabet.length]}`,
    letter: alphabet[idx % alphabet.length],
    labelBlinded: '',
    nickname: '',
    price: null,
  }));
}

export default function WineListPage() {
  const router = useRouter();

  const gameCode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  }, []);

  const uid = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  }, []);

  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiredBottleCount, setRequiredBottleCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        let required = Number(window.localStorage.getItem(LOCAL_STORAGE_BOTTLE_COUNT_KEY) ?? '6');
        required = Number.isFinite(required) && required > 0 ? required : 6;

        try {
          const g = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
          const fromGame = g?.setupBottles;
          if (typeof fromGame === 'number' && Number.isFinite(fromGame) && fromGame > 0) {
            required = fromGame;
            window.localStorage.setItem(LOCAL_STORAGE_BOTTLE_COUNT_KEY, String(fromGame));
          }
        } catch {
          // If game state can't be loaded, fall back to localStorage.
        }

        setRequiredBottleCount(required);

        const res = await apiFetch<{ wines: Wine[] }>(`/api/wines/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (cancelled) return;

        if (res.wines.length) {
          if (res.wines.length < required) {
            const missing = required - res.wines.length;
            const next: Wine[] = [...res.wines];
            for (let i = 0; i < missing; i += 1) {
              const letter = nextLetter(next);
              next.push({
                id: `${Date.now()}-${i}-${letter}`,
                letter,
                labelBlinded: '',
                nickname: '',
                price: null,
              });
            }
            setWines(next);
            if (uid) {
              await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
                method: 'POST',
                body: JSON.stringify({ gameCode, uid, wines: next }),
              });
            }
          } else {
            setWines(res.wines);
          }
        } else {
          const initialWines = initWines(required);
          setWines(initialWines);
          if (uid) {
            await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
              method: 'POST',
              body: JSON.stringify({ gameCode, uid, wines: initialWines }),
            });
          }
        }

        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load wines');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gameCode, uid]);

  async function persist(next: Wine[]) {
    if (!gameCode || !uid) return;
    await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
      method: 'POST',
      body: JSON.stringify({ gameCode, uid, wines: next }),
    });
  }

  function updateWine(id: string, patch: Partial<Wine>) {
    setWines((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  async function onContinue() {
    setError(null);
    try {
      if (typeof requiredBottleCount === 'number' && wines.length !== requiredBottleCount) {
        throw new Error(`Please enter exactly ${requiredBottleCount} bottles before continuing (currently ${wines.length}).`);
      }
      await persist(wines);
      router.push('/host/organize-rounds');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[720px]">
      <main className="pt-8">
        <div className="mx-auto w-full max-w-[520px]">
          <WineyCard className="px-6 py-6">
            <h1 className="text-center text-[22px] font-semibold">Wine List</h1>

            {loading ? <p className="mt-3 text-center text-[12px] text-[#3d3d3d]">Loading…</p> : null}
            {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}

            <div className="mt-6 space-y-5">
              {wines.map((w) => (
                <div key={w.id} className="relative">
                  <div className="absolute -left-3 top-3 h-8 w-8 rounded-full border border-[#2f2f2f] bg-[#b08a3c] flex items-center justify-center text-white text-[12px] font-semibold">
                    {w.letter}
                  </div>

                  <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9dfcf] px-3 py-3">
                    <WineyInput
                      value={w.labelBlinded}
                      onChange={(e) => updateWine(w.id, { labelBlinded: e.target.value })}
                      placeholder="Label (Blinded)"
                      className="bg-white"
                    />

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <WineyInput
                          value={w.nickname}
                          onChange={(e) => updateWine(w.id, { nickname: e.target.value })}
                          placeholder="Nickname"
                        />
                      </div>
                      <div>
                        <WineyInput
                          value={w.price === null ? '' : String(w.price)}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateWine(w.id, { price: v.trim() ? Number(v) : null });
                          }}
                          placeholder="Price ($)"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <Button
                className="w-full py-3"
                onClick={onContinue}
                disabled={typeof requiredBottleCount === 'number' && wines.length !== requiredBottleCount}
              >
                Save &amp; Continue
              </Button>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
