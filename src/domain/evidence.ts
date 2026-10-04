import { Array as A, Option, Order, pipe } from "effect"

const NAME = "[a-z0-9][a-z0-9._-]*"

const PATTERNS: ReadonlyArray<RegExp> = [
  new RegExp(`openspec[\\\\/]+changes[\\\\/]+(${NAME})(?=[\\\\/"'\\s]|$)`, "g"),
  new RegExp(`--change(?:=|\\s+)["']?(${NAME})`, "g"),
  new RegExp(`openspec\\s+(?:archive|show|validate)\\s+["']?(${NAME})`, "g"),
]

interface Hit {
  readonly index: number
  readonly name: string
}

const byIndex = Order.mapInput(Order.Number, (hit: Hit) => hit.index)

/** Every change name a piece of text refers to, in order of appearance. */
export const changeNamesIn = (text: string): ReadonlyArray<string> =>
  pipe(
    PATTERNS.flatMap((pattern) =>
      Array.from(text.matchAll(pattern), (m): Hit => ({ index: m.index, name: m[1] ?? "" })),
    ),
    A.filter((hit) => hit.name !== "" && hit.name !== "archive" && !hit.name.startsWith("-")),
    A.sort(byIndex),
    A.map((hit) => hit.name),
  )

/** The change an `/opsx-*` command was invoked for, if its first argument names one. */
export const changeFromCommand = (command: string, args: string): Option.Option<string> =>
  command.startsWith("opsx")
    ? pipe(
        Option.fromNullishOr(args.trim().split(/\s+/)[0]),
        Option.filter((first) => new RegExp(`^${NAME}$`).test(first)),
      )
    : Option.none()

/** Latest evidence wins: the last name referenced by the last item that references any. */
export const latestEvidence = (texts: ReadonlyArray<string>): Option.Option<string> =>
  pipe(
    texts,
    A.flatMap(changeNamesIn),
    A.last,
  )
