# AGENTS.md

## Project
DocPrompter is a Google Docs add-on plus separate Apps Script web app that turns the current Google Doc into a presenter-friendly reading window for video calls.

This repository is the source of truth for the Apps Script project.

---

## Product intent

DocPrompter is:
- a reading aid for Zoom / Meet / Teams presentations
- optimized for a separate reader window
- focused on spoken readability over visual fidelity

DocPrompter is not:
- a hardware teleprompter clone
- a Google Slides speaker-notes tool
- a rich document editor
- an AI rewriting tool

---

## Architecture

The project has three main runtime layers:

1. Google Docs add-on / launcher
   - menu entry
   - Docs add-on homepage
   - launch bridge for the menu flow

2. Reader web app
   - standalone Apps Script web app page
   - loads normalized content using explicit `docId`
   - supports highlighting, auto-scroll, keyboard stepping, refresh, and theme/focus state

3. Modular source layout
   - add-on server code split into focused `.gs` files
   - reader server code split into focused `.gs` files
   - reader UI split into HTML include modules for markup, script, and CSS layers

Key entry shells:
- `Code.gs`: Docs launcher / add-on public entry points
- `ReaderServer.gs`: public reader-server entry points
- `ReaderView.html`: reader page shell
- `ReaderStyles.html`: reader styles shell
- `appsscript.json`: Apps Script manifest

---

## Core design rules

### 1. Keep the add-on thin
Do not add complex product logic to the Docs launcher if it belongs in the reader.

### 2. Prefer explicit `docId`
Do not rely on `getActiveDocument()` in standalone reader flows when `docId` can be passed explicitly.

### 3. Whole document only
The supported launch path is the whole active document.
Do not reintroduce selection-mode launch or snapshot behavior unless that product decision is made explicitly.

### 4. Preserve wording
Do not rewrite the user’s script.
Light cleanup for readability is fine.
Aggressive summarization or paraphrasing is out of scope unless explicitly requested.

### 5. Spoken readability beats formatting fidelity
When there is a tradeoff, favor a structure that reads well aloud.

### 6. Prefer stable identifiers
When possible, derive section and line IDs from structural context so refresh and position restoration are more robust.

### 7. Keep the reader keyboard-first
Do not break:
- Space = play/pause
- Left / Up = back one line
- Right / Down = forward one line

### 8. Persist reader preferences
Preserve useful local state such as:
- theme
- focus mode
- speed
- font size
- line alignment

---

## Deployment rules

### Source of truth
GitHub is the source of truth.
Do not make unreviewed changes directly in the Apps Script editor and leave the repo behind.

### Deployment model
Prefer:
- checks on every push / PR
- controlled deploys via `clasp`
- versioned deployments for releases

Do not assume every push should immediately become the live public deployment.

### Manifest discipline
If scopes or add-on behavior change, update `appsscript.json` intentionally and document why.

### CI/CD caution
Apps Script deployment auth can be brittle in CI.
Prefer robust, explicit deployment workflows over clever but fragile automation.

---

## Change management

When making changes:
1. increment the version number and update the changelog section.
2. preserve existing behavior unless the change explicitly intends to alter it.
3. document new assumptions in `README.md`.
4. add or update manual test notes when behavior changes are user-visible.

---

## Testing expectations

At minimum, validate:
- full-document launch
- popup behavior
- current-line highlighting
- keyboard stepping
- play/pause
- refresh
- section jump
- theme persistence
- focus mode persistence

If touching normalization logic, also validate:
- headings
- lists
- repeated lines
- tables with and without header rows

---

## Guardrails for agents

Do:
- make tightly scoped edits
- preserve product intent
- prefer additive/localized changes
- call out uncertainty explicitly
- update docs when changing behavior

Do not:
- silently remove working launch paths without documenting the tradeoff
- introduce AI rewriting behavior
- over-engineer real-time sync
- assume Apps Script runtime behavior without noting deployment risk
- overwrite the changelog or version history carelessly

---

## Notes for future agents

Known fragile areas:
- Apps Script add-on runtime behavior across surfaces
- CI authentication for `clasp`
- launch bridge behavior across popup settings and browsers
- refresh position restoration after content edits
- table normalization assumptions

If changing these areas, explain the tradeoff in the PR or README.
