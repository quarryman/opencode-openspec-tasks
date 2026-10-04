import { Context, Duration, Effect, Layer, Schema } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { type ListResponse, listResponseFromJson, type StatusResponse, statusResponseFromJson } from "./schema.ts"

export class OpenSpecCliError extends Schema.TaggedError<OpenSpecCliError>()("OpenSpecCliError", {
  command: Schema.String,
  cause: Schema.Defect(),
}) {}

/** The two `openspec` reads the sidebar needs. Both are slow (~1s, a node start), so callers keep them off hot paths. */
export class OpenSpecCli extends Context.Service<
  OpenSpecCli,
  {
    readonly list: (directory: string) => Effect.Effect<ListResponse, OpenSpecCliError>
    readonly status: (directory: string, change: string) => Effect.Effect<StatusResponse, OpenSpecCliError>
  }
>()("opencode-openspec-tasks/OpenSpecCli") {
  static readonly layer = Layer.effect(
    OpenSpecCli,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

      const run = <A, E>(
        directory: string,
        args: ReadonlyArray<string>,
        decode: (output: string) => Effect.Effect<A, E>,
      ): Effect.Effect<A, OpenSpecCliError> =>
        spawner.string(ChildProcess.make("openspec", [...args], { cwd: directory, env: { NO_COLOR: "1" }, extendEnv: true })).pipe(
          Effect.flatMap(decode),
          Effect.timeout(Duration.seconds(10)),
          Effect.mapError((cause) => new OpenSpecCliError({ command: `openspec ${args.join(" ")}`, cause })),
        )

      return OpenSpecCli.of({
        list: (directory) => run(directory, ["list", "--json"], Schema.decodeUnknownEffect(listResponseFromJson)),
        status: (directory, change) => run(directory, ["status", "--change", change, "--json"], Schema.decodeUnknownEffect(statusResponseFromJson)),
      })
    }),
  )
}
