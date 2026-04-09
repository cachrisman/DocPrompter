# DocPrompter

DocPrompter is a Google Docs add-on plus separate Apps Script web app that turns the current Google Doc, or the current selection, into a presenter-friendly reading window for Zoom, Google Meet, Teams, and similar video calls.

This is not meant to be a hardware teleprompter clone. It is a reading aid for scripts and speaker copy that live in Google Docs.

---

## Product summary

### Goal
Help a presenter read a script smoothly during a video call while keeping the source of truth in Google Docs.

### Positioning
- Not an in-Docs teleprompter
- Not a Slides speaker-notes tool
- Not a text-to-speech add-on
- A Google Docs-to-reading-window workflow optimized for presenting on calls

### Primary use case
A user writes or rehearses a presentation script in Google Docs, launches DocPrompter, chooses either the current selection or the full document, and opens a separate reading window that is easy to position near the camera.

---

## MVP feature set

### Launcher behavior
- Google Docs menu item: `DocPrompter -> Open Reading View`
- Small launch dialog for source choice
- `Selection` is the default when a selection exists
- Falls back to `Entire document` when there is no selection
- Opens a separate browser tab or window

### Reading window behavior
- Separate web view only
- Automatic scrolling by default
- Manual line stepping at any time
- Current-line visual indicator
- Reading progress
- Estimated time remaining
- Jump to section
- Refresh from source doc
- Optional polling-based refresh
- Light and dark themes
- Focus mode that fades controls unless hovered

### Keyboard shortcuts
- `Space` = play/pause
- `Left Arrow` or `Up Arrow` = back one line
- `Right Arrow` or `Down Arrow` = forward one line
- `[` = slower
- `]` = faster
- `R` = refresh
- `D` = toggle dark mode
- `F` = toggle focus mode

### Content transformation rules
Preserve:
- headings
- paragraphs
- line breaks
- lists

Transform lightly:
- normalize spacing
- wrap long lines into readable chunks
- convert tables into readable row-grouped text

Ignore or simplify:
- most inline styles
- rich visual fidelity

Do not:
- rewrite the wording
- summarize the script
- turn the source document into a different artifact

---

## Non-goals

Not included in MVP:
- editing from the reading view
- true mirror mode for reflective teleprompters
- always-on-top window control
- transparent or semi-transparent browser windows
- remote control
- aggressive AI rewriting
- exact preservation of Google Docs formatting

---

## User stories

### Core
- As a presenter, I want to launch a reading view directly from the Google Doc I am working on.
- As a presenter, I want the current selection to be the default source when I have highlighted text.
- As a presenter, I want a separate reading window I can position near my camera during a video call.
- As a presenter, I want automatic scrolling so I can read naturally.
- As a presenter, I want keyboard shortcuts to pause and move line by line.
- As a presenter, I want the current line clearly indicated.
- As a presenter, I want the script rendered in a way that reads naturally aloud.
- As a presenter, I want to refresh the window as I edit the underlying doc during practice.

### Nice to have
- As a presenter, I want moderate-latency updates while I rehearse.
- As a presenter, I want an estimate of time remaining.
- As a presenter, I want a low-chrome focus mode.

---

## Technical design

### Architecture
DocPrompter is split into two parts:

1. **Google Docs add-on layer**
   - Adds the menu item
   - Shows the launch UI
   - Detects active selection
   - Generates the launch context
   - Caches selection payloads for handoff

2. **Reading web app**
   - Opens as a separate Apps Script web app page
   - Receives explicit `docId`, `sourceMode`, and optional `selectionToken`
   - Loads normalized content
   - Renders the reader UI
   - Manages scrolling, highlighting, progress, navigation, and refresh

### Why the split exists
Google Docs add-ons are good for discovery and launch, but the actual reader experience is much better in a separate web view. The add-on stays thin; the reader gets the product attention.

---

## Key design decisions

### 1. Separate web view instead of sidebar
Reason:
- Better for video-call use
- Better screen positioning near the camera
- Fewer Google Docs UI constraints

