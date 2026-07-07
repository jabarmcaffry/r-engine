// Drop-in replacement for jsr:@std/cli's parseArgs (minimist-style).
// deno-lint-ignore-file no-explicit-any

export interface ParseOptions {
  string?: string[];
  boolean?: string[] | boolean;
  default?: Record<string, unknown>;
  alias?: Record<string, string | string[]>;
  collect?: string[];
  negatable?: string[];
  "--"?: boolean;
}

export interface Args {
  _: (string | number)[];
  [key: string]: any;
}

export function parseArgs(args: string[], options: ParseOptions = {}): Args {
  const stringFlags = new Set(options.string ?? []);
  const booleanFlags = new Set(Array.isArray(options.boolean) ? options.boolean : []);
  const allBooleans = options.boolean === true;
  const collectFlags = new Set(options.collect ?? []);

  const aliases = new Map<string, string>();
  for (const [key, value] of Object.entries(options.alias ?? {})) {
    for (const alias of Array.isArray(value) ? value : [value]) {
      aliases.set(alias, key);
    }
  }

  const result: Args = { _: [] };

  const setValue = (rawKey: string, value: unknown) => {
    const key = aliases.get(rawKey) ?? rawKey;
    if (collectFlags.has(key)) {
      if (!Array.isArray(result[key])) result[key] = [];
      result[key].push(value);
    } else {
      result[key] = value;
    }
  };

  const isBoolean = (key: string) =>
    allBooleans || booleanFlags.has(aliases.get(key) ?? key);
  const isString = (key: string) => stringFlags.has(aliases.get(key) ?? key);

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--") {
      const rest = args.slice(i + 1);
      if (options["--"]) result["--"] = rest;
      else result._.push(...rest);
      break;
    }

    if (arg.startsWith("--no-") && (options.negatable ?? []).includes(arg.slice(5))) {
      setValue(arg.slice(5), false);
      i += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        setValue(arg.slice(2, eq), coerce(arg.slice(eq + 1), isString(arg.slice(2, eq))));
        i += 1;
        continue;
      }

      const key = arg.slice(2);
      const next = args[i + 1];
      if (isBoolean(key) || next === undefined || next.startsWith("-")) {
        setValue(key, isString(key) ? "" : true);
        i += 1;
      } else {
        setValue(key, coerce(next, isString(key)));
        i += 2;
      }
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      // short flags: -abc or -o value
      const flags = arg.slice(1);
      const lastFlag = flags[flags.length - 1];
      for (const flag of flags.slice(0, -1)) setValue(flag, true);

      const next = args[i + 1];
      if (isBoolean(lastFlag) || next === undefined || next.startsWith("-")) {
        setValue(lastFlag, isString(lastFlag) ? "" : true);
        i += 1;
      } else {
        setValue(lastFlag, coerce(next, isString(lastFlag)));
        i += 2;
      }
      continue;
    }

    result._.push(coerce(arg, false));
    i += 1;
  }

  for (const [key, value] of Object.entries(options.default ?? {})) {
    if (!(key in result)) result[key] = value;
  }

  // booleans default to false when declared
  for (const key of booleanFlags) {
    if (!(key in result)) result[key] = false;
  }

  return result;
}

function coerce(value: string, forceString: boolean): string | number {
  if (forceString) return value;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}
