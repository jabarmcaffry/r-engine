// Drop-in replacement for jsr:@std/random — seeded PCG32 RNG + sampling helpers.
// Browser-safe: uses only standard JS.

/** Pseudo-random number generator returning values in [0, 1). */
export type Prng = () => number;

export interface RandomOptions {
  prng?: Prng;
}

export interface SampleOptions extends RandomOptions {
  weights?: ArrayLike<number>;
}

/**
 * Seeded RNG using the PCG32 algorithm (https://www.pcg-random.org).
 * Matches @std/random's randomSeeded: same seed → same sequence.
 */
export function randomSeeded(seed: bigint): Prng {
  const MUL = 6364136223846793005n;
  const INC = 1442695040888963407n;
  const MASK64 = (1n << 64n) - 1n;

  let state = 0n;
  state = (state * MUL + INC + (seed & MASK64)) & MASK64;
  state = (state * MUL + INC) & MASK64;

  return () => {
    const oldState = state;
    state = (oldState * MUL + INC) & MASK64;
    const xorShifted = Number(((oldState >> 18n) ^ oldState) >> 27n & 0xffffffffn);
    const rot = Number(oldState >> 59n);
    const result = ((xorShifted >>> rot) | (xorShifted << (-rot & 31))) >>> 0;
    return result / 0x100000000;
  };
}

export function randomBetween(min: number, max: number, options?: RandomOptions): number {
  const prng = options?.prng ?? Math.random;
  return min + prng() * (max - min);
}

export function randomIntegerBetween(min: number, max: number, options?: RandomOptions): number {
  const prng = options?.prng ?? Math.random;
  return Math.floor(min + prng() * (max - min + 1));
}

export function sample<T>(items: ArrayLike<T>, options?: SampleOptions): T | undefined {
  const prng = options?.prng ?? Math.random;
  if (items.length === 0) return undefined;

  const weights = options?.weights;
  if (weights) {
    if (weights.length !== items.length) {
      throw new RangeError("weights length must equal items length");
    }
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    if (total <= 0) throw new RangeError("total weight must be positive");

    let target = prng() * total;
    for (let i = 0; i < items.length; i++) {
      target -= weights[i];
      if (target < 0) return items[i];
    }
    return items[items.length - 1];
  }

  return items[Math.floor(prng() * items.length)];
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[], options?: RandomOptions): T[] {
  const prng = options?.prng ?? Math.random;
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