### 2. Explicit `docId` instead of `getActiveDocument()` in the reader
Reason:
- The reader is a standalone web app, not always tied to the active editor execution context
- Passing `docId` makes document loading reliable via `DocumentApp.openById(docId)`

### 3. Cached selection handoff
Reason:
- Selection state is tricky to reconstruct once the reader is detached from the editor session
- The launch dialog serializes the current selection into a normalized payload and stores it in user cache
- The reader receives a `selectionToken` and uses the cached payload if available

Tradeoff:
- Selection snapshots are not fully live after launch
- Full-document mode remains the more robust path for refresh-heavy workflows

### 4. Normalized content model instead of raw Docs HTML
Reason:
- Easier to render consistently
- Easier to highlight the current line
- Easier to calculate progress
- Easier to jump by heading
- Easier to convert tables into spoken-readable text

### 5. Spoken readability over visual fidelity
Reason:
- The product goal is not to reproduce the doc layout exactly
- The goal is to help a human read the content aloud smoothly

### 6. Manual refresh plus lightweight polling
Reason:
- The desired sync fidelity is medium, not real-time collaborative editing
- Manual refresh is reliable
- Polling every few seconds is simple enough for MVP

### 7. Line-based interaction model
Reason:
- Current-line highlighting depends on stable line units
- Keyboard stepping is simpler and more predictable line-by-line than paragraph-by-paragraph
- Progress and ETA calculations become straightforward

---

## Data model

The server normalizes content into two related structures:

- `sections`: for navigation and headings
- `lines`: for display, highlighting, keyboard stepping, and progress

Example conceptual payload:

```json
{
  "title": "Quarterly Demo Script",
  "sourceMode": "document",
  "version": "abc123",
  "sections": [
    {
      "id": "sec-1",
      "type": "heading",
      "text": "Opening",
      "levelNumber": 1,
      "firstLineIndex": 0
    }
  ],
  "lines": [
    {
      "id": "line-1",
      "sectionId": "sec-1",
      "kind": "heading",
      "text": "Opening"
    }
  ]
}
```

---

## File overview

### `Code.gs`
Adds the Docs menu and opens the launch dialog.

### `Launch.html`
Launch UI that checks for a selection, defaults source choice, and opens the reader with the correct query parameters.

### `ReaderServer.gs`
Server-side logic for:
- launch context
- reader preparation
- explicit document loading by `docId`
- selection caching
- normalization
- version token generation

### `ReaderView.html`
Reader UI and all browser-side interaction logic.

### `ReaderStyles.html`
Reader styles include used by the reader template for current-line highlighting, dark mode, and focus mode.

---

## Current implementation notes

### OAuth scope requirement
The reader launch flow calls `ScriptApp.getService().getUrl()`, so the manifest must include:

- `https://www.googleapis.com/auth/script.scriptapp`

Without that scope, both the custom menu launcher and the add-on card launcher will fail at runtime.

### Current launch recommendation
For the current MVP, the **custom Docs menu** is still the most predictable launch path.
The **Docs add-on homepage** is supported, but it should stay secondary until a real deployed runtime pass confirms the card-flow behavior across the intended surfaces.

### Selection mode caveat
Selection mode is handled as a launch-time snapshot using cache. That is intentional. It is reliable enough for MVP, but it is not a live evolving selection.

### Version token caveat
The current version token is derived from document ID plus body-text characteristics. It is good enough for polling-based change detection, but it is not a formal document revision ID.

### Browser window caveat
The app opens in a new tab or window depending on browser behavior and popup settings. It does not control always-on-top or transparency.

### Web app access caveat
The committed manifest currently uses `webapp.access = MYSELF`.
That is appropriate for owner-only development, but it must be widened intentionally before broader internal or external testing.

---

## Acceptance criteria

The MVP is complete when:
- a user can launch from Google Docs
- a user can choose selection or full document
- a separate reader opens
- headings, paragraphs, lists, and table rows render readably
- one current line is visually highlighted
- keyboard shortcuts work
- auto-scroll works
- progress is visible
- section jumps work
- refresh works
- polling can detect changes and refresh the view

---

## Recommended next steps

