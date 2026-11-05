import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** Whether an invitation's email went out. */
export interface InvitationDelivery {
  /** `sent` when a provider accepted the email; `not_sent` with a `code` and `message` otherwise. */
  status: "sent" | "not_sent" | (string & {});
  /** For `not_sent`: `email.suppressed` or `email.provider_unavailable`, for example. */
  code?: string;
  message?: string;
}

/** An invitation to join the organisation. Its token is never returned: the link goes only to the invited address. */
export interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  /** The role the invitee receives on accepting. */
  role_id: string | null;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  /** Present on `create` and `resend`. */
  delivery?: InvitationDelivery;
}

export interface InvitationCreateParams {
  tenant_id: string;
  email: string;
  role_id?: string | null;
}

/** What `create` and `resend` answer. */
export interface InvitationResult {
  invite: Invitation;
}

/** Manages invitations. Accepting one is the invitee's own action and isn't wrapped here. */
export class Invitations extends ApiResource {
  /** Creates an invitation and emails its link to the invited address. */
  async create(params: InvitationCreateParams, options?: IdempotentRequestOptions): Promise<InvitationResult> {
    return this._request({ method: "POST", path: "/v1/invites", body: params, idempotent: true }, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<Invitation>> {
    return this._list(path`/v1/tenants/${tenantId}/invites`, undefined, options);
  }

  /** Issues a new link, extends the expiry and emails the invitation again. */
  async resend(invitationId: string, options?: RequestOptions): Promise<InvitationResult> {
    return this._send("POST", path`/v1/invites/${invitationId}/resend`, undefined, options);
  }

  /** Withdraws a pending invitation; its link stops working. */
  async delete(invitationId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/invites/${invitationId}`, options);
  }
}
