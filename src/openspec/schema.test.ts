import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { listResponseFromJson, statusResponseFromJson } from "./schema.ts"

// Captured from openspec 1.13.2 against a pay-spec-driven change, trimmed.
const status = JSON.stringify({
  changeName: "fix-grid",
  schemaName: "pay-spec-driven",
  changeRoot: "/repo/openspec/changes/fix-grid",
  artifactPaths: {
    proposal: { outputPath: "proposal.md", resolvedOutputPath: "/repo/openspec/changes/fix-grid/proposal.md", existingOutputPaths: [] },
    tasks: { outputPath: "tasks.md", resolvedOutputPath: "/repo/openspec/changes/fix-grid/tasks.md", existingOutputPaths: [] },
  },
  isComplete: false,
  artifacts: [
    { id: "proposal", outputPath: "proposal.md", status: "done", requires: [] },
    { id: "specs", outputPath: "specs/**/*.md", status: "done", requires: ["proposal"] },
    { id: "tasks", outputPath: "tasks.md", status: "done", requires: ["specs"] },
    { id: "coverage", outputPath: "coverage.md", status: "ready", requires: ["tasks"] },
    { id: "verify", outputPath: "verify.md", status: "blocked", requires: ["coverage"] },
  ],
})

describe("statusResponseFromJson", () => {
  it("decodes a real payload and ignores undeclared fields", () => {
    const decoded = Schema.decodeUnknownSync(statusResponseFromJson)(status)
    expect(decoded.artifacts.map((a) => [a.id, a.status])).toEqual([
      ["proposal", "done"],
      ["specs", "done"],
      ["tasks", "done"],
      ["coverage", "ready"],
      ["verify", "blocked"],
    ])
    expect(decoded.artifactPaths?.["tasks"]?.resolvedOutputPath).toBe("/repo/openspec/changes/fix-grid/tasks.md")
  })

  it("accepts absent and null optionals", () => {
    const minimal = JSON.stringify({ changeName: "x", artifacts: [{ id: "proposal", status: "ready" }] })
    const nulls = JSON.stringify({ changeName: "x", changeRoot: null, artifactPaths: null, artifacts: [{ id: "p", status: "done", outputPath: null }] })
    expect(Schema.decodeUnknownSync(statusResponseFromJson)(minimal).artifacts).toHaveLength(1)
    expect(Schema.decodeUnknownSync(statusResponseFromJson)(nulls).changeRoot).toBeNull()
  })

  it("rejects an unknown artifact status", () => {
    const bad = JSON.stringify({ changeName: "x", artifacts: [{ id: "p", status: "weird" }] })
    expect(() => Schema.decodeUnknownSync(statusResponseFromJson)(bad)).toThrow()
  })
})

describe("listResponseFromJson", () => {
  it("decodes a real payload", () => {
    const list = JSON.stringify({
      changes: [{ name: "fix-grid", completedTasks: 15, totalTasks: 17, lastModified: "2026-10-02T22:38:44.802Z", status: "in-progress" }],
      root: { path: "/repo", source: "nearest" },
    })
    expect(Schema.decodeUnknownSync(listResponseFromJson)(list).changes[0]?.name).toBe("fix-grid")
  })

  it("decodes the empty response with a message", () => {
    const empty = JSON.stringify({ changes: [], message: "No active changes.", root: { path: "/r", source: "nearest" } })
    expect(Schema.decodeUnknownSync(listResponseFromJson)(empty).changes).toEqual([])
  })

  it("accepts null and absent optionals on an entry", () => {
    const list = JSON.stringify({ changes: [{ name: "a", lastModified: null }, { name: "b" }] })
    expect(Schema.decodeUnknownSync(listResponseFromJson)(list).changes.map((c) => c.name)).toEqual(["a", "b"])
  })
})
