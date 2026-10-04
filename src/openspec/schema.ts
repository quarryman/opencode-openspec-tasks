import { Schema } from "effect"

/** `openspec list --json` — one entry per active (non-archived) change. */
export const listedChangeSchema = Schema.Struct({
  name: Schema.String,
  lastModified: Schema.optional(Schema.NullOr(Schema.String)),
  completedTasks: Schema.optional(Schema.NullOr(Schema.Number)),
  totalTasks: Schema.optional(Schema.NullOr(Schema.Number)),
  status: Schema.optional(Schema.NullOr(Schema.String)),
})
export type ListedChange = typeof listedChangeSchema.Type

export const listResponseSchema = Schema.Struct({
  changes: Schema.Array(listedChangeSchema),
})
export type ListResponse = typeof listResponseSchema.Type

/** `openspec status --change <name> --json` */
export const artifactStatusSchema = Schema.Struct({
  id: Schema.String,
  status: Schema.Literals(["done", "ready", "blocked"]),
  outputPath: Schema.optional(Schema.NullOr(Schema.String)),
})
export type ArtifactStatusEntry = typeof artifactStatusSchema.Type

export const artifactPathSchema = Schema.Struct({
  resolvedOutputPath: Schema.optional(Schema.NullOr(Schema.String)),
})

export const statusResponseSchema = Schema.Struct({
  changeName: Schema.String,
  changeRoot: Schema.optional(Schema.NullOr(Schema.String)),
  artifacts: Schema.Array(artifactStatusSchema),
  artifactPaths: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, artifactPathSchema))),
})
export type StatusResponse = typeof statusResponseSchema.Type

export const listResponseFromJson = Schema.fromJsonString(listResponseSchema)
export const statusResponseFromJson = Schema.fromJsonString(statusResponseSchema)
