import * as z from "@rebur/vendor/zod.ts";

export const CURRENT_SCHEMA_VERSION: number = 2;

/** nanoid: ent_* */
export const EntityReferenceSchema = z.string().startsWith("ent_").describe("Entity Reference");
/** nanoid: bhv_* */
export const BehaviorReferenceSchema = z
  .string()
  .startsWith("bhv_")
  .describe("Behavior Reference");
/** e.g. "@core/Mesh", "@my-game/MyCustomEntity" */
export const EntityTypeSchema = z.string().describe("Entity Type");

export const ResourceLocationSchema = z.string().describe("Resource URI");

// ---------------------------------------------------------------------------
// 3D math schemas
// ---------------------------------------------------------------------------
export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const QuatSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});

type Primitive = string | number | boolean | null | undefined;
type JsonArray = readonly JsonValue[];
type JsonObject = { [Key in string]?: JsonValue };
type JsonValue = Primitive | JsonArray | JsonObject;

const PrimitiveSchema: z.ZodType<Primitive> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
]);

const JsonArraySchema: z.ZodType<JsonArray> = z.lazy(() => JsonValueSchema.array());
const JsonObjectSchema: z.ZodType<JsonObject> = z.lazy(() =>
  z.record(z.string(), JsonValueSchema),
);
const JsonValueSchema = z.union([PrimitiveSchema, JsonArraySchema, JsonObjectSchema]);

export const ValueSchema = JsonValueSchema;

// ---------------------------------------------------------------------------
// 3D transform schema (position, rotation as quaternion, scale)
// ---------------------------------------------------------------------------
export const TransformSchema = z.object({
  position: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotation: QuatSchema.default({ x: 0, y: 0, z: 0, w: 1 }),
  scale: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
});
export type SceneDescTransform = z.input<typeof TransformSchema>;

export const SyncedObjectSchema = z.object({ kind: z.string(), value: z.unknown() });
export type SceneDescSyncedObject = z.input<typeof SyncedObjectSchema>;

export const BehaviorSchema = z.object({
  ref: BehaviorReferenceSchema,
  script: ResourceLocationSchema,
  values: z.record(z.string(), ValueSchema).default({}),
  overrides: z.record(z.string(), ValueSchema).optional(),
  sync: z.record(z.string(), SyncedObjectSchema).default({}),
});
export type SceneDescBehavior = z.input<typeof BehaviorSchema>;

const EntitySchemaNoChildren = z.object({
  ref: EntityReferenceSchema,
  name: z.string(),
  enabled: z.boolean().default(true),
  type: EntityTypeSchema,
  transform: TransformSchema.default(TransformSchema.parse({})),
  values: z.record(z.string(), ValueSchema).default({}),
  behaviors: z.array(BehaviorSchema).default([]),
  data: JsonValueSchema.optional(),
  locked: z.boolean().default(false),
});
type SceneDescEntityTypeIn = z.input<typeof EntitySchemaNoChildren> & {
  children?: SceneDescEntityTypeIn[];
};
type SceneDescEntityTypeOut = z.output<typeof EntitySchemaNoChildren> & {
  children: SceneDescEntityTypeOut[];
};
export const EntitySchema: z.ZodType<SceneDescEntityTypeOut, SceneDescEntityTypeIn> =
  EntitySchemaNoChildren.extend({
    children: z.lazy(() => EntitySchema.array().default([])),
  });
export type SceneDescEntity = z.input<typeof EntitySchema>;

export const SceneSchema = z.object({
  world: EntitySchema.array().default([]),
  server: EntitySchema.array().default([]),
  local: EntitySchema.array().default([]),
  prefabs: EntitySchema.array().default([]),

  registration: ResourceLocationSchema.array().default([]),
});
export const SceneOrSceneLocationSchema = SceneSchema.or(z.string());

export const ProjectSchema = z.object({
  $schema: z.url().optional(),
  meta: z.object({
    schema_version: z.number(),
    engine_revision: z.string(),
  }),
  tick_rate: z.number().default(60),
  scenes: z
    .object({ main: SceneOrSceneLocationSchema })
    .and(z.record(z.string(), SceneOrSceneLocationSchema)),
});

export type Scene = z.input<typeof SceneSchema>;
export type Project = z.input<typeof ProjectSchema>;
