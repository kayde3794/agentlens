// ─── Team Collaboration API ─────────────────────────────────────────────────
// POST /api/share — Generate a shareable link for a session
// GET  /api/share?token=xxx — Retrieve a shared session

import { NextResponse } from 'next/server';
import { traceStore } from '@/lib/trace-store';
import { demoSessions } from '@/lib/demo-data';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    // Check live sessions
    let token = traceStore.shareSession(session_id);

    // Check demo sessions if not found in live
    if (!token) {
      const demoSession = demoSessions.find(s => s.id === session_id);
      if (demoSession) {
        token = Buffer.from(session_id).toString('base64url');
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // In production, this would be a full URL with the deployment domain
    const shareUrl = `/shared/${token}`;

    return NextResponse.json({
      ok: true,
      token,
      share_url: shareUrl,
      expires_in: '7 days',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  // Check live sessions
  let session = traceStore.getSharedSession(token);

  // Check demo sessions
  if (!session) {
    const sessionId = Buffer.from(token, 'base64url').toString();
    session = demoSessions.find(s => s.id === sessionId);
  }

  if (!session) {
    return NextResponse.json({ error: 'Shared session not found or expired' }, { status: 404 });
  }

  return NextResponse.json(session);
}
