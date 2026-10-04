import { Option } from "effect"
import { describe, expect, it } from "vitest"
import { changeFromCommand, changeNamesIn, latestEvidence } from "./evidence.ts"

describe("changeNamesIn", () => {
  it("finds change directories in absolute and relative paths", () => {
    expect(changeNamesIn('{"filePath":"/repo/openspec/changes/add-x/tasks.md"}')).toEqual(["add-x"])
    expect(changeNamesIn("cat openspec/changes/fix-y/design.md")).toEqual(["fix-y"])
  })

  it("never reports archive as a change", () => {
    expect(changeNamesIn("/repo/openspec/changes/archive/2026-01-01-old/tasks.md")).toEqual([])
  })

  it("reads --change flags and openspec subcommands", () => {
    expect(changeNamesIn("openspec status --change add-x --json")).toEqual(["add-x"])
    expect(changeNamesIn("openspec instructions apply --change=add-y")).toEqual(["add-y"])
    expect(changeNamesIn("openspec archive add-z -y")).toEqual(["add-z"])
  })

  it("orders names by position", () => {
    expect(changeNamesIn("openspec/changes/a/x then openspec/changes/b/y")).toEqual(["a", "b"])
  })

  it("ignores the changes directory itself", () => {
    expect(changeNamesIn("ls openspec/changes/")).toEqual([])
  })
})

describe("latestEvidence", () => {
  it("takes the last reference of the last text", () => {
    expect(latestEvidence(["openspec/changes/a/t.md", "nothing", "openspec/changes/b/t.md"])).toEqual(Option.some("b"))
  })

  it("is none without references", () => {
    expect(latestEvidence(["hello", ""])).toEqual(Option.none())
  })
})

describe("changeFromCommand", () => {
  it("takes the first argument of an opsx command", () => {
    expect(changeFromCommand("opsx-apply", " add-x more context")).toEqual(Option.some("add-x"))
  })

  it("ignores other commands and free text", () => {
    expect(changeFromCommand("review", "add-x")).toEqual(Option.none())
    expect(changeFromCommand("opsx-propose", "Add Dark Mode")).toEqual(Option.none())
    expect(changeFromCommand("opsx-apply", "")).toEqual(Option.none())
  })
})
