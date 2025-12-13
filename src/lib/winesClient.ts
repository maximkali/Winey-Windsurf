'use client';

import { LOCAL_STORAGE_ROUND_ASSIGNMENTS_KEY, LOCAL_STORAGE_WINES_KEY } from '@/utils/constants';
import type { RoundAssignment, Wine } from '@/types/wine';

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function letters(n: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const res: string[] = [];
  for (let i = 0; i < n; i += 1) res.push(alphabet[i % alphabet.length]);
  return res;
}

export function loadWines(): Wine[] {
  const parsed = safeParse<Wine[]>(window.localStorage.getItem(LOCAL_STORAGE_WINES_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveWines(wines: Wine[]) {
  window.localStorage.setItem(LOCAL_STORAGE_WINES_KEY, JSON.stringify(wines));
}

export function initWines(count: number): Wine[] {
  const now = Date.now();
  return letters(count).map((letter, idx) => ({
    id: `${now}-${idx}-${letter}`,
    letter,
    labelBlinded: '',
    nickname: '',
    price: null,
  }));
}

export function ensureWines(count: number): Wine[] {
  const existing = loadWines();
  if (existing.length) return existing;
  const next = initWines(count);
  saveWines(next);
  return next;
}

export function loadAssignments(): RoundAssignment[] {
  const parsed = safeParse<RoundAssignment[]>(
    window.localStorage.getItem(LOCAL_STORAGE_ROUND_ASSIGNMENTS_KEY)
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function saveAssignments(assignments: RoundAssignment[]) {
  window.localStorage.setItem(LOCAL_STORAGE_ROUND_ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

export function emptyAssignments(rounds: number): RoundAssignment[] {
  return Array.from({ length: rounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] }));
}

export function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
