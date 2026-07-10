import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/** APIKey is a server-side management-API key. There is no per-key Get or Rotate in the backend — only Create, Delete (revoke), and List. */
export interface APIKey {
  id: string;
  tenant_id: string;
  user_id?: string;
  name: string;
  prefix: string;
  scopes?: string[];
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
  created_at: string;
}

/**
 * CreateAPIKeyInput — `tenant_id` and `name` are required. Unlike most other
 * resources, `tenant_id` here is genuinely required in the body (not derived
 * from the caller's own key) — you're creating a key for a tenant, so it
 * can't be implicit. `expires_at` is an RFC3339 timestamp, not a day offset.
 */
export interface CreateAPIKeyInput {
  tenant_id: string;
  user_id?: string;
  name: string;
  scopes?: string[];
  expires_at?: string;
}

/** CreateAPIKeyResult carries the plaintext secret, shown once at creation. */
export interface CreateAPIKeyResult {
  api_key: APIKey;
  secret: string;
  warning?: string;
}

/** APIKeysService manages server-side API keys. */
export class APIKeysService {
  constructor(private readonly t: Transport) {}

  create(input: CreateAPIKeyInput, opts?: RequestOpts): Promise<CreateAPIKeyResult> {
    return this.t.post<CreateAPIKeyResult>("/v1/api-keys", input, opts);
  }

  /** Revokes an API key immediately. */
  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/api-keys/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<APIKey[]> {
    const env = await this.t.get<Envelope<APIKey>>(`/v1/tenants/${encodeURIComponent(tenantId)}/api-keys`, opts);
    return resolveEnvelope(env);
  }
}