### Near-term improvements
- Persist reading position / resume state per document
- Add optional countdown timer based on custom speaking rate
- Add click-to-set-active-line
- Add a compact “camera-adjacent narrow mode” preset
- Add section-level collapse for long docs

### Stretch ideas
- Pause markers and emphasis cues authored directly in the doc
- Optional AI suggestions for awkward phrasing, but never auto-rewrite
- Better large-doc rendering with virtualization
- Multi-window presenter mode

---

## Suggested deployment flow

1. Create a new Google Apps Script project
2. Add these files:
   - `Code.gs`
   - `ReaderServer.gs`
   - `Launch.html`
   - `ReaderView.html`
   - `ReaderStyles.html`
   - `appsscript.json`
3. Bind the script to a Google Doc during development, or package it as an Editor Add-on later
4. Run `onOpen()` once with permissions
5. Reload the doc and use the `DocPrompter` menu

---

## Final product one-liner

Turn the current Google Doc or selected text into a clean presenter reading window for video calls.

## Runtime hardening pass

This version reduces add-on runtime brittleness in a few important ways:

- The add-on homepage now prefers **OpenLink** actions for “Open full document” and “Open current selection” instead of relying on opening a Docs modal dialog from a card action. That is generally more reliable across add-on surfaces.
- The launch dialog is still available for the bound-script custom menu flow inside Google Docs.
- The separate reader now relies on an explicit **docId** and uses `DocumentApp.openById(docId)` instead of assuming an active editor context.
- The web app is configured to run as **USER_ACCESSING**, which is a safer fit for reading the current user’s document in the separate reader flow.
- Selection mode is intentionally a launch-time snapshot using a cached `selectionToken`. This avoids fragile assumptions about the current live selection once the separate reader window is open.

### Practical recommendation

Use the project in this order of preference:

1. **Inside a Google Doc via the custom menu** for the smoothest MVP workflow
2. **Inside the Docs add-on card homepage** using “Open full document” or “Open current selection”
3. Treat “Open launch dialog” from the card surface as a convenience fallback, not the primary path

### Known limitations that remain

- Browser behavior still decides whether the reader opens as a new window or a new tab.
- The add-on cannot reliably force always-on-top or window transparency.
- Selection mode is a snapshot, not a live changing range.
- Polling-based refresh is intentionally moderate, not realtime.

---

## Changelog

### v3.5.3 (2026-04-09)
- Fixed the reader stylesheet include so `ReaderStyles.html` is injected correctly by `ReaderView.html`.
- Fixed popup-blocker handling in `Launch.html` so the dialog stays open and shows an explicit error when the reader window is blocked.
- Switched selection deduplication and section IDs to structural element keys so repeated identical lines are preserved more reliably and restore markers are less brittle.
- Corrected repo docs to match the real source tree, current rollout recommendation, and current web-app access model.
- Ignored local clasp config files so the initial commit does not accidentally bind the repo to a local Apps Script project.

### v3.5.2 (2026-04-09)
- Rebuilt the sandbox archive with the README changelog restored.
- No intended product behavior changes.

### v3.4
- Added missing `script.scriptapp` OAuth scope to the Apps Script manifest.
- Fixed popup-blocker handling in `Launch.html` so users do not get a false success message.
- Reworked selection deduplication to use structural element paths instead of text identity, preventing repeated identical lines from being dropped.
- Made section and line IDs more structurally stable across refreshes by incorporating element path keys.
- Documented the current MVP assumption that multi-row tables use row 0 as a header row.
- Added deployment/test blocker notes and clarified the long-term primary add-on flow.

### v3.3
- Fixed launch handoff bugs in the custom menu flow.
- Disabled polling for selection snapshots.
- Improved refresh restore behavior and body-text version hashing.

### v3.2
- Added UI state persistence for theme, focus mode, speed, and font size.
- Clarified that Workspace Add-on card flow is the preferred long-term launch path.

### v3.1
- Added deployment checklist, QA plan, and backlog documentation.

### v3.0
- Hardened the reader around explicit `docId` handoff and `DocumentApp.openById(docId)`.
- Added selection snapshot caching, polling-based refresh, and focus mode.
