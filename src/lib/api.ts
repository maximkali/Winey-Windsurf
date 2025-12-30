'use client';

import { LOCAL_STORAGE_UID_KEY } from '@/utils/constants';

export async function apiFetch<T>(
  input: string,
  init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
): Promise<T> {
  const uid =
    typeof window === 'undefined'
      ? null
      : // Prefer URL (deep links) over localStorage (which may contain a stale uid from a different session).
        (() => {
          let fromUrl: string | null = null;
          try {
            const params = new URLSearchParams(window.location.search);
            fromUrl = params.get('uid') || params.get('hostUid');
          } catch {
            // ignore
          }

          let fromStorage: string | null = null;
          try {
            fromStorage = window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
          } catch {
            // ignore
          }

          return fromUrl || fromStorage;
        })();

  const headers: Record<string, string> = {
    ...(init?.headers ?? {}),
  };

  if (!headers['Content-Type'] && init?.body) headers['Content-Type'] = 'application/json';
  if (uid && !headers['x-uid']) headers['x-uid'] = uid;

  const res = await fetch(input, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(text) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof (parsed as { error?: unknown }).error === 'string'
      ) {
        throw new Error((parsed as { error: string }).error);
      }
    } catch {
      // ignore
    }
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}
