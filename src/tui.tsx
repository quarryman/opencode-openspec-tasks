/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { Part } from "@opencode-ai/sdk/v2"
import { NodeServices } from "@effect/platform-node"
import { Effect, Fiber, Layer, ManagedRuntime, Option, pipe, Stream, SubscriptionRef } from "effect"
import { createEffect, createMemo, createRoot, createSignal, type Accessor } from "solid-js"
import { changeFromCommand, latestEvidence } from "./domain/evidence.ts"
import { OpencodeEvents } from "./opencode/events.ts"
import { OpenSpecCli } from "./openspec/cli.ts"
import { sidebarState, SidebarState } from "./progress.ts"
import { makeToggles, OpenSpecSection, type Toggles } from "./view.tsx"

const id = "opencode-openspec-tasks"

const appLayer = (api: TuiPluginApi) =>
  Layer.mergeAll(OpenSpecCli.layer, OpencodeEvents.layer(api.event)).pipe(Layer.provideMerge(NodeServices.layer))

type AppRuntime = ManagedRuntime.ManagedRuntime<Layer.Success<ReturnType<typeof appLayer>>, never>

/** Text a part contributes as evidence: what a tool was asked to do. */
const partEvidence = (part: Part): ReadonlyArray<string> =>
  part.type === "tool" ? [JSON.stringify(part.state.input)] : []

/**
 * The latest change this session points at, as a Solid memo over opencode's
 * synced messages. `/opsx-*` commands are placed at the message they created,
 * so a command and later tool calls are ordered as they happened.
 */
const sessionEvidence = (api: TuiPluginApi, sessionID: string) => {
  const [commands, setCommands] = createSignal<ReadonlyMap<string, string>>(new Map())
  const off = api.event.on("command.executed", (event) => {
    if (event.properties.sessionID !== sessionID) return
    Option.map(changeFromCommand(event.properties.name, event.properties.arguments), (name) =>
      setCommands((map) => new Map([...map, [event.properties.messageID, name]])),
    )
  })

  const evidence = createMemo(
    () =>
      latestEvidence(
        api.state.session.messages(sessionID).flatMap((message) => [
          ...pipe(
            Option.fromNullishOr(commands().get(message.id)),
            Option.map((name) => `--change ${name}`),
            Option.toArray,
          ),
          ...api.state.part(message.id).flatMap(partEvidence),
        ]),
      ),
    Option.none<string>(),
    { equals: Option.makeEquivalence((a: string, b: string) => a === b) },
  )
  return { evidence, off }
}

/** Everything one session's section needs, owned outside any component. */
interface Tracked {
  readonly sessionID: string
  readonly state: Accessor<SidebarState>
  readonly toggles: Toggles
  readonly dispose: () => void
}

/**
 * opencode re-invokes a slot renderer whenever anything it read changes, and
 * the renderer reads our state, so the component is remounted on every state
 * change. State therefore cannot live in the component: a pipeline started
 * there restarts from Hidden on each remount and never settles. One session is
 * tracked at a time, owned here, and replaced when the sidebar's session changes.
 */
const track = (api: TuiPluginApi, runtime: AppRuntime, sessionID: string): Tracked =>
  createRoot((disposeRoot) => {
    const [state, setState] = createSignal<SidebarState>(SidebarState.Hidden())
    const toggles = makeToggles()
    const { evidence, off } = sessionEvidence(api, sessionID)
    const ref = runtime.runSync(SubscriptionRef.make(evidence()))

    createEffect(() => {
      const latest = evidence()
      runtime.runFork(SubscriptionRef.set(ref, latest))
    })

    const fiber = runtime.runFork(
      sidebarState({
        directory: api.state.path.directory,
        evidence: ref,
        branch: Effect.sync(() => Option.fromNullishOr(api.state.vcs?.branch)),
      }).pipe(Stream.runForEach((next) => Effect.sync(() => setState(() => next)))),
    )

    return {
      sessionID,
      state,
      toggles,
      dispose: () => {
        off()
        runtime.runFork(Fiber.interrupt(fiber))
        disposeRoot()
      },
    }
  })

const tui: TuiPlugin = async (api) => {
  const runtime: AppRuntime = ManagedRuntime.make(appLayer(api))
  const current: { tracked: Option.Option<Tracked> } = { tracked: Option.none() }

  const forSession = (sessionID: string): Tracked =>
    pipe(
      current.tracked,
      Option.filter((tracked) => tracked.sessionID === sessionID),
      Option.getOrElse(() => {
        Option.map(current.tracked, (previous) => previous.dispose())
        const next = track(api, runtime, sessionID)
        current.tracked = Option.some(next)
        return next
      }),
    )

  api.lifecycle.onDispose(async () => {
    Option.map(current.tracked, (tracked) => tracked.dispose())
    await runtime.dispose()
  })

  api.slots.register({
    // Directly after the built-in Todo section (400).
    order: 410,
    slots: {
      sidebar_content(_ctx, props) {
        const tracked = forSession(props.session_id)
        return <OpenSpecSection theme={() => api.theme.current} state={tracked.state} toggles={tracked.toggles} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = { id, tui }
export default plugin
