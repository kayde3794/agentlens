// ─── In-Memory Trace Store ──────────────────────────────────────────────────
// Stores live traces received from the SDK. In production, replace with SQLite/Postgres.

import type { TraceSession, TraceStep, AgentInfo, TokenUsage, CostBreakdown } from './types';
import { calculateCost } from './types';

// Agent color palette for auto-assignment
const AGENT_COLORS = [
  '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#a855f7',
];

interface RawStep {
  session_id: string;
  session_name?: string;
  agent_name: string;
  step_type: string;
  status?: string;
  timestamp?: string;
  duration_ms?: number;
  provider?: string;
  model?: string;
  prompt?: string;
  system_prompt?: string;
  response?: string;
  temperature?: number;
  tokens?: TokenUsage;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: unknown;
  mcp_server?: string;
  mcp_tool?: string;
  mcp_params?: Record<string, unknown>;
  mcp_result?: unknown;
  spawned_agent?: string;
  decision_reason?: string;
  error_message?: string;
  error_type?: string;
}

class TraceStore {
  private sessions: Map<string, TraceSession> = new Map();
  private agentColorMap: Map<string, string> = new Map();
  private colorIndex = 0;

  getAgentColor(agentName: string): string {
    if (!this.agentColorMap.has(agentName)) {
      this.agentColorMap.set(agentName, AGENT_COLORS[this.colorIndex % AGENT_COLORS.length]);
      this.colorIndex++;
    }
    return this.agentColorMap.get(agentName)!;
  }

  ingestStep(raw: RawStep): TraceStep {
    const sessionId = raw.session_id;
    const now = new Date().toISOString();

    // Create session if it doesn't exist
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        name: raw.session_name || `Session ${sessionId.substring(0, 8)}`,
        started_at: now,
        status: 'running',
        agents: [],
        total_steps: 0,
        total_tokens: 0,
        total_cost: 0,
        total_duration_ms: 0,
        anomaly_count: 0,
        steps: [],
      });
    }

    const session = this.sessions.get(sessionId)!;

    // Auto-calculate cost if tokens and model provided
    let cost: CostBreakdown | undefined;
    if (raw.tokens && raw.model) {
      cost = calculateCost(raw.model, raw.tokens);
    }

    // Build the step
    const step: TraceStep = {
      id: `${sessionId}-step-${session.total_steps}`,
      session_id: sessionId,
      agent_name: raw.agent_name,
      agent_color: this.getAgentColor(raw.agent_name),
      step_index: session.total_steps,
      step_type: (raw.step_type || 'llm_call') as TraceStep['step_type'],
      status: (raw.status || 'success') as TraceStep['status'],
      timestamp: raw.timestamp || now,
      duration_ms: raw.duration_ms || 0,
      provider: raw.provider as TraceStep['provider'],
      model: raw.model,
      prompt: raw.prompt,
      system_prompt: raw.system_prompt,
      response: raw.response,
      temperature: raw.temperature,
      tokens: raw.tokens,
      cost,
      tool_name: raw.tool_name,
      tool_input: raw.tool_input,
      tool_output: raw.tool_output,
      spawned_agent: raw.spawned_agent,
      decision_reason: raw.decision_reason,
      error_message: raw.error_message,
      error_type: raw.error_type,
      anomalies: [],
    };

    // Build MCP data if present
    if (raw.mcp_server && raw.mcp_tool) {
      step.mcp = {
        server_name: raw.mcp_server,
        tool_name: raw.mcp_tool,
        params: raw.mcp_params || {},
        result: raw.mcp_result,
        duration_ms: raw.duration_ms || 0,
        valid: true,
      };
    }

    // Add step to session
    session.steps.push(step);
    session.total_steps = session.steps.length;
    session.total_duration_ms += step.duration_ms;
    if (step.tokens) {
      session.total_tokens += step.tokens.total_tokens;
    }
    if (cost) {
      session.total_cost += cost.total_cost;
    }

    // Update agent info
    let agentInfo = session.agents.find(a => a.name === step.agent_name);
    if (!agentInfo) {
      agentInfo = {
        name: step.agent_name,
        color: step.agent_color,
        model: step.model,
        provider: step.provider,
        step_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };
      session.agents.push(agentInfo);
    }
    agentInfo.step_count++;
    if (step.tokens) agentInfo.total_tokens += step.tokens.total_tokens;
    if (cost) agentInfo.total_cost += cost.total_cost;

    // Update session status
    if (step.status === 'error') {
      session.status = 'failed';
    }

    // Run anomaly detection
    this.detectAnomalies(session, step);

    return step;
  }

  private detectAnomalies(session: TraceSession, step: TraceStep) {
    // Check for repeated prompts (loop detection)
    if (step.prompt && session.steps.length >= 2) {
      const prev = session.steps[session.steps.length - 2];
      if (prev.prompt && prev.agent_name === step.agent_name) {
        const similarity = this.textSimilarity(step.prompt, prev.prompt);
        if (similarity > 0.85) {
          step.anomalies = step.anomalies || [];
          step.anomalies.push({
            type: 'repeated_prompt',
            severity: 'warning',
            message: `${(similarity * 100).toFixed(0)}% similar to previous prompt`,
            details: 'Possible infinite loop detected',
          });
          session.anomaly_count++;
        }
      }
    }

    // Check for high cost
    if (step.cost && step.cost.total_cost > 0.05) {
      step.anomalies = step.anomalies || [];
      step.anomalies.push({
        type: 'high_cost',
        severity: step.cost.total_cost > 0.20 ? 'critical' : 'warning',
        message: `High cost step: $${step.cost.total_cost.toFixed(4)}`,
      });
      session.anomaly_count++;
    }

    // Check for empty response
    if (step.step_type === 'llm_call' && (!step.response || step.response.trim() === '')) {
      step.anomalies = step.anomalies || [];
      step.anomalies.push({
        type: 'empty_response',
        severity: 'warning',
        message: 'Model returned empty response',
      });
      session.anomaly_count++;
    }
  }

  private textSimilarity(a: string, b: string): number {
    const tokensA = new Set(a.toLowerCase().split(/\s+/));
    const tokensB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...tokensA].filter(t => tokensB.has(t));
    const union = new Set([...tokensA, ...tokensB]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }

  endSession(sessionId: string, status?: 'completed' | 'failed') {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status || 'completed';
      session.ended_at = new Date().toISOString();
    }
  }

  getSession(sessionId: string): TraceSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TraceSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
  }

  clear() {
    this.sessions.clear();
  }
}

// Singleton instance
export const traceStore = new TraceStore();
