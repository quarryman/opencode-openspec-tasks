import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import { Match, Option, pipe } from "effect"
import { createMemo, createSignal, For, Show } from "solid-js"
import { ArtifactRow, type ChangeView, type Mark, type Progress, type TaskGroup } from "./domain/view.ts"
import { SidebarState } from "./progress.ts"

/** Same glyphs as opencode's TodoItem; "blocked" draws like pending, but muted. */
const glyph = {
  done: "✓",
  active: "•",
  pending: " ",
  blocked: " ",
} as const satisfies Record<Mark, string>

const colour = (theme: TuiThemeCurrent, mark: Mark) =>
  pipe(
    Match.value(mark),
    Match.when("active", () => theme.warning),
    Match.when("pending", () => theme.text),
    Match.when("done", () => theme.textMuted),
    Match.when("blocked", () => theme.textMuted),
    Match.exhaustive,
  )

const count = (p: Progress) => `${p.completed}/${p.total}`

/**
 * Expand/collapse state is owned by the plugin, keyed by change and row, not by
 * the rows or by this component: opencode re-invokes a slot renderer whenever
 * what it read changes, so anything created inside the component is reset by
 * every tasks.md tick.
 * A key in the set means "the user flipped the default".
 */
export interface Toggles {
  readonly isOpen: (key: string, byDefault: boolean) => boolean
  readonly flip: (key: string) => void
}

export const makeToggles = (): Toggles => {
  const [flipped, setFlipped] = createSignal<ReadonlySet<string>>(new Set())
  return {
    isOpen: (key, byDefault) => flipped().has(key) !== byDefault,
    flip: (key) =>
      setFlipped((set) => (set.has(key) ? new Set([...set].filter((k) => k !== key)) : new Set([...set, key]))),
  }
}

/** One `[x] label` line, laid out exactly like opencode's TodoItem. */
function Line(props: { theme: TuiThemeCurrent; mark: Mark; label: string; indent?: number; onMouseDown?: () => void }) {
  return (
    <box flexDirection="row" gap={0} paddingLeft={props.indent ?? 0} onMouseDown={() => props.onMouseDown?.()}>
      <text flexShrink={0} style={{ fg: colour(props.theme, props.mark) }}>
        [{glyph[props.mark]}]{" "}
      </text>
      <text flexGrow={1} wrapMode="word" style={{ fg: colour(props.theme, props.mark) }}>
        {props.label}
      </text>
    </box>
  )
}

function Tasks(props: { theme: TuiThemeCurrent; group: TaskGroup }) {
  return (
    <For each={props.group.tasks}>
      {(task) => <Line theme={props.theme} mark={task.mark} label={task.label} indent={4 + task.depth * 2} />}
    </For>
  )
}

function Group(props: { theme: TuiThemeCurrent; group: TaskGroup; toggles: Toggles; keyPrefix: string }) {
  return Option.match(props.group.title, {
    onNone: () => <Tasks theme={props.theme} group={props.group} />,
    onSome: (title) => {
      const key = `${props.keyPrefix}/group/${title}`
      const open = () => props.toggles.isOpen(key, props.group.current)
      return (
        <box>
          <box flexDirection="row" gap={1} paddingLeft={4} onMouseDown={() => props.toggles.flip(key)}>
            <text fg={props.theme.textMuted}>{open() ? "▼" : "▶"}</text>
            <text flexGrow={1} wrapMode="word" fg={props.group.current ? props.theme.text : props.theme.textMuted}>
              {title} {count(props.group.progress)}
            </text>
          </box>
          <Show when={open()}>
            <Tasks theme={props.theme} group={props.group} />
          </Show>
        </box>
      )
    },
  })
}

function Row(props: { theme: TuiThemeCurrent; row: ArtifactRow; toggles: Toggles; keyPrefix: string }) {
  return ArtifactRow.$match(props.row, {
    Artifact: (row) => <Line theme={props.theme} mark={row.mark} label={row.id} />,
    Tasks: (row) => {
      const key = `${props.keyPrefix}/tasks`
      const open = () => props.toggles.isOpen(key, row.mark !== "done")
      const label = Option.match(row.progress, { onNone: () => row.id, onSome: (p) => `${row.id} ${count(p)}` })
      return (
        <box>
          <Line theme={props.theme} mark={row.mark} label={label} onMouseDown={() => props.toggles.flip(key)} />
          <Show when={open()}>
            <For each={row.groups}>
              {(group) => <Group theme={props.theme} group={group} toggles={props.toggles} keyPrefix={props.keyPrefix} />}
            </For>
          </Show>
        </box>
      )
    },
  })
}

const viewOf = SidebarState.$match({
  Hidden: () => Option.none<ChangeView>(),
  Showing: ({ view }) => Option.some(view),
})

/** The sidebar section: same header and toggle as the built-in Todo section; renders nothing while hidden. */
export function OpenSpecSection(props: { theme: () => TuiThemeCurrent; state: () => SidebarState; toggles: Toggles }) {
  const toggles = props.toggles
  const view = createMemo(() => Option.getOrUndefined(viewOf(props.state())))
  return (
    <Show when={view()}>
      {(current: () => ChangeView) => {
        const open = () => toggles.isOpen(`${current().change}/section`, true)
        return (
          <box>
            <box flexDirection="row" gap={1} onMouseDown={() => toggles.flip(`${current().change}/section`)}>
              <text fg={props.theme().text}>{open() ? "▼" : "▶"}</text>
              <text fg={props.theme().text} wrapMode="word">
                <b>OpenSpec</b> <span style={{ fg: props.theme().textMuted }}>{current().change}</span>
              </text>
            </box>
            <Show when={open()}>
              <For each={current().rows}>
                {(row) => <Row theme={props.theme()} row={row} toggles={toggles} keyPrefix={current().change} />}
              </For>
            </Show>
          </box>
        )
      }}
    </Show>
  )
}
