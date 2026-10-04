# opencode-openspec-tasks

An opencode **TUI plugin** that adds a sidebar section mirroring the OpenSpec
change the current session is working on: each artifact's status
(`proposal`, `specs`, `design`, `tasks`, …, as the change's schema defines
them) and live `tasks.md` progress, rendered exactly like opencode's built-in
Todo section.

## Stack

| piece | version | note |
| --- | --- | --- |
| Effect | 4.0.0 | core logic; services, `Stream`, `Schema`. Read `node_modules/effect/AGENTS.md` and `ai-docs/` — do not write v3 APIs from memory |
| @effect/platform-node | 4.0.0 | `FileSystem` (incl. `watch`) and `ChildProcessSpawner` implementations |
| @opencode-ai/plugin | 1.18.x | `@opencode-ai/plugin/tui` types only |
| @opentui/solid + solid-js | host-provided | peer deps; opencode supplies its own instances at runtime |
| vitest + @effect/vitest | 5 / 4.0.0 | `it.effect` for Effect code |
| TypeScript | 6 | `tsc --noEmit` only; opencode loads `src/tui.tsx` directly (Bun + opentui's Solid transform) |

Node is pinned in `.tool-versions` (24). Package manager is **bun**.

## Reference facts (measured against opencode v1.18.33)

- The built-in Todo section is `packages/tui/src/feature-plugins/sidebar/todo.tsx`:
  `sidebar_content` slot, `order: 400`; rows `[✓]` / `[•]` / `[ ]`; in-progress
  row `theme.warning`, others `theme.textMuted`; collapsible (▼/▶) when > 2 items.
- The `edit`, `write` and `apply_patch` tools publish `file.edited {file}` and
  `file.watcher.updated {file, event: add|change|unlink}` on the bus; TUI
  plugins receive them via `api.event.on`. Edits made through bash do NOT — the
  project-wide watcher is behind `OPENCODE_EXPERIMENTAL_FILEWATCHER` — so a
  narrow `fs` watch is the fallback.
- `openspec status --change <n> --json` (~1s, spawns node) is the authority
  for artifact ids/status (`done` | `ready` | `blocked`) and resolved paths.
  It must never run on the per-checkbox hot path.
- The TUI plugin API is callback-shaped. Wrap callbacks in `Stream.callback`
  with the unsubscribe as finalizer; one `ManagedRuntime` per plugin
  instance, disposed from `api.lifecycle.onDispose`.

## Code style

- Pure parsing/selection functions with unit tests; effects behind services.
- Data from outside (CLI JSON, events) is decoded with `Schema`.
  Optional fields: `Schema.optional(Schema.NullOr(T))`.
- No `let`, no `for` loops; `const`, `Array`/`Option`/`pipe`.
- View components stay thin: they read a Solid signal fed by the runtime.

## Workflow

OpenSpec (`openspec/`), commands in `.opencode/commands/` (generated — do not
edit). One change per git worktree.
