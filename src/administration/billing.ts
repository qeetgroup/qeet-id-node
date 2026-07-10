import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * Plan is a subscribable Qeet ID plan. `prices` maps currency (ISO 4217) to
 * amount in minor units (e.g. cents) — never a float.
 */
export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  interval: string;
  features?: string[];
  /** currency -> minor units */
  prices: Record<string, number>;
}

/**
 * Subscription is a tenant's current Qeet ID billing state. Status "none"
 * (all other fields zero-valued) means the tenant has no subscription.
 */
export interface Subscription {
  plan_code?: string;
  plan_name?: string;
  currency?: string;
  amount_minor?: number;
  interval?: string;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
}

export interface PutSubscriptionInput {
  plan_code: string;
  currency: string;
}

/** Invoice is one billed period for a tenant's subscription. */
export interface Invoice {
  id: string;
  plan_code: string;
  currency: string;
  amount_minor: number;
  status: string;
  period_start: string;
  period_end: string;
  issued_at: string;
}

export interface CheckoutInput {
  plan_code: string;
  currency: string;
  success_url: string;
  cancel_url: string;
}

/**
 * CheckoutResult is either an immediate activation ("active", no
 * `checkout_url` — e.g. a free plan) or a redirect to the payment provider
 * ("checkout").
 */
export interface CheckoutResult {
  /** active | checkout */
  status: string;
  checkout_url?: string;
  provider?: string;
}

/**
 * CancelSubscriptionResult confirms the subscription will lapse at the end
 * of the current billing period (no proration/immediate cancellation today).
 */
export interface CancelSubscriptionResult {
  cancel_at_period_end: boolean;
}

/**
 * BillingService manages billing for the Qeet ID platform itself — what a
 * tenant pays for using Qeet ID — not a general-purpose payments surface.
 */
export class BillingService {
  constructor(private readonly t: Transport) {}

  async listPlans(opts?: RequestOpts): Promise<Plan[]> {
    const env = await this.t.get<Envelope<Plan>>("/v1/billing/plans", opts);
    return resolveEnvelope(env);
  }

  getSubscription(tenantId: string, opts?: RequestOpts): Promise<Subscription> {
    return this.t.get<Subscription>(`/v1/tenants/${encodeURIComponent(tenantId)}/billing/subscription`, opts);
  }

  putSubscription(tenantId: string, input: PutSubscriptionInput, opts?: RequestOpts): Promise<Subscription> {
    return this.t.put<Subscription>(`/v1/tenants/${encodeURIComponent(tenantId)}/billing/subscription`, input, opts);
  }

  cancelSubscription(tenantId: string, opts?: RequestOpts): Promise<CancelSubscriptionResult> {
    return this.t.post<CancelSubscriptionResult>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/billing/subscription/cancel`,
      undefined,
      opts,
    );
  }

  async listInvoices(tenantId: string, opts?: RequestOpts): Promise<Invoice[]> {
    const env = await this.t.get<Envelope<Invoice>>(`/v1/tenants/${encodeURIComponent(tenantId)}/billing/invoices`, opts);
    return resolveEnvelope(env);
  }

  checkout(tenantId: string, input: CheckoutInput, opts?: RequestOpts): Promise<CheckoutResult> {
    return this.t.post<CheckoutResult>(`/v1/tenants/${encodeURIComponent(tenantId)}/billing/checkout`, input, opts);
  }
}
