import { ensureDir } from "@std/fs";
import { dirname, relative } from "@std/path";
import { bundleWorld } from "../build-system/mod.ts";

export async function bundleSingleplayerWorld(
  worldId: string,
  {
    sourceWorldDir = "../multiplayer/worlds/" + worldId,
    targetWorldDir = "./web/worlds/" + worldId,
  }: { sourceWorldDir?: string; targetWorldDir?: string } = {},
) {
  const rel = relative(sourceWorldDir, targetWorldDir);

  await ensureDir(dirname(targetWorldDir));

  await bundleWorld(worldId, {
    denoJsonPath: "./deno.json",
    dir: sourceWorldDir,
    outDirName: rel,
  });
}

if (import.meta.main) {
  bundleSingleplayerWorld(Deno.args.at(0) ?? "rebur/test-world");
}
