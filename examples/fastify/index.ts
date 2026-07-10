// A Fastify app with a `preHandler` auth hook and a webhook route that
// registers a custom content-type parser so it receives the RAW body
// instead of Fastify's default JSON-parsed one — required for signature
// verification to see the exact bytes Qeet ID signed.
//
//   npm install fastify
//   QEETID_API_KEY=qk_… QEETID_WEBHOOK_SECRET=whsec_… npx tsx examples/fastify
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ApiError, AuthError, QeetID, constructEvent } from "../../src/index.js";

const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
const app = Fastify();

async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) {
    reply.code(401).send({ error: "missing bearer token" });
    return;
  }
  try {
    const claims = await client.sessions.verify(token);
    (req as FastifyRequest & { userId?: string }).userId = claims.userId;
  } catch (err) {
    if (err instanceof AuthError) {
      reply.code(401).send({ error: err.message });
      return;
    }
    throw err;
  }
}

app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
  const userId = (req as FastifyRequest & { userId?: string }).userId!;
  const user = await client.users.get(userId);
  reply.send(user);
});

// Registered as an encapsulated plugin so the raw-body content-type parser
// only applies within this scope — every route outside it (e.g. /me above)
// keeps Fastify's default JSON body parsing untouched.
app.register(async (webhooks) => {
  webhooks.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });

  webhooks.post("/webhooks/qeet", async (req, reply) => {
    try {
      const event = constructEvent(
        req.body as Buffer,
        req.headers["x-qeet-signature"] as string,
        req.headers["x-qeet-event"] as string,
        process.env.QEETID_WEBHOOK_SECRET!,
      );
      console.log("received", event.type);
      reply.code(200).send();
    } catch {
      reply.code(400).send("invalid signature");
    }
  });
});

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ApiError) {
    reply.code(err.status || 500).send({ error: err.code, message: err.message, requestId: err.requestId });
    return;
  }
  reply.code(500).send({ error: "internal_error" });
});

app.listen({ port: 3000 }, () => console.log("listening on :3000"));
