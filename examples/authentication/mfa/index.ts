// Clears a user's MFA factors — the admin-initiated reset for when someone
// loses their authenticator device. The backend has no endpoint to list a
// user's factors as an admin, only this reset.
//
//   QEETID_API_KEY=qk_… npx tsx examples/authentication/mfa <user-id>
import { QeetID } from "../../../src/index.js";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("usage: mfa <user-id>");
    process.exit(1);
  }

  const client = new QeetID({ apiKey: process.env.QEETID_API_KEY! });
  await client.mfa.reset(userId);
  console.log("MFA factors cleared for", userId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
