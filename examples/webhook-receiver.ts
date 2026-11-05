// Receives Qeet ID webhooks with nothing but node:http: read the raw body,
// verify it, act on the event once, answer 2xx quickly.
//
//   QEET_ID_WEBHOOK_SECRET=… node --experimental-strip-types examples/webhook-receiver.ts
//
// In your app, import from "@qeet-id/node" instead of "../src/index.js".
import { createServer } from "node:http";
import { WebhookVerificationError, constructWebhookEvent } from "../src/index.js";

// During a secret rotation, list both secrets: the new one first.
const secrets = [process.env.QEET_ID_WEBHOOK_SECRET, process.env.QEET_ID_WEBHOOK_SECRET_PREVIOUS].filter((s): s is string => !!s);
const seen = new Set<string>(); // use your database: deliveries are retried and may repeat

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/qeet-id") {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks); // the raw bytes: never re-serialise before verifying

  try {
    const event = constructWebhookEvent(body, req.headers, secrets);
    if (!seen.has(event.id)) {
      seen.add(event.id);
      switch (event.type) {
        case "user.created":
          console.log("new user in", event.tenant_id, event.data);
          break;
        case "session.revoked":
          console.log("a session ended", event.data);
          break;
        default:
          break; // ignore events you don't handle, including ones newer than this SDK
      }
    }
    res.writeHead(204).end();
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      res.writeHead(400).end(error.code);
      return;
    }
    res.writeHead(500).end();
  }
}).listen(3000);
