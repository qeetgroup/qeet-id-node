// A Next.js App Router route handler verifying a session token. Save as
// app/api/me/route.ts. Next's Request is a standard Fetch API Request, so
// `await req.text()` already gives the raw body — no raw-body middleware
// dance needed the way Express/Fastify require for the webhook route (see
// examples/express, examples/fastify for that comparison).
//
//   npm install next react react-dom
import { type NextRequest, NextResponse } from "next/server";
import { ApiError, AuthError, QeetID } from "../../src/index.js";

const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }

  try {
    const claims = await client.sessions.verify(token);
    const user = await client.users.get(claims.userId!);
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status || 500 });
    }
    throw err;
  }
}

// The webhook route (app/api/webhooks/qeet/route.ts) is just as direct —
// req.text() is already the raw, unparsed body.
//
//   import { constructEvent } from "@qeet-id/node";
//
//   export async function POST(req: NextRequest) {
//     const body = await req.text();
//     try {
//       const event = constructEvent(body, req.headers.get("x-qeet-signature"), req.headers.get("x-qeet-event"), process.env.QEETID_WEBHOOK_SECRET!);
//       console.log("received", event.type);
//       return new Response(null, { status: 200 });
//     } catch {
//       return new Response("invalid signature", { status: 400 });
//     }
//   }
