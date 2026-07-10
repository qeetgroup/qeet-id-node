import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A resolved template — the tenant's custom override if one exists
 * (`custom` is true), otherwise the platform default. There's a fixed
 * catalog of keys (`name`/`description`/`variables` are metadata for
 * building an editor UI); templates aren't independently created, only
 * customized via `update` and reverted via `reset`.
 */
export interface EmailTemplate {
  key: string;
  name: string;
  description?: string;
  subject: string;
  body: string;
  variables?: string[];
  custom: boolean;
}

export interface UpdateEmailTemplateInput {
  subject: string;
  body: string;
}

/**
 * The rendered output with vars substituted — `{{name}}` placeholders left
 * intact are unfilled.
 */
export interface PreviewEmailTemplateResult {
  subject: string;
  body: string;
}

/** Manages transactional email template overrides. */
export class EmailTemplatesService {
  constructor(private readonly t: Transport) {}

  async list(tenantId: string, opts?: RequestOpts): Promise<EmailTemplate[]> {
    const env = await this.t.get<Envelope<EmailTemplate>>(`/v1/tenants/${encodeURIComponent(tenantId)}/email-templates`, opts);
    return resolveEnvelope(env);
  }

  get(tenantId: string, key: string, opts?: RequestOpts): Promise<EmailTemplate> {
    return this.t.get<EmailTemplate>(`/v1/tenants/${encodeURIComponent(tenantId)}/email-templates/${encodeURIComponent(key)}`, opts);
  }

  /** Sets a custom override for a template (full replace of subject+body). */
  update(tenantId: string, key: string, input: UpdateEmailTemplateInput, opts?: RequestOpts): Promise<EmailTemplate> {
    return this.t.put<EmailTemplate>(`/v1/tenants/${encodeURIComponent(tenantId)}/email-templates/${encodeURIComponent(key)}`, input, opts);
  }

  /** Discards a custom override, reverting to the platform default. */
  reset(tenantId: string, key: string, opts?: RequestOpts): Promise<EmailTemplate> {
    return this.t.delete<EmailTemplate>(`/v1/tenants/${encodeURIComponent(tenantId)}/email-templates/${encodeURIComponent(key)}`, opts);
  }

  /**
   * Renders the template's current subject/body with vars substituted for
   * `{{placeholder}}` tokens — nothing is sent.
   */
  preview(tenantId: string, key: string, vars: Record<string, string>, opts?: RequestOpts): Promise<PreviewEmailTemplateResult> {
    return this.t.post<PreviewEmailTemplateResult>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/email-templates/${encodeURIComponent(key)}/preview`,
      { vars },
      opts,
    );
  }
}
