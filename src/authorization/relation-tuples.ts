import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A ReBAC relationship assertion: "object relation subject". `object` is
 * "type:id"; `subject` is "user:id" for a direct grant, or
 * "type:id#relation" for a userset (e.g. `group:eng#member`).
 */
export interface Tuple {
  id: string;
  object: string;
  relation: string;
  subject: string;
}

export interface CreateTupleInput {
  object: string;
  relation: string;
  subject: string;
}

/** A ReBAC check — does `user_id` have `relation` on `object`, resolving usersets recursively? */
export interface CheckRelationInput {
  object: string;
  relation: string;
  user_id: string;
}

/** The response shape; `path` is populated only when `check` is called with `explain=true`. */
export interface RelationCheckResult {
  allowed: boolean;
  path?: RelationPathStep[];
}

/** One hop in a `check(explain=true)` grant path. */
export interface RelationPathStep {
  object: string;
  relation: string;
  subject: string;
  depth: number;
}

/**
 * `GraphNode` and `GraphEdge` describe the identity-graph shape returned by
 * `graph` — a BFS expansion of every subject reachable from an
 * object+relation.
 */
export interface GraphNode {
  id: string;
  type: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface RelationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Manages ReBAC (Zanzibar-style) relationship tuples, their recursive
 * check, and the graph visualization. Exposed as `Authorization.relationships`.
 */
export class RelationTuplesService {
  constructor(private readonly t: Transport) {}

  create(tenantId: string, input: CreateTupleInput, opts?: RequestOpts): Promise<Tuple> {
    return this.t.post<Tuple>(`/v1/tenants/${encodeURIComponent(tenantId)}/relation-tuples`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/relation-tuples/${encodeURIComponent(id)}`, opts);
  }

  /** Lists every tuple on an object (e.g. "document:readme"). */
  async listByObject(tenantId: string, object: string, opts?: RequestOpts): Promise<Tuple[]> {
    const env = await this.t.get<Envelope<Tuple>>(`/v1/tenants/${encodeURIComponent(tenantId)}/relation-tuples`, {
      ...opts,
      query: { object },
    });
    return resolveEnvelope(env);
  }

  /** The reverse lookup: every tuple naming this subject (e.g. "user:123" or "group:eng#member"). */
  async listBySubject(tenantId: string, subject: string, opts?: RequestOpts): Promise<Tuple[]> {
    const env = await this.t.get<Envelope<Tuple>>(`/v1/tenants/${encodeURIComponent(tenantId)}/relation-tuples`, {
      ...opts,
      query: { subject },
    });
    return resolveEnvelope(env);
  }

  /**
   * Resolves whether `input.user_id` has `input.relation` on
   * `input.object`, recursively through usersets. Pass `explain=true` to
   * get the grant path back in `path`.
   */
  check(tenantId: string, input: CheckRelationInput, explain: boolean, opts?: RequestOpts): Promise<RelationCheckResult> {
    return this.t.request<RelationCheckResult>("POST", `/v1/tenants/${encodeURIComponent(tenantId)}/relation-tuples/check`, {
      ...opts,
      query: { explain: explain ? true : undefined },
      body: input,
    });
  }

  /**
   * Expands every subject reachable from object+relation (BFS, capped at
   * depth 1-10, default 10) — the data behind the console's Identity Graph
   * visualization.
   */
  graph(tenantId: string, object: string, relation: string, depth: number, opts?: RequestOpts): Promise<RelationGraph> {
    return this.t.get<RelationGraph>(`/v1/tenants/${encodeURIComponent(tenantId)}/relation-tuples/graph`, {
      ...opts,
      query: { object, relation, depth: depth > 0 ? depth : undefined },
    });
  }
}
