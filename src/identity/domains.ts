import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A custom domain pending or completed DNS verification. `verified_at` is
 * absent until the DNS record is confirmed — there is no separate boolean
 * flag. `dns_record_name`/`dns_record_type`/`dns_record_value` are what the
 * caller needs to actually create in their DNS provider. There is no
 * per-domain get in the backend — only create, delete, verify, and list.
 */
export interface Domain {
  id: string;
  domain: string;
  verification_token?: string;
  dns_record_name?: string;
  dns_record_type?: string;
  dns_record_value?: string;
  verified_at?: string;
  created_at: string;
}

/** Reports whether DNS verification has completed for `domain`. */
export function domainVerified(domain: Domain): boolean {
  return !!domain.verified_at;
}

export interface CreateDomainInput {
  domain: string;
}

/** Manages custom domains. */
export class DomainsService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateDomainInput, opts?: RequestOpts): Promise<Domain> {
    return this.t.post<Domain>(`/v1/tenants/${encodeURIComponent(tenantId)}/domains`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(id)}`, opts);
  }

  verify(tenantId: string, id: string, opts?: RequestOpts): Promise<Domain> {
    return this.t.post<Domain>(`/v1/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(id)}/verify`, {}, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<Domain[]> {
    const env = await this.t.get<Envelope<Domain>>(`/v1/tenants/${encodeURIComponent(tenantId)}/domains`, opts);
    return resolveEnvelope(env);
  }
}
