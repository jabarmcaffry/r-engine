// Replacement for jsr:@luca/esbuild-deno-loader that works without JSR access.
//
// Resolves Deno-style imports for browser bundles:
//   - import-map entries from a deno.json/deno.jsonc (`@rebur/engine` → local file)
//   - `npm:pkg@version/subpath` specifiers → node_modules (install via `npm install`
//     at the repo root; versions are pinned in package.json)
//   - `data:` URL imports (used for the `env` module in editor/client builds)
//
// Everything else (relative paths, bare node_modules specifiers) falls through to
// esbuild's native resolver.
import * as esbuild from "npm:esbuild@0.24.0";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parse as parseJsonc } from "../util/std/jsonc.ts";

interface DenoPluginsOptions {
  configPath: string;
  /** Accepted for call-site compatibility; resolution is always node_modules-based. */
  loader?: "native" | "portable";
  /** Directory containing node_modules. Defaults to the repo root (one above build-system). */
  nodeModulesParent?: string;
}

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");

interface ImportMap {
  /** exact specifier → target */
  exact: Map<string, string>;
  /** prefix (ends with "/") → target prefix */
  prefixes: [string, string][];
  baseDir: string;
}

function loadImportMap(configPath: string): ImportMap {
  const text = Deno.readTextFileSync(configPath);
  const config = parseJsonc(text) as { imports?: Record<string, string> };
  const baseDir = dirname(configPath);

  const exact = new Map<string, string>();
  const prefixes: [string, string][] = [];
  for (const [key, value] of Object.entries(config.imports ?? {})) {
    if (key.endsWith("/")) prefixes.push([key, value]);
    else exact.set(key, value);
  }
  // longest prefix first
  prefixes.sort((a, b) => b[0].length - a[0].length);

  return { exact, prefixes, baseDir };
}

function applyImportMap(specifier: string, map: ImportMap): string | undefined {
  const exact = map.exact.get(specifier);
  if (exact !== undefined) return exact;

  for (const [prefix, target] of map.prefixes) {
    if (specifier.startsWith(prefix)) {
      return target + specifier.slice(prefix.length);
    }
  }
  return undefined;
}

/** `npm:@scope/pkg@1.2.3/sub` → `@scope/pkg/sub`; `npm:pkg@^1/sub` → `pkg/sub` */
export function stripNpmSpecifier(specifier: string): string {
  let rest = specifier.slice(4); // remove "npm:"
  if (rest.startsWith("/")) rest = rest.slice(1);

  let scope = "";
  if (rest.startsWith("@")) {
    const slash = rest.indexOf("/");
    scope = rest.slice(0, slash + 1);
    rest = rest.slice(slash + 1);
  }

  const at = rest.indexOf("@");
  let name: string, subpath: string;
  if (at === -1) {
    const slash = rest.indexOf("/");
    name = slash === -1 ? rest : rest.slice(0, slash);
    subpath = slash === -1 ? "" : rest.slice(slash);
  } else {
    name = rest.slice(0, at);
    const afterVersion = rest.slice(at + 1);
    const slash = afterVersion.indexOf("/");
    subpath = slash === -1 ? "" : afterVersion.slice(slash);
  }

  return scope + name + subpath;
}

export function denoPlugins(options: DenoPluginsOptions): esbuild.Plugin[] {
  const importMap = loadImportMap(options.configPath);
  const nodeModulesParent = options.nodeModulesParent ?? REPO_ROOT;

  const plugin: esbuild.Plugin = {
    name: "rebur-deno-resolver",
    setup(build) {
      // data: URL imports (e.g. `env` → "data:application/javascript,...")
      build.onResolve({ filter: /^data:/ }, args => ({
        path: args.path,
        namespace: "rebur-data-url",
      }));
      build.onLoad({ filter: /.*/, namespace: "rebur-data-url" }, args => {
        const match = /^data:([^,;]+)(;base64)?,(.*)$/.exec(args.path);
        if (!match) throw new Error(`Unsupported data: URL: ${args.path.slice(0, 64)}`);
        const [, _mime, isBase64, data] = match;
        const contents = isBase64 ? atob(data) : decodeURIComponent(data);
        return { contents, loader: "js" };
      });

      // npm: specifiers → bare specifier resolved from node_modules
      build.onResolve({ filter: /^npm:/ }, async args => {
        const bare = stripNpmSpecifier(args.path);
        const result = await build.resolve(bare, {
          kind: args.kind,
          resolveDir: nodeModulesParent,
        });
        if (result.errors.length > 0) {
          throw new Error(
            `Cannot resolve "${args.path}" (as "${bare}") from node_modules. ` +
              `Is it listed in package.json? Run \`npm install\` at the repo root.`,
          );
        }
        return result;
      });

      build.onResolve({ filter: /^jsr:/ }, args => {
        throw new Error(
          `JSR imports are not supported: "${args.path}". Use an npm or local module instead.`,
        );
      });

      // import-map resolution for bare/mapped specifiers
      build.onResolve({ filter: /.*/ }, async args => {
        if (args.namespace !== "file" && args.namespace !== "") return undefined;
        if (args.path.startsWith(".") || isAbsolute(args.path)) return undefined;

        const mapped = applyImportMap(args.path, importMap);
        if (mapped === undefined) return undefined;

        if (mapped.startsWith("npm:") || mapped.startsWith("data:") || mapped.startsWith("jsr:")) {
          return await build.resolve(mapped, {
            kind: args.kind,
            resolveDir: args.resolveDir,
          });
        }

        // relative/absolute file target, resolved against the import map's directory
        const filePath = isAbsolute(mapped) ? mapped : join(importMap.baseDir, mapped);
        return { path: filePath };
      });
    },
  };

  return [plugin];
}
