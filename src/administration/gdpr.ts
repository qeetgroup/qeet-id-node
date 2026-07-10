import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/** PurgeRequest is a GDPR erasure request against a user, with a grace window before it actually runs. */
export interface PurgeRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  requested_by?: string;
  reason?: string;
  status: string;
  grace_until: string;
  completed_at?: string;
  created_at: string;
}

/**
 * CreatePurgeInput — `tenant_id`/`user_id` identify who to erase; the
 * requester is inferred server-side from the caller's principal, not sent in
 * the body.
 */
export interface CreatePurgeInput {
  tenant_id: string;
  user_id: string;
  reason?: string;
}

/**
 * ExportRequest is a GDPR data-export request. `payload` is populated
 * inline once `status` is "ready" — there is no separate download-URL
 * field; fetch `getExport` again once ready and read `payload` directly.
 */
export interface ExportRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  requested_by?: string;
  /** pending | ready | failed */
  status: string;
  payload?: Record<string, unknown>;
  error?: string;
  completed_at?: string;
  created_at: string;
}

export interface CreateExportInput {
  tenant_id: string;
  user_id: string;
}

/** GDPRService manages erasure (purge) and data-export requests. */
export class GDPRService {
  constructor(private readonly t: Transport) {}

  /** CreatePurge is not tenant-path-scoped — tenant/user are identified in the body. */
  createPurge(input: CreatePurgeInput, opts?: RequestOpts): Promise<PurgeRequest> {
    return this.t.post<PurgeRequest>("/v1/gdpr/purge", input, opts);
  }

  cancelPurge(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/gdpr/purge/${encodeURIComponent(id)}`, opts);
  }

  async listPurge(tenantId: string, opts?: RequestOpts): Promise<PurgeRequest[]> {
    const env = await this.t.get<Envelope<PurgeRequest>>(`/v1/tenants/${encodeURIComponent(tenantId)}/gdpr/purge`, opts);
    return resolveEnvelope(env);
  }

  /** CreateExport is async (202 Accepted) — poll `getExport` until `status` is "ready" or "failed". */
  createExport(input: CreateExportInput, opts?: RequestOpts): Promise<ExportRequest> {
    return this.t.post<ExportRequest>("/v1/gdpr/export", input, opts);
  }

  async listExports(tenantId: string, opts?: RequestOpts): Promise<ExportRequest[]> {
    const env = await this.t.get<Envelope<ExportRequest>>(`/v1/tenants/${encodeURIComponent(tenantId)}/gdpr/export`, opts);
    return resolveEnvelope(env);
  }

  getExport(tenantId: string, id: string, opts?: RequestOpts): Promise<ExportRequest> {
    return this.t.get<ExportRequest>(`/v1/tenants/${encodeURIComponent(tenantId)}/gdpr/export/${encodeURIComponent(id)}`, opts);
  }
}
