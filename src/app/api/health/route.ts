import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit';

/**
 * Health check endpoint - useful for monitoring, deployment checks, and verifying API is running.
 * Rate limited to 5 requests/minute per IP to prevent abuse.
 */
export async function GET(req: Request) {
  const identifier = getRateLimitIdentifier(req);
  
  if (!checkRateLimit(identifier, 5, 60 * 1000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}

