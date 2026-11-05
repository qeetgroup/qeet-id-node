import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** An erasure request. It runs when its grace period ends, unless cancelled first. */
export interface ErasureRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  requested_by: string | null;
  reason: string | null;
  status: string;
  grace_until: string;
  grace_period_days?: number;
  completed_at: string | null;
  created_at: string;
  subject_email?: string | null;
  subject_name?: string | null;
  /** The subject's details were erased. */
  subject_redacted?: boolean;
}

/** A data export. `payload` is filled in once `status` is `ready`. */
export interface ExportRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  requested_by: string | null;
  status: "pending" | "ready" | "failed" | (string & {});
  payload?: Record<string, unknown>;
  error?: string;
  completed_at: string | null;
  created_at: string;
}

/** Erasure requests (the right to be forgotten). */
export class GdprErasures extends ApiResource {
  /** Requests a user's erasure, after a grace period. */
  async create(params: { tenant_id: string; user_id: string; reason: string }, options?: RequestOptions): Promise<ErasureRequest> {
    return this._send("POST", "/v1/gdpr/purge", params, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<ErasureRequest>> {
    return this._list(path`/v1/tenants/${tenantId}/gdpr/purge`, undefined, options);
  }

  /** Cancels a request still in its grace period. */
  async cancel(requestId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/gdpr/purge/${requestId}`, options);
  }
}

/** Data export requests (the right of access). */
export class GdprExports extends ApiResource {
  /** Starts an export. It runs in the background: poll `get` until `status` is `ready` or `failed`. */
  async create(params: { tenant_id: string; user_id: string }, options?: RequestOptions): Promise<ExportRequest> {
    return this._send("POST", "/v1/gdpr/export", params, options);
  }

  async get(tenantId: string, exportId: string, options?: RequestOptions): Promise<ExportRequest> {
    return this._get(path`/v1/tenants/${tenantId}/gdpr/export/${exportId}`, undefined, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<ExportRequest>> {
    return this._list(path`/v1/tenants/${tenantId}/gdpr/export`, undefined, options);
  }
}

/** Data-subject requests: erasure and export. */
export class Gdpr extends ApiResource {
  readonly erasures: GdprErasures = new GdprErasures(this._http);
  readonly exports: GdprExports = new GdprExports(this._http);
}
