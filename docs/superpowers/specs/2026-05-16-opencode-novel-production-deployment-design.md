# OpenCode Novel Production Deployment Design

## Context

The project is already an OpenCode-native Chinese novel production line. It can be opened directly in OpenCode and uses project-local assets under `.opencode/` plus file-backed runtime state under `.novel-production/`.

The next deployment improvement is not a cloud service or web UI. It is a reliable way to install or synchronize the existing OpenCode production-line assets into another OpenCode project so that the target project can produce novels through the same `/novel-*` workflow.

Official OpenCode documentation supports project-local config and assets through:

- `opencode.json`
- `.opencode/agents/`
- `.opencode/commands/`
- `.opencode/plugins/`

OpenCode plugins are documented for hooks, integrations, and custom tools. The design must not depend on undocumented runtime registration of agents or slash commands from a plugin. Agents and commands remain markdown assets; the installer only places or updates those assets.

## Goal

Add a deployment layer that keeps this repository directly usable while also allowing the user to deploy the novel production line into another OpenCode project with a repeatable local command.

The first supported deployment target is:

```text
source project -> installer/sync script -> target OpenCode project
```

The target project should become able to run `/novel-init`, `/novel-intake`, `/novel-plan`, `/novel-produce`, `/novel-review`, `/novel-repair`, `/novel-export`, and `/novel-status` without manual file copying.

## Non-Goals

- No browser UI.
- No cloud deployment.
- No account system.
- No npm publishing workflow in this phase.
- No dependence on private OMO APIs.
- No assumption that an OpenCode plugin can dynamically register agents or slash commands.
- No destructive overwrite of unrelated target project OpenCode configuration.

## Proposed Approach

Use a Node/TypeScript installer script that performs controlled file synchronization and config merging.

Suggested entry point:

```bash
npm run install:opencode-novel -- --target /path/to/target-project
```

Suggested script file:

```text
scripts/install-opencode-novel-production.ts
```

The installer copies only managed novel-production assets from the source project into the target project:

```text
.opencode/agents/novel-*.md
.opencode/commands/novel-*.md
.opencode/plugins/novel-production.ts
```

It then merges `opencode.json` conservatively:

- create `opencode.json` if missing;
- preserve existing unrelated keys;
- set `default_agent` to `novel-producer` only when requested or when no default is present;
- report a warning when the target already has another default agent;
- never replace the full file blindly.

## Installer Modes

### Dry Run

Default or explicit dry-run mode should show planned changes without writing files:

```bash
npm run install:opencode-novel -- --target /path/to/project --dry-run
```

The report should include:

- files to create;
- files to update;
- conflicts requiring `--force`;
- config changes that would be made;
- backup paths that would be used in write mode.

### Write Mode

Write mode applies safe changes:

```bash
npm run install:opencode-novel -- --target /path/to/project --write
```

Before replacing an existing managed file, the installer writes a timestamped backup under a target-local backup directory such as:

```text
.opencode/novel-production-backups/YYYYMMDD-HHMMSS/
```

### Force Mode

Force mode allows replacing conflicting novel-production files after backups are created:

```bash
npm run install:opencode-novel -- --target /path/to/project --write --force
```

Force mode still must not delete unrelated target files or unrelated config keys.

## Conflict Policy

The installer treats these as managed files:

- `.opencode/agents/novel-producer.md`
- `.opencode/agents/novel-planner.md`
- `.opencode/agents/novel-drafter.md`
- `.opencode/agents/novel-reviewer.md`
- `.opencode/agents/novel-repairer.md`
- `.opencode/agents/novel-continuity.md`
- `.opencode/agents/novel-exporter.md`
- `.opencode/commands/novel-init.md`
- `.opencode/commands/novel-intake.md`
- `.opencode/commands/novel-plan.md`
- `.opencode/commands/novel-produce.md`
- `.opencode/commands/novel-review.md`
- `.opencode/commands/novel-repair.md`
- `.opencode/commands/novel-export.md`
- `.opencode/commands/novel-status.md`
- `.opencode/plugins/novel-production.ts`

