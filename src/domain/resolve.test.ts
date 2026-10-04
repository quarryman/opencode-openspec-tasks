import { Option } from "effect"
import { describe, expect, it } from "vitest"
import { Resolution, resolveChange, resolvedName } from "./resolve.ts"

const candidates = [
  { name: "old", lastModified: 1 },
  { name: "add-x", lastModified: 2 },
  { name: "newest", lastModified: 3 },
]

describe("resolveChange", () => {
  it("prefers session evidence", () => {
    expect(resolveChange({ candidates, evidence: Option.some("old"), branch: Option.some("add-x") })).toEqual(Resolution.Evidence({ name: "old" }))
  })

  it("ignores evidence for a change that is not listed", () => {
    expect(resolveChange({ candidates, evidence: Option.some("gone"), branch: Option.some("add-x") })).toEqual(Resolution.Branch({ name: "add-x" }))
  })

  it("matches the last segment of a slashed branch", () => {
    expect(resolveChange({ candidates, evidence: Option.none(), branch: Option.some("feature/add-x") })).toEqual(Resolution.Branch({ name: "add-x" }))
  })

  it("selects the only change", () => {
    expect(
      resolveChange({ candidates: [{ name: "solo", lastModified: 0 }], evidence: Option.none(), branch: Option.some("main") }),
    ).toEqual(Resolution.Single({ name: "solo" }))
  })

  it("falls back to the most recently modified", () => {
    expect(resolveChange({ candidates, evidence: Option.none(), branch: Option.some("main") })).toEqual(Resolution.Latest({ name: "newest" }))
  })

  it("resolves nothing without candidates", () => {
    expect(resolveChange({ candidates: [], evidence: Option.some("x"), branch: Option.none() })).toEqual(Resolution.None())
  })
})

describe("resolvedName", () => {
  it("extracts the name from every matching rule and none otherwise", () => {
    expect(resolvedName(Resolution.Branch({ name: "a" }))).toEqual(Option.some("a"))
    expect(resolvedName(Resolution.None())).toEqual(Option.none())
  })
})
