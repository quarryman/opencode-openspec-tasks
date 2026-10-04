## ADDED Requirements

### Requirement: Candidate set
The plugin SHALL take candidate changes from `openspec list --json` run in the session's directory, and SHALL only ever select a change present in that list.

#### Scenario: Evidence names an archived change
- **WHEN** session evidence names a change that is no longer listed
- **THEN** that evidence is ignored and resolution falls through to the next rule

### Requirement: Resolution order
The plugin SHALL resolve the change by the first rule that yields a listed candidate: (1) the most recent session evidence, (2) the git branch name equal to a change name, (3) the only listed change, (4) the listed change with the latest `lastModified`.

#### Scenario: Session ran an opsx command
- **WHEN** the session executed `/opsx-apply fix-thing` and `fix-thing` is listed
- **THEN** `fix-thing` is selected regardless of branch or modification time

#### Scenario: Session tool touched a change directory
- **WHEN** the latest tool call in the session whose input references `openspec/changes/<name>/` names a listed change
- **THEN** that change is selected

#### Scenario: Worktree branch matches
- **WHEN** there is no session evidence and the branch is `add-x` and `add-x` is listed
- **THEN** `add-x` is selected

#### Scenario: Single change
- **WHEN** there is no session evidence, no branch match, and exactly one change is listed
- **THEN** that change is selected

#### Scenario: Several changes, no evidence
- **WHEN** no earlier rule applies and several changes are listed
- **THEN** the change with the latest `lastModified` is selected

#### Scenario: Archive paths are not evidence
- **WHEN** a tool input references `openspec/changes/archive/...`
- **THEN** it is not treated as evidence for a change named `archive`

### Requirement: CLI output is decoded
The plugin MUST decode `openspec list --json` and `openspec status --json` output with a schema, and a failed decode or non-zero exit SHALL leave the previously displayed state unchanged.

#### Scenario: CLI missing
- **WHEN** `openspec` is not on `PATH`
- **THEN** the section renders nothing and no error is thrown into the TUI
