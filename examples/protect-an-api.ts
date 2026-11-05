// Protects an HTTP API with Qeet ID access tokens, verified locally against
// the issuer's signing keys. For a resource server registered as an RFC 8707
// resource, the audience is its identifier.
//
//   QEET_ID_AUDIENCE=https://api.brightleaffoods.in node --experimental-strip-types examples/protect-an-api.ts
import { createServer } from "node:http";
import { TokenVerificationError, createTokenVerifierFromDiscovery } from "../src/index.js";

// Reads the issuer and the JWKS location from the discovery document, once.
const verifier = await createTokenVerifierFromDiscovery({ audience: process.env.QEET_ID_AUDIENCE ?? "qeet-id" });

createServer(async (req, res) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    res.writeHead(401, { "www-authenticate": 'Bearer realm="api"' }).end();
    return;
  }
  try {
    const claims = await verifier.verify(token);
    const scopes = new Set((claims.scope ?? "").split(" "));
    if (!scopes.has("orders:read")) {
      res.writeHead(403, { "www-authenticate": 'Bearer error="insufficient_scope", scope="orders:read"' }).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ user: claims.sub, tenant: claims.tenant_id }));
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      res.writeHead(401, { "www-authenticate": 'Bearer error="invalid_token"' }).end();
      return;
    }
    res.writeHead(500).end();
  }
}).listen(3001);
