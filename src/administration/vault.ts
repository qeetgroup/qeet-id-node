import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

export interface Secret {
  id: string;
  name: string;
  scope: string;
  last4: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSecretInput {
  name: string;
  scope: string;
  value: string;
}

export interface UpdateSecretInput {
  scope?: string;
  value?: string;
}

export interface VaultGetResult {
  value: string;
}

/**
 * VaultService is the encrypted secrets store used by agent/developer
 * credentials (3rd-party OAuth tokens, API keys agents hold on a user's
 * behalf).
 */
export class VaultService {
  constructor(private readonly t: Transport) {}

  /** Fetches the value of a vault secret by name (agent-scoped endpoint). */
  get(name: string, opts?: RequestOpts): Promise<VaultGetResult> {
    return this.t.get<VaultGetResult>(`/v1/vault/${encodeURIComponent(name)}`, opts);
  }

  async listSecrets(tenantId: string, opts?: RequestOpts): Promise<Secret[]> {
    const env = await this.t.get<Envelope<Secret>>(`/v1/tenants/${encodeURIComponent(tenantId)}/secrets`, opts);
    return resolveEnvelope(env);
  }

  createSecret(tenantId: string, input: CreateSecretInput, opts?: RequestOpts): Promise<Secret> {
    return this.t.post<Secret>(`/v1/tenants/${encodeURIComponent(tenantId)}/secrets`, input, opts);
  }

  updateSecret(tenantId: string, id: string, input: UpdateSecretInput, opts?: RequestOpts): Promise<Secret> {
    return this.t.patch<Secret>(`/v1/tenants/${encodeURIComponent(tenantId)}/secrets/${encodeURIComponent(id)}`, input, opts);
  }

  revealSecret(tenantId: string, id: string, opts?: RequestOpts): Promise<VaultGetResult> {
    return this.t.post<VaultGetResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/secrets/${encodeURIComponent(id)}/reveal`, {}, opts);
  }

  deleteSecret(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/secrets/${encodeURIComponent(id)}`, opts);
  }
}
