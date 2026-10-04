import type { TuiEventBus } from "@opencode-ai/plugin/tui"
import type { Event } from "@opencode-ai/sdk/v2"
import { Context, Effect, Layer, Queue, Stream } from "effect"

export type EventType = Event["type"]
export type EventOf<T extends EventType> = Extract<Event, { type: T }>

/**
 * opencode's bus as Effect streams. Same shape as `Event` in
 * `@opencode-ai/plugin/v2/effect`, which the TUI API does not offer:
 * there, the bus is a callback registry with an unsubscribe function.
 */
export class OpencodeEvents extends Context.Service<
  OpencodeEvents,
  {
    readonly subscribe: <T extends EventType>(type: T) => Stream.Stream<EventOf<T>>
  }
>()("opencode-openspec-tasks/OpencodeEvents") {
  static readonly layer = (bus: Pick<TuiEventBus, "on">) =>
    Layer.succeed(
      OpencodeEvents,
      OpencodeEvents.of({
        subscribe: <T extends EventType>(type: T) =>
          Stream.callback<EventOf<T>>((queue) =>
            Effect.acquireRelease(
              Effect.sync(() => bus.on(type, (event) => Queue.offerUnsafe(queue, event))),
              (unsubscribe) => Effect.sync(unsubscribe),
            ),
          ),
      }),
    )
}
