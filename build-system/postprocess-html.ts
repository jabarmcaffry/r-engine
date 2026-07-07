import { encodeHex } from "../util/std/encoding.ts";
import * as fs from "../util/std/fs.ts";
import * as path from "../util/std/path.ts";

const dir = Deno.args[0];
const htmlPath = path.join(dir, "index.html");
let html = await Deno.readTextFile(htmlPath);

async function replace(target: string): Promise<void> {
  const filePath = path.join(dir, target);
  const exists = await fs.exists(filePath);
  if (!exists) return;

  const buf = await Deno.readFile(filePath);
  const hash = await crypto.subtle.digest("SHA-384", buf);
  const rev = encodeHex(hash).slice(0, 10);

  html = html.replaceAll(`"${target}"`, `"${target}?rev=${rev}"`);
}

await replace("./dist/engine.js");
await replace("./dist/client-main.js");
await replace("./dist/ui.js");
await replace("./dist/ui-jsx.js");

await Deno.writeTextFile(htmlPath, html);
