import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * LogSink is a configured SIEM forwarding destination. The auth token is
 * write-only — never returned on any response.
 */
export interface LogSink {
  id: string;
  /** splunk_hec | datadog | http */
  type: string;
  endpoint: string;
  enabled: boolean;
  last_forwarded_at?: string;
  last_error?: string;
  created_at: string;
}

export interface CreateLogSinkInput {
  /** splunk_hec | datadog | http */
  type: string;
  endpoint: string;
  token: string;
}

/**
 * LogSinksService manages SIEM log-forwarding destinations. The OpenAPI tag
 * is "Log Sinks" and every path is `/log-sinks` — there is no `/siem` path
 * despite the backend Go package being named "siem".
 */
export class LogSinksService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateLogSinkInput, opts?: RequestOpts): Promise<LogSink> {
    return this.t.post<LogSink>(`/v1/tenants/${encodeURIComponent(tenantId)}/log-sinks`, input, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<LogSink[]> {
    const env = await this.t.get<Envelope<LogSink>>(`/v1/tenants/${encodeURIComponent(tenantId)}/log-sinks`, opts);
    return resolveEnvelope(env);
  }

  setEnabled(tenantId: string, id: string, enabled: boolean, opts?: RequestOpts): Promise<LogSink> {
    return this.t.patch<LogSink>(`/v1/tenants/${encodeURIComponent(tenantId)}/log-sinks/${encodeURIComponent(id)}`, { enabled }, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/log-sinks/${encodeURIComponent(id)}`, opts);
  }
}
