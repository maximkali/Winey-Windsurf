'use client';

export async function apiFetch<T>(
  input: string,
  init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
): Promise<T> {
  const uid = typeof window !== 'undefined' ? window.localStorage.getItem('winey_uid') : null;

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
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}
