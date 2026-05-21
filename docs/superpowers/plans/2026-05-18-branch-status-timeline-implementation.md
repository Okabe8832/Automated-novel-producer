# Branch Status Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact per-branch plot-unit timeline to `/novel-branch-status` while preserving existing file-count and artifact-status output.

**Architecture:** Extend `src/novel-production/branch-status.ts` to read only `plot-units.json` metadata for each branch and precompute display labels. Render a new `## Branch Timeline` section before existing detailed branch sections. Update command documentation and tests.

**Tech Stack:** TypeScript, Vitest, Node fs helpers, existing novel-production branch repository APIs.

---

## File Structure

- Modify `src/novel-production/branch-status.ts`: add exported `NovelBranchPlotUnitStatus`, branch timeline fields, plot-unit metadata loader, timeline renderer.
- Modify `tests/novel-production/branch-status.test.ts`: add timeline rendering, ordering, active marker, empty/missing/unavailable cases, and no-content-read sentinel coverage.
- Modify `.opencode/commands/novel-branch-status.md`: document the timeline and metadata-only behavior.
- Modify `tests/novel-production/opencode-assets.test.ts`: assert command documentation mentions timeline and metadata/no-content-read behavior.

## Task 1: Timeline Data Model and Rendering

**Files:**
- Modify: `src/novel-production/branch-status.ts`
- Test: `tests/novel-production/branch-status.test.ts`

- [ ] **Step 1: Write failing timeline rendering test**

Add a test that creates two branches, saves plot units with unsorted `orderIndex`, and asserts rendered markdown contains:

```text
## Branch Timeline
branch01: ch01(drafted) ── ch02(approved)
branch02*: ch01(ready_to_produce)
```

Also assert existing detailed output like `drafts:` and `requirements.json:` remains present.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- tests/novel-production/branch-status.test.ts -t "Branch Timeline"
```

Expected: FAIL because no timeline is rendered.

- [ ] **Step 3: Implement timeline model and renderer**

In `src/novel-production/branch-status.ts`:

- Import `parsePlotUnits` and `type PlotUnitStatus` from `./schema`.
- Export:

```ts
export type NovelBranchPlotUnitStatus = {
  label: string;
  status: PlotUnitStatus;
};
```

- Extend `NovelBranchStatusBranch` with:

```ts
plotUnits: NovelBranchPlotUnitStatus[];
plotUnitsAvailable: boolean;
```

- In `buildBranchStatus`, load plot units only when the workspace exists.
- Sort units by `orderIndex` and map to `ch01`, `ch02`, etc.
- Add `## Branch Timeline` to `renderNovelBranchStatusMarkdown` before branch details.
- Use `branchId*` for active branches.
- Use ` ── ` between units.
- Render `no plot units` when available but empty or workspace missing.

- [ ] **Step 4: Run test to verify pass**

Run:

```bash
npm test -- tests/novel-production/branch-status.test.ts -t "Branch Timeline"
```

Expected: PASS.

## Task 2: Unavailable Plot Units and No-Content-Read Coverage

**Files:**
- Modify: `src/novel-production/branch-status.ts`
- Test: `tests/novel-production/branch-status.test.ts`

- [ ] **Step 1: Write failing unavailable plot-units tests**

Add tests for:

- Missing branch workspace keeps existing warning and renders `branch01: no plot units`.
- Missing `plot-units.json` renders `branch01: plot units unavailable` and branch warning mentions plot units.
- Malformed `plot-units.json` renders `plot units unavailable` and branch warning mentions plot units.
- Unreadable `plot-units.json` renders `plot units unavailable` and branch warning mentions plot units instead of throwing.

- [ ] **Step 2: Write failing no-content-read sentinel test**

Create a branch with valid plot units. Make non-metadata content files unreadable, or spy on content reads if chmod is unreliable on the platform. Cover:

- draft file
- review JSON file
- repair task JSON file
- generation run JSON file
- manuscript
- production report

Build and render branch status. Assert status still renders the timeline and detailed file counts/artifact presence without throwing. This proves the status builder does not read those content files.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- tests/novel-production/branch-status.test.ts
```

Expected: FAIL until unavailable handling is implemented.

- [ ] **Step 4: Implement unavailable handling**

Add helper:

```ts
async function loadPlotUnitTimeline(path: string): Promise<{ available: true; units: NovelBranchPlotUnitStatus[] } | { available: false; warning: string }> { ... }
```

Behavior:

- Missing, malformed, or unreadable `plot-units.json` returns unavailable with warning.
- Missing workspace bypasses loading and returns available empty units with the existing workspace warning.
- Other unexpected errors outside plot-unit loading may still throw.

- [ ] **Step 5: Run branch-status tests**

Run:

```bash
npm test -- tests/novel-production/branch-status.test.ts
```

Expected: PASS.

## Task 3: Command Documentation and Verification

**Files:**
- Modify: `.opencode/commands/novel-branch-status.md`
- Modify: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing command asset assertions**

In `tests/novel-production/opencode-assets.test.ts`, update the branch-status command test to assert the command mentions:

- `timeline`
- `plot-units.json`
- `Do not read draft or review contents`

- [ ] **Step 2: Run failing asset test**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts -t "branch-status command"
```

Expected: FAIL until command doc is updated.

- [ ] **Step 3: Update command doc**

Update `.opencode/commands/novel-branch-status.md` to mention:

- It shows a compact branch timeline.
- The timeline reads `plot-units.json` metadata only.
- It still reports file counts and artifact existence.
- It does not read draft/review/repair/generation/report/manuscript contents.

- [ ] **Step 4: Run asset test**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts -t "branch-status command"
```

Expected: PASS.

## Task 4: Final Verification and Review

**Files:**
- All changed files

- [ ] **Step 1: Run targeted branch-status tests**

Run:

```bash
npm test -- tests/novel-production/branch-status.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run asset tests**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run LSP diagnostics if available**

Run diagnostics on changed TypeScript files. If the language server is unavailable, record the tool error.

- [ ] **Step 6: Request final review**

Ask Oracle to review the spec, implementation, tests, and verification output.

Expected: APPROVED.
