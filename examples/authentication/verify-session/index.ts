// Verifies a Qeet ID session token locally (against the published JWKS)
// and runs a permission check.
//
//   QEETID_API_KEY=qk_… QEETID_TOKEN=<jwt> npx tsx examples/authentication/verify-session
import { QeetID } from "../../../src/index.js";

async function main() {
  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });

  const claims = await client.sessions.verify(process.env.QEETID_TOKEN!);
  console.log(`user=${claims.userId} tenant=${claims.tenantId} scope=${JSON.stringify(claims.scope)}`);

  const allowed = await client.permissions.check({
    user: claims.userId!,
    tenant: claims.tenantId!,
    permission: "billing:write",
  });
  console.log("billing:write allowed:", allowed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
