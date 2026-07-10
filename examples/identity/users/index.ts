// Auto-paginates every user in a tenant using the `all` async generator.
//
//   QEETID_API_KEY=qk_… QEETID_TENANT_ID=<uuid> npx tsx examples/identity/users
import { QeetID } from "../../../src/index.js";

async function main() {
  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });

  let count = 0;
  for await (const user of client.users.all({ tenant: process.env.QEETID_TENANT_ID })) {
    console.log(user.email);
    count++;
  }
  console.log(`${count} users total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
