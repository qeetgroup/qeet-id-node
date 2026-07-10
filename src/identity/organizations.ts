import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import { paginate } from "../transport/pagination.js";
import type { Transport } from "../transport/http.js";

/**
 * Organization is a tenant in Qeet ID terms — the wire path is still
 * `/v1/tenants`; "Organization" is the SDK-facing name, matching the term
 * the rest of the CIAM industry (Auth0, WorkOS, Clerk) uses for the same
 * concept.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  region?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  region?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  region?: string;
}

export interface OrganizationPage {
  data: Organization[];
  nextCursor?: string;
}

/** Manages organizations (tenants). */
export class OrganizationsService {
  constructor(private readonly t: Transport) {}

  create(input: CreateOrganizationInput, opts?: RequestOpts): Promise<Organization> {
    return this.t.post<Organization>("/v1/tenants", input, opts);
  }

  get(id: string, opts?: RequestOpts): Promise<Organization> {
    return this.t.get<Organization>(`/v1/tenants/${encodeURIComponent(id)}`, opts);
  }

  update(id: string, input: UpdateOrganizationInput, opts?: RequestOpts): Promise<Organization> {
    return this.t.patch<Organization>(`/v1/tenants/${encodeURIComponent(id)}`, input, opts);
  }

  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(id)}`, opts);
  }

  async list(limit?: number, cursor?: string, opts?: RequestOpts): Promise<OrganizationPage> {
    const env = await this.t.get<Envelope<Organization> & { next_cursor?: string }>("/v1/tenants", {
      ...opts,
      query: { limit, cursor },
    });
    return { data: resolveEnvelope(env), nextCursor: env.next_cursor };
  }

  /** Iterates every organization across pages. */
  all(limit?: number, opts?: RequestOpts): AsyncGenerator<Organization, void, void> {
    return paginate((cursor) => this.list(limit, cursor, opts));
  }
}
