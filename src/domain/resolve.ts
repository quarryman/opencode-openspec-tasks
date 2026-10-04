import { Array as A, Data, Option, Order, pipe } from "effect"

export interface Candidate {
  readonly name: string
  /** epoch millis; 0 when unknown */
  readonly lastModified: number
}

export interface ResolveInput {
  readonly candidates: ReadonlyArray<Candidate>
  readonly evidence: Option.Option<string>
  readonly branch: Option.Option<string>
}

/** Which change was chosen, and by which rule. */
export type Resolution = Data.TaggedEnum<{
  Evidence: { readonly name: string }
  Branch: { readonly name: string }
  Single: { readonly name: string }
  Latest: { readonly name: string }
  None: {}
}>
export const Resolution = Data.taggedEnum<Resolution>()

const listed = (candidates: ReadonlyArray<Candidate>) => (name: string): Option.Option<string> =>
  candidates.some((c) => c.name === name) ? Option.some(name) : Option.none()

const byModified = Order.mapInput(Order.Number, (c: Candidate) => c.lastModified)

/** Evidence → branch → the only change → the most recently modified change. */
export const resolveChange = ({ candidates, evidence, branch }: ResolveInput): Resolution => {
  const known = listed(candidates)
  return pipe(
    Option.flatMap(evidence, known),
    Option.map((name) => Resolution.Evidence({ name })),
    Option.orElse(() =>
      pipe(
        Option.flatMap(branch, (b) => known(b.split("/").at(-1) ?? b)),
        Option.map((name) => Resolution.Branch({ name })),
      ),
    ),
    Option.orElse(() =>
      candidates.length === 1 ? Option.map(A.head(candidates), (c) => Resolution.Single({ name: c.name })) : Option.none(),
    ),
    Option.orElse(() =>
      pipe(
        A.sort(candidates, Order.flip(byModified)),
        A.head,
        Option.map((c) => Resolution.Latest({ name: c.name })),
      ),
    ),
    Option.getOrElse(() => Resolution.None()),
  )
}

/** The resolved change name, if any rule matched. */
export const resolvedName: (r: Resolution) => Option.Option<string> = Resolution.$match({
  Evidence: ({ name }) => Option.some(name),
  Branch: ({ name }) => Option.some(name),
  Single: ({ name }) => Option.some(name),
  Latest: ({ name }) => Option.some(name),
  None: () => Option.none(),
})
