// Grants a ReBAC relationship and then expands the identity graph rooted at
// it — the same data the console's Identity Graph visualization renders.
//
//   QEETID_API_KEY=qk_… npx tsx examples/authorization/relation-tuples <tenant-id>
import { QeetID } from "../../../src/index.js";

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error("usage: relation-tuples <tenant-id>");
    process.exit(1);
  }

  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
  const rel = client.relationships;

  await rel.create(tenantId, { object: "document:readme", relation: "viewer", subject: "group:eng#member" });

  const result = await rel.check(tenantId, { object: "document:readme", relation: "viewer", user_id: "user-in-eng-group" }, true);
  console.log("allowed:", result.allowed);

  const graph = await rel.graph(tenantId, "document:readme", "viewer", 5);
  for (const node of graph.nodes) {
    console.log(`node: ${node.label} (${node.type})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
