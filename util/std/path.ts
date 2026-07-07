// Drop-in replacement for jsr:@std/path — pure-JS POSIX implementation.
// Browser-safe (no node builtins) so editor/client bundles can use it too.

export const sep = "/";
export const SEPARATOR = "/";

export function isAbsolute(path: string): boolean {
  return path.startsWith("/");
}

export function normalize(path: string): string {
  if (path === "") return ".";
  const absolute = isAbsolute(path);
  const trailingSlash = path.endsWith("/");

  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else if (!absolute) {
        segments.push("..");
      }
      continue;
    }
    segments.push(segment);
  }

  let result = segments.join("/");
  if (absolute) result = "/" + result;
  else if (result === "") result = ".";
  if (trailingSlash && !result.endsWith("/")) result += "/";
  return result;
}

export function join(...paths: string[]): string {
  const joined = paths.filter(p => p !== "").join("/");
  if (joined === "") return ".";
  return normalize(joined);
}

export function resolve(...paths: string[]): string {
  let resolved = "";
  for (let i = paths.length - 1; i >= 0; i--) {
    const path = paths[i];
    if (path === "") continue;
    resolved = resolved === "" ? path : path + "/" + resolved;
    if (isAbsolute(path)) return normalize(resolved);
  }
  const cwd = typeof Deno !== "undefined" ? Deno.cwd() : "/";
  return normalize(cwd + "/" + resolved);
}

export function dirname(path: string): string {
  if (path === "") return ".";
  let end = path.length;
  while (end > 1 && path[end - 1] === "/") end--;
  const lastSlash = path.lastIndexOf("/", end - 1);
  if (lastSlash === -1) return ".";
  if (lastSlash === 0) return "/";
  return path.slice(0, lastSlash);
}

export function basename(path: string, suffix?: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end--;
  const lastSlash = path.lastIndexOf("/", end - 1);
  let base = path.slice(lastSlash + 1, end);
  if (suffix && base.endsWith(suffix) && base !== suffix) {
    base = base.slice(0, -suffix.length);
  }
  return base;
}

export function extname(path: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot);
}

export function relative(from: string, to: string): string {
  const fromParts = normalize(from).split("/").filter(p => p !== "" && p !== ".");
  const toParts = normalize(to).split("/").filter(p => p !== "" && p !== ".");

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }

  const up = fromParts.length - common;
  const parts = [...Array(up).fill(".."), ...toParts.slice(common)];
  return parts.join("/");
}

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

export function parse(path: string): ParsedPath {
  const root = isAbsolute(path) ? "/" : "";
  const dir = dirname(path);
  const base = basename(path);
  const ext = extname(path);
  const name = ext ? base.slice(0, -ext.length) : base;
  return { root, dir: dir === "." && !path.startsWith("./") ? "" : dir, base, ext, name };
}

export function format(parsed: Partial<ParsedPath>): string {
  const dir = parsed.dir ?? parsed.root ?? "";
  const base = parsed.base ?? `${parsed.name ?? ""}${parsed.ext ?? ""}`;
  if (dir === "") return base;
  return dir === "/" ? `/${base}` : `${dir}/${base}`;
}

export function toFileUrl(path: string): URL {
  if (!isAbsolute(path)) throw new TypeError(`Path must be absolute: ${path}`);
  const url = new URL("file:///");
  url.pathname = path
    .split("/")
    .map(segment => encodeURIComponent(segment).replace(/%2F/gi, "/"))
    .join("/");
  return url;
}

export function fromFileUrl(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url) : url;
  if (parsed.protocol !== "file:") throw new TypeError(`Must be a file URL: ${url}`);
  return decodeURIComponent(parsed.pathname);
}
