// A Hono app with an auth middleware — Hono's Context gives you the raw
// body via `c.req.arrayBuffer()`/`c.req.text()` directly (it's built on the
// Fetch API's Request), so the webhook route needs no special raw-body
// wiring the way Express/Fastify's default JSON parsers require.
//
//   npm install hono @hono/node-server
//   QEETID_API_KEY=qk_… QEETID_WEBHOOK_SECRET=whsec_… npx tsx examples/hono
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { ApiError, AuthError, QeetID, constructEvent } from "../../src/index.js";

const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
const app = new Hono<{ Variables: { userId?: string } }>();

app.use("/me", async (c, next) => {
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!token) return c.json({ error: "missing bearer token" }, 401);
  try {
    const claims = await client.sessions.verify(token);
    c.set("userId", claims.userId);
    await next();
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401);
    throw err;
  }
});

app.get("/me", async (c) => {
  const user = await client.users.get(c.get("userId")!);
  return c.json(user);
});

app.post("/webhooks/qeet", async (c) => {
  const body = await c.req.text();
  try {
    const event = constructEvent(body, c.req.header("x-qeet-signature"), c.req.header("x-qeet-event"), process.env.QEETID_WEBHOOK_SECRET!);
    console.log("received", event.type);
    return c.body(null, 200);
  } catch {
    return c.text("invalid signature", 400);
  }
});

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.code, message: err.message, requestId: err.requestId }, (err.status || 500) as never);
  }
  return c.json({ error: "internal_error" }, 500);
});

serve({ fetch: app.fetch, port: 3000 }, () => console.log("listening on :3000"));
