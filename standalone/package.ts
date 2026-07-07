// this script is complicated because we're making sure the build is as small as possible

import * as fs from "@std/fs";
import * as path from "@std/path";
import {
  denoPlugins,
  reburEngineExternalPlugin,
  reburExternalPlugin,
  reburUIExternalPlugin,
  reburVendorExternalPlugin,
} from "../build-system/_esbuild.ts";
import {
  BASE_BUILD_OPTIONS,
  bundle,
  bundleClient,
  bundleEngine,
  bundleEngineDependencies,
  bundleUI,
} from "../build-system/build-components.ts";
import { bundleWorld } from "../build-system/build-world.ts";

const world = Deno.args.at(0);
if (!world) throw new Error("no world was specified!");

if (!Deno.args.includes("--keep")) {
  console.log("Clearing directory: out");
  await fs.emptyDir("./out");
}

console.log("Copying world...");
await fs.ensureDir("./out/worlds");
const sourceWorldDir = path.join(Deno.cwd(), "../multiplayer/worlds/", world);
const worldDir = path.join("./out/worlds/", world);
if (!(await fs.exists(sourceWorldDir))) {
  throw new Error("not yet implemented: clone worlds from a remote distribution server");
} else {
  const copy = async (rel: string) => {
    const source = path.join(sourceWorldDir, rel);
    const target = path.join(worldDir, rel);
    await fs.ensureDir(path.dirname(target));
    await fs.copy(source, target, { overwrite: true });
  };

  for await (const entry of fs.expandGlob("**/*", { root: sourceWorldDir })) {
    if (entry.isDirectory) continue;
    const rel = path.relative(sourceWorldDir, entry.path);
    if (rel.startsWith("_dist")) continue;
    await copy(rel);
  }
}

await bundleWorld(world, {
  dir: worldDir,
  outDirName: "_dist_play",
  denoJsonPath: "./deno.json",
});

await bundleEngine("../engine", "./out/engine/", undefined, { silent: true }, true);
await fs.copy("../engine/_deps", "./out/engine/vendor");

await bundle("server", {
  ...BASE_BUILD_OPTIONS,
  minify: true,
  splitting: false,
  sourcemap: undefined,
  plugins: [
    reburVendorExternalPlugin(true),
    reburEngineExternalPlugin(),
    reburUIExternalPlugin(),
    reburExternalPlugin(
      "rebur-jsr-external-plugin",
      /^npm:/,
      /^jsr:/,
      /^https:\/\/jsr.io\//,
    ),
    ...denoPlugins({
      loader: "native",
      configPath: await Deno.realPath("../multiplayer/deno.jsonc"),
    }),
  ],
  entryPoints: [
    { in: "../multiplayer/play-host/main.ts", out: "server" },
    { in: "../multiplayer/server-runtime/main.ts", out: ".server-runtime" },
  ],
  outdir: "./out/",
});

await fs.ensureDir("out/client");

await bundleEngineDependencies("../engine", "./out/client/dist");
await bundleEngine("../engine", "./out/client/dist");
await fs.copy("../client/web/index.html", "out/client/index.html");
await bundleClient(
  "../client",
  "out/client/dist",
  undefined,
  [{ in: "../client/src/main-slim.ts", out: "client-main" }],
  undefined,
  { REBUR_MULTIPLAYER_STANDALONE: "1", REBUR_CLIENT_DISABLE_TOP_BAR: "1" },
);
await bundleUI("../ui/", "./out/client/dist");

await Deno.writeTextFile(
  "./out/deno.json",
  JSON.stringify(
    {
      imports: {
        "@rebur/engine": "./engine/engine.js",
        "@rebur/vendor/": "./engine/vendor/",
        "@rebur/ui": "./client/dist/ui.js",
        "@rebur/ui/jsx-runtime": "./client/dist/ui-jsx.js",
      },
    },
    undefined,
    2,
  ),
);

const envOutput = [
  "REBUR_MULTIPLAYER_WORLD_ID=" + world,
  "REBUR_MULTIPLAYER_INSTANCE_ID=standalone",
  "REBUR_MULTIPLAYER_STANDALONE=1",
  "REBUR_MULTIPLAYER_RUNTIME_SCRIPT=./.server-runtime.js",
  "REBUR_MULTIPLAYER_CLIENT_DIRECTORY=./client/web/",
];

const kvPublicUrl = Deno.env.get("REBUR_KV_PUBLIC_URL");
const kvSigningKey = Deno.env.get("REBUR_KV_SIGNING_KEY");

if (kvPublicUrl && kvSigningKey) {
  envOutput.push("REBUR_KV_PUBLIC_URL=" + kvPublicUrl);
  envOutput.push("REBUR_KV_SIGNING_KEY=" + kvSigningKey);
}

const multiplayerScriptsBaseUrl = Deno.env.get("REBUR_MULTIPLAYER_SCRIPTS_PUBLIC_BASE_URL");
if (multiplayerScriptsBaseUrl) {
  envOutput.push("REBUR_MULTIPLAYER_SCRIPTS_PUBLIC_BASE_URL=" + multiplayerScriptsBaseUrl);
}

const multiplayerAuthToken = Deno.env.get("REBUR_MULTIPLAYER_AUTH_TOKEN");
if (multiplayerAuthToken) {
  envOutput.push("REBUR_MULTIPLAYER_AUTH_TOKEN=" + multiplayerAuthToken);
}

await Deno.writeTextFile("./out/.env", envOutput.join("\n"));
