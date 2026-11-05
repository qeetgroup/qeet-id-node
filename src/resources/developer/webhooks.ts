import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { CursorPageParams, ListResult, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A webhook subscription: an endpoint and the events it receives. */
export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  url: string;
  events: string[];
  /** Set while disabled; null while enabled. */
  disabled_at: string | null;
  /** `disabled` by an administrator, or `failing` after three days of failed deliveries. */
  disabled_reason?: "disabled" | "failing" | null;
  disabled_by?: string;
  /** When deliveries started failing. */
  failing_since?: string | null;
  /** While a rotated-out secret still signs deliveries alongside the new one. */
  previous_secret_expires_at?: string | null;
  last_delivered_at?: string | null;
  last_status_code?: number | null;
  counts?: { pending: number; retrying: number; gave_up: number };
  created_at: string;
  /** The signing secret: only in `create`'s answer, once. */
  secret?: string;
}

export interface WebhookCreateParams {
  /** A public https URL. */
  url: string;
  /** At least one event from the catalogue. */
  events: string[];
  tenant_id?: string;
}

export interface WebhookUpdateParams {
  url?: string;
  events?: string[];
}

/** One attempt-tracked delivery of an event to a subscription. */
export interface WebhookDelivery {
  id: string;
  event_type: string;
  attempt: number;
  status_code?: number;
  error?: string;
  /** The delivered body, as JSON text. */
  payload: string;
  response_body?: string;
  delivered_at?: string;
  next_attempt_at?: string;
  dead_at?: string;
  created_at: string;
}

export interface WebhookDeliveryListParams extends CursorPageParams {
  status?: "delivered" | "pending" | "retrying" | "dead";
}

/** One attempt to send a delivery. */
export interface WebhookDeliveryAttempt {
  attempted_at: string;
  status_code: number | null;
  duration_ms: number;
  error: string | null;
}

/** A webhook subscription's deliveries. */
export class WebhookDeliveries extends ApiResource {
  /** Lists a subscription's deliveries, newest first. */
  list(webhookId: string, params: WebhookDeliveryListParams = {}, options?: RequestOptions): PagePromise<WebhookDelivery> {
    return this._page(() => path`/v1/webhooks/${webhookId}/deliveries`, { ...params }, options);
  }

  /** Sends a delivery again now. */
  async retry(webhookId: string, deliveryId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, undefined, options);
  }

  /** Sends again, each with fresh attempts, up to 1,000 of the subscription's given-up deliveries. */
  async retryFailed(tenantId: string, webhookId: string, options?: RequestOptions): Promise<{ requeued: number }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/webhooks/${webhookId}/deliveries/retry`, undefined, options);
  }

  /** Every attempt to send a delivery, oldest first. */
  async listAttempts(
    tenantId: string,
    webhookId: string,
    deliveryId: string,
    options?: RequestOptions,
  ): Promise<ListResult<WebhookDeliveryAttempt>> {
    return this._list(path`/v1/tenants/${tenantId}/webhooks/${webhookId}/deliveries/${deliveryId}/attempts`, undefined, options);
  }
}

/**
 * Manages webhook subscriptions. To verify the deliveries your endpoint
 * receives, use `constructWebhookEvent`.
 */
export class Webhooks extends ApiResource {
  /** A subscription's deliveries. */
  readonly deliveries: WebhookDeliveries = new WebhookDeliveries(this._http);

  /** Subscribes an endpoint. The signing secret is in the answer, once: store it. */
  async create(params: WebhookCreateParams, options?: IdempotentRequestOptions): Promise<WebhookSubscription> {
    return this._request({ method: "POST", path: "/v1/webhooks", body: params, idempotent: true }, options);
  }

  async get(webhookId: string, options?: RequestOptions): Promise<WebhookSubscription> {
    return this._get(path`/v1/webhooks/${webhookId}`, undefined, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<WebhookSubscription>> {
    return this._list(path`/v1/tenants/${tenantId}/webhooks`, undefined, options);
  }

  /** Changes the URL, the events, or both. */
  async update(tenantId: string, webhookId: string, params: WebhookUpdateParams, options?: RequestOptions): Promise<WebhookSubscription> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}/webhooks/${webhookId}`, params, options);
  }

  /** Stops deliveries to the subscription. Undo with `enable`. */
  async disable(webhookId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/webhooks/${webhookId}`, options);
  }

  /** Turns a disabled subscription back on; deliveries held meanwhile are then sent. */
  async enable(tenantId: string, webhookId: string, options?: RequestOptions): Promise<WebhookSubscription> {
    return this._send("POST", path`/v1/tenants/${tenantId}/webhooks/${webhookId}/enable`, undefined, options);
  }

  /**
   * Replaces the signing secret and returns the new one, once. The old one
   * keeps signing alongside it until `previous_secret_expires_at` (24 hours):
   * verify with both meanwhile.
   */
  async rotateSecret(
    tenantId: string,
    webhookId: string,
    options?: RequestOptions,
  ): Promise<{ secret: string; previous_secret_expires_at: string }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/webhooks/${webhookId}/rotate-secret`, undefined, options);
  }

  /** Queues a `test.ping` event for this subscription alone. */
  async test(webhookId: string, options?: RequestOptions): Promise<{ queued: boolean; subscription: string }> {
    return this._send("POST", path`/v1/webhooks/${webhookId}/test`, undefined, options);
  }

  /** The catalogue of events a subscription can name. */
  async listEventTypes(tenantId: string, options?: RequestOptions): Promise<ListResult<{ name: string; description: string }>> {
    return this._list(path`/v1/tenants/${tenantId}/webhooks/events`, undefined, options);
  }
}
