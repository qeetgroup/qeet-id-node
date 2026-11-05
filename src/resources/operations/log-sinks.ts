import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

export type LogSinkType = "splunk_hec" | "datadog" | "http";

/** A destination the audit log is streamed to (a SIEM). Its token is never returned. */
export interface LogSink {
  id: string;
  type: LogSinkType | (string & {});
  endpoint: string;
  enabled: boolean;
  last_forwarded_at?: string;
  last_error?: string;
  created_at: string;
}

export interface LogSinkCreateParams {
  type: LogSinkType;
  endpoint: string;
  token?: string;
}

/** A test event's delivery. */
export interface LogSinkTestResult {
  delivered: boolean;
  status?: number;
  error?: string;
  duration_ms: number;
}

/** Manages audit-log streaming to SIEMs. */
export class LogSinks extends ApiResource {
  async create(tenantId: string, params: LogSinkCreateParams, options?: RequestOptions): Promise<LogSink> {
    return this._send("POST", path`/v1/tenants/${tenantId}/log-sinks`, params, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<LogSink>> {
    return this._list(path`/v1/tenants/${tenantId}/log-sinks`, undefined, options);
  }

  /** Switches streaming to the sink on or off. */
  async setEnabled(tenantId: string, sinkId: string, enabled: boolean, options?: RequestOptions): Promise<void> {
    await this._send("PATCH", path`/v1/tenants/${tenantId}/log-sinks/${sinkId}`, { enabled }, options);
  }

  async delete(tenantId: string, sinkId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/log-sinks/${sinkId}`, options);
  }

  /** Sends a test event to a saved sink. */
  async test(tenantId: string, sinkId: string, options?: RequestOptions): Promise<LogSinkTestResult> {
    return this._send("POST", path`/v1/tenants/${tenantId}/log-sinks/${sinkId}/test`, undefined, options);
  }

  /** Sends a test event to a destination before saving it. */
  async testDestination(tenantId: string, params: LogSinkCreateParams, options?: RequestOptions): Promise<LogSinkTestResult> {
    return this._send("POST", path`/v1/tenants/${tenantId}/log-sinks/test`, params, options);
  }
}
