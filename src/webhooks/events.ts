/**
 * Every event a webhook subscription can receive, as the API's event
 * catalogue lists them (`client.webhooks.listEventTypes()` reads it live). An
 * event's name is its version: a payload that changes incompatibly gets a new
 * name, while adding a field to one does not.
 */
export const WEBHOOK_EVENT_TYPES = [
  "user.created",
  "user.updated",
  "user.suspended",
  "user.reactivated",
  "user.deleted",
  "user.password_set",
  "user.bulk_imported",
  "auth.password_changed",
  "session.revoked",
  "token.claims_change",
  "group.created",
  "group.updated",
  "group.deleted",
  "group.member_added",
  "group.member_removed",
  "group_template.applied",
  "domain.created",
  "domain.verified",
  "domain.deleted",
  "agent.created",
  "agent.suspended",
  "agent.resumed",
  "agent.decommissioned",
  "agent.deleted",
  "agent.sponsor_transferred",
  "agent.kill_switch",
  "agent.resume_all",
  "rebac.tuple_written",
  "rebac.tuple_deleted",
  "abac_policy.created",
  "abac_policy.updated",
  "abac_policy.deleted",
  "auth_hook.created",
  "auth_hook.updated",
  "auth_hook.deleted",
  "siem.sink_created",
  "siem.sink_updated",
  "siem.sink_deleted",
  "rate_limits.updated",
  "rate_limits.deleted",
  "credential.issued",
  "credential.revoked",
  "oidc.client_locked_out",
  "tenant.suspended",
  "tenant.reactivated",
  "tenant.deleted",
] as const;

/** An event a subscription can name. */
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** The event the test call sends. No subscription names it. */
export const TEST_WEBHOOK_EVENT = "test.ping";

/**
 * A verified webhook delivery's body. `id` is the same in every delivery of
 * one event, retries included: deduplicate on it. `type` may be an event
 * newer than this SDK, so handle unknown types gracefully.
 */
export interface WebhookEvent<TData = Record<string, unknown>> {
  id: string;
  type: WebhookEventType | typeof TEST_WEBHOOK_EVENT | (string & {});
  tenant_id: string;
  /** When the change happened (RFC 3339). */
  occurred_at: string;
  data: TData;
}

/** The data of a `test.ping` event. */
export interface TestPingData {
  subscription_id: string;
}
