// Drop-in replacement for jsr:@std/dotenv — parses simple KEY=VALUE .env files.

export interface LoadOptions {
  envPath?: string | null;
  export?: boolean;
}

export function parse(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      }
    }
    env[key] = value;
  }
  return env;
}

export async function load(options: LoadOptions = {}): Promise<Record<string, string>> {
  const envPath = options.envPath ?? ".env";
  let text: string;
  try {
    text = await Deno.readTextFile(envPath);
  } catch {
    return {};
  }

  const env = parse(text);
  if (options.export) {
    for (const [key, value] of Object.entries(env)) {
      if (Deno.env.get(key) === undefined) Deno.env.set(key, value);
    }
  }
  return env;
}

export function loadSync(options: LoadOptions = {}): Record<string, string> {
  const envPath = options.envPath ?? ".env";
  let text: string;
  try {
    text = Deno.readTextFileSync(envPath);
  } catch {
    return {};
  }

  const env = parse(text);
  if (options.export) {
    for (const [key, value] of Object.entries(env)) {
      if (Deno.env.get(key) === undefined) Deno.env.set(key, value);
    }
  }
  return env;
}
