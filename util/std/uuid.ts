// Drop-in replacement for jsr:@std/uuid — NIL_UUID, validate, and v5 generation.

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validate(id: string): boolean {
  return id === NIL_UUID || UUID_RE.test(id);
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const v5 = {
  /** Generate a UUIDv5 (SHA-1, namespaced) — matches @std/uuid/v5's generate(). */
  async generate(namespace: string, data: Uint8Array): Promise<string> {
    const ns = uuidToBytes(namespace);
    const input = new Uint8Array(ns.length + data.length);
    input.set(ns);
    input.set(data, ns.length);

    const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", input.buffer as ArrayBuffer));
    const bytes = hash.slice(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

    return bytesToUuid(bytes);
  },
};

export const generate = v5.generate;
