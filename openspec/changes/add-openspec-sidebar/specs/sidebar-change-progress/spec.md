## ADDED Requirements

### Requirement: Section placement and visibility
The plugin SHALL register a `sidebar_content` slot at order 410 (directly after the built-in Todo at 400) and SHALL render nothing when no change is resolved for the session.

#### Scenario: No change resolved
- **WHEN** the session's working directory has no active OpenSpec change
- **THEN** the section renders nothing

#### Scenario: Change resolved
- **WHEN** a change is resolved
- **THEN** the section header reads `OpenSpec` followed by the change name, in bold `theme.text`, like the Todo header

### Requirement: Artifact rows
The plugin SHALL render one row per artifact reported by `openspec status --json`, in the order reported, using the Todo row format `[<mark>] <label>`.

#### Scenario: Done artifact
- **WHEN** an artifact's status is `done` and it is not `tasks`
- **THEN** its row is `[✓] <id>` in `theme.textMuted`

#### Scenario: Ready artifact
- **WHEN** an artifact's status is `ready`
- **THEN** its row is `[ ] <id>` in `theme.text`

#### Scenario: Blocked artifact
- **WHEN** an artifact's status is `blocked`
- **THEN** its row is `[ ] <id>` in `theme.textMuted`

### Requirement: Tasks row and task list
The `tasks` artifact row SHALL show `completed/total` parsed from `tasks.md`, SHALL be `[•]` in `theme.warning` while `0 < remaining`, `[✓]` when all tasks are complete, and SHALL expand into the individual tasks.

#### Scenario: Tasks in progress
- **WHEN** `tasks.md` exists with 15 of 17 tasks checked
- **THEN** the row reads `[•] tasks 15/17` in `theme.warning`
- **AND** below it each task is listed indented, `[✓]` for checked, `[•]` in `theme.warning` for the first unchecked task, `[ ]` for the rest

#### Scenario: All tasks done
- **WHEN** every task in `tasks.md` is checked
- **THEN** the row reads `[✓] tasks 17/17` in `theme.textMuted` and the task list is collapsed by default

#### Scenario: Tasks file without checkboxes
- **WHEN** `tasks.md` exists but contains no checkbox items
- **THEN** the row reads `[✓] tasks` with no count

### Requirement: Collapsing
The section header SHALL toggle the whole section (▼/▶) on click, and the `tasks` row SHALL toggle its task list on click, mirroring the Todo section's affordance.

#### Scenario: Collapse section
- **WHEN** the user clicks the section header
- **THEN** all rows are hidden and the marker changes from ▼ to ▶
