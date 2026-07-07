/**
 * Creates a minimal value-adapter for a fixed set of string literals.
 * Returned object satisfies the `type` parameter of `Entity.defineValue`.
 */
export function enumAdapter<const T extends readonly string[]>(
  values: T,
): { serialize(v: T[number]): string; deserialize(raw: unknown): T[number] } {
  const set = new Set(values);
  return {
    serialize(v) {
      return v;
    },
    deserialize(raw) {
      const s = String(raw);
      if (!set.has(s)) return values[0] as T[number];
      return s as T[number];
    },
  };
}
