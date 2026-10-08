import * as NodeFs from "node:fs"
import * as NodeOs from "node:os"
import * as NodePath from "node:path"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Fiber, FileSystem, Layer, Option, Queue, Stream, SubscriptionRef } from "effect"
import type { TuiEventBus } from "@opencode-ai/plugin/tui"
import { OpencodeEvents } from "./opencode/events.ts"
import { OpenSpecCli } from "./openspec/cli.ts"
import type { ListResponse, StatusResponse } from "./openspec/schema.ts"
import { sidebarState, SidebarState } from "./progress.ts"
import { ArtifactRow } from "./domain/view.ts"

/** A bus with the same `on` contract as the TUI's, plus `emit` for the test. */
const fakeBus = () => {
  const handlers = new Map<string, Set<(event: never) => void>>()
  const bus: Pick<TuiEventBus, "on"> = {
    on: (type, handler) => {
      const set = handlers.get(type) ?? new Set()
      set.add(handler as (event: never) => void)
      handlers.set(type, set)
      return () => set.delete(handler as (event: never) => void)
    },
  }
  const emit = (type: "file.edited", file: string) =>
    handlers.get(type)?.forEach((h) => h({ id: "e", type, properties: { file } } as never))
  return { bus, emit, listeners: () => [...handlers.values()].reduce((n, s) => n + s.size, 0) }
}

const project = () => {
  const root = NodeFs.realpathSync(NodeFs.mkdtempSync(NodePath.join(NodeOs.tmpdir(), "oot-")))
  const change = (name: string, tasks: string) => {
    const dir = NodePath.join(root, "openspec", "changes", name)
    NodeFs.mkdirSync(dir, { recursive: true })
    NodeFs.writeFileSync(NodePath.join(dir, "tasks.md"), tasks)
    return NodePath.join(dir, "tasks.md")
  }
  NodeFs.mkdirSync(NodePath.join(root, "openspec", "changes", "archive"), { recursive: true })
  return { root, change }
}

const stubCli = (root: string, names: () => ReadonlyArray<string>) => {
  const calls: Array<string> = []
  const layer = Layer.succeed(
    OpenSpecCli,
    OpenSpecCli.of({
      list: () =>
        Effect.sync((): ListResponse => {
          calls.push("list")
          return { changes: names().map((name) => ({ name, lastModified: null })), root: { path: root } }
        }),
      status: (_dir, name) =>
        Effect.sync((): StatusResponse => {
          calls.push(`status ${name}`)
          return {
            changeName: name,
            artifacts: [
              { id: "proposal", status: "done" },
              { id: "tasks", status: "done" },
              { id: "verify", status: "blocked" },
            ],
          }
        }),
    }),
  )
  return { calls, layer }
}

const tasksProgress = (state: SidebarState) =>
  SidebarState.$match(state, {
    Hidden: () => "hidden",
    Showing: ({ view }) => {
      const row = view.rows.find(ArtifactRow.$is("Tasks"))
      return `${view.change} ${Option.match(row?.progress ?? Option.none(), {
        onNone: () => "-",
        onSome: (p) => `${p.completed}/${p.total}`,
      })}`
    },
  })

/** Run the pipeline into a queue; `next(expected)` waits for that rendering. */
const harness = (
  root: string,
  evidence: SubscriptionRef.SubscriptionRef<Option.Option<string>>,
  layer: Layer.Layer<OpenSpecCli | OpencodeEvents>,
  fileSystem: Layer.Layer<FileSystem.FileSystem> = NodeFileSystem.layer,
) =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<string>()
    const fiber = yield* sidebarState({ directory: root, evidence, branch: Effect.succeed(Option.none()) }).pipe(
      Stream.runForEach((s) => Queue.offer(queue, tasksProgress(s))),
      Effect.provide(Layer.mergeAll(layer, fileSystem)),
      Effect.forkChild,
    )
    const next = (expected: string) =>
      Queue.take(queue).pipe(
        Effect.repeat({ until: (s) => s === expected }),
        Effect.timeoutOrElse({
          duration: Duration.seconds(3),
          orElse: () => Effect.die(new Error(`timed out waiting for "${expected}"`)),
        }),
      )
    return { fiber, next }
  })

/** Real reads, no watching: only opencode's bus can announce a change. */
const blindFileSystem = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return FileSystem.FileSystem.of({ ...fs, watch: () => Stream.never })
  }),
).pipe(Layer.provide(NodeFileSystem.layer))

