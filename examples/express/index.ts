// An Express app with two things every real integration needs: an auth
// middleware that verifies the session token on protected routes, and a
// webhook route wired to receive the RAW body (not Express's default
// JSON-parsed one) so signature verification sees the exact bytes Qeet ID
// signed.
//
//   npm install express
//   QEETID_API_KEY=qk_… QEETID_WEBHOOK_SECRET=whsec_… npx tsx examples/express
import express, { type NextFunction, type Request, type Response } from "express";
import { ApiError, AuthError, QeetID, constructEvent } from "../../src/index.js";

const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
const app = express();

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    tenantId?: string;
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    const claims = await client.sessions.verify(token);
    req.userId = claims.userId;
    req.tenantId = claims.tenantId;
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    next(err);
  }
}

// Regular JSON body parsing for everything except the webhook route below.
app.use(express.json());

app.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await client.users.get(req.userId!);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// The webhook route needs the RAW body, so it gets its own parser
// (express.raw) instead of the app-wide express.json() above.
app.post("/webhooks/qeet", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = constructEvent(
      req.body as Buffer,
      req.header("x-qeet-signature"),
      req.header("x-qeet-event"),
      process.env.QEETID_WEBHOOK_SECRET!,
    );
    console.log("received", event.type);
    res.sendStatus(200);
  } catch {
    res.status(400).send("invalid signature");
  }
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status || 500).json({ error: err.code, message: err.message, requestId: err.requestId });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(3000, () => console.log("listening on :3000"));
