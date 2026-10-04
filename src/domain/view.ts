import { Array as A, Data, Option, pipe } from "effect"
import type { TaskDocument } from "./tasks.ts"

export type ArtifactStatus = "done" | "ready" | "blocked"

export interface Artifact {
  readonly id: string
  readonly status: ArtifactStatus
}

/** The three states the built-in Todo row draws, plus "blocked" (muted, unchecked). */
export type Mark = "done" | "active" | "pending" | "blocked"

export interface Progress {
  readonly completed: number
  readonly total: number
}

/** One line under the tasks row: a section heading or a task. */
export type TaskItem = Data.TaggedEnum<{
  Section: { readonly title: string; readonly progress: Progress }
  Task: { readonly label: string; readonly mark: Mark; readonly depth: number }
}>
export const TaskItem = Data.taggedEnum<TaskItem>()

/** One artifact line; the tasks artifact carries its progress and task list. */
export type ArtifactRow = Data.TaggedEnum<{
  Artifact: { readonly id: string; readonly mark: Mark }
  Tasks: {
    readonly id: string
    readonly mark: Mark
    readonly progress: Option.Option<Progress>
    readonly items: ReadonlyArray<TaskItem>
  }
}>
export const ArtifactRow = Data.taggedEnum<ArtifactRow>()

export interface ChangeView {
  readonly change: string
  readonly rows: ReadonlyArray<ArtifactRow>
}

const markOf = {
  done: "done",
  ready: "pending",
  blocked: "blocked",
} as const satisfies Record<ArtifactStatus, Mark>

const taskItems = (doc: TaskDocument): ReadonlyArray<TaskItem> => {
  const firstOpen = doc.sections.flatMap((s) => s.tasks).findIndex((t) => !t.done)
  const titled = doc.sections.length > 1 || doc.sections.some((s) => Option.isSome(s.title))
  return doc.sections.reduce(
    (acc, section) => {
      const header: ReadonlyArray<TaskItem> = pipe(
        section.title,
        Option.filter(() => titled),
        Option.map((title) =>
          TaskItem.Section({
            title,
            progress: { completed: section.tasks.filter((t) => t.done).length, total: section.tasks.length },
          }),
        ),
        Option.toArray,
      )
      const rows = section.tasks.map((task, i) =>
        TaskItem.Task({
          label: task.label,
          depth: task.depth,
          mark: task.done ? "done" : acc.offset + i === firstOpen ? "active" : "pending",
        }),
      )
      return { offset: acc.offset + section.tasks.length, items: [...acc.items, ...header, ...rows] }
    },
    { offset: 0, items: [] as ReadonlyArray<TaskItem> },
  ).items
}

const tasksRow = (id: string, status: ArtifactStatus, doc: Option.Option<TaskDocument>): ArtifactRow =>
  pipe(
    doc,
    Option.filter((d) => d.total > 0),
    Option.match({
      onNone: () => ArtifactRow.Tasks({ id, mark: markOf[status], progress: Option.none(), items: [] }),
      onSome: (d) =>
        ArtifactRow.Tasks({
          id,
          mark: d.completed === d.total ? "done" : "active",
          progress: Option.some({ completed: d.completed, total: d.total }),
          items: taskItems(d),
        }),
    }),
  )

export const buildView = (
  change: string,
  artifacts: ReadonlyArray<Artifact>,
  tasks: Option.Option<TaskDocument>,
): ChangeView => ({
  change,
  rows: A.map(artifacts, (a) =>
    a.id === "tasks" ? tasksRow(a.id, a.status, tasks) : ArtifactRow.Artifact({ id: a.id, mark: markOf[a.status] }),
  ),
})
