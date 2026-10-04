import { Array as A, Data, Option, pipe } from "effect"

export interface Task {
  readonly label: string
  readonly done: boolean
  readonly depth: number
}

export interface TaskSection {
  readonly title: Option.Option<string>
  readonly tasks: ReadonlyArray<Task>
}

export interface TaskDocument {
  readonly sections: ReadonlyArray<TaskSection>
  readonly completed: number
  readonly total: number
}

const TASK = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*?)\s*$/
const HEADING = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/

type Line = Data.TaggedEnum<{
  Heading: { readonly title: string }
  Task: { readonly task: Task }
}>
const Line = Data.taggedEnum<Line>()

interface Scan {
  readonly fence: Option.Option<string>
  readonly lines: ReadonlyArray<Line>
}

const classify = (line: string): Option.Option<Line> => {
  const task = TASK.exec(line)
  if (task) {
    return Option.some(
      Line.Task({
        task: {
          depth: Math.floor((task[1] ?? "").replace(/\t/g, "  ").length / 2),
          done: task[2] !== " ",
          label: task[3] ?? "",
        },
      }),
    )
  }
  const heading = HEADING.exec(line)
  return heading ? Option.some(Line.Heading({ title: heading[1] ?? "" })) : Option.none()
}

const step = (scan: Scan, line: string): Scan => {
  const fence = FENCE.exec(line)?.[1]
  return Option.match(scan.fence, {
    onSome: (open) =>
      fence !== undefined && fence[0] === open[0] && fence.length >= open.length
        ? { ...scan, fence: Option.none() }
        : scan,
    onNone: () =>
      fence !== undefined
        ? { ...scan, fence: Option.some(fence) }
        : pipe(
            classify(line),
            Option.match({
              onNone: () => scan,
              onSome: (classified) => ({ ...scan, lines: [...scan.lines, classified] }),
            }),
          ),
  })
}

const group = (sections: ReadonlyArray<TaskSection>, line: Line): ReadonlyArray<TaskSection> =>
  Line.$match(line, {
    Heading: ({ title }): ReadonlyArray<TaskSection> => [...sections, { title: Option.some(title), tasks: [] }],
    Task: ({ task }) =>
      pipe(
        A.last(sections),
        Option.match({
          onNone: (): ReadonlyArray<TaskSection> => [{ title: Option.none(), tasks: [task] }],
          onSome: (last) => [...sections.slice(0, -1), { ...last, tasks: [...last.tasks, task] }],
        }),
      ),
  })

/** Parse an OpenSpec `tasks.md`. Headings open sections; checkbox list items are tasks. */
export const parseTasks = (markdown: string): TaskDocument => {
  const { lines } = markdown.split(/\r?\n/).reduce(step, { fence: Option.none(), lines: [] })
  const sections = lines.reduce(group, [] as ReadonlyArray<TaskSection>).filter((s) => s.tasks.length > 0)
  const tasks = sections.flatMap((s) => s.tasks)
  return {
    sections,
    completed: tasks.filter((t) => t.done).length,
    total: tasks.length,
  }
}
