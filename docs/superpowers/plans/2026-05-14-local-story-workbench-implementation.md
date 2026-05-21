# Local Story Workbench Implementation Plan

> Superseded by `docs/superpowers/plans/2026-05-16-opencode-novel-production-line-implementation.md`. The project is now an OpenCode-native novel production line, not a Next.js/SQLite web workbench.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local single-user Next.js + SQLite story creation workbench that runs the core business loop with AI plot-node generation.

**Architecture:** A single Next.js app owns the simple UI, server-side mutations, SQLite persistence, prompt construction, and direct AI provider calls. The MVP avoids accounts, cloud assumptions, complex frontend, queues, crawlers, and multi-timeline logic.

**Tech Stack:** Next.js, TypeScript, SQLite, Drizzle ORM or equivalent typed SQL layer, Vitest, Playwright, direct model API configured through `.env.local`.

---

## File Structure

- Create: `package.json` - scripts and dependencies.
- Create: `tsconfig.json` - TypeScript configuration.
- Create: `next.config.ts` - Next.js configuration.
- Create: `eslint.config.mjs` - lint configuration.
- Create: `vitest.config.ts` - unit/integration test configuration.
- Create: `playwright.config.ts` - local smoke test configuration.
- Create: `.env.example` - AI and database env variables.
- Create: `src/lib/env.ts` - typed environment access.
- Create: `src/db/client.ts` - SQLite connection.
- Create: `src/db/schema.ts` - database schema.
- Create: `src/db/migrate.ts` - migration runner.
- Create: `src/features/stories/domain.ts` - story validation and defaults.
- Create: `src/features/elements/domain.ts` - element rules.
- Create: `src/features/prototypes/domain.ts` - prototype rules.
- Create: `src/features/characters/domain.ts` - character rules.
- Create: `src/features/scenes/domain.ts` - scene rules.
- Create: `src/features/time-entries/domain.ts` - time entry rules.
- Create: `src/features/plot-nodes/domain.ts` - node ordering and status transitions.
- Create: `src/features/generation/domain.ts` - generation status rules.
- Create: `src/features/*/repository.ts` - persistence operations by feature.
- Create: `src/ai/prompt-builder.ts` - prompt snapshot builder.
- Create: `src/ai/provider.ts` - AI provider interface and implementation.
- Create: `src/features/generation/service.ts` - generation orchestration.
- Create: `src/app/layout.tsx` - base layout.
- Create: `src/app/page.tsx` - dashboard redirect/landing.
- Create: `src/app/stories/page.tsx` - story overview.
- Create: `src/app/stories/[storyId]/page.tsx` - local workbench dashboard.
- Create: `src/app/stories/[storyId]/nodes/[nodeId]/page.tsx` - node editor and generation/review controls.
- Create: `src/features/*/actions.ts` - server actions for UI mutations.
- Create: `tests/domain/*.test.ts` - domain unit tests.
- Create: `tests/ai/*.test.ts` - prompt/provider/generation tests.
- Create: `tests/db/*.test.ts` - repository tests.
- Create: `e2e/local-story-flow.spec.ts` - Playwright smoke test.
- Create: `scripts/seed-demo.ts` - demo story seed.

## Task 1: Bootstrap Local App and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/lib/env.ts`
- Test: `tests/env.test.ts`

- [ ] Step 1: Initialize the Next.js TypeScript project structure without adding account/auth dependencies.
- [ ] Step 2: Add scripts: `dev`, `build`, `lint`, `test`, `test:watch`, `e2e`, `seed`.
- [ ] Step 3: Write a failing env test that requires `DATABASE_URL` defaulting to a local SQLite file and optional AI provider variables.
- [ ] Step 4: Implement `src/lib/env.ts` with typed env parsing and no secret hardcoding.
- [ ] Step 5: Run `npm test -- tests/env.test.ts`; expected PASS.
- [ ] Step 6: Run `npm run build`; expected PASS with a minimal page.

## Task 2: Define Domain Rules Before Persistence

