// Verifies inbound Qeet ID webhooks and prints them. Uses plain node:http
// (no framework) specifically because it hands you the raw request body by
// default — no risk of a body-parsing middleware consuming it before
// signature verification can see the original bytes. See examples/express
// and examples/fastify for the same thing wired into a framework.
//
//   QEETID_WEBHOOK_SECRET=whsec_… npx tsx examples/administration/webhooks
import { createServer } from "node:http";
import { constructEvent } from "../../../src/index.js";

const secret = process.env.QEETID_WEBHOOK_SECRET!;

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/qeet") {
    res.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    try {
      const event = constructEvent(body, req.headers["x-qeet-signature"] as string, req.headers["x-qeet-event"] as string, secret);
      switch (event.type) {
        case "user.created":
        case "user.deleted":
          console.log(`${event.type}:`, event.payload);
          break;
        default:
          console.log("unhandled event", event.type);
      }
      res.writeHead(200).end();
    } catch {
      res.writeHead(400).end("invalid signature");
    }
  });
});

server.listen(8080, () => console.log("listening on :8080"));
