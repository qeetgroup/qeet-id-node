import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** An issued W3C verifiable credential's record. */
export interface VerifiableCredential {
  id: string;
  subject: string;
  type: string;
  issued_at: string;
  expires_at?: string;
  revoked: boolean;
  /** The user it was issued for, when it names one. */
  user: { id: string; email: string; display_name: string } | null;
}

export interface VerifiableCredentialIssueParams {
  subject: string;
  type: string;
  claims?: Record<string, unknown>;
  ttl_seconds?: number;
  /** One of the organization's users the credential is about. */
  user_id?: string | null;
}

/** An issued credential: a signed JWT-VC. */
export interface IssuedCredential {
  credential_id: string;
  jwt: string;
  expires_at?: string;
}

/** Whether a presented JWT-VC is authentic and not revoked. */
export interface CredentialVerification {
  valid: boolean;
  reason?: string;
  reason_code?: "vc.not_credential" | "vc.signature_invalid" | "vc.unknown" | "vc.revoked";
  subject?: string;
  issuer?: string;
  vc?: Record<string, unknown>;
}

/** Issues, lists, revokes and verifies W3C verifiable credentials (JWT-VC). */
export class VerifiableCredentials extends ApiResource {
  async issue(organizationId: string, params: VerifiableCredentialIssueParams, options?: RequestOptions): Promise<IssuedCredential> {
    return this._send("POST", path`/v1/organizations/${organizationId}/credentials`, params, options);
  }

  async list(organizationId: string, options?: RequestOptions): Promise<ListResult<VerifiableCredential>> {
    return this._list(path`/v1/organizations/${organizationId}/credentials`, undefined, options);
  }

  async revoke(organizationId: string, credentialId: string, options?: RequestOptions): Promise<void> {
    await this._request(
      { method: "POST", path: path`/v1/organizations/${organizationId}/credentials/${credentialId}/revoke`, retrySafe: true },
      options,
    );
  }

  /** Checks a presented JWT-VC. Public: sends no API key. */
  async verify(credential: string, options?: RequestOptions): Promise<CredentialVerification> {
    return this._request(
      { method: "POST", path: "/v1/credentials/verify", body: { credential }, authenticate: false, retrySafe: true },
      options,
    );
  }
}