describe("sidebarState", () => {
  it.live("updates from the opencode bus alone when filesystem watching is unavailable", () =>
    Effect.gen(function* () {
      const { root, change } = project()
      const tasks = change("add-x", "- [ ] a\n- [ ] b\n")
      const { bus, emit } = fakeBus()
      const cli = stubCli(root, () => ["add-x"])
      const evidence = yield* SubscriptionRef.make(Option.none<string>())
      const { next } = yield* harness(root, evidence, Layer.mergeAll(cli.layer, OpencodeEvents.layer(bus)), blindFileSystem)

      yield* next("add-x 0/2")
      NodeFs.writeFileSync(tasks, "- [x] a\n- [ ] b\n")
      emit("file.edited", tasks)
      yield* next("add-x 1/2")
    }),
  )

  it.live("shows the change, then follows tasks.md edits announced by opencode without calling the CLI", () =>
    Effect.gen(function* () {
      const { root, change } = project()
      const tasks = change("add-x", "- [x] a\n- [ ] b\n")
      const { bus, emit } = fakeBus()
      const cli = stubCli(root, () => ["add-x"])
      const evidence = yield* SubscriptionRef.make(Option.none<string>())
      const { next } = yield* harness(root, evidence, Layer.mergeAll(cli.layer, OpencodeEvents.layer(bus)))

      yield* next("add-x 1/2")
      const before = cli.calls.length

      NodeFs.writeFileSync(tasks, "- [x] a\n- [x] b\n")
      emit("file.edited", tasks)
      yield* next("add-x 2/2")

      expect(cli.calls.length).toBe(before)
    }),
  )

  it.live("picks up an edit that opencode did not announce (bash, other editors)", () =>
    Effect.gen(function* () {
      const { root, change } = project()
      const tasks = change("add-x", "- [ ] a\n")
      const cli = stubCli(root, () => ["add-x"])
      const evidence = yield* SubscriptionRef.make(Option.none<string>())
      const { next } = yield* harness(root, evidence, Layer.mergeAll(cli.layer, OpencodeEvents.layer(fakeBus().bus)))

      yield* next("add-x 0/1")
      NodeFs.writeFileSync(tasks, "- [x] a\n")
      yield* next("add-x 1/1")
    }),
  )

  it.live("switches to the change named by session evidence", () =>
    Effect.gen(function* () {
      const { root, change } = project()
      change("add-x", "- [ ] a\n")
      change("fix-y", "- [x] a\n- [x] b\n- [ ] c\n")
      const cli = stubCli(root, () => ["add-x", "fix-y"])
      const evidence = yield* SubscriptionRef.make(Option.some("add-x"))
      const { next } = yield* harness(root, evidence, Layer.mergeAll(cli.layer, OpencodeEvents.layer(fakeBus().bus)))

      yield* next("add-x 0/1")
      yield* SubscriptionRef.set(evidence, Option.some("fix-y"))
      yield* next("fix-y 2/3")
    }),
  )

  it.live("hides when there is no active change, and shows one once it appears", () =>
    Effect.gen(function* () {
      const { root, change } = project()
      const names: Array<string> = []
      const cli = stubCli(root, () => names)
      const evidence = yield* SubscriptionRef.make(Option.none<string>())
      const { next } = yield* harness(root, evidence, Layer.mergeAll(cli.layer, OpencodeEvents.layer(fakeBus().bus)))

      yield* next("hidden")
      names.push("new-z")
      change("new-z", "- [ ] a\n")
      yield* next("new-z 0/1")
    }),
  )

  it.live("releases bus subscriptions when interrupted", () =>
    Effect.gen(function* () {
      const { root, change } = project()
      change("add-x", "- [ ] a\n")
      const { bus, listeners } = fakeBus()
      const cli = stubCli(root, () => ["add-x"])
      const evidence = yield* SubscriptionRef.make(Option.none<string>())
      const { fiber, next } = yield* harness(root, evidence, Layer.mergeAll(cli.layer, OpencodeEvents.layer(bus)))

      yield* next("add-x 0/1")
      expect(listeners()).toBeGreaterThan(0)
      yield* Fiber.interrupt(fiber)
      expect(listeners()).toBe(0)
    }),
  )
})
