// deno-lint-ignore-file no-import-prefix
import { Entity } from "@rebur/engine";
import * as path from "../../util/std/path.ts";

export const projectTemplate = () => ({
  meta: {
    schema_version: 1,
    engine_revision: "2024-08.001",
  },
  scenes: {
    main: {
      registration: [],
      world: [],
      local: [
        {
          ref: Entity.createRef(),
          type: "@core/Camera",
          name: "Camera",
          values: { active: true },
        },
      ],
      server: [],
      prefabs: [],
    },
  },
});

export const denoJson = (root: string = "./.rebur-engine") => ({
  imports: {
    // deno demands leading ./ or it errors
    "@rebur/engine": "./" + path.join(root, "engine/mod.ts"),
    "@rebur/engine/internal": "./" + path.join(root, "engine/internal.ts"),
    "@rebur/vendor/": "./" + path.join(root, "engine/_deps/"),
    "@rebur/ui": "./" + path.join(root, "ui/mod.ts"),
    "@rebur/ui/jsx-runtime": "./" + path.join(root, "ui/jsx.ts"),
    "@rebur/util/": "./" + path.join(root, "util/"),
  },
  compilerOptions: {
    lib: ["deno.window", "dom"],
    noImplicitOverride: false,
    jsxImportSource: "@rebur/ui",
  },
});

export const helloWorldScript =
  `
import { Behavior } from "@rebur/engine";

export default class HelloWorld extends Behavior {
  onInitialize() {
    console.log("hello world!");
  }
}
`.trim() + "\n";
