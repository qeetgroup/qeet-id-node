import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/** The standard AuthZEN (OpenID unified authorization) request shapes. */
export interface AuthZENSubject {
  type: string;
  id: string;
}

export interface AuthZENResource {
  type: string;
  id: string;
}

export interface AuthZENAction {
  name: string;
}

/**
 * An AuthZEN `/access/v1/evaluation` request. The backend routes to RBAC
 * when `resource.type === "permission"`, else to ReBAC — so one endpoint
 * fronts both authorization models with a single standard shape. Set
 * `context.explain = true` to get a grant-path trace back in the response
 * `context`.
 */
export interface EvaluateInput {
  subject: AuthZENSubject;
  resource: AuthZENResource;
  action: AuthZENAction;
  context?: Record<string, unknown>;
}

/** The AuthZEN decision response. */
export interface EvaluateResult {
  decision: boolean;
  context?: Record<string, unknown>;
}

/**
 * Implements the AuthZEN (OpenID unified authorization)
 * `/access/v1/evaluation` endpoint — a single standard request/response
 * shape fronting both RBAC and ReBAC. Exposed as `Authorization.decisions`.
 */
export class AuthZENService {
  constructor(private readonly t: Transport) {}

  evaluate(tenantId: string, input: EvaluateInput, opts?: RequestOpts): Promise<EvaluateResult> {
    return this.t.post<EvaluateResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/access/v1/evaluation`, input, opts);
  }
}
