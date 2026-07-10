import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A pending (or resolved) org invitation. There is no per-invitation `get`
 * or resend in the backend — only `create`, `delete`, and `list`. `role_id`
 * is the role the invitee will hold once accepted.
 */
export interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role_id?: string;
  status: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface CreateInvitationInput {
  tenant_id: string;
  email: string;
  role_id?: string;
}

/**
 * Carries the raw invite token alongside the invitation record — admins
 * frequently need to copy the link directly when email delivery isn't
 * trustworthy yet.
 */
export interface CreateInvitationResult {
  invite: Invitation;
  token: string;
}

/**
 * Manages org invitations. Accepting an invitation is deliberately not
 * wrapped here — like login/signup, it's an end-user auth action (it
 * returns a fresh session token pair for the invitee), not an admin
 * management operation.
 */
export class InvitationsService {
  constructor(private readonly t: Transport) {}

  create(input: CreateInvitationInput, opts?: RequestOpts): Promise<CreateInvitationResult> {
    return this.t.post<CreateInvitationResult>("/v1/invites", input, opts);
  }

  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/invites/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<Invitation[]> {
    const env = await this.t.get<Envelope<Invitation>>(`/v1/tenants/${encodeURIComponent(tenantId)}/invites`, opts);
    return resolveEnvelope(env);
  }
}
