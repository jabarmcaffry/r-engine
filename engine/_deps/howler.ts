// howler is CommonJS; `export *` from CJS loses named exports when bundled as
// a separate ESM vendor module, so re-export the names explicitly.
// @deno-types="npm:@types/howler@2.2.12"
import howler from "npm:howler@2.2.4";

// deno-lint-ignore no-explicit-any
const cjs = howler as any;

export const Howl: typeof import("npm:howler@2.2.4").Howl = cjs.Howl;
export const Howler: typeof import("npm:howler@2.2.4").Howler = cjs.Howler;
export type { HowlOptions } from "npm:howler@2.2.4";
