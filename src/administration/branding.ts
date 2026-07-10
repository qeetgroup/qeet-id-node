import type { RequestOpts } from "../client/options.js";
import type { Transport } from "../transport/http.js";

export interface BrandingSettings {
  tenant_id: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  custom_domain?: string;
  favicon_url?: string;
  updated_at?: string;
}

export interface UpdateBrandingInput {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  custom_domain?: string;
  favicon_url?: string;
}

/** Manages a tenant's hosted-login branding. */
export class BrandingService {
  constructor(private readonly t: Transport) {}

  get(tenantId: string, opts?: RequestOpts): Promise<BrandingSettings> {
    return this.t.get<BrandingSettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/branding`, opts);
  }

  update(tenantId: string, input: UpdateBrandingInput, opts?: RequestOpts): Promise<BrandingSettings> {
    return this.t.put<BrandingSettings>(`/v1/tenants/${encodeURIComponent(tenantId)}/branding`, input, opts);
  }
}
