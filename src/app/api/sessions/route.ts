import { NextResponse } from 'next/server';
import { demoSessions } from '@/lib/demo-data';
import { traceStore } from '@/lib/trace-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');
  const mode = searchParams.get('mode'); // 'live' | 'demo' | 'all'

  // Get sessions based on mode
  const liveSessions = traceStore.getAllSessions();

  if (sessionId) {
    // Check live sessions first, then demo
    const liveSession = liveSessions.find(s => s.id === sessionId);
    if (liveSession) return NextResponse.json(liveSession);

    const demoSession = demoSessions.find(s => s.id === sessionId);
    if (demoSession) return NextResponse.json(demoSession);

    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (mode === 'live') {
    return NextResponse.json(liveSessions);
  }

  if (mode === 'demo') {
    return NextResponse.json(demoSessions);
  }

  // Default: return both, live first
  const allSessions = [...liveSessions, ...demoSessions];
  return NextResponse.json(allSessions);
}
