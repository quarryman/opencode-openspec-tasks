import * as NodePath from "node:path"
import { Data, Duration, Effect, FileSystem, Option, pipe, Stream, SubscriptionRef } from "effect"
import { OpencodeEvents } from "./opencode/events.ts"
import { OpenSpecCli } from "./openspec/cli.ts"
import type { ListedChange, StatusResponse } from "./openspec/schema.ts"
import { parseTasks, type TaskDocument } from "./domain/tasks.ts"
import { type Candidate, resolveChange, resolvedName } from "./domain/resolve.ts"
import { buildView, type ChangeView } from "./domain/view.ts"

/** What the sidebar shows for one session. */
export type SidebarState = Data.TaggedEnum<{
  Hidden: {}
  Showing: { readonly view: ChangeView }
}>
export const SidebarState = Data.taggedEnum<SidebarState>()

export interface SessionInputs {
  /** The directory opencode runs in; `openspec` resolves its root from here. */
  readonly directory: string
  /** Latest change named by this session's commands and tool calls. */
  readonly evidence: SubscriptionRef.SubscriptionRef<Option.Option<string>>
  /** Current git branch, read when resolution runs. */
  readonly branch: Effect.Effect<Option.Option<string>>
}

export const timing = {
  /** Coalesce bursts of evidence and changes-directory events before running `openspec list`. */
  resolve: Duration.millis(150),
  /** Coalesce artifact creation/removal before running `openspec status`. */
  status: Duration.millis(200),
  /** Coalesce writes to tasks.md before re-reading it. */
  tasks: Duration.millis(50),
}

type FileKind = "add" | "change" | "remove"

interface FileSignal {
  readonly path: string
  readonly kind: FileKind
}

const kindOfWatch = { Create: "add", Update: "change", Remove: "remove" } as const satisfies Record<
  FileSystem.WatchEvent["_tag"],
  FileKind
>
const kindOfBus = { add: "add", change: "change", unlink: "remove" } as const satisfies Record<
  "add" | "change" | "unlink",
  FileKind
>

const isInside = (directory: string) => (path: string) =>
  path === directory || path.startsWith(directory + NodePath.sep)

/** Filesystem watch on a directory; resolves the relative paths Node reports, and goes quiet if watching fails. */
const watchDirectory = (directory: string, recursive: boolean) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return fs.watch(directory, { recursive }).pipe(
        Stream.map((event): FileSignal => ({ path: NodePath.resolve(directory, event.path), kind: kindOfWatch[event._tag] })),
        Stream.ignore,
      )
    }),
  )

/**
 * Every file signal inside `directory`: opencode's own edit/write/apply_patch
 * events (immediate, exact) merged with a recursive watch (covers bash edits).
 */
const fileSignals = (directory: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const events = yield* OpencodeEvents
      return Stream.mergeAll(
        [
          watchDirectory(directory, true),
          events
            .subscribe("file.watcher.updated")
            .pipe(Stream.map((e): FileSignal => ({ path: NodePath.resolve(e.properties.file), kind: kindOfBus[e.properties.event] }))),
          events
            .subscribe("file.edited")
            .pipe(Stream.map((e): FileSignal => ({ path: NodePath.resolve(e.properties.file), kind: "change" }))),
        ],
        { concurrency: "unbounded" },
      ).pipe(Stream.filter((signal) => isInside(directory)(signal.path)))
    }),
  )

/** Run an effect per trigger, dropping failures so the last good value stays on screen. */
const refreshOn = <A, E, R1, R2>(
  triggers: Stream.Stream<unknown, never, R1>,
  window: Duration.Duration,
  load: Effect.Effect<A, E, R2>,
): Stream.Stream<A, never, R1 | R2> =>
  Stream.concat(Stream.make(undefined), triggers).pipe(
    Stream.debounce(window),
    Stream.flatMap(() => Stream.fromEffect(load).pipe(Stream.ignore)),
  )

const readTasks = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return yield* fs.readFileString(path)
  }).pipe(
    Effect.map((markdown) => Option.some(parseTasks(markdown))),
    Effect.orElseSucceed(() => Option.none<TaskDocument>()),
  )

const tasksPathOf = (changeDir: string, status: StatusResponse) =>
  pipe(
    Option.fromNullishOr(status.artifactPaths?.["tasks"]?.resolvedOutputPath),
    Option.getOrElse(() => NodePath.join(changeDir, "tasks.md")),
    (path) => NodePath.resolve(path),
  )

/** Live view of one change: `openspec status` on artifact creation/removal, a file read on tasks.md writes. */
const changeView = (directory: string, root: string, name: string) => {
  const changeDir = NodePath.join(root, "openspec", "changes", name)
  const statuses = refreshOn(
    fileSignals(changeDir).pipe(Stream.filter((s) => s.kind !== "change")),
    timing.status,
    Effect.gen(function* () {
      const cli = yield* OpenSpecCli
      return yield* cli.status(directory, name)
    }),
  )
  return statuses.pipe(
    Stream.switchMap((status) => {
      const tasksPath = tasksPathOf(changeDir, status)
      return refreshOn(
        fileSignals(changeDir).pipe(Stream.filter((s) => s.path === tasksPath)),
        timing.tasks,
        readTasks(tasksPath),
      ).pipe(Stream.map((tasks): SidebarState => SidebarState.Showing({ view: buildView(name, status.artifacts, tasks) })))
    }),
  )
}

const sameName = Option.makeEquivalence((x: string, y: string) => x === y)

interface Resolved {
  readonly root: string
  readonly name: Option.Option<string>
}

const candidatesOf = (changes: ReadonlyArray<ListedChange>) =>
  changes.map(
    (c): Candidate => ({
      name: c.name,
      lastModified: pipe(
        Option.fromNullishOr(c.lastModified),
        Option.map(Date.parse),
        Option.filter(Number.isFinite),
        Option.getOrElse(() => 0),
      ),
    }),
  )

/** The sidebar state for one session: re-resolve on evidence or changes-directory topology, then follow that change. */
export const sidebarState = (inputs: SessionInputs) => {
  const changesDir = NodePath.join(inputs.directory, "openspec", "changes")
  const triggers = Stream.merge(
    SubscriptionRef.changes(inputs.evidence),
    watchDirectory(changesDir, false).pipe(Stream.filter((s) => s.kind !== "change")),
  )
  const resolve = Effect.gen(function* () {
    const cli = yield* OpenSpecCli
    const listed = yield* cli.list(inputs.directory)
    const evidence = yield* SubscriptionRef.get(inputs.evidence)
    const branch = yield* inputs.branch
    const root = pipe(
      Option.fromNullishOr(listed.root?.path),
      Option.getOrElse(() => inputs.directory),
    )
    return {
      root,
      name: resolvedName(resolveChange({ candidates: candidatesOf(listed.changes), evidence, branch })),
    } satisfies Resolved
  })

  return refreshOn(triggers, timing.resolve, resolve).pipe(
    Stream.changesWith((a: Resolved, b: Resolved) => a.root === b.root && sameName(a.name, b.name)),
    Stream.switchMap((resolved) =>
      Option.match(resolved.name, {
        onNone: (): Stream.Stream<SidebarState> => Stream.succeed(SidebarState.Hidden()),
        onSome: (name) => changeView(inputs.directory, resolved.root, name),
      }),
    ),
  )
}
