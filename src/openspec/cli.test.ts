import { execFileSync } from "node:child_process"
import * as NodeOs from "node:os"
import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { OpenSpecCli } from "./cli.ts"

const hasOpenSpec = (() => {
  try {
    execFileSync("openspec", ["--version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
})()

const live = OpenSpecCli.layer.pipe(Layer.provide(NodeServices.layer))

/** Runs the real binary against this repository, whose own change is a live fixture. */
describe.skipIf(!hasOpenSpec)("OpenSpecCli (real binary)", () => {
  it.live("decodes list and status for this repository", () =>
    Effect.gen(function* () {
      const cli = yield* OpenSpecCli
      const listed = yield* cli.list(process.cwd())
      const name = listed.changes[0]?.name
      expect(name).toBeDefined()
      const status = yield* cli.status(process.cwd(), name!)
      expect(status.artifacts.map((a) => a.id)).toContain("tasks")
    }).pipe(Effect.provide(live)),
  )

  it.live("fails with a typed error outside an OpenSpec project's change", () =>
    Effect.gen(function* () {
      const cli = yield* OpenSpecCli
      const error = yield* Effect.flip(cli.status(NodeOs.tmpdir(), "does-not-exist"))
      expect(error._tag).toBe("OpenSpecCliError")
    }).pipe(Effect.provide(live)),
  )
})
