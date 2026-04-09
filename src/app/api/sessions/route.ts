import { NextResponse } from 'next/server';
import { getDemoSessions, getDemoSession } from '@/lib/demo-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (sessionId) {
    const session = getDemoSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  // Return all sessions (summary only)
  const sessions = getDemoSessions().map(s => ({
    id: s.id,
    name: s.name,
    started_at: s.started_at,
    ended_at: s.ended_at,
    status: s.status,
    agent_count: s.agents.length,
    total_steps: s.total_steps,
    total_tokens: s.total_tokens,
    total_cost: s.total_cost,
    anomaly_count: s.anomaly_count,
  }));

  return NextResponse.json(sessions);
}
