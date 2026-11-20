import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A template's text in one language. */
export interface EmailLocalizedContent {
  subject: string;
  body: string;
  preheader?: string;
  body_html?: string;
}

export interface EmailTemplateOptions {
  preheader?: string;
  body_html?: string;
  default_locale?: string;
  show_logo?: boolean;
  alignment?: "left" | "center";
  translations?: Record<string, EmailLocalizedContent>;
}

/** A template's editable content. `{{name}}` placeholders are filled in when it is sent. */
export interface EmailTemplateContent {
  subject: string;
  body: string;
  options?: EmailTemplateOptions;
}

/** A template as it is used: the organization's override (`custom`), or the platform's default. */
export interface EmailTemplate extends EmailTemplateContent {
  key: string;
  name: string;
  description?: string;
  /** The placeholders it may use. */
  variables?: string[];
  custom: boolean;
  delivery_scope?: "organization" | "platform";
}

export interface EmailTemplatePreviewParams {
  vars?: Record<string, string>;
  locale?: string;
  /** Preview unsaved content instead of the saved template. */
  draft?: EmailTemplateContent;
}

/** A rendered template. Placeholders left as `{{name}}` were not given. */
export interface EmailTemplatePreview {
  subject: string;
  body: string;
  html?: string;
  locale?: string;
}

/** Manages the organization's email templates. The set of templates is fixed; each can be overridden and reset. */
export class EmailTemplates extends ApiResource {
  async list(organizationId: string, options?: RequestOptions): Promise<ListResult<EmailTemplate>> {
    return this._list(path`/v1/organizations/${organizationId}/email-templates`, undefined, options);
  }

  async get(organizationId: string, key: string, options?: RequestOptions): Promise<EmailTemplate> {
    return this._get(path`/v1/organizations/${organizationId}/email-templates/${key}`, undefined, options);
  }

  /** Saves the organization's override of a template. */
  async update(organizationId: string, key: string, content: EmailTemplateContent, options?: RequestOptions): Promise<EmailTemplate> {
    return this._send("PUT", path`/v1/organizations/${organizationId}/email-templates/${key}`, content, options);
  }

  /** Discards the override, going back to the platform's default. */
  async reset(organizationId: string, key: string, options?: RequestOptions): Promise<EmailTemplate> {
    return this._send("DELETE", path`/v1/organizations/${organizationId}/email-templates/${key}`, undefined, options);
  }

  /** Renders a template with `vars`. Sends nothing. */
  async preview(
    organizationId: string,
    key: string,
    params: EmailTemplatePreviewParams = {},
    options?: RequestOptions,
  ): Promise<EmailTemplatePreview> {
    return this._request(
      { method: "POST", path: path`/v1/organizations/${organizationId}/email-templates/${key}/preview`, body: params, retrySafe: true },
      options,
    );
  }

  /** Sends a draft to the caller's own address. */
  async sendTest(
    organizationId: string,
    key: string,
    params: { draft: EmailTemplateContent; locale?: string },
    options?: RequestOptions,
  ): Promise<void> {
    await this._send("POST", path`/v1/organizations/${organizationId}/email-templates/${key}/test`, params, options);
  }
}
