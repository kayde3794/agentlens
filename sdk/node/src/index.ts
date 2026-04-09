/**
 * AgentLens Node.js/TypeScript SDK
 *
 * Trace your AI agents with one line of code.
 *
 * @example
 * ```typescript
 * import { AgentLens } from 'agentlens-sdk';
 *
 * const lens = new AgentLens({ sessionName: 'My Pipeline' });
 *
 * // Automatic OpenAI wrapping
 * const client = lens.wrapOpenAI(new OpenAI());
 * const response = await client.chat.completions.create({ model: 'gpt-4o', messages: [...] });
 *
 * // Manual tracing
 * await lens.traceLLMCall({ agentName: 'Agent', model: 'gpt-4o', prompt: '...', response: '...' });
 *
 * await lens.end();
 * ```
 */

import { randomUUID } from 'crypto';

const DEFAULT_URL = 'http://localhost:3000';

interface AgentLensOptions {
  sessionName?: string;
  serverUrl?: string;
  sessionId?: string;
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface LLMCallOptions {
  agentName: string;
  model?: string;
  provider?: string;
  prompt?: string;
  systemPrompt?: string;
  response?: string;
  temperature?: number;
  tokens?: TokenUsage;
  durationMs?: number;
  status?: string;
}

interface ToolCallOptions {
  agentName: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  durationMs?: number;
  status?: string;
}

interface MCPCallOptions {
  agentName: string;
  serverName: string;
  toolName: string;
  params?: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  status?: string;
}

export class AgentLens {
  private serverUrl: string;
  private sessionId: string;
  private sessionName: string;

  constructor(options: AgentLensOptions = {}) {
    this.serverUrl = (options.serverUrl || DEFAULT_URL).replace(/\/$/, '');
    this.sessionId = options.sessionId || randomUUID();
    this.sessionName = options.sessionName || 'Untitled Session';
  }

  private async send(data: Record<string, unknown>, action?: string): Promise<Record<string, unknown>> {
    let url = `${this.serverUrl}/api/ingest`;
    if (action) url += `?action=${action}`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await resp.json() as Record<string, unknown>;
    } catch (err) {
      console.warn(`AgentLens send failed: ${err}`);
      return { ok: false, error: String(err) };
    }
  }

  /** Trace an LLM API call */
  async traceLLMCall(opts: LLMCallOptions): Promise<Record<string, unknown>> {
    return this.send({
      session_id: this.sessionId,
      session_name: this.sessionName,
      agent_name: opts.agentName,
      step_type: 'llm_call',
      status: opts.status || 'success',
      provider: opts.provider || 'openai',
      model: opts.model || 'unknown',
      prompt: opts.prompt || '',
      system_prompt: opts.systemPrompt || '',
      response: opts.response || '',
      temperature: opts.temperature,
      tokens: opts.tokens,
      duration_ms: opts.durationMs || 0,
    });
  }

  /** Trace a tool invocation */
  async traceToolCall(opts: ToolCallOptions): Promise<Record<string, unknown>> {
    return this.send({
      session_id: this.sessionId,
      session_name: this.sessionName,
      agent_name: opts.agentName,
      step_type: 'tool_call',
      status: opts.status || 'success',
      tool_name: opts.toolName,
      tool_input: opts.toolInput || {},
      tool_output: opts.toolOutput,
      duration_ms: opts.durationMs || 0,
    });
  }

  /** Trace an MCP tool invocation */
  async traceMCPCall(opts: MCPCallOptions): Promise<Record<string, unknown>> {
    return this.send({
      session_id: this.sessionId,
      session_name: this.sessionName,
      agent_name: opts.agentName,
      step_type: 'mcp_invoke',
      status: opts.status || 'success',
      mcp_server: opts.serverName,
      mcp_tool: opts.toolName,
      mcp_params: opts.params || {},
      mcp_result: opts.result,
      duration_ms: opts.durationMs || 0,
    });
  }

