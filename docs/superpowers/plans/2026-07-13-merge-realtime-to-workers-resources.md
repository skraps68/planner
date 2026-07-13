# Merge `realtime-collaboration` → `workers-resources` — Plan

**Date:** 2026-07-13
**Type:** Git integration runbook (not a code-implementation plan)

## Goal

Merge the completed `realtime-collaboration` branch back into the branch it
split from, `workers-resources`.

## Verified current state (as of writing)

| Branch | Tip | Note |
|---|---|---|
| `main` | `6bb7af1` | default branch; has `origin/main` |
| `nav-redesign` | `ecec75a` | +47 over main; has `origin/nav-redesign` |
| `workers-resources` | `c78f63f` | the split point; **local-only, no remote** |
| `realtime-collaboration` | `c916214` | +31 over workers-resources; tracks `origin/realtime-collaboration` |

**Split point** = `git merge-base workers-resources realtime-collaboration` = `c78f63f`, which is *also* `workers-resources`'s current tip.

**Consequence — this is a fast-forward merge.** `workers-resources` is a strict
ancestor of `realtime-collaboration` (workers-resources ahead: 0,
realtime-collaboration ahead: 31). There are **no divergent commits and thus no
possible merge conflicts**. Merging simply advances `workers-resources` to
`c916214` (optionally via a merge commit — see decision below).

**Working tree:** clean. `realtime-collaboration` is pushed and in sync with its remote.

## The one decision: fast-forward vs. merge commit

- **`--no-ff` (recommended):** creates an explicit "Merge branch
  'realtime-collaboration' into workers-resources" commit. Preserves the feature
  boundary — you can see in history that 31 commits arrived as one integrated
  feature, and reverting the whole feature later is a single `git revert -m 1`.
- **Fast-forward (default `git merge`):** no merge commit; `workers-resources`
  just becomes `c916214`. Simpler, linear history, but the feature boundary is
  only implicit.

Given this is a substantial, self-contained feature (real-time collaboration,
16 tasks), `--no-ff` is the better default. Steps below use it; drop the flag
for a plain fast-forward.

## Pre-merge checklist

1. **Confirm clean tree & correct branch state:**
   ```bash
   git status                        # expect: clean
   git rev-parse workers-resources   # expect: c78f63f (unchanged split point)
   git rev-list --left-right --count workers-resources...realtime-collaboration
   # expect: "0   31"  (ff still valid)
   ```
2. **Record a rollback anchor** (ff is safe + reflog exists, but be explicit):
   ```bash
   git tag pre-merge-workers-resources workers-resources
   ```
3. **Sanity-verify the source tip is healthy** (it was verified live this
   session; this is a re-confirm). Redis must be reachable from the app
   container (`REDIS_HOST=redis`):
   ```bash
   # backend realtime suites
   docker exec -e REDIS_HOST=redis planner-app python -m pytest \
     tests/unit/test_realtime_*.py tests/integration/test_realtime_*.py -q
   # frontend realtime + touched pages
   cd frontend && npx vitest run src/realtime/ \
     src/pages/resources src/pages/workers \
     src/pages/portfolios src/pages/programs src/pages/projects
   ```
   **"Green" = no NEW failures vs. the pre-existing debt** documented in the
   `test-repair-backlog` memory (the repo has known-failing suites unrelated to
   this feature — e.g. `ResourceAssignmentCalendar.*` provider-drift). Do not
   block the merge on those; block only on a failure this branch introduced.

## Merge steps

```bash
git checkout workers-resources
git merge --no-ff realtime-collaboration -m "Merge realtime-collaboration: real-time collaboration & concurrency + resource/detail UI"
git --no-pager log --oneline -3        # confirm the merge commit sits on top
git --no-pager log --graph --oneline -8 # optional: see the merged topology
```

Expected: `workers-resources` now contains all 31 commits; HEAD is the new merge
commit whose second parent is `c916214`.

## Post-merge verification

```bash
git status                    # clean
# Re-run the same suites as the pre-merge check (code is identical to the
# source tip, so results should match). Optionally drive the app once more:
#   - resources list live-updates across two sessions (SSE)
#   - lock banner + take-over on the resource calendar
#   - worker-name hyperlink + "Back to Resource"
#   - portfolio/program/project detail ID alignment
```

## Publish / cleanup (optional, your call)

- **Push `workers-resources`** (it has no remote yet):
  ```bash
  git push -u origin workers-resources
  ```
- **Keep or retire the feature branch.** After the merge, `realtime-collaboration`
  is fully contained in `workers-resources`. You can keep it or delete it:
  ```bash
  git branch -d realtime-collaboration           # local (safe: already merged)
  git push origin --delete realtime-collaboration # remote, only if retiring it
  ```
- **Drop the rollback tag** once satisfied: `git tag -d pre-merge-workers-resources`.

## Rollback

If anything looks wrong after merging (before pushing):
```bash
git checkout workers-resources
git reset --hard pre-merge-workers-resources   # back to c78f63f
```
(Or `git reflog` → reset to the pre-merge entry if the tag was skipped.)

## Wider context — this is one step down a stack

The branch stack is `main → nav-redesign → workers-resources → realtime-collaboration`.
This plan only collapses the top link (realtime → workers-resources). Fully
landing the work still requires, later and separately:
`workers-resources → nav-redesign → main`. Each of those is its own integration
decision and out of scope here.

## Environment note (not a merge step)

The real-time feature needs Redis reachable from the backend. The dev fix for
that (`REDIS_HOST=redis`) lives in the **gitignored `.env`**, so it is *not*
carried by the branch. Any environment running this code live must set
`REDIS_HOST=redis` (compose default) — otherwise realtime degrades off (which is
safe by design, but the feature won't be exercisable).
