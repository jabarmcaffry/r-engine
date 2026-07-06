#!/usr/bin/env -S deno run -A
// Rebur Engine — Proxy server
// Port 5000: serves dashboard, editor, docs, public assets.
// Forwards /api/* /internal/* /worlds/* to the multiplayer server on port 8000.

import { serveDir } from "jsr:@std/http@^1/file-server";

const API_PORT      = 8000;
const EDITOR_WEB_DIR = "./editor/web";
const PUBLIC_DIR    = "./public";

// Auth token for privileged multiplayer endpoints.
// Never sent to the browser — the proxy adds it server-side for /api/dashboard/* routes.
const MULTIPLAYER_AUTH_TOKEN =
  Deno.env.get("REBUR_MULTIPLAYER_AUTH_TOKEN") ?? "token";

function isApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/internal/") ||
    pathname.startsWith("/worlds/") ||
    pathname === "/api" ||
    pathname === "/internal"
  );
}

function sanitizeCloseCode(code: number): number {
  if (code === 1000) return 1000;
  if (code >= 3000 && code <= 4999) return code;
  return 1000;
}

// ── Static file helpers ───────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js:   "application/javascript; charset=utf-8",
  css:  "text/css; charset=utf-8",
  json: "application/json",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  svg:  "image/svg+xml",
  ico:  "image/x-icon",
  woff2:"font/woff2",
  woff: "font/woff",
};

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

async function serveFile(filePath: string): Promise<Response> {
  try {
    const content = await Deno.readFile(filePath);
    return new Response(content, { headers: { "Content-Type": mimeFor(filePath) } });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

// Serve the editor, injecting the mobile overlay script.
async function serveEditorPage(): Promise<Response> {
  try {
    let html = await Deno.readTextFile(EDITOR_WEB_DIR + "/index.html");
    // Inject mobile overlay just before </body>
    html = html.replace(
      "</body>",
      `  <script src="/public/mobile-overlay.js" defer></script>\n</body>`,
    );
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

// ── World list (filesystem, no forward to port 8000) ─────────────────────────

async function serveWorldsList(): Promise<Response> {
  const worlds: Array<{ id: string; name: string }> = [];
  try {
    for await (const entry of Deno.readDir("./multiplayer/worlds/rebur")) {
      if (entry.isDirectory) worlds.push({ id: `rebur/${entry.name}`, name: entry.name });
    }
  } catch { /* worlds dir not found */ }
  worlds.sort((a, b) => a.id.localeCompare(b.id));
  return new Response(JSON.stringify({ worlds }), { headers: { "Content-Type": "application/json" } });
}

// ── Dashboard privileged proxy (auth added server-side) ──────────────────────

async function dashboardProxy(req: Request, targetPath: string, method?: string): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = `http://localhost:${API_PORT}${targetPath}${url.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.set("Authorization", `Bearer ${MULTIPLAYER_AUTH_TOKEN}`);
  const m = method ?? req.method;
  try {
    return await fetch(targetUrl, {
      method: m,
      headers,
      body: m !== "GET" && m !== "HEAD" ? req.body : undefined,
    });
  } catch {
    return new Response("Multiplayer server unavailable", { status: 502 });
  }
}

// ── WebSocket proxy ───────────────────────────────────────────────────────────

async function proxyWebSocket(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = `ws://localhost:${API_PORT}${url.pathname}${url.search}`;
  const { socket: client, response } = Deno.upgradeWebSocket(req);
  let server: WebSocket | null = null;
  const queue: Array<string | ArrayBuffer> = [];

  client.onopen = () => {
    server = new WebSocket(targetUrl);
    server.binaryType = "arraybuffer";
    server.onopen    = () => { queue.forEach(m => server!.send(m)); queue.length = 0; };
    server.onmessage = (e) => { if (client.readyState === WebSocket.OPEN) client.send(e.data); };
    server.onclose   = (e) => { if (client.readyState === WebSocket.OPEN) client.close(sanitizeCloseCode(e.code), e.reason); };
    server.onerror   = ()  => { if (client.readyState === WebSocket.OPEN) client.close(1000, "Server error"); };
  };
  client.onmessage = (e) => { if (server?.readyState === WebSocket.OPEN) server.send(e.data); else queue.push(e.data); };
  client.onclose   = (e) => { if (server?.readyState === WebSocket.OPEN) server.close(sanitizeCloseCode(e.code), e.reason); };
  client.onerror   = ()  => { if (server?.readyState === WebSocket.OPEN) server.close(1000, "Client error"); };
  return response;
}

// ── HTTP proxy ────────────────────────────────────────────────────────────────

async function proxyHttp(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = `http://localhost:${API_PORT}${url.pathname}${url.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  try {
    return await fetch(targetUrl, {
      method: req.method, headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });
  } catch {
    return new Response("Multiplayer server unavailable", { status: 502 });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve({ port: 5000, hostname: "0.0.0.0" }, async (req) => {
  const url = new URL(req.url);
  const { pathname } = url;

  // ── Proxy-only API endpoints ──────────────────────────────────────────────
  if (pathname === "/api/v1/worlds" && req.method === "GET") return serveWorldsList();

  // Dashboard privileged tunnels (auth token added server-side)
  if (pathname === "/api/dashboard/instances"     && req.method === "GET")  return dashboardProxy(req, "/api/v1/instances");
  if (pathname === "/api/dashboard/start-instance" && req.method === "POST") return dashboardProxy(req, "/api/v1/instances", "PUT");

  // ── Forward to multiplayer server ─────────────────────────────────────────
  if (isApiPath(pathname)) {
    return req.headers.get("upgrade")?.toLowerCase() === "websocket"
      ? proxyWebSocket(req)
      : proxyHttp(req);
  }

  // ── Public assets (mobile overlay, docs assets, etc.) ────────────────────
  if (pathname.startsWith("/public/")) {
    const filePath = PUBLIC_DIR + pathname.slice("/public".length);
    return serveFile(filePath);
  }

  // ── Documentation ─────────────────────────────────────────────────────────
  if (pathname === "/docs" || pathname === "/docs/") {
    return serveFile(PUBLIC_DIR + "/docs.html");
  }

  // ── Root routing ──────────────────────────────────────────────────────────
  if (pathname === "/" || pathname === "") {
    return url.searchParams.has("instance")
      ? serveEditorPage()                          // editor with mobile overlay
      : serveFile(PUBLIC_DIR + "/dashboard.html"); // launcher dashboard
  }

  // ── Editor static assets (dist/, sprites/, fonts/, etc.) ─────────────────
  const editorResp = await serveDir(req, { fsRoot: EDITOR_WEB_DIR, quiet: true });
  if (editorResp.status !== 404) return editorResp;

  // SPA fallback
  return serveEditorPage();
});

console.log("Rebur Engine proxy running on http://0.0.0.0:5000");
console.log("  /                   → dashboard");
console.log("  /?instance=<id>     → editor (+ mobile overlay)");
console.log("  /docs               → documentation");
console.log("  /public/*           → static public assets");
console.log("  /api/dashboard/*    → privileged proxy (auth server-side)");
console.log(`  /api/* /internal/* /worlds/* → localhost:${API_PORT}`);
