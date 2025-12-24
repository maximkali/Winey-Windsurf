'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyInput } from '@/components/winey/fields';
import { WineyTitle } from '@/components/winey/Typography';
import { apiFetch } from '@/lib/api';
import { parseMoneyInput } from '@/lib/money';
import { LOCAL_STORAGE_BOTTLE_COUNT_KEY } from '@/utils/constants';
import { useUrlBackedIdentity } from '@/utils/hooks';
import type { Wine } from '@/types/wine';

type GameState = {
  setupBottles?: number | null;
};

function isPositiveIntString(v: string) {
  if (!/^\d+$/.test(v)) return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function nextWineNumber(existing: Wine[]) {
  const used = new Set(existing.map((w) => w.letter).filter((x) => isPositiveIntString(x)));
  for (let i = 1; i <= existing.length + 1; i += 1) {
    const s = String(i);
    if (!used.has(s)) return s;
  }
  return String(existing.length + 1);
}

function renumberSequentiallyByOrder(wines: Wine[]) {
  // We persist the "display number" in `wine.letter` for backward compatibility.
  // If a game already has A/B/C..., migrate it to 1/2/3... in the existing order.
  return wines.map((w, idx) => ({ ...w, letter: String(idx + 1) }));
}

function initWines(count: number): Wine[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, idx) => ({
    id: `${now}-${idx}-${idx + 1}`,
    letter: String(idx + 1),
    labelBlinded: '',
    nickname: '',
    price: null,
  }));
}

export default function WineListPage() {
  const router = useRouter();

  const { gameCode, uid } = useUrlBackedIdentity();

  const [wines, setWines] = useState<Wine[]>([]);
  const [priceDraftByWineId, setPriceDraftByWineId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiredBottleCount, setRequiredBottleCount] = useState<number | null>(null);

  useEffect(() => {
    // Initialize drafts for newly loaded/created wines without overwriting in-progress edits.
    setPriceDraftByWineId((prev) => {
      const next = { ...prev };
      for (const w of wines) {
        if (typeof next[w.id] === 'string') continue;
        // Prefer a consistent 2-decimal display for money fields.
        next[w.id] = w.price === null ? '' : String(Number.isFinite(w.price) ? w.price.toFixed(2) : '');
      }
      return next;
    });
  }, [wines]);

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
          // If we have legacy letter-based labels, migrate to numeric labels (1..N) in-place.
          const needsNumericMigration = res.wines.some((w) => !isPositiveIntString(w.letter));
          const baseWines = needsNumericMigration ? renumberSequentiallyByOrder(res.wines) : res.wines;
          if (needsNumericMigration && uid) {
            await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
              method: 'POST',
              body: JSON.stringify({ gameCode, uid, wines: baseWines }),
            });
          }

          if (res.wines.length < required) {
            const missing = required - res.wines.length;
            const next: Wine[] = [...baseWines];
            for (let i = 0; i < missing; i += 1) {
              const letter = nextWineNumber(next);
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
          } else if (res.wines.length > required) {
            // If setup bottle count was reduced after wines were created, trim to the configured size.
            const trimmed = baseWines.slice(0, required);
            setWines(trimmed);
            if (uid) {
              await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
                method: 'POST',
                body: JSON.stringify({ gameCode, uid, wines: trimmed }),
              });
            }
          } else {
            setWines(baseWines);
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
      if (!gameCode) throw new Error('Missing game code. Please return to Setup and try again.');
      if (!uid) throw new Error('Missing admin id. Please return to Setup and try again.');

      // Commit any in-progress price edits before saving.
      const committed = wines.map((w, idx) => {
        const draft = priceDraftByWineId[w.id];
        if (typeof draft !== 'string') return w;
        const parsed = parseMoneyInput(draft);
        if (!parsed.ok) {
          throw new Error(
            `Invalid price for bottle ${isPositiveIntString(w.letter) ? w.letter : String(idx + 1)}. Please enter a valid number (e.g. 12.50).`,
          );
        }
        return { ...w, price: parsed.value };
      });

      setWines(committed);
      await persist(committed);
      const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
      router.push(`/host/organize-rounds?${qs}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[720px]">
      <main className="pt-8">
        <div className="mx-auto w-full max-w-[520px]">
          <WineyCard className="px-6 py-6">
            <WineyTitle className="text-center">Wine List</WineyTitle>
            <p className="mt-2 text-center text-[11px] text-[#3d3d3d] leading-relaxed">
              This is where you set up the wines for the tasting. For each bottle, enter the wine’s real name (for example, “Caymus Cabernet Sauvignon”),
              choose a fun nickname that players will see during the game so they can talk about it without revealing what it is, and write that nickname on
              the bottle’s paper wrap/bag so you can identify it during the tasting. Then enter its price. Once you’ve added them all, you’ll organize which
              wines appear in each round to curate the blind tasting.
            </p>

            {loading ? <p className="mt-3 text-center text-[12px] text-[#3d3d3d]">Loading…</p> : null}
            {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}

            <div className="mt-6 space-y-5">
              {wines.map((w, idx) => (
                <div key={w.id} className="relative">
                  <div className="absolute -left-3 top-3 h-8 w-8 rounded-full border border-[#2f2f2f] bg-[#b08a3c] flex items-center justify-center text-white text-[12px] font-semibold">
                    {isPositiveIntString(w.letter) ? w.letter : String(idx + 1)}
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
                          value={priceDraftByWineId[w.id] ?? (w.price === null ? '' : String(w.price))}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPriceDraftByWineId((prev) => ({ ...prev, [w.id]: v }));
                          }}
                          onBlur={() => {
                            const draft = priceDraftByWineId[w.id] ?? '';
                            const parsed = parseMoneyInput(draft);
                            if (!parsed.ok) return;
                            updateWine(w.id, { price: parsed.value });
                            setPriceDraftByWineId((prev) => ({ ...prev, [w.id]: parsed.value === null ? '' : parsed.value.toFixed(2) }));
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
