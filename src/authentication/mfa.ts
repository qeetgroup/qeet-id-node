import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

/**
 * The admin-side MFA surface. The backend has no admin endpoint to list a
 * user's enrolled factors or force MFA on — only an admin-initiated reset
 * (clearing all factors, e.g. after a lost device). This mirrors
 * `UsersService.resetMfa`; both reach the same endpoint.
 */
export class MFAService {
  constructor(private readonly t: Transport) {}

  reset(userId: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/users/${encodeURIComponent(userId)}/mfa`, opts);
  }
}
