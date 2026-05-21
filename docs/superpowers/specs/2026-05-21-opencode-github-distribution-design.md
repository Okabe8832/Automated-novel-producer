# OpenCode GitHub Distribution Design

## Go / No-Go

**Conclusion: Go.**

This repository should be published as a GitHub-hosted OpenCode project that works in two ways:

1. Users can clone the repository and open it directly in OpenCode.
2. Users can install the project assets into another OpenCode project through the existing installer flow.

The project should not split into separate repositories for these two use cases. One source of truth is easier to maintain and matches the current architecture: project-local OpenCode assets, a project-local default agent, and an installer that synchronizes managed assets into a target project.

## Product Goal

The goal is to make this project easy to discover, run, and reuse from GitHub without introducing a web app or a separate hosting layer. The repository should clearly communicate that it is both:

- a standalone OpenCode project for local use, and
- a reusable OpenCode asset bundle that can be installed into other projects.

## Confirmed User Decision

- Use a single repository for both direct use and reusable distribution.

## Recommended Distribution Model

Use one repository with one source tree and two supported entry paths.

### Path 1: Direct Project Use

The user clones the repository, runs `npm install`, opens the repo root in OpenCode, and uses the workflow from that project directory. The repo already contains the runtime-facing pieces for this mode:

- `opencode.json`
- `src/novel-production/*`
- `scripts/install-opencode-novel-production.ts`
- `docs/opencode-deployment-checklist.md`

This path is the primary user experience for contributors and for people trying the project locally.

### Path 2: Install Into Another Project

The existing installer becomes the reusable distribution path. It should copy or synchronize the OpenCode-managed assets into a target project and merge the target `opencode.json` in a safe way.

The installer is the published contract for reuse. GitHub distribution should point users to it rather than asking them to manually copy files.

## Packaging Surface

The repository should present the following as the supported public surface:

```text
opencode.json
src/novel-production/
scripts/install-opencode-novel-production.ts
docs/opencode-deployment-checklist.md
```

Optional OpenCode assets such as `.opencode/agents`, `.opencode/commands`, and `.opencode/plugins` should remain part of the installation story, but the repository should not depend on undocumented plugin registration behavior.

## Repository Behavior

The repository should behave like a publishable OpenCode package, not a general-purpose application.

- The default agent stays set to `novel-producer` in the project root.
- The installer remains the supported path for reuse in another OpenCode project.
- The docs should explain how to use the repo directly and how to install it elsewhere.
- GitHub release notes should describe the project as an OpenCode production line for Chinese novel generation.

## Documentation Requirements

The repository should include a short, user-facing release story:

- What the project does.
- How to use it directly from GitHub.
- How to install it into another OpenCode project.
- What files are managed by the installer.
- What the user should verify after installation.

`docs/opencode-deployment-checklist.md` should remain the canonical install guide. If the README is added later, it should link to that checklist instead of duplicating its logic.

## Constraints

- No web UI.
- No separate deployment backend.
- No split between “product repo” and “distribution repo.”
- No reliance on undocumented OpenCode plugin registration behavior.
- No packaging work that breaks direct project use.

## MVP Success Criteria

The distribution is successful when all of the following are true:

- A user can clone the repository and open it in OpenCode as-is.
- A user can install the workflow into another OpenCode project using the documented installer.
- The docs clearly explain both entry paths.
- The default agent and OpenCode assets remain consistent with the current project structure.

## Out of Scope

- Marketplace publishing.
- Separate npm package release.
- Separate installer repository.
- Web UI or browser-based setup.
- Full plugin SDK dependence beyond the current installer and project-local assets.
