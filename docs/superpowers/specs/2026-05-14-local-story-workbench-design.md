# Local Story Workbench Design

> Superseded by `docs/superpowers/specs/2026-05-16-opencode-novel-production-line-design.md`. The project is now an OpenCode-native novel production line, not a Next.js/SQLite web workbench.

## Go / No-Go

**Conclusion: Conditional Go.**

The project is ready to start as a local MVP because the product direction, deployment boundary, stack, AI boundary, and test strategy are now clear. It is conditional because there is no codebase yet, so the first work package must create the engineering foundation before domain packages can proceed.

## Product Direction

Build a local single-user web workbench for novel/story creation. The first stage must run the business loop end-to-end: define a story, manage creative elements and prototypes, build a linear plot chain, generate node drafts through AI, review/approve/reject nodes, and record revision requests.

This is not a SaaS product in MVP. There is no account system, team workspace, billing, permission model, complex frontend, crawler, or multi-user collaboration.

## Recommended Architecture

Use a single Next.js application with SQLite.

- **Frontend:** simple server-rendered/admin-style pages, minimal client interactivity only where it improves editing.
- **Backend:** Next.js server actions or route handlers for all mutations and AI calls.
- **Persistence:** SQLite local file with migrations and typed data access.
- **AI:** direct server-side API call using environment variables. Each generation records prompt snapshot, provider/model metadata, output, status, and error.
- **Tests:** TDD for domain rules, persistence boundaries, prompt construction, AI adapter behavior, and user-visible smoke flows.

Avoid background queues in MVP. A lightweight `generation_runs` table is enough for pending/running/succeeded/failed status, retry, and audit.

## MVP Trim

### MVP Must Have

- Local Next.js app bootstrapped and runnable.
- SQLite schema and migrations.
- Story/project creation and basic settings.
- Element pool CRUD grouped by category: type, plot, character, scene, time, custom.
- Prototype/preset CRUD for type, character, scene, time, plot node.
- Character, scene, and time records.
- Linear plot node CRUD with ordering.
- Node detail editor with bindings to elements, characters, scenes, and time entries.
- AI draft generation for a plot node.
- Prompt snapshot saved for every AI generation.
- Node status flow: draft, ready_to_generate, generating, generated, review_pending, approved, rejected, revising.
- Manual review actions: approve, reject with revision request, retry generation.
- Basic local dashboard showing story, nodes, statuses, and next action.
- Tests and manual QA script for the core loop.

### MVP Optional

- Import/export JSON for local backup.
- Basic prompt template editor.
- Simple seed data for a science-fiction demo story.
- Markdown preview of generated content.

### Later

- Text ingestion and automatic prototype extraction.
- Crawling existing novels.
- Multi-timeline, branch/merge plot structures.
- Automatic review agent.
- Revision impact analysis across downstream nodes.
- Background generation queue.
- Multi-user collaboration.

### Not Implemented

- Account management.
- Role/permission system.
- Billing/subscriptions.
- Complex frontend design system.
- Cloud deployment assumptions.

## Shared Contract Freeze V1

### Core Objects

`Story`
- `id`
- `title`
- `genre`
- `premise`
- `created_at`
- `updated_at`

`Element`
- `id`
- `story_id`
- `category`: `type | plot | character | scene | time | custom`
- `name`
- `description`
- `source`: `default | user | prototype | generated`
- `created_at`
- `updated_at`

`Prototype`
- `id`
- `story_id`
- `kind`: `type | character | scene | time | plot_node`
- `name`
- `content_json`
- `created_at`
- `updated_at`

`Character`
- `id`
- `story_id`
- `name`
- `nickname`
- `appearance`
- `personality`
- `setting`
- `created_at`
- `updated_at`

`Scene`
- `id`
- `story_id`
- `name`
- `description`
- `created_at`
- `updated_at`

`TimeEntry`
- `id`
- `story_id`
- `label`
- `description`
- `created_at`
- `updated_at`

