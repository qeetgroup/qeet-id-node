// Creates an organization (tenant) and lists the first page of existing
// ones.
//
//   QEETID_API_KEY=qk_… npx tsx examples/identity/organizations
import { QeetID } from "../../../src/index.js";

async function main() {
  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });

  const org = await client.organizations.create({ name: "Acme Corp", slug: "acme" });
  console.log("created", org.id, org.slug);

  const page = await client.organizations.list(20);
  for (const o of page.data) {
    console.log("-", o.name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
