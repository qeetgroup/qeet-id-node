import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

export interface Credential {
  id: string;
  subject: string;
  type: string;
  issued_at: string;
  expires_at?: string;
  revoked: boolean;
}

export interface IssueCredentialInput {
  subject: string;
  type: string;
  claims?: Record<string, unknown>;
  ttl_seconds?: number;
}

export interface IssueCredentialResult {
  credential_id: string;
  jwt: string;
  expires_at?: string;
}

export interface VerifyCredentialResult {
  valid: boolean;
  reason?: string;
  subject?: string;
  issuer?: string;
  vc?: Record<string, unknown>;
}

/** Issues, lists, revokes, and verifies W3C Verifiable Credentials. */
export class CredentialsService {
  constructor(private readonly t: Transport) {}

  issue(tenantId: string, input: IssueCredentialInput, opts?: RequestOpts): Promise<IssueCredentialResult> {
    return this.t.post<IssueCredentialResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/credentials`, input, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<Credential[]> {
    const env = await this.t.get<Envelope<Credential>>(`/v1/tenants/${encodeURIComponent(tenantId)}/credentials`, opts);
    return resolveEnvelope(env);
  }

  revoke(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/tenants/${encodeURIComponent(tenantId)}/credentials/${encodeURIComponent(id)}/revoke`, {}, opts);
  }

  /**
   * Public endpoint — no API key required. Relying parties call this to
   * confirm a presented JWT-VC is authentic and not revoked.
   */
  verify(jwt: string, opts?: RequestOpts): Promise<VerifyCredentialResult> {
    return this.t.post<VerifyCredentialResult>("/v1/credentials/verify", { credential: jwt }, opts);
  }
}
