import { Option } from "effect"
import { describe, expect, it } from "vitest"
import { parseTasks } from "./tasks.ts"
import { ArtifactRow, buildView, TaskItem } from "./view.ts"

const artifacts = [
  { id: "proposal", status: "done" },
  { id: "design", status: "ready" },
  { id: "tasks", status: "done" },
  { id: "verify", status: "blocked" },
] as const

const tasksRowOf = (view: ReturnType<typeof buildView>) => {
  const row = view.rows.find(ArtifactRow.$is("Tasks"))
  if (row === undefined) throw new Error("no tasks row")
  return row
}

describe("buildView", () => {
  it("maps artifact statuses to marks in reported order", () => {
    const view = buildView("c", artifacts, Option.none())
    expect(view.rows.map((r) => [r._tag, r.id, r.mark])).toEqual([
      ["Artifact", "proposal", "done"],
      ["Artifact", "design", "pending"],
      ["Tasks", "tasks", "done"],
      ["Artifact", "verify", "blocked"],
    ])
  })

  it("marks the tasks row active with progress, and only the first open task active", () => {
    const tasks = tasksRowOf(buildView("c", artifacts, Option.some(parseTasks("## 1. A\n- [x] a1\n- [ ] a2\n## 2. B\n- [ ] b1\n"))))
    expect(tasks.mark).toBe("active")
    expect(tasks.progress).toEqual(Option.some({ completed: 1, total: 3 }))
    expect(tasks.items).toEqual([
      TaskItem.Section({ title: "1. A", progress: { completed: 1, total: 2 } }),
      TaskItem.Task({ label: "a1", depth: 0, mark: "done" }),
      TaskItem.Task({ label: "a2", depth: 0, mark: "active" }),
      TaskItem.Section({ title: "2. B", progress: { completed: 0, total: 1 } }),
      TaskItem.Task({ label: "b1", depth: 0, mark: "pending" }),
    ])
  })

  it("marks the tasks row done when everything is checked", () => {
    expect(tasksRowOf(buildView("c", artifacts, Option.some(parseTasks("- [x] a\n- [x] b\n")))).mark).toBe("done")
  })

  it("falls back to the artifact status when tasks.md has no checkboxes", () => {
    const tasks = tasksRowOf(buildView("c", artifacts, Option.some(parseTasks("# nothing here\n"))))
    expect(Option.isNone(tasks.progress)).toBe(true)
    expect(tasks.mark).toBe("done")
  })

  it("omits section headers for a single untitled section", () => {
    expect(tasksRowOf(buildView("c", artifacts, Option.some(parseTasks("- [ ] a\n")))).items).toEqual([
      TaskItem.Task({ label: "a", depth: 0, mark: "active" }),
    ])
  })
})
