export function getUidFromRequest(
  req: Request,
  body?: unknown
): string | null {
  const headerUid = req.headers.get('x-uid');
  if (headerUid) return headerUid;

  if (body && typeof body === 'object' && body !== null && 'uid' in body) {
    const uid = (body as { uid?: unknown }).uid;
    if (typeof uid === 'string' && uid.trim()) return uid;
  }

  return null;
}
