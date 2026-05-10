/**
 * Simple in-memory rate limiter to prevent API abuse.
 * Limits: 5 requests per minute per IP (aggressive, won't affect real users during normal gameplay)
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const limiter = new Map<string, RateLimitEntry>();

// Cleanup old entries every 2 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limiter.entries()) {
    if (entry.resetAt < now) {
      limiter.delete(key);
    }
  }
}, 2 * 60 * 1000);

export function checkRateLimit(identifier: string, maxRequests = 5, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  const entry = limiter.get(identifier);

  if (!entry || entry.resetAt < now) {
    // First request or window expired
    limiter.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return false;
  }

  // Increment count
  entry.count += 1;
  return true;
}

export function getRateLimitIdentifier(req: Request): string {
  // Try to get IP from various headers (works with Vercel, CloudFlare, etc.)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  const ip = cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
  return ip.trim();
}

