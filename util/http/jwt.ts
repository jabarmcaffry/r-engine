// Minimal HS256 JWT implementation (djwt-compatible API subset) using WebCrypto.
// deno-lint-ignore-file no-explicit-any

function encodeBase64Url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface Header {
  alg: "HS256";
  typ?: string;
  [key: string]: unknown;
}

export type Payload = Record<string, unknown>;

/** Create and sign a JWT. Only HS256 is supported. */
export async function create(header: Header, payload: Payload, key: CryptoKey): Promise<string> {
  if (header.alg !== "HS256") throw new Error(`Unsupported JWT algorithm: ${header.alg}`);

  const headerB64 = encodeBase64Url(JSON.stringify({ typ: "JWT", ...header }));
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

/** Verify a JWT's signature and expiry; returns the payload. Throws on failure. */
export async function verify(token: string, key: CryptoKey): Promise<Payload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(headerB64)));
  if (header.alg !== "HS256") throw new Error(`Unsupported JWT algorithm: ${header.alg}`);

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signatureB64).buffer as ArrayBuffer,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) throw new Error("Invalid JWT signature");

  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadB64)));
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
    throw new Error("JWT expired");
  }

  return payload;
}

/** Decode a JWT WITHOUT verifying the signature. Returns [header, payload, signature]. */
export function decode(token: string): [any, any, Uint8Array] {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [headerB64, payloadB64, signatureB64] = parts;
  return [
    JSON.parse(new TextDecoder().decode(decodeBase64Url(headerB64))),
    JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadB64))),
    decodeBase64Url(signatureB64),
  ];
}

/** Numeric date (seconds since epoch) `offsetSeconds` from now — djwt's getNumericDate. */
export function getNumericDate(offsetSeconds: number): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}
