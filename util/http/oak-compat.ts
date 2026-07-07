// Minimal Oak-compatible HTTP framework built on Deno.serve.
// Implements exactly the surface this codebase uses so the multiplayer hosts
// don't depend on JSR being reachable: Application, Router, Context, Status,
// route params (`:name`, `:name*`), middleware composition, websocket
// upgrades, and static file sending.
// deno-lint-ignore-file no-explicit-any

import { extname, join, normalize, resolve } from "node:path";
import { contentType } from "../std/media-types.ts";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
export enum Status {
  OK = 200,
  Created = 201,
  Accepted = 202,
  NoContent = 204,
  MovedPermanently = 301,
  Found = 302,
  NotModified = 304,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  Conflict = 409,
  Gone = 410,
  PayloadTooLarge = 413,
  UnsupportedMediaType = 415,
  MisdirectedRequest = 421,
  UnprocessableEntity = 422,
  TooManyRequests = 429,
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
}

export class HttpError extends Error {
  constructor(
    public status: Status,
    message?: string,
  ) {
    super(message ?? Status[status] ?? `HTTP ${status}`);
  }
}

// ---------------------------------------------------------------------------
// Request / Response wrappers
// ---------------------------------------------------------------------------
export class OakRequest {
  #request: Request;
  readonly url: URL;

  constructor(request: Request) {
    this.#request = request;
    this.url = new URL(request.url);
  }

  get method(): string {
    return this.#request.method;
  }

  get headers(): Headers {
    return this.#request.headers;
  }

  get source(): Request {
    return this.#request;
  }

  get body() {
    const request = this.#request;
    return {
      json: () => request.json(),
      text: () => request.text(),
      arrayBuffer: () => request.arrayBuffer(),
      formData: () => request.formData(),
      get stream(): ReadableStream<Uint8Array> | null {
        return request.body;
      },
    };
  }
}

export class OakResponse {
  #status: Status | undefined = undefined;
  body: unknown = undefined;
  type: string | undefined = undefined;
  headers = new Headers();

