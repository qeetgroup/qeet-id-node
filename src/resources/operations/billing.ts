import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** The organisation's Qeet ID subscription. Status `none` means it has none. */
export interface Subscription {
  status: "none" | "trialing" | "active" | "past_due" | "canceled";
  plan_code: string;
  plan_name: string;
  currency: string;
  /** In minor units (paise, cents). */
  amount_minor: number;
  interval: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  ended_at?: string | null;
}

/** A tax invoice. Amounts are in minor units. */
export interface Invoice {
  id: string;
  invoice_number: string | null;
  plan_code: string;
  kind?: "purchase" | "renewal";
  status: "paid" | "open" | "void";
  currency: string;
  amount_minor: number;
  taxable_amount_minor: number;
  tax_amount_minor: number;
  tax_rate_bps: number;
  tax_type: string;
  place_of_supply: string;
  supplier_gstin?: string;
  sac?: string;
  billed_to?: BillingProfile | null;
  period_start: string;
  period_end: string;
  issued_at: string;
  due_at?: string | null;
  paid_at?: string | null;
  emailed_at?: string | null;
}

/** Who invoices are addressed to. */
export interface BillingProfile {
  legal_name: string;
  billing_email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  tax_id: string;
  tax_id_type: string;
}

/** The card or mandate on file. */
export interface PaymentMethod {
  provider: string;
  type: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  last_used_at: string;
}

export interface CheckoutParams {
  plan_code: string;
  currency: string;
  /** ISO 3166-1 alpha-2, for tax. */
  country?: string;
  success_url: string;
  cancel_url: string;
}

/** `active` for an immediate activation (a free plan); `checkout` with the URL to send the person to. */
export interface CheckoutResult {
  status: "active" | "checkout" | (string & {});
  checkout_url?: string;
  provider?: string;
}

/** The organisation's plan: its features and limits. */
export interface Entitlements {
  plan: "free" | "starter" | "pro" | "enterprise" | (string & {});
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

/** The organisation's Qeet ID billing: subscription, invoices and plan. */
export class Billing extends ApiResource {
  async getSubscription(tenantId: string, options?: RequestOptions): Promise<Subscription> {
    return this._get(path`/v1/tenants/${tenantId}/billing/subscription`, undefined, options);
  }

  /** Changes the plan or currency. */
  async updateSubscription(
    tenantId: string,
    params: { plan_code: string; currency: string },
    options?: RequestOptions,
  ): Promise<Subscription> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/billing/subscription`, params, options);
  }

  /** Ends the subscription at the end of the current period. */
  async cancelSubscription(tenantId: string, options?: RequestOptions): Promise<{ cancel_at_period_end: boolean }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/billing/subscription/cancel`, undefined, options);
  }

  /** Starts a checkout for a plan. */
  async checkout(tenantId: string, params: CheckoutParams, options?: IdempotentRequestOptions): Promise<CheckoutResult> {
    return this._request({ method: "POST", path: path`/v1/tenants/${tenantId}/billing/checkout`, body: params, idempotent: true }, options);
  }

  async listInvoices(tenantId: string, options?: RequestOptions): Promise<ListResult<Invoice>> {
    return this._list(path`/v1/tenants/${tenantId}/billing/invoices`, undefined, options);
  }

  /** Starts paying an open invoice. */
  async payInvoice(
    tenantId: string,
    invoiceId: string,
    params: { success_url: string; cancel_url: string },
    options?: IdempotentRequestOptions,
  ): Promise<CheckoutResult> {
    return this._request(
      { method: "POST", path: path`/v1/tenants/${tenantId}/billing/invoices/${invoiceId}/pay`, body: params, idempotent: true },
      options,
    );
  }

  async getPaymentMethod(tenantId: string, options?: RequestOptions): Promise<PaymentMethod | null> {
    const response = await this._get<{ payment_method?: PaymentMethod | null }>(
      path`/v1/tenants/${tenantId}/billing/payment-method`,
      undefined,
      options,
    );
    return response?.payment_method ?? null;
  }

  async getProfile(tenantId: string, options?: RequestOptions): Promise<BillingProfile> {
    return this._get(path`/v1/tenants/${tenantId}/billing/profile`, undefined, options);
  }

  async updateProfile(tenantId: string, profile: Partial<BillingProfile>, options?: RequestOptions): Promise<BillingProfile> {
    return this._send("PUT", path`/v1/tenants/${tenantId}/billing/profile`, profile, options);
  }

  /** The plan's features and limits. */
  async getEntitlements(tenantId: string, options?: RequestOptions): Promise<Entitlements> {
    return this._get(path`/v1/tenants/${tenantId}/entitlements`, undefined, options);
  }

  /** How much of each limit is used. */
  async getUsage(tenantId: string, options?: RequestOptions): Promise<Record<string, number>> {
    const response = await this._get<{ usage?: Record<string, number> }>(
      path`/v1/tenants/${tenantId}/entitlements/usage`,
      undefined,
      options,
    );
    return response?.usage ?? {};
  }
}
