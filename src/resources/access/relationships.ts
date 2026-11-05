import type { RequestOptions } from "../../core/options.js";
import type { CursorPageParams, ListResult, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";
import type { DecidedBy } from "./permissions.js";

/**
 * A relationship tuple: `subject` holds `relation` on `object`. `object` is
 * `type:id`; `subject` is `type:id`, or a userset `type:id#relation` (such as
 * `group:eng#member`).
 */
export interface RelationTuple {
  id: string;
  object: string;
  relation: string;
  subject: string;
  /** A readable name for the subject, when known. */
  subject_name?: string;
}

export interface RelationTupleCreateParams {
  object: string;
  relation: string;
  subject: string;
}

/** List the tuples on one side: exactly one of `object` or `subject`. */
export type RelationTupleListParams = { object: string; subject?: never } | { subject: string; object?: never };

export interface RelationCheckParams {
  object: string;
  relation: string;
  user_id: string;
}

/** A relationship check's answer. `path` and `trace` come with `explain`. */
export interface RelationDecision {
  allowed: boolean;
  decided_by?: DecidedBy;
  trace?: string[];
  path?: { object: string; relation: string; subject: string; depth: number }[];
}

/** Every identity reachable from an object and relation. */
export interface RelationGraph {
  nodes: { id: string; type: string; label: string; name?: string }[];
  edges: { from: string; to: string; relation: string }[];
}

export interface RelationGraphParams {
  object: string;
  relation: string;
  /** Hops to follow, 1 to 10. */
  depth?: number;
}

export interface RelationObjectType {
  type: string;
  objects: number;
  tuples: number;
}

export interface RelationObject {
  object: string;
  id: string;
  tuples: number;
}

/** Manages relationship tuples (ReBAC) and answers relationship checks. */
export class Relationships extends ApiResource {
  /** Writes a tuple. */
  async create(tenantId: string, params: RelationTupleCreateParams, options?: RequestOptions): Promise<RelationTuple> {
    return this._send("POST", path`/v1/tenants/${tenantId}/relation-tuples`, params, options);
  }

  /** Lists the tuples on an object (who has what on it) or of a subject (what it reaches). */
  async list(tenantId: string, params: RelationTupleListParams, options?: RequestOptions): Promise<ListResult<RelationTuple>> {
    return this._list(path`/v1/tenants/${tenantId}/relation-tuples`, { object: params.object, subject: params.subject }, options);
  }

  async delete(tenantId: string, tupleId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/relation-tuples/${tupleId}`, options);
  }

  /** Whether the user holds the relation on the object, following usersets. */
  async check(tenantId: string, params: RelationCheckParams, options?: RequestOptions): Promise<boolean> {
    const decision = await this.#check(tenantId, params, false, options);
    return decision.allowed === true;
  }

  /** `check` with its reasons: the deciding model and the path of tuples. */
  async explain(tenantId: string, params: RelationCheckParams, options?: RequestOptions): Promise<RelationDecision> {
    return this.#check(tenantId, params, true, options);
  }

  async #check(tenantId: string, params: RelationCheckParams, explain: boolean, options?: RequestOptions): Promise<RelationDecision> {
    return this._request(
      {
        method: "POST",
        path: path`/v1/tenants/${tenantId}/relation-tuples/check`,
        query: { explain: explain ? "true" : undefined },
        body: params,
        retrySafe: true,
      },
      options,
    );
  }

  /** The graph of identities reachable from an object and relation. */
  async graph(tenantId: string, params: RelationGraphParams, options?: RequestOptions): Promise<RelationGraph> {
    return this._get(path`/v1/tenants/${tenantId}/relation-tuples/graph`, { ...params }, options);
  }

  /** The object types the tuples name, with counts. */
  async listTypes(tenantId: string, options?: RequestOptions): Promise<ListResult<RelationObjectType>> {
    return this._list(path`/v1/tenants/${tenantId}/relation-tuples/types`, undefined, options);
  }

  /** The objects of one type the tuples name, a page at a time. */
  listObjects(tenantId: string, params: CursorPageParams & { type: string }, options?: RequestOptions): PagePromise<RelationObject> {
    return this._page(() => path`/v1/tenants/${tenantId}/relation-tuples/objects`, { ...params }, options);
  }
}