  /** Trace an agent spawn */
  async traceAgentSpawn(parentAgent: string, spawnedAgent: string, reason?: string): Promise<Record<string, unknown>> {
    return this.send({
      session_id: this.sessionId,
      session_name: this.sessionName,
      agent_name: parentAgent,
      step_type: 'agent_spawn',
      spawned_agent: spawnedAgent,
      decision_reason: reason || '',
      duration_ms: 0,
    });
  }

  /** Trace a decision point */
  async traceDecision(agentName: string, reason: string, durationMs?: number): Promise<Record<string, unknown>> {
    return this.send({
      session_id: this.sessionId,
      session_name: this.sessionName,
      agent_name: agentName,
      step_type: 'decision',
      decision_reason: reason,
      duration_ms: durationMs || 0,
    });
  }

  /** Trace an error */
  async traceError(agentName: string, errorMessage: string, errorType?: string): Promise<Record<string, unknown>> {
    return this.send({
      session_id: this.sessionId,
      session_name: this.sessionName,
      agent_name: agentName,
      step_type: 'error',
      status: 'error',
      error_message: errorMessage,
      error_type: errorType || 'Error',
      duration_ms: 0,
    });
  }

  /** End the trace session */
  async end(status: string = 'completed'): Promise<Record<string, unknown>> {
    return this.send({ session_id: this.sessionId, status }, 'end');
  }

  /** Subscribe to real-time trace events via SSE */
  connectStream(onEvent: (event: string, data: unknown) => void): () => void {
    const eventSource = new EventSource(`${this.serverUrl}/api/stream`);

    eventSource.addEventListener('step:new', (e) => {
      onEvent('step:new', JSON.parse(e.data));
    });
    eventSource.addEventListener('session:new', (e) => {
      onEvent('session:new', JSON.parse(e.data));
    });
    eventSource.addEventListener('session:end', (e) => {
      onEvent('session:end', JSON.parse(e.data));
    });
    eventSource.addEventListener('session:update', (e) => {
      onEvent('session:update', JSON.parse(e.data));
    });

    return () => eventSource.close();
  }

  /**
   * Wrap an OpenAI client instance to auto-trace all chat completions.
   * Works with the `openai` npm package.
   */
  wrapOpenAI<T>(client: T, agentName: string = 'Agent'): T {
    const lens = this;
    const c = client as Record<string, unknown>;

    if (c.chat && typeof c.chat === 'object') {
      const chat = c.chat as Record<string, unknown>;
      if (chat.completions && typeof chat.completions === 'object') {
        const completions = chat.completions as Record<string, unknown>;
        const originalCreate = completions.create as (...args: unknown[]) => Promise<unknown>;

        completions.create = async function (...args: unknown[]) {
          const start = Date.now();
          try {
            const response = await originalCreate.apply(this, args) as Record<string, unknown>;
            const durationMs = Date.now() - start;

            const kwargs = (args[0] || {}) as Record<string, unknown>;
            const messages = (kwargs.messages || []) as Array<Record<string, string>>;
            let userPrompt = '';
            let systemPrompt = '';
            for (const msg of messages) {
              if (msg.role === 'user') userPrompt = msg.content || '';
              if (msg.role === 'system') systemPrompt = msg.content || '';
            }

            let responseText = '';
            const choices = response.choices as Array<Record<string, unknown>> | undefined;
            if (choices && choices[0]) {
              const message = choices[0].message as Record<string, string> | undefined;
              if (message) responseText = message.content || '';
            }

            let tokens: TokenUsage | undefined;
            const usage = response.usage as Record<string, number> | undefined;
            if (usage) {
              tokens = {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0,
              };
            }

            await lens.traceLLMCall({
              agentName,
              model: (kwargs.model as string) || 'unknown',
              provider: 'openai',
              prompt: userPrompt,
              systemPrompt,
              response: responseText,
              temperature: kwargs.temperature as number | undefined,
              tokens,
              durationMs,
            });

            return response;
          } catch (err) {
            await lens.traceError(agentName, String(err));
            throw err;
          }
        };
      }
    }

    return client;
  }

  /** Get the session ID */
  getSessionId(): string {
    return this.sessionId;
  }
}

export default AgentLens;
