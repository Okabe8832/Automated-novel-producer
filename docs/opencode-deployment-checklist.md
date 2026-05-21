# OpenCode Deployment Checklist

This project is meant to be opened inside OpenCode as a deployable novel production line. The product purpose is to produce Chinese novel text through OpenCode agents and commands, not through a separate web app.

## Project-Local Use

1. Run `npm install`.
2. In OpenCode, open this project root in OpenCode so project-local assets are discoverable.
3. Confirm `opencode.json` sets `default_agent` to `novel-producer`.
4. Run `/novel-init` to create `.novel-production/`.
5. Run `/novel-intake` to capture the writing order.
6. Run `/novel-plan` to create the story bible, production plan, and plot units.
7. Run `/novel-produce` to draft the next eligible unit.
8. Run `/novel-review` and `/novel-repair` until the unit is approved.
9. Run `/novel-export` to assemble approved units into `.novel-production/exports/manuscript.md`.
10. Run `/novel-status` to inspect blockers and the next action.

## Asset Discovery

OpenCode discovers this workflow from project-local files:

- `.opencode/agents/novel-producer.md` is the main production controller.
- `.opencode/agents/novel-*.md` files define specialist roles for planning, drafting, review, repair, continuity, and export.
- `.opencode/commands/novel-*.md` files expose the slash-command workflow.
- `.opencode/plugins/novel-production.ts` exposes optional helper tools.

The plugin helper does not register agents or commands. The commands and agents are markdown assets because OpenCode plugin APIs should not be assumed to register slash commands or agents directly.

## Install Into Another OpenCode Project

Use the installer instead of manually copying files. It synchronizes managed OpenCode assets, merges `opencode.json`, and protects existing target files with conflict checks and backups.

From GitHub, preview the install with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/Okabe8832/Automated-novel-producer-release/main/install.sh | bash -s -- /path/to/target-project
```

Apply the GitHub installer after reviewing the dry-run report:

```bash
curl -fsSL https://raw.githubusercontent.com/Okabe8832/Automated-novel-producer-release/main/install.sh | bash -s -- /path/to/target-project --write
```

Preview the install first:

```bash
npm run install:opencode-novel -- --target /path/to/target-project --dry-run
```

Apply the install after reviewing the dry-run report:

```bash
npm run install:opencode-novel -- --target /path/to/target-project --write
```

Use force only after reviewing the listed conflict paths:

```bash
npm run install:opencode-novel -- --target /path/to/target-project --write --force
```

Backups for overwritten managed assets and merged `opencode.json` are written under the target project at `.opencode/novel-production-backups/`.

Default-agent behavior:

- If the target has no `default_agent`, the installer sets `default_agent` to `novel-producer`.
- If the target already has another `default_agent`, the installer keeps it and reports a warning.
- Use `--set-default-agent` to replace the target default with `novel-producer`.
- Use `--keep-default-agent` to preserve the target default-agent setting exactly.

After installing, open the target project in OpenCode and verify:

1. `/novel-status` is available.
2. `novel-producer` is available as an agent.
3. `/novel-init` creates `.novel-production/`.
4. `/novel-produce`, `/novel-review`, and `/novel-export` remain available.

If the plugin helper later imports external packages, add `.opencode/package.json` for those plugin-only dependencies.

## Acceptance Check

The workflow is deployable when all of these hold:

- OpenCode is opened from the project root.
- `/novel-init`, `/novel-intake`, `/novel-plan`, `/novel-produce`, `/novel-review`, `/novel-repair`, `/novel-export`, and `/novel-status` are available.
- The `novel-producer` agent is the default project agent.
- A smoke workflow can initialize a workspace, plan a unit, produce Chinese draft text, approve it, and export `manuscript.md`.
