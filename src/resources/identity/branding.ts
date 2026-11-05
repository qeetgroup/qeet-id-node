import type { RequestOptions } from "../../core/options.js";
import { ApiResource, path } from "../../core/resource.js";

/** How the hosted sign-in pages and emails look for the organisation. */
export interface TenantBranding {
  tenant_id: string;
  /** A URL or a base64 `data:` image (PNG, JPEG, WEBP or SVG, at most 2 MiB). */
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  custom_domain: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  /** `background_color` (six-digit hex) and `email_reply_to`; keep unknown keys when writing back. */
  settings: { background_color?: string; email_reply_to?: string; [key: string]: unknown };
}

export type BrandingUpdateParams = Partial<Omit<TenantBranding, "tenant_id">>;

/** Manages the organisation's branding. Shown only while the plan includes custom branding. */
export class Branding extends ApiResource {
  async get(tenantId: string, options?: RequestOptions): Promise<TenantBranding> {
    return this._get(path`/v1/tenants/${tenantId}/branding`, undefined, options);
  }

  /** Replaces the branding. */
  async update(tenantId: string, params: BrandingUpdateParams, options?: RequestOptions): Promise<TenantBranding> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/branding`, params, options);
  }
}
