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

export interface TaskLine {
  readonly label: string
  readonly mark: Mark
  readonly depth: number
}

/** A heading of tasks.md and the tasks under it. `title` is none for tasks before any heading. */
export interface TaskGroup {
  readonly title: Option.Option<string>
  readonly progress: Progress
  /** Holds the first unchecked task; the view expands this group by default. */
  readonly current: boolean
  readonly tasks: ReadonlyArray<TaskLine>
}

/** One artifact line; the tasks artifact carries its progress and task list. */
export type ArtifactRow = Data.TaggedEnum<{
  Artifact: { readonly id: string; readonly mark: Mark }
  Tasks: {
    readonly id: string
    readonly mark: Mark
    readonly progress: Option.Option<Progress>
    readonly groups: ReadonlyArray<TaskGroup>
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

const taskGroups = (doc: TaskDocument): ReadonlyArray<TaskGroup> => {
  const firstOpen = doc.sections.flatMap((s) => s.tasks).findIndex((t) => !t.done)
  return doc.sections.reduce(
    (acc, section) => {
      const tasks = section.tasks.map(
        (task, i): TaskLine => ({
          label: task.label,
          depth: task.depth,
          mark: task.done ? "done" : acc.offset + i === firstOpen ? "active" : "pending",
        }),
      )
      const group: TaskGroup = {
        title: section.title,
        progress: { completed: section.tasks.filter((t) => t.done).length, total: section.tasks.length },
        current: tasks.some((t) => t.mark === "active"),
        tasks,
      }
      return { offset: acc.offset + section.tasks.length, groups: [...acc.groups, group] }
    },
    { offset: 0, groups: [] as ReadonlyArray<TaskGroup> },
  ).groups
}

const tasksRow = (id: string, status: ArtifactStatus, doc: Option.Option<TaskDocument>): ArtifactRow =>
  pipe(
    doc,
    Option.filter((d) => d.total > 0),
    Option.match({
      onNone: () => ArtifactRow.Tasks({ id, mark: markOf[status], progress: Option.none(), groups: [] }),
      onSome: (d) =>
        ArtifactRow.Tasks({
          id,
          mark: d.completed === d.total ? "done" : "active",
          progress: Option.some({ completed: d.completed, total: d.total }),
          groups: taskGroups(d),
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
