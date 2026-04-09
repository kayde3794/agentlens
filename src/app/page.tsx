'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TraceSession, TraceStep, Anomaly } from '@/lib/types';
import { demoSessions } from '@/lib/demo-data';

// ─── Step Type Config ───────────────────────────────────────────────────────
const STEP_TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  llm_call: { icon: '🧠', label: 'LLM Call' },
  tool_call: { icon: '🔧', label: 'Tool Call' },
  mcp_invoke: { icon: '🔌', label: 'MCP Invoke' },
  agent_spawn: { icon: '🚀', label: 'Agent Spawn' },
  decision: { icon: '🎯', label: 'Decision' },
  error: { icon: '💥', label: 'Error' },
};

// ─── Helper Functions ───────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.001) return `$${cost.toFixed(5)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${tokens}`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getStepPreview(step: TraceStep): string {
  if (step.step_type === 'llm_call') {
    return step.prompt?.substring(0, 120) || step.response?.substring(0, 120) || '';
  }
  if (step.step_type === 'tool_call') {
    return `${step.tool_name}(${JSON.stringify(step.tool_input || {}).substring(0, 80)})`;
  }
  if (step.step_type === 'mcp_invoke' && step.mcp) {
    return `${step.mcp.server_name}.${step.mcp.tool_name}()`;
  }
  if (step.step_type === 'agent_spawn') {
    return `Spawning ${step.spawned_agent}`;
  }
  if (step.step_type === 'decision') {
    return step.decision_reason || '';
  }
  if (step.step_type === 'error') {
    return step.error_message || 'Unknown error';
  }
  return '';
}

