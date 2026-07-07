// deno-lint-ignore-file no-import-prefix
import * as fs from "../../util/std/fs.ts";
import * as path from "../../util/std/path.ts";

export const initServerEnv = async (root: string | URL, token = "token"): Promise<boolean> => {
  const serverEnvLocal = path.join(root, "multiplayer", ".env.local");
  if (await fs.exists(serverEnvLocal)) return false;

  const env =
    `
REBUR_MULTIPLAYER_AUTH_TOKEN="${token}"
REBUR_NEXT_GAME_JWT_SECRET="${token}"
`.trim() + "\n";

  await Deno.writeTextFile(serverEnvLocal, env);
  return true;
};

export const initEditorEnv = async (root: string | URL): Promise<boolean> => {
  const editorEnvLocal = path.join(root, "editor", ".env.local");
  if (await fs.exists(editorEnvLocal)) return false;

  const env =
    `
IS_DEV="true"
REBUR_MULTIPLAYER_PUBLIC_URL="http://localhost:8001"
`.trim() + "\n";

  await Deno.writeTextFile(editorEnvLocal, env);
  return true;
};
