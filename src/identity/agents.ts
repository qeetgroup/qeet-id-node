import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  scopes: string[];
  token_ttl_seconds: number;
  disabled: boolean;
  created_at: string;
  /** Only present on create. */
  secret?: string;
}

export interface CreateAgentInput {
  name: string;
  scopes?: string[];
  token_ttl_seconds?: number;
}

/** `disabled` is the only mutable field, per the backend. */
export interface UpdateAgentInput {
  disabled: boolean;
}

export interface AgentTokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/** The lifecycle state returned by suspend/resume/decommission. */
export interface AgentStatus {
  /** active | suspended | decommissioned */
  status: string;
}

/** Reports how many agents an incident-response kill-switch suspended. */
export interface KillAllResult {
  suspended: number;
}

/** Names the new sponsor for an offboarded user's agents. */
export interface TransferSponsorshipInput {
  to_user_id: string;
}

/** Reports how many agents were transferred. */
export interface TransferSponsorshipResult {
  transferred: number;
}

/**
 * Manages AI-agent identities: ephemeral tokens and the
 * suspend/resume/decommission lifecycle.
 */
export class AgentsService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateAgentInput, opts?: RequestOpts): Promise<Agent> {
    return this.t.post<Agent>(`/v1/tenants/${encodeURIComponent(tenantId)}/agents`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/agents/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<Agent[]> {
    const env = await this.t.get<Envelope<Agent>>(`/v1/tenants/${encodeURIComponent(tenantId)}/agents`, opts);
    return resolveEnvelope(env);
  }

  /** Toggles `disabled` — the only field the backend allows mutating here. */
  update(tenantId: string, id: string, input: UpdateAgentInput, opts?: RequestOpts): Promise<Agent> {
    return this.t.patch<Agent>(`/v1/tenants/${encodeURIComponent(tenantId)}/agents/${encodeURIComponent(id)}`, input, opts);
  }

  /** Mints a short-lived access token for an AI agent. */
  token(tenantId: string, agentId: string, secret: string, scope?: string, opts?: RequestOpts): Promise<AgentTokenResult> {
    const body: Record<string, string> = { tenant_id: tenantId, agent_id: agentId, secret };
    if (scope) body.scope = scope;
    return this.t.post<AgentTokenResult>("/v1/agents/token", body, opts);
  }

  /** Reversibly disables an agent — it can be resumed. */
  suspend(tenantId: string, id: string, opts?: RequestOpts): Promise<AgentStatus> {
    return this.t.post<AgentStatus>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/agents/${encodeURIComponent(id)}/suspend`,
      undefined,
      opts,
    );
  }

  /** Reverses a suspend. */
  resume(tenantId: string, id: string, opts?: RequestOpts): Promise<AgentStatus> {
    return this.t.post<AgentStatus>(`/v1/tenants/${encodeURIComponent(tenantId)}/agents/${encodeURIComponent(id)}/resume`, undefined, opts);
  }

  /** Terminal — a decommissioned agent cannot be resumed. */
  decommission(tenantId: string, id: string, opts?: RequestOpts): Promise<AgentStatus> {
    return this.t.post<AgentStatus>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/agents/${encodeURIComponent(id)}/decommission`,
      undefined,
      opts,
    );
  }

  /** Incident-response switch: suspends every agent in the tenant. */
  killAll(tenantId: string, opts?: RequestOpts): Promise<KillAllResult> {
    return this.t.post<KillAllResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/agents/kill-all`, undefined, opts);
  }

  /** Lists every agent a given human user sponsors. */
  async listSponsoredBy(tenantId: string, userId: string, opts?: RequestOpts): Promise<Agent[]> {
    const path = `/v1/tenants/${encodeURIComponent(tenantId)}/agents/sponsored-by/${encodeURIComponent(userId)}`;
    const env = await this.t.get<Envelope<Agent>>(path, opts);
    return resolveEnvelope(env);
  }

  /**
   * Reassigns every agent sponsored by `userId` to a new sponsor — the
   * standard step when offboarding a human sponsor.
   */
  transferSponsorship(
    tenantId: string,
    userId: string,
    input: TransferSponsorshipInput,
    opts?: RequestOpts,
  ): Promise<TransferSponsorshipResult> {
    const path = `/v1/tenants/${encodeURIComponent(tenantId)}/agents/sponsored-by/${encodeURIComponent(userId)}/transfer`;
    return this.t.post<TransferSponsorshipResult>(path, input, opts);
  }
}
