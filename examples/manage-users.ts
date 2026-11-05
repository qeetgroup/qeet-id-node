// Creates a user safely across retries, walks every user, and handles the
// errors worth handling.
//
//   QEET_ID_API_KEY=qk_… QEET_ID_TENANT_ID=… node --experimental-strip-types examples/manage-users.ts
import { ConflictError, QeetID, RateLimitError, ValidationError } from "../src/index.js";

const qeetId = new QeetID({ apiKey: process.env.QEET_ID_API_KEY, appInfo: { name: "brightleaf-onboarding", version: "1.0.0" } });
const tenantId = process.env.QEET_ID_TENANT_ID ?? "";

try {
  // A key derived from your own record makes a repeated run create the user once.
  const user = await qeetId.users.create(
    { tenant_id: tenantId, email: "meera@brightleaffoods.in", display_name: "Meera Iyer", metadata: { department: "Finance" } },
    { idempotencyKey: "onboarding-employee-1042" },
  );
  console.log("created", user.id);
} catch (error) {
  if (error instanceof ConflictError) {
    console.log("already exists:", error.code);
  } else if (error instanceof ValidationError) {
    for (const field of error.fields) console.log(`${field.field}: ${field.message}`);
  } else if (error instanceof RateLimitError) {
    console.log(`slow down; retry in ${error.retryAfterSeconds ?? 1} s (request ${error.requestId})`);
  } else {
    throw error;
  }
}

// Every active user in Finance, page by page as needed.
for await (const user of qeetId.users.list({ status: "active", department: "Finance", limit: 100 })) {
  console.log(user.email, user.roles?.join(", "));
}
