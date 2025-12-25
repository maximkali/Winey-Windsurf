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
import { stripTrailingNumberMatchingLetter } from '@/lib/wineLabel';
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
  const [devFilling, setDevFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiredBottleCount, setRequiredBottleCount] = useState<number | null>(null);
  // This is intentionally "admin-only" (requires host uid). Keep it simple; you can delete later.
  const showDevTools = !!uid;

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

          // Clean up labels like "Douro Blend 9" -> "Douro Blend" when the suffix matches the bottle number.
          const sanitized = baseWines.map((w) => ({
            ...w,
            labelBlinded: stripTrailingNumberMatchingLetter(w.labelBlinded, w.letter),
          }));
          const needsLabelCleanup = sanitized.some((w, idx) => w.labelBlinded !== baseWines[idx]?.labelBlinded);

          if ((needsNumericMigration || needsLabelCleanup) && uid) {
            await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
              method: 'POST',
              body: JSON.stringify({ gameCode, uid, wines: sanitized }),
            });
          }

          if (res.wines.length < required) {
            const missing = required - res.wines.length;
            const next: Wine[] = [...sanitized];
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
            const trimmed = sanitized.slice(0, required);
            setWines(trimmed);
            if (uid) {
              await apiFetch<{ ok: true }>(`/api/wines/upsert`, {
                method: 'POST',
                body: JSON.stringify({ gameCode, uid, wines: trimmed }),
              });
            }
          } else {
            setWines(sanitized);
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

  function randomAutofill(w: Wine, idx: number): Wine {
    const adjectives = ['Smoky', 'Silky', 'Bright', 'Velvet', 'Crisp', 'Bold', 'Zesty', 'Juicy', 'Floral', 'Spicy'];
    const nouns = ['Fox', 'Gambit', 'Barrel', 'Grape', 'Monk', 'River', 'Ridge', 'Garden', 'Comet', 'Crown'];
    const regions = ['Napa', 'Sonoma', 'Bordeaux', 'Rioja', 'Tuscany', 'Mendoza', 'Mosel', 'Willamette', 'Barossa', 'Douro'];

    const adj = adjectives[(idx + 3) % adjectives.length];
    const noun = nouns[(idx + 7) % nouns.length];
    const region = regions[(idx + 11) % regions.length];

    // Price: deterministic-ish variety but still "random enough" for testing.
    const base = 9 + ((idx * 17) % 140); // 9..148
    const cents = idx % 3 === 0 ? 99 : idx % 3 === 1 ? 50 : 0;
    const price = Number((base + cents / 100).toFixed(2));

    return {
      ...w,
      // Keep it simple for play-testing: don't append the bottle number to the label.
      labelBlinded: `${region} Blend`,
      nickname: `${adj} ${noun}`,
      price,
    };
  }

  async function onDevAutofill() {
    setError(null);
    if (!gameCode || !uid) {
      setError('Missing admin identity. Open this from the host account.');
      return;
    }
    try {
      setDevFilling(true);
      const next = wines.map((w, idx) => randomAutofill(w, idx));
      setWines(next);
      setPriceDraftByWineId(() => {
        const drafts: Record<string, string> = {};
        for (const w of next) drafts[w.id] = w.price === null ? '' : (Number.isFinite(w.price) ? w.price.toFixed(2) : '');
        return drafts;
      });
      await persist(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to autofill wines');
    } finally {
      setDevFilling(false);
    }
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

  const bottleCountOk = typeof requiredBottleCount !== 'number' || wines.length === requiredBottleCount;
  const allWinesHaveRequiredFields =
    wines.length > 0 &&
    wines.every((w) => {
      if (!w.labelBlinded.trim()) return false;
      if (!w.nickname.trim()) return false;

      // Price is edited in a draft field; validate the draft if present, otherwise fall back to stored price.
      const draft = priceDraftByWineId[w.id];
      const parsed = typeof draft === 'string' ? parseMoneyInput(draft) : ({ ok: true, value: w.price } as const);
      if (!parsed.ok) return false;
      return parsed.value !== null;
    });

  const canContinue = !loading && bottleCountOk && allWinesHaveRequiredFields;
  const continueHelperMessage = !loading && !canContinue ? 'Be sure all information above is completed before proceeding.' : null;

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
                disabled={!canContinue}
              >
                Save &amp; Continue
              </Button>

              {continueHelperMessage ? (
                <p className="text-center text-[12px] text-[#3d3d3d]">{continueHelperMessage}</p>
              ) : null}

              {showDevTools ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => void onDevAutofill()}
                    disabled={loading || devFilling || !wines.length}
                    className="text-[11px] text-blue-700 underline disabled:opacity-50"
                    title="Quickly populate wines with dummy data for testing."
                  >
                    {devFilling ? 'Autofilling…' : 'Autofill Wines'}
                  </button>
                </div>
              ) : null}
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