**Files:**
- Create: `src/features/stories/domain.ts`
- Create: `src/features/elements/domain.ts`
- Create: `src/features/prototypes/domain.ts`
- Create: `src/features/characters/domain.ts`
- Create: `src/features/scenes/domain.ts`
- Create: `src/features/time-entries/domain.ts`
- Create: `src/features/plot-nodes/domain.ts`
- Create: `src/features/generation/domain.ts`
- Test: `tests/domain/story.test.ts`
- Test: `tests/domain/elements.test.ts`
- Test: `tests/domain/plot-node-status.test.ts`
- Test: `tests/domain/generation.test.ts`

- [ ] Step 1: Write failing tests for story creation defaults: title required, genre optional, premise optional.
- [ ] Step 2: Implement story domain helpers.
- [ ] Step 3: Write failing tests for element categories: `type`, `plot`, `character`, `scene`, `time`, `custom`.
- [ ] Step 4: Implement element domain helpers.
- [ ] Step 5: Write failing tests for plot node status transitions: `draft -> ready_to_generate -> generating -> generated -> review_pending -> approved`, rejection `review_pending -> rejected -> revising -> ready_to_generate`, and failure `generating -> ready_to_generate` with a failed generation run.
- [ ] Step 6: Implement status transition functions that reject invalid transitions.
- [ ] Step 7: Write failing tests for generation status transitions: pending, running, succeeded, failed.
- [ ] Step 8: Implement generation domain helpers.
- [ ] Step 9: Run `npm test -- tests/domain`; expected PASS.

