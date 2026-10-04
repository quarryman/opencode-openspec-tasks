# Design

## Context

opencode (v1.18.33) loads TUI plugins listed in `tui.json`. A plugin module
exports `{ id, tui }`, where `tui(api)` registers Solid components into slots.
The built-in Todo section (`feature-plugins/sidebar/todo.tsx`) is the visual
reference: `sidebar_content` slot at `order: 400`, rows `[✓]`/`[•]`/`[ ]`,
warning colour for the in-progress row, muted otherwise, ▼/▶ toggle.

Prior art measured before designing:

- `opencode-openspec-task-tui` re-runs `openspec list` + `openspec status` on
  every file event (1.28s + 0.99s measured), polls every 30s, and supersedes
  in-flight refreshes, so rapid ticks starve rendering. Its project-wide
  "most recently modified change" ignores which change the session is on.
- opencode's `edit` / `write` / `apply_patch` tools publish `file.edited` and
  `file.watcher.updated` on the bus with the absolute path; TUI plugins get
  them via `api.event.on`. Bash edits produce no event (the project watcher is
  experimental and off by default).

## Goals / Non-Goals

Goals: per-session change, all schema artifacts, live tasks at file-read cost,
Effect-native core, zero polling, clean disposal.

Non-goals: editing tasks from the sidebar, buttons that drive `/opsx-*`,
browsing specs, multi-change dashboards.

## Decisions

### D1. Two refresh paths with different costs

| trigger | work |
| --- | --- |
| bus event or fs event for the resolved `tasks.md` | read + parse file |
| create/remove inside the change directory | `openspec status --json` |
| new session evidence, or entry added/removed directly under `openspec/changes/` | `openspec list --json`, resolve, then both of the above |

Rejected: Angel's single pipeline (list → status → read) per event. The
change cannot become a different change because a checkbox was ticked.

### D2. One recursive watch plus the bus

One `FileSystem.watch(<root>/openspec/changes, { recursive: true })` stream
classifies every event by path (top-level entry / inside resolved change /
`tasks.md`). Bus events for paths inside the resolved change are merged into
the same classification. Whichever arrives first wins; the debounce collapses
the duplicate. Rejected: three per-file watchers (Angel) — the recursive watch
on macOS (FSEvents) and Linux (Node ≥ 20) covers atomic replace too.

### D3. Session evidence is computed in Solid, consumed in Effect

`api.state.session.messages(id)` / `api.state.part(messageID)` are reactive
store reads. A `createMemo` derives the latest evidenced change name (pure
`latestEvidence(parts)`), and an effect pushes it into a
`SubscriptionRef<Option<string>>` the Effect pipeline reads as a stream.
`command.executed` events for `opsx-*` commands are folded into the same ref,
covering the command before any tool runs. Evidence extraction:
`openspec/changes/<name>/` in any tool input string (excluding `archive/`),
`--change <name>` / `--change=<name>`, and `openspec archive <name>`.

### D4. Effect services

- `OpenSpecCli` — `list(dir)`, `status(dir, change)`; `ChildProcessSpawner`
  from `@effect/platform-node`, 10s timeout, output decoded with `Schema`;
  failures are typed (`OpenSpecCliError`) and the pipeline keeps the last good
  value.
- `OpencodeEvents` — `subscribe(type): Stream` over `api.event.on`, same
  signature as opencode's own `@opencode-ai/plugin/v2/effect` `Event`, built
  with `Stream.callback` and the unsubscribe as finalizer.
- `FileSystem` — from `NodeServices`.

The per-session pipeline is `Stream.switchMap`-style (`flatMap` with
`switch: true`) on the resolved change, so a new change cancels the previous
change's watchers and reads.

### D5. Runtime ownership

One `ManagedRuntime` per plugin instance. Each mounted sidebar view forks its
pipeline with `runtime.runFork` and interrupts it in Solid `onCleanup`.
`api.lifecycle.onDispose` disposes the runtime. The pipeline writes into a
Solid signal; the view never awaits.

### D6. Effect version

`effect@4.0.0` stable, not opencode's internal `4.0.0-beta.83`. No Effect
value crosses the plugin boundary (the TUI API is plain callbacks), so the two
copies never meet.

## Risks / Trade-offs

- Recursive `fs.watch` not supported on some Linux filesystems → bus events
  still cover agent edits; bash edits would be missed until the next
  re-resolution. Acceptable.
- The plugin is loaded as source `.tsx` by opencode's Bun runtime; the view
  cannot be unit-tested without the opentui Solid transform, so the view stays
  thin and logic lives in tested pure modules.
- `openspec status` latency (~1s) on artifact creation is visible but rare.
