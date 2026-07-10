/** Base64url (RFC 4648 §5, no padding) decode — Node's `Buffer` supports this encoding natively (no dependency needed). */
export function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/** Base64url (RFC 4648 §5, no padding) encode. */
export function base64UrlEncode(input: Uint8Array | Buffer): string {
  return Buffer.from(input).toString("base64url");
}
