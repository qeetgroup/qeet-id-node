import type { RequestOptions } from "../../core/options.js";
import type { CursorPageParams, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** An AuthZEN subject, resource or action: a type and id (or a name) with optional attributes. */
export interface AuthzenEntity {
  type?: string;
  id?: string;
  properties?: Record<string, unknown>;
}

export interface AuthzenAction {
  name?: string;
  properties?: Record<string, unknown>;
}

/**
 * An OpenID AuthZEN evaluation request. With `resource.type` `"permission"`,
 * `action.name` is a permission key; otherwise the resource is `type:id` and
 * `action.name` a relation.
 */
export interface EvaluationParams {
  subject: AuthzenEntity;
  resource?: AuthzenEntity;
  action: AuthzenAction;
  context?: Record<string, unknown>;
}

/** An AuthZEN decision. `context` always carries `decided_by`. */
export interface Evaluation {
  decision: boolean;
  context?: Record<string, unknown>;
}

/** Several evaluations in one call. Top-level fields are defaults each evaluation may replace. */
export interface EvaluationsParams {
  subject?: AuthzenEntity;
  resource?: AuthzenEntity;
  action?: AuthzenAction;
  context?: Record<string, unknown>;
  evaluations: Partial<EvaluationParams>[];
  options?: { evaluations_semantic?: "execute_all" | "deny_on_first_deny" | "permit_on_first_permit" };
}

export interface Evaluations {
  evaluations: Evaluation[];
}

export type DecisionSource = "check" | "relation_check" | "authzen" | "abac_evaluate" | "abac_draft";

/** One recorded access decision. */
export interface DecisionLogEntry {
  id: string;
  decided_at: string;
  source: DecisionSource;
  caller_type?: string;
  caller_id?: string;
  caller_client?: string;
  subject: string;
  resource: string;
  action: string;
  allowed: boolean;
  model: string;
  rule?: string;
  reason_code?: string;
}

export interface DecisionListParams extends CursorPageParams {
  subject?: string;
  source?: DecisionSource;
  allowed?: boolean;
  /** How many days back to look. */
  days?: number;
}

/** OpenID AuthZEN evaluations over every authorization model, and the log of decisions made. */
export class Decisions extends ApiResource {
  /** Evaluates one AuthZEN request. */
  async evaluate(tenantId: string, params: EvaluationParams, options?: RequestOptions): Promise<Evaluation> {
    return this._request(
      { method: "POST", path: path`/v1/tenants/${tenantId}/access/v1/evaluation`, body: params, retrySafe: true },
      options,
    );
  }

  /** Evaluates several AuthZEN requests; decisions come back in request order. */
  async evaluateMany(tenantId: string, params: EvaluationsParams, options?: RequestOptions): Promise<Evaluations> {
    const response = await this._request<Partial<Evaluations>>(
      { method: "POST", path: path`/v1/tenants/${tenantId}/access/v1/evaluations`, body: params, retrySafe: true },
      options,
    );
    return { evaluations: response?.evaluations ?? [] };
  }

  /** The access decisions the organisation asked for, newest first. */
  list(tenantId: string, params: DecisionListParams = {}, options?: RequestOptions): PagePromise<DecisionLogEntry> {
    return this._page(() => path`/v1/tenants/${tenantId}/authorization/decisions`, { ...params }, options);
  }
}
