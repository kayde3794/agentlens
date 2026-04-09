// ─── Trace Ingestion API ────────────────────────────────────────────────────
// POST /api/ingest — Receives trace steps from the Python/JS SDK
// POST /api/ingest?action=end — Marks a session as completed

import { NextResponse } from 'next/server';
import { traceStore } from '@/lib/trace-store';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const body = await request.json();

    // End session
    if (action === 'end') {
      const { session_id, status } = body;
      if (!session_id) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400 });
      }
      traceStore.endSession(session_id, status || 'completed');
      return NextResponse.json({ ok: true, session_id });
    }

    // Ingest a single step
    if (!body.session_id || !body.agent_name) {
      return NextResponse.json(
        { error: 'session_id and agent_name are required' },
        { status: 400 }
      );
    }

    const step = traceStore.ingestStep(body);

    return NextResponse.json({
      ok: true,
      step_id: step.id,
      session_id: step.session_id,
      anomalies: step.anomalies?.length || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/ingest — Returns all live sessions
export async function GET() {
  const sessions = traceStore.getAllSessions();
  return NextResponse.json(sessions);
}
