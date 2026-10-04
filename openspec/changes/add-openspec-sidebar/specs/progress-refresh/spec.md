## ADDED Requirements

### Requirement: Task updates without the CLI
A change to the resolved `tasks.md` SHALL be reflected by re-reading and parsing that file only, without invoking the `openspec` CLI.

#### Scenario: Agent ticks a checkbox with the edit tool
- **WHEN** opencode publishes `file.edited` or `file.watcher.updated` for the resolved `tasks.md`
- **THEN** the task list re-renders from the re-read file within the debounce window

#### Scenario: File edited outside opencode tools
- **WHEN** `tasks.md` is modified by a bash command or another editor
- **THEN** the filesystem watch on the change directory triggers the same re-read

#### Scenario: Burst of edits
- **WHEN** several edits arrive within the debounce window
- **THEN** exactly one re-read happens after the last one, and the displayed state is the final file content

### Requirement: Artifact status refresh
Artifact statuses SHALL be refreshed via `openspec status --json` only when a file is created or removed inside the change directory, or when the resolved change changes.

#### Scenario: New artifact written
- **WHEN** `design.md` is created in the change directory
- **THEN** artifact statuses are refreshed once and `design` shows `[✓]`

#### Scenario: Plain edit of an existing artifact
- **WHEN** `proposal.md` is modified in place
- **THEN** the CLI is not invoked

### Requirement: Re-resolution
The resolved change SHALL be re-evaluated when the session produces new evidence, or when an entry is added to or removed from the `openspec/changes` directory.

#### Scenario: Change archived
- **WHEN** the shown change's directory moves to `archive/`
- **THEN** resolution reruns and the section shows the next candidate or nothing

### Requirement: No polling and clean disposal
The plugin SHALL NOT poll on a timer, and all watchers, subscriptions and fibers SHALL be released when the TUI disposes the plugin.

#### Scenario: Plugin disposed
- **WHEN** `api.lifecycle` disposes the plugin
- **THEN** the runtime is disposed, closing every event subscription and filesystem watch
