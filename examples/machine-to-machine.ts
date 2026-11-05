// A service principal gets a token with the client_credentials grant and
// reuses it until shortly before it expires.
//
//   QEET_ID_CLIENT_ID=… QEET_ID_CLIENT_SECRET=… node --experimental-strip-types examples/machine-to-machine.ts
import { OAuthError, QeetID } from "../src/index.js";

const qeetId = new QeetID(); // the token endpoint needs no API key
let cached: { token: string; renewAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.renewAt) return cached.token;
  const result = await qeetId.oauth.clientCredentialsGrant({
    client_id: process.env.QEET_ID_CLIENT_ID ?? "",
    client_secret: process.env.QEET_ID_CLIENT_SECRET ?? "",
  });
  // Renew a minute early, or at half-life for short tokens.
  const margin = Math.min(60, result.expires_in / 2) * 1000;
  cached = { token: result.access_token, renewAt: Date.now() + result.expires_in * 1000 - margin };
  return result.access_token;
}

try {
  const token = await accessToken();
  const response = await fetch("https://reports.brightleaffoods.in/v1/summary", { headers: { authorization: `Bearer ${token}` } });
  console.log(response.status);
} catch (error) {
  if (error instanceof OAuthError && error.code === "invalid_client") {
    console.error("The client id or secret is wrong, or the principal was deleted.");
  } else if (error instanceof OAuthError && error.code === "unauthorized_client") {
    console.error("The service principal is disabled.");
  } else {
    throw error;
  }
}