// ─── Session Card Component ────────────────────────────────────────────────
function SessionCard({
  session,
  active,
  onClick,
}: {
  session: TraceSession;
  active: boolean;
  onClick: () => void;
}) {
  const statusClass = session.status === 'failed' ? 'failed' : '';
  return (
    <div
      className={`session-card ${active ? 'active' : ''} ${statusClass}`}
      onClick={onClick}
      id={`session-${session.id}`}
    >
      <div className="session-card-name">{session.name}</div>
      <div className="session-card-meta">
        <span className="session-card-stat">
          <span className="value">{session.agents.length}</span> agents
        </span>
        <span className="session-card-stat">
          <span className="value">{session.total_steps}</span> steps
        </span>
        <span className="session-card-stat">
          <span className="value">{formatCost(session.total_cost)}</span>
        </span>
      </div>
      <div className={`session-card-status ${session.status}`}>
        <span className={`status-dot ${session.status === 'running' ? 'pulse' : ''}`} />
        {session.status}
        {session.anomaly_count > 0 && (
          <span style={{ marginLeft: 6 }}>⚠️ {session.anomaly_count}</span>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Step Component ────────────────────────────────────────────────
function TimelineStep({
  step,
  index,
  active,
  onClick,
}: {
  step: TraceStep;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const config = STEP_TYPE_CONFIG[step.step_type] || { icon: '❓', label: 'Unknown' };
  const hasAnomaly = step.anomalies && step.anomalies.length > 0;
  const isCritical = step.anomalies?.some(a => a.severity === 'critical');

  return (
    <div
      className={`timeline-step ${active ? 'active' : ''} ${hasAnomaly ? 'has-anomaly' : ''} ${isCritical ? 'critical' : ''}`}
      onClick={onClick}
      style={{
        animationDelay: `${index * 60}ms`,
        // Timeline dot color matches agent
        ['--agent-color' as string]: step.agent_color,
      }}
      id={`step-${step.id}`}
    >
      <style>{`
        #step-${step.id}::before {
          background: ${step.agent_color};
        }
      `}</style>
      <div className="step-header">
        <div className="step-header-left">
          <span
            className="step-agent-badge"
            style={{
              color: step.agent_color,
              background: `${step.agent_color}15`,
              border: `1px solid ${step.agent_color}30`,
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: step.agent_color,
              display: 'inline-block',
            }} />
            {step.agent_name}
          </span>
          <span className="step-type-badge">
            <span className="step-type-icon">{config.icon}</span>
            {config.label}
          </span>
        </div>
        <div className="step-header-right">
          <span className="step-duration">{formatDuration(step.duration_ms)}</span>
          {step.cost && step.cost.total_cost > 0 && (
            <span className="step-cost-badge">{formatCost(step.cost.total_cost)}</span>
          )}
          {step.status === 'error' && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>✕ Error</span>}
          {step.status === 'loop_detected' && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>🔄 Loop</span>}
        </div>
      </div>
      <div className="step-preview">{getStepPreview(step)}</div>
      {hasAnomaly && step.anomalies!.map((anomaly, i) => (
        <div key={i} className={`step-anomaly-bar ${anomaly.severity}`}>
          <span>{anomaly.severity === 'critical' ? '🚨' : '⚠️'}</span>
          <span>{anomaly.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Inspector Panel Component ──────────────────────────────────────────────
type InspectorTab = 'details' | 'prompt' | 'response' | 'mcp' | 'anomalies';

function InspectorPanel({ step, session }: { step: TraceStep | null; session: TraceSession | null }) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('details');

  if (!step) {
    return (
      <div className="inspector">
        <div className="inspector-header">
          <span className="inspector-title">Inspector</span>
        </div>
        <div className="inspector-empty">
          <div className="inspector-empty-icon">🔍</div>
          <div className="inspector-empty-text">Select a step to inspect</div>
          <div className="inspector-empty-hint">
            Click any step in the timeline to view its full details,
            prompts, responses, and diagnostics
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: InspectorTab; label: string; show: boolean }[] = [
    { id: 'details', label: 'Details', show: true },
    { id: 'prompt', label: 'Prompt', show: step.step_type === 'llm_call' },
    { id: 'response', label: 'Response', show: step.step_type === 'llm_call' },
    { id: 'mcp', label: 'MCP', show: step.step_type === 'mcp_invoke' },
    { id: 'anomalies', label: `Anomalies (${step.anomalies?.length || 0})`, show: (step.anomalies?.length || 0) > 0 },
  ];

  // Reset tab if current tab is not available
  const visibleTabs = tabs.filter(t => t.show);
  const currentTab = visibleTabs.find(t => t.id === activeTab) ? activeTab : 'details';

  return (
    <div className="inspector">
      <div className="inspector-header">
        <span className="inspector-title">Inspector</span>
        <span
          className="step-agent-badge"
          style={{
            color: step.agent_color,
            background: `${step.agent_color}15`,
            border: `1px solid ${step.agent_color}30`,
          }}
        >
          {step.agent_name}
        </span>
      </div>

      <div className="inspector-tabs">
        {visibleTabs.map(tab => (
          <div
            key={tab.id}
            className={`inspector-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div className="inspector-content">
        {currentTab === 'details' && <InspectorDetails step={step} />}
        {currentTab === 'prompt' && <InspectorPrompt step={step} />}
        {currentTab === 'response' && <InspectorResponse step={step} />}
        {currentTab === 'mcp' && <InspectorMCP step={step} />}
        {currentTab === 'anomalies' && <InspectorAnomalies step={step} />}
      </div>
    </div>
  );
}

function InspectorDetails({ step }: { step: TraceStep }) {
  return (
    <>
      <div className="data-section animate-in">
        <div className="data-section-header">
          <span className="data-section-title">Metadata</span>
        </div>
        <div className="data-block">
          <div className="data-kv-row">
            <span className="data-kv-key">Step ID</span>
            <span className="data-kv-value">{step.id}</span>
          </div>
          <div className="data-kv-row">
            <span className="data-kv-key">Type</span>
            <span className="data-kv-value">{STEP_TYPE_CONFIG[step.step_type]?.label || step.step_type}</span>
          </div>
          <div className="data-kv-row">
            <span className="data-kv-key">Status</span>
            <span className={`data-kv-value ${step.status === 'error' || step.status === 'loop_detected' ? 'error' : ''}`}>
              {step.status}
            </span>
          </div>
          {step.provider && (
            <div className="data-kv-row">
              <span className="data-kv-key">Provider</span>
              <span className="data-kv-value provider">{step.provider}</span>
            </div>
          )}
          {step.model && (
            <div className="data-kv-row">
              <span className="data-kv-key">Model</span>
              <span className="data-kv-value model">{step.model}</span>
            </div>
          )}
          {step.temperature !== undefined && (
            <div className="data-kv-row">
              <span className="data-kv-key">Temperature</span>
              <span className="data-kv-value">{step.temperature}</span>
            </div>
          )}
          <div className="data-kv-row">
            <span className="data-kv-key">Duration</span>
            <span className="data-kv-value">{formatDuration(step.duration_ms)}</span>
          </div>
          <div className="data-kv-row">
            <span className="data-kv-key">Timestamp</span>
            <span className="data-kv-value">{new Date(step.timestamp).toLocaleTimeString()}</span>
          </div>
          {step.spawned_agent && (
            <div className="data-kv-row">
              <span className="data-kv-key">Spawned</span>
              <span className="data-kv-value" style={{ color: 'var(--accent-amber)' }}>{step.spawned_agent}</span>
            </div>
          )}
          {step.decision_reason && (
            <div className="data-kv-row">
              <span className="data-kv-key">Reason</span>
              <span className="data-kv-value">{step.decision_reason}</span>
            </div>
          )}
          {step.error_message && (
            <div className="data-kv-row">
              <span className="data-kv-key">Error</span>
              <span className="data-kv-value error">{step.error_message}</span>
            </div>
          )}
        </div>
      </div>

      {step.tokens && (
        <div className="data-section animate-in" style={{ animationDelay: '100ms' }}>
          <div className="data-section-header">
            <span className="data-section-title">Token Usage</span>
            <span className="data-section-badge">{formatTokens(step.tokens.total_tokens)} total</span>
          </div>
          <div className="data-block">
            <div className="data-kv-row">
              <span className="data-kv-key">Prompt</span>
              <span className="data-kv-value">{step.tokens.prompt_tokens.toLocaleString()}</span>
            </div>
            <div className="data-kv-row">
              <span className="data-kv-key">Completion</span>
              <span className="data-kv-value">{step.tokens.completion_tokens.toLocaleString()}</span>
            </div>
            <div className="data-kv-row">
              <span className="data-kv-key">Total</span>
              <span className="data-kv-value">{step.tokens.total_tokens.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ padding: '0 4px' }}>
            <div className="token-bar">
              <div
                className="token-bar-segment input"
                style={{ width: `${(step.tokens.prompt_tokens / step.tokens.total_tokens) * 100}%` }}
              />
              <div
                className="token-bar-segment output"
                style={{ width: `${(step.tokens.completion_tokens / step.tokens.total_tokens) * 100}%` }}
              />
            </div>
            <div className="token-bar-labels">
              <span className="token-bar-label">
                <span className="token-bar-label-dot" style={{ background: 'var(--accent-cyan)' }} />
                Input ({Math.round((step.tokens.prompt_tokens / step.tokens.total_tokens) * 100)}%)
              </span>
              <span className="token-bar-label">
                <span className="token-bar-label-dot" style={{ background: 'var(--accent-purple)' }} />
                Output ({Math.round((step.tokens.completion_tokens / step.tokens.total_tokens) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {step.cost && step.cost.total_cost > 0 && (
        <div className="data-section animate-in" style={{ animationDelay: '200ms' }}>
          <div className="data-section-header">
            <span className="data-section-title">Cost Breakdown</span>
          </div>
          <div className="data-block">
            <div className="data-kv-row">
              <span className="data-kv-key">Input Cost</span>
              <span className="data-kv-value cost">{formatCost(step.cost.input_cost)}</span>
            </div>
            <div className="data-kv-row">
              <span className="data-kv-key">Output Cost</span>
              <span className="data-kv-value cost">{formatCost(step.cost.output_cost)}</span>
            </div>
            <div className="data-kv-row">
              <span className="data-kv-key">Total</span>
              <span className="data-kv-value cost" style={{ fontSize: 14, fontWeight: 700 }}>
                {formatCost(step.cost.total_cost)}
              </span>
            </div>
          </div>
        </div>
      )}

      {step.tool_name && (
        <div className="data-section animate-in" style={{ animationDelay: '150ms' }}>
          <div className="data-section-header">
            <span className="data-section-title">Tool Call</span>
          </div>
          <div className="data-block">
            <div className="data-kv-row">
              <span className="data-kv-key">Tool</span>
              <span className="data-kv-value model">{step.tool_name}</span>
            </div>
            <div className="data-kv-row">
              <span className="data-kv-key">Input</span>
              <span className="data-kv-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {JSON.stringify(step.tool_input, null, 2)}
              </span>
            </div>
            <div className="data-kv-row">
              <span className="data-kv-key">Output</span>
              <span className="data-kv-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {JSON.stringify(step.tool_output, null, 2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InspectorPrompt({ step }: { step: TraceStep }) {
  return (
    <>
      {step.system_prompt && (
        <div className="data-section animate-in">
          <div className="data-section-header">
            <span className="data-section-title">System Prompt</span>
          </div>
          <div className="data-block">
            <div className="data-block-content" style={{ color: 'var(--accent-amber)', opacity: 0.9 }}>
              {step.system_prompt}
            </div>
          </div>
        </div>
      )}
      <div className="data-section animate-in" style={{ animationDelay: '100ms' }}>
        <div className="data-section-header">
          <span className="data-section-title">User Prompt</span>
          {step.tokens && (
            <span className="data-section-badge">{step.tokens.prompt_tokens.toLocaleString()} tokens</span>
          )}
        </div>
        <div className="data-block">
          <div className="data-block-content">{step.prompt || 'No prompt data'}</div>
        </div>
      </div>
    </>
  );
}

function InspectorResponse({ step }: { step: TraceStep }) {
  return (
    <div className="data-section animate-in">
      <div className="data-section-header">
        <span className="data-section-title">Model Response</span>
        {step.tokens && (
          <span className="data-section-badge">{step.tokens.completion_tokens.toLocaleString()} tokens</span>
        )}
      </div>
      <div className="data-block">
        <div className="data-block-content" style={{ maxHeight: 500 }}>
          {step.response || 'No response data'}
        </div>
      </div>
    </div>
  );
}

function InspectorMCP({ step }: { step: TraceStep }) {
  if (!step.mcp) return null;
  const mcp = step.mcp;

  return (
    <>
      <div className="data-section animate-in">
        <div className="mcp-card">
          <div className="mcp-card-header">
            <span>🔌</span>
            <span className="mcp-server-name">{mcp.server_name}</span>
            <span className="mcp-separator">→</span>
            <span className="mcp-tool-name">{mcp.tool_name}</span>
            <span className={`mcp-valid-badge ${mcp.valid ? 'valid' : 'invalid'}`}>
              {mcp.valid ? '✓ Valid' : '✕ Invalid'}
            </span>
          </div>
          <div className="data-kv-row">
            <span className="data-kv-key">Duration</span>
            <span className="data-kv-value">{formatDuration(mcp.duration_ms)}</span>
          </div>
        </div>
      </div>

      <div className="data-section animate-in" style={{ animationDelay: '100ms' }}>
        <div className="data-section-header">
          <span className="data-section-title">Parameters</span>
        </div>
        <div className="data-block">
          <div className="data-block-content" style={{ color: 'var(--accent-cyan)' }}>
            {JSON.stringify(mcp.params, null, 2)}
          </div>
        </div>
      </div>

      <div className="data-section animate-in" style={{ animationDelay: '200ms' }}>
        <div className="data-section-header">
          <span className="data-section-title">Result</span>
        </div>
        <div className="data-block">
          <div className="data-block-content">
            {JSON.stringify(mcp.result, null, 2)}
          </div>
        </div>
      </div>

      {mcp.schema && (
        <div className="data-section animate-in" style={{ animationDelay: '300ms' }}>
          <div className="data-section-header">
            <span className="data-section-title">Schema</span>
          </div>
          <div className="data-block">
            <div className="data-block-content" style={{ color: 'var(--text-tertiary)' }}>
              {JSON.stringify(mcp.schema, null, 2)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InspectorAnomalies({ step }: { step: TraceStep }) {
  if (!step.anomalies || step.anomalies.length === 0) return null;
  return (
    <div className="data-section animate-in">
      <div className="data-section-header">
        <span className="data-section-title">Detected Anomalies</span>
        <span className="data-section-badge" style={{ color: 'var(--accent-red)', background: 'rgba(239,68,68,0.1)' }}>
          {step.anomalies.length} found
        </span>
      </div>
      {step.anomalies.map((anomaly, i) => (
        <div key={i} className={`anomaly-card ${anomaly.severity}`} style={{ animationDelay: `${i * 100}ms` }}>
          <div className="anomaly-card-header">
            <span>{anomaly.severity === 'critical' ? '🚨' : '⚠️'}</span>
            <span>{anomaly.type.replace(/_/g, ' ').toUpperCase()}</span>
          </div>
          <div>{anomaly.message}</div>
          {anomaly.details && (
            <div className="anomaly-card-details" style={{ marginTop: 6 }}>{anomaly.details}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Cost Dashboard Tab ─────────────────────────────────────────────────────
function CostDashboard({ session }: { session: TraceSession }) {
  const maxCost = Math.max(...session.agents.map(a => a.total_cost));

  return (
    <div className="inspector-content">
      <div className="cost-grid animate-in">
        <div className="cost-card">
          <div className="cost-card-value" style={{ color: 'var(--accent-emerald)' }}>
            {formatCost(session.total_cost)}
          </div>
          <div className="cost-card-label">Total Cost</div>
        </div>
        <div className="cost-card">
          <div className="cost-card-value" style={{ color: 'var(--accent-cyan)' }}>
            {formatTokens(session.total_tokens)}
          </div>
          <div className="cost-card-label">Total Tokens</div>
        </div>
        <div className="cost-card">
          <div className="cost-card-value" style={{ color: 'var(--accent-purple)' }}>
            {session.total_steps}
          </div>
          <div className="cost-card-label">Total Steps</div>
        </div>
        <div className="cost-card">
          <div className="cost-card-value" style={{ color: 'var(--accent-amber)' }}>
            {formatDuration(session.total_duration_ms)}
          </div>
          <div className="cost-card-label">Duration</div>
        </div>
      </div>

      <div className="data-section animate-in" style={{ animationDelay: '100ms' }}>
        <div className="data-section-header">
          <span className="data-section-title">Cost by Agent</span>
        </div>
        {session.agents.map((agent, i) => (
          <div key={agent.name} className="cost-agent-row">
            <span className="cost-agent-name" style={{ color: agent.color }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: agent.color,
                display: 'inline-block',
                marginRight: 8,
              }} />
              {agent.name}
            </span>
            <div className="cost-agent-bar-container">
              <div
                className="cost-agent-bar"
                style={{
                  width: maxCost > 0 ? `${(agent.total_cost / maxCost) * 100}%` : '0%',
                  background: agent.color,
                }}
              />
            </div>
            <span className="cost-agent-value" style={{ color: agent.color }}>
              {formatCost(agent.total_cost)}
            </span>
          </div>
        ))}
      </div>

      <div className="data-section animate-in" style={{ animationDelay: '200ms' }}>
        <div className="data-section-header">
          <span className="data-section-title">Token Distribution</span>
        </div>
        {session.agents.map((agent) => (
          <div key={agent.name} className="cost-agent-row">
            <span className="cost-agent-name" style={{ color: agent.color }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: agent.color,
                display: 'inline-block',
                marginRight: 8,
              }} />
              {agent.name}
            </span>
            <div className="cost-agent-bar-container">
              <div
                className="cost-agent-bar"
                style={{
                  width: session.total_tokens > 0 ? `${(agent.total_tokens / session.total_tokens) * 100}%` : '0%',
                  background: agent.color,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="cost-agent-value" style={{ color: 'var(--text-secondary)' }}>
              {formatTokens(agent.total_tokens)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function AgentLensApp() {
  const [sessions] = useState<TraceSession[]>(demoSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [rightPanel, setRightPanel] = useState<'inspector' | 'cost'>('inspector');
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeStep = activeSession?.steps.find(s => s.id === activeStepId) || null;

  // Auto-select first session
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Playback logic
  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (!activeSession) return;
    setIsPlaying(true);
    let idx = playbackIndex;

    playIntervalRef.current = setInterval(() => {
      if (idx >= activeSession.steps.length - 1) {
        stopPlayback();
        return;
      }
      idx++;
      setPlaybackIndex(idx);
      setActiveStepId(activeSession.steps[idx].id);
    }, 1200);
  }, [activeSession, playbackIndex, stopPlayback]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);

  // Reset on session change
  useEffect(() => {
    stopPlayback();
    setActiveStepId(null);
    setPlaybackIndex(0);
  }, [activeSessionId, stopPlayback]);

  // Handle scrubber click
  const handleScrubberClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeSession) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const idx = Math.min(
      Math.floor(percent * activeSession.steps.length),
      activeSession.steps.length - 1
    );
    setPlaybackIndex(idx);
    setActiveStepId(activeSession.steps[idx].id);
  }, [activeSession]);

  const playbackPercent = activeSession
    ? ((playbackIndex + 1) / activeSession.steps.length) * 100
    : 0;

  return (
    <div className="app-layout" id="agentlens-app">
      {/* ─── Header ─── */}
      <header className="header" id="header">
        <div className="header-brand">
          <div className="header-logo">🔍</div>
          <span className="header-title">AgentLens</span>
          <span className="header-subtitle">AI Agent Debugger & Replay Inspector</span>
        </div>
        <div className="header-actions">
          <div className="header-badge demo">⚡ DEMO MODE</div>
          <div
            className="header-badge"
            style={{ cursor: 'pointer' }}
            onClick={() => setRightPanel(rightPanel === 'cost' ? 'inspector' : 'cost')}
            id="toggle-cost-dashboard"
          >
            💰 {rightPanel === 'cost' ? 'Inspector' : 'Cost Dashboard'}
          </div>
        </div>
      </header>

      {/* ─── Sidebar ─── */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-section-title">Trace Sessions</div>
        {sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
            onClick={() => setActiveSessionId(session.id)}
          />
        ))}

        {/* Agent legend */}
        {activeSession && (
          <>
            <div className="sidebar-section-title" style={{ marginTop: 24 }}>
              Agents ({activeSession.agents.length})
            </div>
            {activeSession.agents.map(agent => (
              <div
                key={agent.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: agent.color, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600, color: agent.color }}>{agent.name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {agent.step_count} steps
                </span>
              </div>
            ))}
          </>
        )}
      </aside>

      {/* ─── Main Panel ─── */}
      <div className="main-panel" id="main-panel">
        {activeSession ? (
          <>
            {/* Stats bar */}
            <div className="stats-bar">
              <div className="stat-chip">
                <span className="stat-chip-icon">🕐</span>
                <span className="stat-chip-label">Duration</span>
                <span className="stat-chip-value">{formatDuration(activeSession.total_duration_ms)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon">🧠</span>
                <span className="stat-chip-label">Tokens</span>
                <span className="stat-chip-value">{formatTokens(activeSession.total_tokens)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon">💰</span>
                <span className="stat-chip-label">Cost</span>
                <span className="stat-chip-value cost">{formatCost(activeSession.total_cost)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon">📊</span>
                <span className="stat-chip-label">Steps</span>
                <span className="stat-chip-value">{activeSession.total_steps}</span>
              </div>
              {activeSession.anomaly_count > 0 && (
                <div className="stat-chip">
                  <span className="stat-chip-icon">⚠️</span>
                  <span className="stat-chip-label">Anomalies</span>
                  <span className="stat-chip-value warning">{activeSession.anomaly_count}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="timeline-container" id="timeline">
              <div className="timeline">
                {activeSession.steps.map((step, i) => (
                  <TimelineStep
                    key={step.id}
                    step={step}
                    index={i}
                    active={step.id === activeStepId}
                    onClick={() => {
                      setActiveStepId(step.id);
                      setPlaybackIndex(i);
                      setRightPanel('inspector');
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Playback controls */}
            <div className="playback-bar" id="playback">
              <button
                className={`playback-btn ${isPlaying ? 'playing' : ''}`}
                onClick={() => {
                  stopPlayback();
                  setPlaybackIndex(0);
                  setActiveStepId(activeSession.steps[0]?.id || null);
                }}
                title="Reset"
              >
                ⟲
              </button>
              <button
                className={`playback-btn ${isPlaying ? 'playing' : ''}`}
                onClick={togglePlayback}
                title={isPlaying ? 'Pause' : 'Play'}
                id="play-btn"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                className="playback-btn"
                onClick={() => {
                  if (!activeSession) return;
                  const nextIdx = Math.min(playbackIndex + 1, activeSession.steps.length - 1);
                  setPlaybackIndex(nextIdx);
                  setActiveStepId(activeSession.steps[nextIdx].id);
                }}
                title="Next Step"
              >
                ⏭
              </button>
              <div className="playback-scrubber" onClick={handleScrubberClick}>
                <div className="playback-track">
                  <div className="playback-progress" style={{ width: `${playbackPercent}%` }} />
                  <div className="playback-step-markers">
                    {activeSession.steps.map((step, i) => (
                      <div
                        key={step.id}
                        className="playback-marker"
                        style={{
                          left: `${((i + 0.5) / activeSession.steps.length) * 100}%`,
                          background: step.agent_color,
                          opacity: step.anomalies?.some(a => a.severity === 'critical') ? 1 : 0.4,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <span className="playback-time">
                Step {playbackIndex + 1} / {activeSession.steps.length}
              </span>
            </div>
          </>
        ) : (
          <div className="no-session">
            <div className="no-session-icon">🔍</div>
            <div className="no-session-title">Select a Trace Session</div>
            <div className="no-session-desc">
              Choose a session from the sidebar to inspect its timeline, trace steps, and cost breakdown
            </div>
          </div>
        )}
      </div>

      {/* ─── Right Panel: Inspector or Cost Dashboard ─── */}
      {rightPanel === 'inspector' ? (
        <InspectorPanel step={activeStep} session={activeSession} />
      ) : activeSession ? (
        <div className="inspector">
          <div className="inspector-header">
            <span className="inspector-title">💰 Cost Dashboard</span>
            <span
              style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}
              onClick={() => setRightPanel('inspector')}
            >
              ← Inspector
            </span>
          </div>
          <CostDashboard session={activeSession} />
        </div>
      ) : (
        <InspectorPanel step={null} session={null} />
      )}
    </div>
  );
}
