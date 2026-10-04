import { Option } from "effect"
import { describe, expect, it } from "vitest"
import { parseTasks } from "./tasks.ts"

describe("parseTasks", () => {
  it("groups tasks under headings and counts progress", () => {
    const doc = parseTasks(
      [
        "# Tasks",
        "",
        "## 1. Domain",
        "",
        "- [x] 1.1 parse",
        "- [X] 1.2 resolve",
        "- [ ] 1.3 view",
        "",
        "## 2. TUI",
        "- [ ] 2.1 render",
      ].join("\n"),
    )
    expect(doc.completed).toBe(2)
    expect(doc.total).toBe(4)
    expect(doc.sections.map((s) => Option.getOrNull(s.title))).toEqual(["1. Domain", "2. TUI"])
    expect(doc.sections[0]?.tasks.map((t) => [t.label, t.done])).toEqual([
      ["1.1 parse", true],
      ["1.2 resolve", true],
      ["1.3 view", false],
    ])
  })

  it("drops headings that have no tasks", () => {
    const doc = parseTasks("# Tasks\n\n## 1. Only\n- [ ] a\n")
    expect(doc.sections).toHaveLength(1)
  })

  it("ignores checkboxes inside fenced code", () => {
    const doc = parseTasks(["- [ ] real", "```md", "- [ ] example", "```", "~~~", "- [x] other", "~~~"].join("\n"))
    expect(doc.total).toBe(1)
  })

  it("keeps tasks that appear before any heading", () => {
    const doc = parseTasks("- [x] first\n- [ ] second\n")
    expect(doc.sections).toHaveLength(1)
    expect(Option.isNone(doc.sections[0]!.title)).toBe(true)
  })

  it("records nesting depth", () => {
    const doc = parseTasks("- [ ] parent\n  - [x] child\n    - [ ] grandchild\n")
    expect(doc.sections[0]?.tasks.map((t) => t.depth)).toEqual([0, 1, 2])
  })

  it("handles CRLF and an empty file", () => {
    expect(parseTasks("- [x] a\r\n- [ ] b\r\n").total).toBe(2)
    expect(parseTasks("")).toEqual({ sections: [], completed: 0, total: 0 })
  })

  it("does not treat plain list items as tasks", () => {
    expect(parseTasks("- plain\n- [] malformed\n").total).toBe(0)
  })
})