  /** Mirrors Oak: defaults to 200 once a body has been set, undefined otherwise. */
  get status(): Status | undefined {
    if (this.#status !== undefined) return this.#status;
    return this.body !== undefined ? Status.OK : undefined;
  }

  set status(value: Status | undefined) {
    this.#status = value;
  }

  redirect(url: string | URL): void {
    this.status = Status.Found;
    this.headers.set("Location", url.toString());
  }

  toNativeResponse(): Response {
    const status = this.status ?? (this.body !== undefined ? Status.OK : Status.NotFound);
    const headers = this.headers;
    let body: BodyInit | null = null;

    if (this.body === undefined || this.body === null) {
      body = status === Status.NotFound && this.body === undefined ? "Not Found" : null;
      if (body && !this.type) this.type = "text/plain; charset=UTF-8";
    } else if (typeof this.body === "string") {
      body = this.body;
      if (!this.type) this.type = "text/plain; charset=UTF-8";
    } else if (this.body instanceof Uint8Array || this.body instanceof ArrayBuffer) {
      body = this.body as BodyInit;
      if (!this.type) this.type = "application/octet-stream";
    } else if (this.body instanceof ReadableStream) {
      body = this.body;
      if (!this.type) this.type = "application/octet-stream";
    } else if (this.body instanceof Blob) {
      body = this.body;
    } else {
      body = JSON.stringify(this.body);
      if (!this.type) this.type = "application/json; charset=UTF-8";
    }

    if (this.type && !headers.has("Content-Type")) {
      headers.set("Content-Type", contentType(this.type) ?? this.type);
    }

    // Statuses that must not carry a body
    if (status === 204 || status === 304) body = null;

    return new Response(body, { status, headers });
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export type State = Record<string, any>;
export type RouteParams<_R extends string = string> = Record<string, string>;

export interface SendOptions {
  root: string;
  path?: string;
  index?: string;
  hidden?: boolean;
  /** Accepted for Oak compatibility; caching hints are not implemented. */
  immutable?: boolean;
  maxage?: number;
  /** Accepted for Oak compatibility; content type is derived from the extension. */
  contentTypes?: Record<string, string>;
}

export class Context<S extends State = State, P extends RouteParams = RouteParams> {
  readonly request: OakRequest;
  readonly response = new OakResponse();
  state: S = {} as S;
  params: P = {} as P;

  /** Set when `upgrade()` has been called; returned directly by the server. */
  upgradeResponse: Response | undefined = undefined;

  constructor(request: Request) {
    this.request = new OakRequest(request);
  }

  get isUpgradable(): boolean {
    return this.request.headers.get("upgrade")?.toLowerCase() === "websocket";
  }

  upgrade(): WebSocket {
    const { socket, response } = Deno.upgradeWebSocket(this.request.source);
    this.upgradeResponse = response;
    return socket;
  }

  throw(status: Status, message?: string): never {
    throw new HttpError(status, message);
  }

  assert(condition: unknown, status: Status, message?: string): asserts condition {
    if (!condition) throw new HttpError(status, message);
  }

  /** Serve a static file from `root`, guarding against path traversal. */
  async send(options: SendOptions): Promise<string | undefined> {
    const root = resolve(options.root);
    const requested = decodeURIComponent(options.path ?? this.request.url.pathname);

    let filePath = normalize(join(root, requested));
    if (!filePath.startsWith(root)) throw new HttpError(Status.Forbidden);

    let stat: Deno.FileInfo;
    try {
      stat = await Deno.stat(filePath);
      if (stat.isDirectory && options.index) {
        filePath = join(filePath, options.index);
        stat = await Deno.stat(filePath);
      }
    } catch {
      if (options.index) {
        // SPA-style fallback is the caller's job; we just report not-found.
        throw new HttpError(Status.NotFound, `File not found: ${requested}`);
      }
      throw new HttpError(Status.NotFound, `File not found: ${requested}`);
    }

    const file = await Deno.open(filePath, { read: true });
    this.response.body = file.readable;
    this.response.type = contentType(extname(filePath)) ?? "application/octet-stream";
    this.response.status = Status.OK;
    return filePath;
  }
}

export type RouterContext<
  R extends string = string,
  P extends RouteParams<R> = RouteParams<R>,
  S extends State = State,
> = Context<S, P>;

export type Next = () => Promise<unknown>;
export type Middleware<S extends State = State> = (
  ctx: Context<S>,
  next: Next,
) => unknown | Promise<unknown>;
export type RouterMiddleware<
  R extends string = string,
  P extends RouteParams<R> = RouteParams<R>,
  S extends State = State,
> = (ctx: RouterContext<R, P, S>, next: Next) => unknown | Promise<unknown>;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
interface Route {
  method: string;
  pattern: RegExp;
  paramNames: { name: string; wildcard: boolean }[];
  middleware: RouterMiddleware<any, any, any>[];
}

/** Compile an Oak-style route path (`/a/:b/:c*`) into a RegExp. */
function compilePath(path: string): { pattern: RegExp; paramNames: Route["paramNames"] } {
  const paramNames: Route["paramNames"] = [];
  const segments = path.split("/").filter(s => s !== "");

  let regex = "";
  for (const segment of segments) {
    if (segment.startsWith(":")) {
      const wildcard = segment.endsWith("*") || segment.endsWith("+");
      const name = segment.slice(1, wildcard ? -1 : undefined);
      paramNames.push({ name, wildcard });
      if (wildcard) {
        // `*` matches zero or more segments, `+` one or more
        regex += segment.endsWith("*") ? "(?:/(.*))?" : "/(.+)";
      } else {
        regex += "/([^/]+)";
      }
    } else {
      regex += "/" + segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }

  if (regex === "") regex = "/";
  return { pattern: new RegExp(`^${regex}/?$`), paramNames };
}

export class Router<S extends State = State> {
  #routes: Route[] = [];

  #add(method: string, path: string, middleware: RouterMiddleware<any, any, any>[]) {
    const { pattern, paramNames } = compilePath(path);
    this.#routes.push({ method, pattern, paramNames, middleware });
    return this;
  }

  get<R extends string>(path: R, ...mw: RouterMiddleware<R, RouteParams<R>, S>[]) {
    return this.#add("GET", path, mw);
  }
  post<R extends string>(path: R, ...mw: RouterMiddleware<R, RouteParams<R>, S>[]) {
    return this.#add("POST", path, mw);
  }
  put<R extends string>(path: R, ...mw: RouterMiddleware<R, RouteParams<R>, S>[]) {
    return this.#add("PUT", path, mw);
  }
  patch<R extends string>(path: R, ...mw: RouterMiddleware<R, RouteParams<R>, S>[]) {
    return this.#add("PATCH", path, mw);
  }
  delete<R extends string>(path: R, ...mw: RouterMiddleware<R, RouteParams<R>, S>[]) {
    return this.#add("DELETE", path, mw);
  }

  routes(): Middleware<S> {
    return async (ctx, next) => {
      const pathname = ctx.request.url.pathname;
      for (const route of this.#routes) {
        if (route.method !== ctx.request.method && ctx.request.method !== "HEAD") continue;
        if (route.method !== ctx.request.method && route.method !== "GET") continue;
        const match = route.pattern.exec(pathname);
        if (!match) continue;

        const params: Record<string, string> = {};
        route.paramNames.forEach((param, i) => {
          const raw = match[i + 1];
          params[param.name] = raw === undefined ? "" : decodeURIComponent(raw);
        });
        ctx.params = params as any;

        // run this route's middleware chain
        await compose(route.middleware as Middleware<S>[])(ctx as Context<S>, next);
        return;
      }
      await next();
    };
  }

  allowedMethods(): Middleware<S> {
    return async (ctx, next) => {
      await next();
      if (ctx.response.status !== undefined || ctx.response.body !== undefined) return;
      const pathname = ctx.request.url.pathname;
      const allowed = this.#routes
        .filter(route => route.pattern.test(pathname))
        .map(route => route.method);
      if (allowed.length > 0 && !allowed.includes(ctx.request.method)) {
        ctx.response.status = Status.MethodNotAllowed;
        ctx.response.headers.set("Allow", [...new Set(allowed)].join(", "));
        ctx.response.body = "Method Not Allowed";
        ctx.response.type = "text/plain";
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
function compose<S extends State>(middleware: Middleware<S>[]): Middleware<S> {
  return async (ctx, finalNext) => {
    let index = -1;
    const dispatch = async (i: number): Promise<unknown> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const fn = i === middleware.length ? finalNext : middleware[i];
      if (!fn) return;
      return await fn(ctx, () => dispatch(i + 1));
    };
    return await dispatch(0);
  };
}

export interface ListenOptions {
  hostname?: string;
  port: number;
  signal?: AbortSignal;
}

export class Application<S extends State = State> {
  #middleware: Middleware<S>[] = [];
  state: S = {} as S;

  use(...middleware: Middleware<S>[]): this {
    this.#middleware.push(...middleware);
    return this;
  }

  async handle(request: Request): Promise<Response> {
    const ctx = new Context(request) as Context<S>;
    ctx.state = this.state;

    try {
      await compose(this.#middleware)(ctx, async () => {});
    } catch (error) {
      if (error instanceof HttpError) {
        ctx.response.status = error.status;
        ctx.response.body = error.message;
        ctx.response.type = "text/plain";
      } else {
        console.error("Unhandled error in request handler:", error);
        ctx.response.status = Status.InternalServerError;
        ctx.response.body = "Internal Server Error";
        ctx.response.type = "text/plain";
      }
    }

    if (ctx.upgradeResponse) return ctx.upgradeResponse;
    return ctx.response.toNativeResponse();
  }

  async listen(options: ListenOptions): Promise<void> {
    const server = Deno.serve(
      {
        hostname: options.hostname,
        port: options.port,
        signal: options.signal,
        onListen: () => {},
      },
      request => this.handle(request),
    );
    await server.finished;
  }
}

// ---------------------------------------------------------------------------
// CORS middleware (replaces deno.land/x/cors)
// ---------------------------------------------------------------------------
export interface CorsOptions {
  origin?: string;
  allowedHeaders?: string | string[];
  methods?: string | string[];
}

export function oakCors(options: CorsOptions = {}): Middleware {
  const origin = options.origin ?? "*";
  const headers = Array.isArray(options.allowedHeaders)
    ? options.allowedHeaders.join(",")
    : (options.allowedHeaders ?? "*");
  const methods = Array.isArray(options.methods)
    ? options.methods.join(",")
    : (options.methods ?? "GET,HEAD,PUT,PATCH,POST,DELETE");

  return async (ctx, next) => {
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    if (ctx.request.method === "OPTIONS") {
      ctx.response.headers.set("Access-Control-Allow-Methods", methods);
      ctx.response.headers.set("Access-Control-Allow-Headers", headers);
      ctx.response.status = Status.NoContent;
      return;
    }
    await next();
  };
}
