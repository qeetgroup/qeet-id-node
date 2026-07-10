import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A webhook subscription. `disabled_at` is unset while active; there is no
 * separate "enabled" flag on the wire — a subscription is enabled exactly
 * when `disabled_at` is empty. There is also no rename/update endpoint —
 * recreate the subscription to change its URL or events.
 */
export interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  events: string[];
  disabled_at?: string;
  created_at: string;
  /** Only present in the `create` response. */
  secret?: string;
}

/** Reports whether the subscription is currently active. */
export function isWebhookEnabled(webhook: Webhook): boolean {
  return !webhook.disabled_at;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  response_status?: number;
  created_at: string;
}

/**
 * Manages webhook subscriptions. `create`/`get`/`delete`/`test`/
 * `listDeliveries`/`retryDelivery` are NOT tenant-path-scoped — the tenant
 * is resolved from the caller's own API key, so the key must be
 * tenant-scoped for these calls to work. Only `list` takes an explicit
 * `tenantId` (the backend requires it in the path there, even though the
 * same implicit scoping is available). See `../utils/webhook.js` for
 * inbound-delivery HMAC verification helpers (`verifyWebhookSignature`,
 * `constructEvent`) — those live outside this service.
 */
export class WebhooksService {
  constructor(private readonly t: Transport) {}

  create(input: CreateWebhookInput, opts?: RequestOpts): Promise<Webhook> {
    return this.t.post<Webhook>("/v1/webhooks", input, opts);
  }

  get(id: string, opts?: RequestOpts): Promise<Webhook> {
    return this.t.get<Webhook>(`/v1/webhooks/${encodeURIComponent(id)}`, opts);
  }

  /**
   * Disables the subscription (the backend calls this "disable" internally;
   * DELETE is the verb, matching every other resource's naming in this
   * SDK).
   */
  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/webhooks/${encodeURIComponent(id)}`, opts);
  }

  test(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/webhooks/${encodeURIComponent(id)}/test`, {}, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<Webhook[]> {
    const env = await this.t.get<Envelope<Webhook>>(`/v1/tenants/${encodeURIComponent(tenantId)}/webhooks`, opts);
    return resolveEnvelope(env);
  }

  async listDeliveries(webhookId: string, opts?: RequestOpts): Promise<WebhookDelivery[]> {
    const env = await this.t.get<Envelope<WebhookDelivery>>(`/v1/webhooks/${encodeURIComponent(webhookId)}/deliveries`, opts);
    return resolveEnvelope(env);
  }

  retryDelivery(webhookId: string, deliveryId: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/webhooks/${encodeURIComponent(webhookId)}/deliveries/${encodeURIComponent(deliveryId)}/retry`, {}, opts);
  }
}