## Task 3: Add SQLite Schema and Repositories

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/migrate.ts`
- Create: `src/features/stories/repository.ts`
- Create: `src/features/elements/repository.ts`
- Create: `src/features/prototypes/repository.ts`
- Create: `src/features/characters/repository.ts`
- Create: `src/features/scenes/repository.ts`
- Create: `src/features/time-entries/repository.ts`
- Create: `src/features/plot-nodes/repository.ts`
- Create: `src/features/generation/repository.ts`
- Test: `tests/db/repositories.test.ts`

- [ ] Step 1: Write failing repository tests using an isolated temporary SQLite database.
- [ ] Step 2: Define tables for stories, elements, prototypes, characters, scenes, time_entries, plot_nodes, generation_runs, and join tables.
- [ ] Step 3: Implement migration runner.
- [ ] Step 4: Implement story repository create/get/list/update.
- [ ] Step 5: Implement element/prototype repositories.
- [ ] Step 6: Implement character, scene, and time entry repositories.
- [ ] Step 7: Implement plot node repository with ordered insert, reorder, and bindings to elements, characters, scenes, and time entries.
- [ ] Step 8: Implement generation run repository.
- [ ] Step 9: Run `npm test -- tests/db`; expected PASS.

## Task 4: Implement Prompt Snapshot Builder

**Files:**
- Create: `src/ai/prompt-builder.ts`
- Test: `tests/ai/prompt-builder.test.ts`

- [ ] Step 1: Write a failing test that builds a prompt snapshot containing story, current plot node, previous nodes, bound elements, characters, scenes, time entries, revision request, and `templateVersion: v1`.
- [ ] Step 2: Implement prompt snapshot construction as pure functions.
- [ ] Step 3: Write a failing test that the rendered prompt includes enough context for one node but does not include unrelated future nodes.
- [ ] Step 4: Implement prompt rendering.
- [ ] Step 5: Run `npm test -- tests/ai/prompt-builder.test.ts`; expected PASS.

## Task 5: Implement Direct AI Generation Service

**Files:**
- Create: `src/ai/provider.ts`
- Create: `src/features/generation/service.ts`
- Modify: `src/features/generation/repository.ts`
- Modify: `src/features/plot-nodes/repository.ts`
- Test: `tests/ai/generation-service.test.ts`

- [ ] Step 1: Write failing tests using a fake AI provider: successful generation creates a generation run, stores prompt snapshot, stores output, and moves node to `review_pending`.
- [ ] Step 2: Define an `AiProvider` interface with `generateText(prompt, options)`.
- [ ] Step 3: Implement generation service using dependency injection for provider and repositories.
- [ ] Step 4: Write failing tests for provider failure: generation run is `failed`, error is saved, node returns to `ready_to_generate`.
- [ ] Step 5: Implement failure handling and retry readiness.
- [ ] Step 6: Add a real provider implementation reading env variables, but keep tests mocked.
- [ ] Step 7: Run `npm test -- tests/ai/generation-service.test.ts`; expected PASS.

## Task 6: Build Minimal Workbench UI

**Files:**
- Create: `src/app/stories/page.tsx`
- Create: `src/app/stories/[storyId]/page.tsx`
- Create: `src/app/stories/[storyId]/nodes/[nodeId]/page.tsx`
- Create: `src/features/stories/actions.ts`
- Create: `src/features/elements/actions.ts`
- Create: `src/features/prototypes/actions.ts`
- Create: `src/features/characters/actions.ts`
- Create: `src/features/scenes/actions.ts`
- Create: `src/features/time-entries/actions.ts`
- Create: `src/features/plot-nodes/actions.ts`
- Create: `src/features/generation/actions.ts`
- Create: `src/components/FormButton.tsx`
- Create: `src/components/StatusBadge.tsx`
- Test: `tests/actions/workbench-actions.test.ts`

- [ ] Step 1: Write failing action tests for creating a story, adding an element, adding a character, adding a scene, adding a time entry, adding a plot node, binding records to the node, generating a node draft with a fake provider, approving a node, and rejecting a node with a revision request.
- [ ] Step 2: Implement server actions that call repositories and domain services.
- [ ] Step 3: Build a plain story overview page.
- [ ] Step 4: Build a plain story dashboard with element list, prototype list, character list, scene list, time entry list, plot node chain, and status badges.
- [ ] Step 5: Build node detail page with node fields, bindings for elements/characters/scenes/time entries, generate button, generated draft, approve/reject controls, and revision request field.
- [ ] Step 6: Run `npm test -- tests/actions/workbench-actions.test.ts`; expected PASS.
- [ ] Step 7: Run `npm run build`; expected PASS.

## Task 7: Add Seed Data and End-to-End Smoke Test

**Files:**
- Create: `scripts/seed-demo.ts`
- Create: `e2e/local-story-flow.spec.ts`
- Modify: `package.json`
- Create: `docs/local-runbook.md`

- [ ] Step 1: Create seed script for one science-fiction story, several elements, characters, scenes, time entries, and three plot nodes.
- [ ] Step 2: Write Playwright test for: open dashboard, create/edit node, trigger mocked generation path, approve node, reject another node with revision request.
- [ ] Step 3: Configure e2e test to use test database and fake AI provider mode.
- [ ] Step 4: Document local run commands in `docs/local-runbook.md`.
- [ ] Step 5: Run `npm run seed`; expected demo data inserted.
- [ ] Step 6: Run `npm run e2e`; expected PASS.
- [ ] Step 7: Run full verification: `npm run lint`, `npm test`, `npm run build`, `npm run e2e`; expected PASS.

## Work Package Prompts

### A: Engineering Foundation and Local Run Base

Read `docs/superpowers/specs/2026-05-14-local-story-workbench-design.md` and this plan. Implement only Task 1. Do not add authentication, cloud deployment, complex UI, or unrelated features. Return changed files, commands run, test results, blockers, and any contract change request.

### B: Domain Model and SQLite Persistence

Read the design spec and this plan. Implement Tasks 2 and 3 after package A is complete. Do not change shared contracts without a CONTRACT CHANGE REQUEST. Use TDD. Return changed files, commands run, test results, blockers, and any contract change request.

### C: Prompt Snapshots and Direct AI Generation

Read the design spec and this plan. Implement Tasks 4 and 5 after package B stabilizes. Mock AI in tests. Real provider credentials must come only from env. Return changed files, commands run, test results, blockers, and any contract change request.

### D: Minimal Web Workbench

Read the design spec and this plan. Implement Task 6 after B/C expose stable services. Keep UI plain and business-first. Do not introduce accounts, complex design system, or frontend-heavy abstractions. Return changed files, commands run, test results, blockers, and any contract change request.

### E: End-to-End QA and Seed Workflow

Read the design spec and this plan. Implement Task 7 once D is available. Verify the complete local business loop. Return changed files, commands run, test results, blockers, and any contract change request.
