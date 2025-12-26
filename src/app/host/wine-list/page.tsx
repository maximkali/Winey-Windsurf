'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyInput } from '@/components/winey/fields';
import { WineyTitle } from '@/components/winey/Typography';
import { apiFetch } from '@/lib/api';
import { parseMoneyInput } from '@/lib/money';
import { stripTrailingNumberMatchingLetter } from '@/lib/wineLabel';
import { LOCAL_STORAGE_BOTTLE_COUNT_KEY, LOCAL_STORAGE_WINE_LIST_DRAFT_KEY } from '@/utils/constants';
import { useUrlBackedIdentity } from '@/utils/hooks';
import type { Wine } from '@/types/wine';

type GameState = {
  setupBottles?: number | null;
};

type LocalWineListDraftV1 = {
  v: 1;
  gameCode: string;
  uid: string;
  wines: Wine[];
  priceDraftByWineId: Record<string, string>;
  savedAt: number;
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

  const localKey = useMemo(() => {
    return gameCode && uid ? `${LOCAL_STORAGE_WINE_LIST_DRAFT_KEY}:${gameCode}:${uid}` : null;
  }, [gameCode, uid]);

  const readLocalDraft = useCallback((): LocalWineListDraftV1 | null => {
    if (!localKey || !gameCode || !uid) return null;
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(localKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const p = parsed as Partial<LocalWineListDraftV1>;
      if (p.v !== 1) return null;
      if (p.gameCode !== gameCode) return null;
      if (p.uid !== uid) return null;
      if (!Array.isArray(p.wines)) return null;
      if (!p.priceDraftByWineId || typeof p.priceDraftByWineId !== 'object') return null;
      return p as LocalWineListDraftV1;
    } catch {
      return null;
    }
  }, [localKey, gameCode, uid]);

  const writeLocalDraft = useCallback(
    (next: Omit<LocalWineListDraftV1, 'v' | 'gameCode' | 'uid' | 'savedAt'>) => {
      if (!localKey || !gameCode || !uid) return;
      if (typeof window === 'undefined') return;
      try {
        const payload: LocalWineListDraftV1 = { v: 1, gameCode, uid, savedAt: Date.now(), ...next };
        window.localStorage.setItem(localKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    },
    [localKey, gameCode, uid]
  );

  const clearLocalDraft = useCallback(() => {
    if (!localKey) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(localKey);
    } catch {
      // ignore
    }
  }, [localKey]);

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

  // Mirror current edits to localStorage (so refresh/back doesn't lose work).
  useEffect(() => {
    if (!gameCode || !uid) return;
    if (!wines.length) return;
    writeLocalDraft({ wines, priceDraftByWineId });
  }, [gameCode, uid, wines, priceDraftByWineId, writeLocalDraft]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        // Prefer local draft (unsaved edits) over server state.
        const local = readLocalDraft();
        if (local?.wines?.length) {
          setWines(local.wines);
          setPriceDraftByWineId(local.priceDraftByWineId ?? {});
        }

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

        // If we had a local draft, we don't need to block on server fetch.
        // Still fetch in the background to populate initial state when no local draft exists.
        if (!local?.wines?.length) {
          const res = await apiFetch<{ wines: Wine[] }>(`/api/wines/get?gameCode=${encodeURIComponent(gameCode)}`);
          if (cancelled) return;

          if (res.wines.length) {
            // If we have legacy letter-based labels, migrate to numeric labels (1..N) in-place.
            // NOTE: This is only applied locally; the server is updated only when clicking Save & Continue.
            const needsNumericMigration = res.wines.some((w) => !isPositiveIntString(w.letter));
            const baseWines = needsNumericMigration ? renumberSequentiallyByOrder(res.wines) : res.wines;

            // Clean up labels like "Douro Blend 9" -> "Douro Blend" when the suffix matches the bottle number.
            const sanitized = baseWines.map((w) => ({
              ...w,
              labelBlinded: stripTrailingNumberMatchingLetter(w.labelBlinded, w.letter),
            }));

            if (sanitized.length < required) {
              const missing = required - sanitized.length;
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
            } else if (sanitized.length > required) {
              // If setup bottle count was reduced after wines were created, trim to the configured size.
              const trimmed = sanitized.slice(0, required);
              setWines(trimmed);
            } else {
              setWines(sanitized);
            }
          } else {
            const initialWines = initWines(required);
            setWines(initialWines);
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
  }, [gameCode, uid, readLocalDraft]);

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
    // NOTE: This is used for quick playtesting/dev – but it must remain unique across
    // the maximum bottle count (up to ~200). We guarantee uniqueness by including a
    // deterministic short code derived from the index.
    const code = (idx + 1).toString(36).toUpperCase().padStart(2, '0'); // 01.., 0A.., etc.

    const adjectives = [
      'Smoky',
      'Silky',
      'Bright',
      'Velvet',
      'Crisp',
      'Bold',
      'Zesty',
      'Juicy',
      'Floral',
      'Spicy',
      'Mineral',
      'Lush',
      'Lean',
      'Round',
      'Elegant',
      'Wild',
      'Golden',
      'Rustic',
      'Inky',
      'Sunlit',
    ];
    const nouns = [
      'Fox',
      'Gambit',
      'Barrel',
      'Grape',
      'Monk',
      'River',
      'Ridge',
      'Garden',
      'Comet',
      'Crown',
      'Harvest',
      'Lantern',
      'Falcon',
      'Canyon',
      'Atlas',
      'Valley',
      'Oracle',
      'Sparrow',
      'Anchor',
      'Thorn',
    ];
    const regions = [
      'Napa',
      'Sonoma',
      'Bordeaux',
      'Rioja',
      'Tuscany',
      'Mendoza',
      'Mosel',
      'Willamette',
      'Barossa',
      'Douro',
      'Loire',
      'Burgundy',
      'Piedmont',
      'Alsace',
      'Rhone',
      'Priorat',
      'Stellenbosch',
      'Tokaj',
      'Santorini',
      'Madeira',
    ];
    const varietals = [
      'Blend',
      'Cab',
      'Pinot',
      'Syrah',
      'Grenache',
      'Tempranillo',
      'Sangiovese',
      'Riesling',
      'Chard',
      'Malbec',
    ];

    const adj = adjectives[(idx * 7 + 3) % adjectives.length];
    const noun = nouns[(idx * 11 + 7) % nouns.length];
    const region = regions[(idx * 13 + 11) % regions.length];
    const varietal = varietals[(idx * 5 + 2) % varietals.length];
    const vintage = 2000 + ((idx * 9 + 5) % 25); // 2000..2024

    // Price: deterministic-ish variety but still "random enough" for testing.
    // Also: keep each wine's autofill price unique (at least across common max bottle counts like 200).
    const base = 10 + idx; // 10..209 (unique)
    const cents = (idx * 37) % 100; // 00..99 (pseudo-random but deterministic)
    const price = Number((base + cents / 100).toFixed(2)); // unique for idx in [0..99] and still unique for 0..200 due to unique base

    return {
      ...w,
      // Keep it simple for play-testing: don't append the bottle number to the label.
      // Include a short unique code so we never reuse values across the full list.
      labelBlinded: `${region} ${varietal} ${vintage} (${code})`,
      nickname: `${adj} ${noun} ${code}`,
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
      clearLocalDraft();
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
            <p className="mt-2 text-center text-[11px] text-[color:var(--winey-muted)] leading-relaxed">
              This is where you set up the wines for the tasting. For each bottle, enter the wine’s real name (for example, “Caymus Cabernet Sauvignon”),
              choose a fun nickname that players will see during the game so they can talk about it without revealing what it is, and write that nickname on
              the bottle’s paper wrap/bag so you can identify it during the tasting. Then enter its price. Once you’ve added them all, you’ll organize which
              wines appear in each round to curate the blind tasting.
            </p>

            {loading ? <p className="mt-3 text-center text-[12px] text-[color:var(--winey-muted)]">Loading…</p> : null}
            {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}

            <div className="mt-6 space-y-5">
              {wines.map((w, idx) => (
                <div key={w.id} className="relative">
                  <div className="absolute -left-3 -top-3 h-8 w-8 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-[#b08a3c] flex items-center justify-center text-white text-[12px] font-semibold shadow-[var(--winey-shadow-sm)]">
                    {isPositiveIntString(w.letter) ? w.letter : String(idx + 1)}
                  </div>

                  <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[#e9dfcf] px-3 py-3 shadow-[var(--winey-shadow-sm)]">
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
                <p className="text-center text-[12px] text-[color:var(--winey-muted)]">{continueHelperMessage}</p>
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
