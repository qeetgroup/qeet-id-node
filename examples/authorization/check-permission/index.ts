// Runs an RBAC check and prints the grant path that decided it (explain),
// not just the boolean.
//
//   QEETID_API_KEY=qk_… npx tsx examples/authorization/check-permission <user> <tenant> <permission>
import { QeetID } from "../../../src/index.js";

async function main() {
  const [userId, tenantId, permission] = process.argv.slice(2);
  if (!userId || !tenantId || !permission) {
    console.error("usage: check-permission <user-id> <tenant-id> <permission>");
    process.exit(1);
  }

  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
  const explanation = await client.permissions.explain({ user: userId, tenant: tenantId, permission });

  if (!explanation.allowed) {
    console.log("denied:", explanation.reason);
    return;
  }
  console.log("allowed via:");
  for (const step of explanation.paths ?? []) {
    console.log(`  ${step.permission} granted by ${step.granted_by} (${step.via})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
