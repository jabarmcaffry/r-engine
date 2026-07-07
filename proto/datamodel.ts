import * as z from "@rebur/vendor/zod.ts";

export const EntityReferenceSchema = z.string().describe("Entity Reference");
export const EntityTypeSchema = z.string().describe("Entity Type");

export const ConnectionIdSchema = z.literal("server").or(z.string()).describe("Connection ID");

export const BehaviorDefinitionSchema = z.object({
  script: z.string(),
  values: z.record(z.string(), z.any()),
  sync: z.record(
    z.string(),
    z.object({
      kind: z.string(),
      clock: z.number(),
      net: z.boolean().default(false),
      value: z.unknown(),
    }),
  ),
  ref: z.string(),
});

// `z` defaults to 0 so scenes saved by the 2D-era engine still load.
export const Vec3Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number().default(0),
  })
  .describe("Vec3");

export const QuatSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    w: z.number(),
  })
  .describe("Quat");

export const TransformSchema = z.object({
  position: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotation: QuatSchema.default({ x: 0, y: 0, z: 0, w: 1 }),
  scale: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
});

// we need to do a little ceremony since EntityDefinitionSchema is recursively defined
const BaseEntityDefinitionSchema = z.object({
  type: EntityTypeSchema,
  parent: EntityReferenceSchema,
  name: z.string(),
  enabled: z.boolean().optional(),
  values: z.record(z.string(), z.any()).optional(),
  sync: z
    .record(
      z.string(),
      z.object({
        kind: z.string(),
        clock: z.number(),
        net: z.boolean().default(false),
        value: z.unknown(),
      }),
    )
    .optional(),
  behaviors: BehaviorDefinitionSchema.array().optional(),
  transform: TransformSchema.optional(),
  ref: EntityReferenceSchema,
  authority: ConnectionIdSchema.optional(),
  data: z.unknown(),
});
type EntityDefinitionSchemaTypeIn = z.input<typeof BaseEntityDefinitionSchema> & {
  children?: EntityDefinitionSchemaTypeIn[];
};
type EntityDefinitionSchemaTypeOut = z.output<typeof BaseEntityDefinitionSchema> & {
  children?: EntityDefinitionSchemaTypeOut[];
};
export const EntityDefinitionSchema: z.ZodType<
  EntityDefinitionSchemaTypeOut,
  EntityDefinitionSchemaTypeIn
> = BaseEntityDefinitionSchema.extend({
  children: z.lazy(() => EntityDefinitionSchema.array().default([])),
});
export type EntityDefinitionSchemaType = z.infer<typeof EntityDefinitionSchema>;
