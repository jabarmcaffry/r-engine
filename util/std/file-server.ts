// Drop-in replacement for jsr:@std/http/file-server's serveDir.
import { extname, join, normalize, resolve } from "node:path";
import { contentType } from "./media-types.ts";

export interface ServeDirOptions {
  fsRoot?: string;
  urlRoot?: string;
  showIndex?: boolean;
  enableCors?: boolean;
  quiet?: boolean;
}

export async function serveDir(request: Request, options: ServeDirOptions = {}): Promise<Response> {
  const root = resolve(options.fsRoot ?? ".");
  const url = new URL(request.url);

  let pathname = decodeURIComponent(url.pathname);
  if (options.urlRoot) {
    const prefix = `/${options.urlRoot.replace(/^\/|\/$/g, "")}`;
    if (!pathname.startsWith(prefix)) return new Response("Not Found", { status: 404 });
    pathname = pathname.slice(prefix.length) || "/";
  }

  let filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) return new Response("Forbidden", { status: 403 });

  try {
    let stat = await Deno.stat(filePath);
    if (stat.isDirectory) {
      if (options.showIndex === false) return new Response("Not Found", { status: 404 });
      filePath = join(filePath, "index.html");
      stat = await Deno.stat(filePath);
    }

    const file = await Deno.open(filePath, { read: true });
    const headers = new Headers({
      "Content-Type": contentType(extname(filePath)) ?? "application/octet-stream",
      "Content-Length": String(stat.size),
    });
    if (options.enableCors) headers.set("Access-Control-Allow-Origin", "*");
    return new Response(file.readable, { status: 200, headers });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

// Allow running directly as a simple static file server:
//   deno run -A util/std/file-server.ts --port=5173 <dir>
if (import.meta.main) {
  let port = 8000;
  let dir = ".";
  for (const arg of Deno.args) {
    if (arg.startsWith("--port=")) port = Number(arg.slice(7));
    else if (!arg.startsWith("-")) dir = arg;
  }
  Deno.serve({ port, hostname: "0.0.0.0" }, request =>
    serveDir(request, { fsRoot: dir, enableCors: true }),
  );
}
