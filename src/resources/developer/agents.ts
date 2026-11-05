import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** An AI agent's lifecycle state. `decommissioned` is final. */
export type AgentLifecycle = "active" | "suspended" | "decommissioned";

/** An AI agent identity, accountable to a human sponsor. */
export interface Agent {
  id: string;
  name: string;
  scopes: string[];
  /** The lifetime of the tokens it gets. */
  token_ttl_seconds: number;
  status: AgentLifecycle | (string & {});
  /** True whenever `status` isn't `active`. */
  disabled: boolean;
  /** The person accountable for the agent. */
  sponsor_user_id?: string;
  last_used_at?: string | null;
  /** While a rotated-out secret still gets tokens. */
  previous_secret_expires_at?: string;
  created_at: string;
  /** The agent's secret: only in `create`'s answer, once. */
  secret?: string;
}

export interface AgentCreateParams {
  name: string;
  /** The person accountable for the agent. Required. */
  sponsor_user_id: string;
  scopes?: string[];
  token_ttl_seconds?: number;
}

/** A token for an agent, from its id and secret. */
export interface AgentToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/** A new agent secret, shown once, and when the old one stops working. */
export interface AgentSecret {
  id: string;
  secret: string;
  previous_secret_expires_at: string;
}

/** Manages AI agent identities: their tokens, secrets and lifecycle. */
export class Agents extends ApiResource {
  async create(tenantId: string, params: AgentCreateParams, options?: IdempotentRequestOptions): Promise<Agent> {
    return this._request({ method: "POST", path: path`/v1/tenants/${tenantId}/agents`, body: params, idempotent: true }, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<Agent>> {
    return this._list(path`/v1/tenants/${tenantId}/agents`, undefined, options);
  }

  async delete(tenantId: string, agentId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/agents/${agentId}`, options);
  }

  /** Suspends (`true`) or resumes (`false`) the agent. Prefer `suspend` and `resume`. */
  async setDisabled(tenantId: string, agentId: string, disabled: boolean, options?: RequestOptions): Promise<void> {
    await this._send("PATCH", path`/v1/tenants/${tenantId}/agents/${agentId}`, { disabled }, options);
  }

  /** Suspends the agent: its tokens stop working at once. Reversible with `resume`. */
  async suspend(tenantId: string, agentId: string, options?: RequestOptions): Promise<{ status: AgentLifecycle }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/${agentId}/suspend`, undefined, options);
  }

  async resume(tenantId: string, agentId: string, options?: RequestOptions): Promise<{ status: AgentLifecycle }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/${agentId}/resume`, undefined, options);
  }

  /** Retires the agent for good. */
  async decommission(tenantId: string, agentId: string, options?: RequestOptions): Promise<{ status: AgentLifecycle }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/${agentId}/decommission`, undefined, options);
  }

  /** Incident response: suspends every active agent of the organisation at once. */
  async suspendAll(tenantId: string, options?: RequestOptions): Promise<{ suspended: number }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/kill-all`, undefined, options);
  }

  /** Resumes every suspended agent of the organisation at once. */
  async resumeAll(tenantId: string, options?: RequestOptions): Promise<{ resumed: number }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/resume-all`, undefined, options);
  }

  /** Issues a new secret, shown once; the old one keeps working for `overlap_hours`. */
  async rotateSecret(
    tenantId: string,
    agentId: string,
    params: { overlap_hours?: number } = {},
    options?: RequestOptions,
  ): Promise<AgentSecret> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/${agentId}/rotate-secret`, params, options);
  }

  /** Lists the agents a person sponsors. */
  async listSponsoredBy(tenantId: string, userId: string, options?: RequestOptions): Promise<ListResult<Agent>> {
    return this._list(path`/v1/tenants/${tenantId}/agents/sponsored-by/${userId}`, undefined, options);
  }

  /** Gives every agent a person sponsors to another sponsor, as when the person leaves. */
  async transferSponsorship(
    tenantId: string,
    fromUserId: string,
    toUserId: string,
    options?: RequestOptions,
  ): Promise<{ transferred: number }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/agents/sponsored-by/${fromUserId}/transfer`, { to_user_id: toUserId }, options);
  }

  /**
   * Gets a short-lived access token for an agent from its id and secret. The
   * token carries the agent's scopes. Sends no API key.
   */
  async createToken(agentId: string, secret: string, options?: RequestOptions): Promise<AgentToken> {
    return this._request({ method: "POST", path: "/v1/agents/token", body: { agent_id: agentId, secret }, authenticate: false }, options);
  }
}