If a managed target file exists and differs from the source, the installer should:

1. report the difference in dry-run mode;
2. refuse to overwrite in write mode without `--force` unless the file contains a managed marker;
3. back up the file before overwrite when overwrite is allowed.

Managed marker recommendation:

```text
<!-- managed-by: opencode-novel-production-line -->
```

Markdown agent and command assets should include this marker near the top. TypeScript plugin assets should include an equivalent comment.

## Config Merge Policy

`opencode.json` merge behavior should be conservative:

- Preserve all existing keys not owned by this project.
- Add or update only deployment-owned keys.
- Prefer plural `.opencode` asset directories.
- Validate that `default_agent` points to a primary agent.
- If another `default_agent` already exists, report it and require an explicit flag before replacing it.

Suggested flags:

```text
--set-default-agent       set default_agent to novel-producer
--keep-default-agent      do not change target default_agent
```

If neither flag is provided and the target has no default agent, set `default_agent` to `novel-producer`. If the target already has another default, keep it and print the command the user can rerun with `--set-default-agent`.

## Deployment Report

Each run should print a concise report:

```text
OpenCode Novel Production Deployment
Target: /path/to/project
Mode: dry-run | write

Assets:
- create: N
- update: N
- unchanged: N
- conflicts: N

Config:
- opencode.json: created | merged | unchanged | conflict
- default_agent: novel-producer | kept existing: <name>

Next steps:
1. Open target project in OpenCode.
2. Confirm /novel-status is available.
3. Run /novel-init.
```

When write mode succeeds, the report should state where backups were written.

## Data Flow

1. Resolve the source project root from the current repository.
2. Resolve and validate the target project root.
3. Enumerate known managed assets from the source.
4. Compare each asset against the target path.
5. Build a deployment plan with create, update, unchanged, and conflict actions.
6. Merge or plan `opencode.json` changes.
7. In dry-run mode, print the plan and exit.
8. In write mode, create directories, write backups, copy assets, and write merged config.
9. Print the deployment report and next OpenCode commands.

## Error Handling

The installer should fail before writing if:

- the target path is missing;
- the target path is not a directory;
- required source assets are missing;
- `opencode.json` exists but is invalid JSON;
- conflicts exist and neither managed markers nor `--force` allow replacement;
- the target equals the source and the requested operation would be a no-op install.

The installer should never partially overwrite files after a validation failure. Validation happens before writes.

## Testing Strategy

Add tests around the installer planner and writer:

- builds a dry-run plan for a fresh target;
- creates expected `.opencode` files in write mode;
- preserves unrelated `opencode.json` keys;
- handles existing default agent without clobbering it;
- backs up changed managed files before overwrite;
- refuses unmarked conflicts without `--force`;
- reports missing source assets clearly;
- keeps repeated installs idempotent.

The tests should use temporary directories and should not require a real OpenCode runtime.

Manual OpenCode verification remains a separate acceptance step.

## Acceptance Criteria

- Current repository remains directly usable as an OpenCode novel production project.
- A target project can receive all novel production agents, commands, and plugin helper through one local installer command.
- Installer dry-run shows planned changes without writing.
- Installer write mode creates or updates only managed assets.
- Existing target `opencode.json` settings are preserved unless explicitly changed.
- Conflicts are reported instead of silently overwritten.
- Backups are created before overwriting target managed files.
- After installation, the target project can be opened in OpenCode and should expose `/novel-*` commands and the `novel-producer` agent.
- Automated tests cover installer planning, config merging, conflict handling, and idempotency.

## Future Work

- Package the installer as a reusable npm package or project template.
- Add an uninstall command that removes only managed files with markers.
- Add an update command that reports source and target asset versions.
- Add plugin helper tools for workspace validation once the OpenCode plugin runtime has been manually verified.