`PlotNode`
- `id`
- `story_id`
- `order_index`
- `title`
- `summary`
- `status`
- `draft_content`
- `revision_request`
- `created_at`
- `updated_at`

`GenerationRun`
- `id`
- `story_id`
- `plot_node_id`
- `status`: `pending | running | succeeded | failed`
- `provider`
- `model`
- `prompt_snapshot_json`
- `output_text`
- `error_message`
- `created_at`
- `updated_at`

### Relationships

- A story owns all records.
- A plot node can bind many elements, characters, scenes, and time entries through join tables.
- A plot node has many generation runs; the newest succeeded run may update `draft_content` and move the node to `review_pending`.

### Status Flow

`draft -> ready_to_generate -> generating -> generated -> review_pending -> approved`

Reject flow:

`review_pending -> rejected -> revising -> ready_to_generate`

Failure flow:

`generating -> ready_to_generate` with a failed `GenerationRun` record.

### API Style

Use server-side functions with typed input validation at boundaries.

Suggested module boundary:
- `src/features/stories/actions.ts`
- `src/features/elements/actions.ts`
- `src/features/prototypes/actions.ts`
- `src/features/plot-nodes/actions.ts`
- `src/features/generation/actions.ts`

Route handlers are only needed for endpoints that cannot naturally be represented as server actions.

### Prompt Snapshot Structure

```json
{
  "story": { "title": "", "genre": "", "premise": "" },
  "plotNode": { "title": "", "summary": "", "orderIndex": 1 },
  "previousNodes": [],
  "elements": [],
  "characters": [],
  "scenes": [],
  "timeEntries": [],
  "revisionRequest": "",
  "templateVersion": "v1"
}
```

## File Ownership Map V1

### Package A: Engineering Foundation

Owns:
- `package.json`
- `next.config.*`
- `tsconfig.json`
- `eslint.config.*`
- `vitest.config.*`
- `playwright.config.*`
- `.env.example`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/lib/env.ts`

### Package B: Data Model and Domain Rules

Owns:
- `src/db/schema.ts`
- `src/db/client.ts`
- `src/db/migrations/*`
- `src/features/*/domain.ts`
- `src/features/*/repository.ts`

### Package C: AI Generation and Prompt System

Owns:
- `src/ai/provider.ts`
- `src/ai/prompt-builder.ts`
- `src/features/generation/*`

### Package D: Minimal Web Workbench

Owns:
- `src/app/stories/*`
- `src/app/nodes/*`
- `src/components/*`
- feature UI files under `src/features/*/components/*`

### Package E: Review and QA Loop

Owns:
- `tests/*`
- `e2e/*`
- `scripts/qa-local-flow.*`
- documentation updates under `docs/*`

Shared files require coordination:
- `src/db/schema.ts`
- `src/lib/env.ts`
- `src/features/plot-nodes/domain.ts`
- `src/features/generation/domain.ts`

## Work Packages

1. **A: Engineering foundation and local run base**
   - Create the Next.js app, TypeScript, linting, Vitest, Playwright, SQLite driver, env handling, and base route.

2. **B: Domain model and SQLite persistence**
   - Implement schema, migrations, repositories, and domain state transitions using TDD.

3. **C: Prompt snapshots and direct AI generation**
   - Implement prompt builder, AI provider adapter, generation run records, retry/failure handling, and tests with mocked provider.

4. **D: Minimal web workbench**
   - Implement plain UI for story, element pool, prototypes, plot node chain, node editor, and review actions.

5. **E: End-to-end QA and seed workflow**
   - Add seed data, Playwright smoke path, local QA script, and documentation for running the full business loop.

## Recommended Start Order

1. Start A first.
2. Start B after A creates the app and test tooling.
3. Start C after B defines persistence contracts.
4. Start D after B and C expose stable actions/repositories.
5. Start E throughout, but final E validation runs after D.

## High-Impact Defaults

- Use one local SQLite database file.
- Keep UI intentionally simple.
- Keep node chain linear.
- Store snapshots as JSON.
- Mock AI in tests; real AI only in local manual QA with configured env.
- No account system.
- No cloud assumptions.
