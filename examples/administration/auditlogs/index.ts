// Runs a free-text search over the audit log and verifies the hash chain
// is intact.
//
//   QEETID_API_KEY=qk_… npx tsx examples/administration/auditlogs <tenant-id> "<query>"
import { QeetID } from "../../../src/index.js";

async function main() {
  const [tenantId, query] = process.argv.slice(2);
  if (!tenantId || !query) {
    console.error('usage: auditlogs <tenant-id> "<query>"');
    process.exit(1);
  }

  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });

  const page = await client.auditLogs.list(tenantId, { search: query, limit: 20 });
  for (const entry of page.data) {
    console.log(`${entry.created_at} ${entry.action} ${entry.resource_type ?? ""}`);
  }

  const verification = await client.auditLogs.verify(tenantId);
  console.log(`chain intact: ${verification.ok} (${verification.rows_checked} rows checked)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
