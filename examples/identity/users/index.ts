// Auto-paginates every user of the API key's organisation using the `all`
// async generator (the organisation always comes from the credential).
//
//   QEETID_API_KEY=qk_… npx tsx examples/identity/users
import { QeetID } from "../../../src/index.js";

async function main() {
  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });

  let count = 0;
  for await (const user of client.users.all()) {
    console.log(user.email);
    count++;
  }
  console.log(`${count} users total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
