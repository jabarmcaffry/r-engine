// Drop-in replacement for jsr:@std/fs backed by node:fs.
// Implements only the surface the engine uses: ensureDir, exists, copy,
// emptyDir, move, walk, expandGlob.
import * as nfs from "node:fs/promises";
import * as npath from "node:path";

export interface WalkEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

export async function ensureDir(dir: string | URL): Promise<void> {
  await nfs.mkdir(dir, { recursive: true });
}

export interface ExistsOptions {
  isFile?: boolean;
  isDirectory?: boolean;
}

export async function exists(path: string | URL, options?: ExistsOptions): Promise<boolean> {
  try {
    const stat = await nfs.stat(path);
    if (options?.isFile && !stat.isFile()) return false;
    if (options?.isDirectory && !stat.isDirectory()) return false;
    return true;
  } catch {
    return false;
  }
}

export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
}

export async function copy(
  src: string | URL,
  dest: string | URL,
  options?: CopyOptions,
): Promise<void> {
  await nfs.cp(src, dest, {
    recursive: true,
    force: options?.overwrite ?? false,
    errorOnExist: !(options?.overwrite ?? false),
    preserveTimestamps: options?.preserveTimestamps ?? false,
  });
}

export async function emptyDir(dir: string | URL): Promise<void> {
  try {
    const entries = await nfs.readdir(dir);
    await Promise.all(
      entries.map(entry => nfs.rm(npath.join(dir.toString(), entry), { recursive: true })),
    );
  } catch {
    await nfs.mkdir(dir, { recursive: true });
  }
}

export interface MoveOptions {
  overwrite?: boolean;
}

export async function move(
  src: string | URL,
  dest: string | URL,
  options?: MoveOptions,
): Promise<void> {
  if (options?.overwrite) {
    await nfs.rm(dest, { recursive: true, force: true });
  }
  await nfs.rename(src, dest);
}

export interface WalkOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  includeDirs?: boolean;
  includeSymlinks?: boolean;
  followSymlinks?: boolean;
  exts?: string[];
  match?: RegExp[];
  skip?: RegExp[];
}

export async function* walk(
  root: string | URL,
  options: WalkOptions = {},
): AsyncGenerator<WalkEntry, void, unknown> {
  const {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = true,
    includeSymlinks = true,
    exts,
    match,
    skip,
  } = options;

  const rootPath = root.toString();

  function shouldInclude(path: string, isFile: boolean): boolean {
    if (exts && isFile && !exts.some(ext => path.endsWith(ext.startsWith(".") ? ext : `.${ext}`)))
      return false;
    if (match && !match.some(re => re.test(path))) return false;
    if (skip && skip.some(re => re.test(path))) return false;
    return true;
  }

  async function* walkDir(dir: string, depth: number): AsyncGenerator<WalkEntry, void, unknown> {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await nfs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = npath.join(dir, entry.name);
      const isSymlink = entry.isSymbolicLink();
      const isDirectory = entry.isDirectory();
      const isFile = entry.isFile();

      if (isDirectory) {
        if (includeDirs && shouldInclude(entryPath, false)) {
          yield { path: entryPath, name: entry.name, isFile: false, isDirectory: true, isSymlink };
        }
        yield* walkDir(entryPath, depth + 1);
      } else if (isFile) {
        if (includeFiles && shouldInclude(entryPath, true)) {
          yield { path: entryPath, name: entry.name, isFile: true, isDirectory: false, isSymlink };
        }
      } else if (isSymlink && includeSymlinks) {
        if (shouldInclude(entryPath, false)) {
          yield { path: entryPath, name: entry.name, isFile: false, isDirectory: false, isSymlink };
        }
      }
    }
  }

  if (includeDirs && shouldInclude(rootPath, false)) {
    yield {
      path: rootPath,
      name: npath.basename(rootPath),
      isFile: false,
      isDirectory: true,
      isSymlink: false,
    };
  }
  yield* walkDir(rootPath, 1);
}

export interface ExpandGlobOptions {
  root?: string;
  exclude?: string[];
  includeDirs?: boolean;
  followSymlinks?: boolean;
}

/** Convert a glob pattern to a RegExp. Supports `**`, `*`, `?` and literal text. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**/` or `**` — match any number of path segments
        if (glob[i + 2] === "/") {
          re += "(?:[^/]*/)*";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

export async function* expandGlob(
  glob: string,
  options: ExpandGlobOptions = {},
): AsyncGenerator<WalkEntry, void, unknown> {
  const isAbsoluteGlob = npath.isAbsolute(glob);
  const root = options.root ?? (isAbsoluteGlob ? findGlobRoot(glob) : Deno.cwd());
  const pattern = isAbsoluteGlob ? npath.relative(root, glob) : glob;
  const regex = globToRegExp(pattern.split(npath.sep).join("/"));

  for await (const entry of walk(root, { includeDirs: options.includeDirs ?? true })) {
    const rel = npath.relative(root, entry.path).split(npath.sep).join("/");
    if (rel === "") continue;
    if (regex.test(rel)) yield entry;
  }
}

/** The non-glob prefix of an absolute glob pattern (the deepest literal directory). */
function findGlobRoot(glob: string): string {
  const segments = glob.split(npath.sep);
  const literal: string[] = [];
  for (const segment of segments) {
    if (segment.includes("*") || segment.includes("?")) break;
    literal.push(segment);
  }
  // Drop the final segment if the glob had no wildcard (points at a file)
  if (literal.length === segments.length) literal.pop();
  return literal.join(npath.sep) || npath.sep;
}
