# DocPrompter

DocPrompter is a Google Docs add-on plus separate Apps Script web app that turns the current Google Doc into a presenter-friendly reading window for Zoom, Google Meet, Teams, and similar video calls.

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
A user writes or rehearses a presentation script in Google Docs, launches DocPrompter, and opens a separate reading window that is easy to position near the camera.

---

## MVP feature set

### Launcher behavior
- Google Docs menu item: `Extensions -> DocPrompter -> Open Reader`
- Whole-document launch only
- No source chooser and no selection mode
- Opens a separate browser tab or window
- Docs add-on homepage also offers a direct `Open Reader` action

### Reading window behavior
- Separate web view only
- Automatic scrolling by default
- Manual line stepping at any time
- Click any line to make it active
- Double-click any line to start playback from there
- Jump to beginning / end controls
- Current-line visual indicator
- Reading progress
- Estimated time remaining
- Elapsed time and estimated total read time
- Persistent current-section context near progress
- Jump to section
- Refresh from source doc
- Optional polling-based refresh
- Light and dark themes
- Focus mode that hides secondary chrome after idle
- Left-aligned or centered reading text
- Built-in help overlay for shortcuts and controls

### Keyboard shortcuts
- `Space` = play/pause
- `Left Arrow` or `Up Arrow` = back one line
- `Right Arrow` or `Down Arrow` = forward one line
- `Home` = jump to beginning
- `End` = jump to end
- `[` = slower
- `]` = faster
- `R` = refresh
- `?` = show or hide help
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
- alternate launch scopes beyond the active document
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
DocPrompter is split into three runtime layers:

1. **Google Docs add-on layer**
   - adds the menu item
   - exposes the Docs add-on homepage
   - launches the detached reader for the active doc

2. **Launch bridge**
   - a small Apps Script HTML surface used only for menu-triggered launch
   - opens the detached reader tab/window and closes itself
   - exists because Docs menu callbacks cannot directly open browser tabs by themselves

3. **Reading web app**
   - opens as a separate Apps Script web app page
   - receives explicit `docId`
   - loads normalized content
   - renders the reader UI
   - manages scrolling, highlighting, progress, navigation, refresh, and diagnostics

### Why the split exists
Google Docs add-ons are good for discovery and launch, but the actual reader experience is much better in a separate web view. The add-on stays thin; the reader gets the product attention.

### Key design decisions

#### 1. Separate web view instead of sidebar
Reason:
- Better for video-call use
- Better screen positioning near the camera
- Fewer Google Docs UI constraints

#### 2. Explicit `docId` instead of `getActiveDocument()` in the reader
Reason:
- The reader is a standalone web app, not always tied to the active editor execution context
- Passing `docId` makes document loading reliable via `DocumentApp.openById(docId)`

#### 3. Whole-document-only launch
Reason:
- Reduces launch complexity and deployment/runtime brittleness
- Removes chooser UI, selection cache lifecycle, and detached selection-state ambiguity
- Keeps the product aligned with the most reliable reading and refresh path

#### 4. Normalized content model instead of raw Docs HTML
Reason:
- Easier to render consistently
- Easier to highlight the current line
- Easier to calculate progress
- Easier to jump by heading
- Easier to convert tables into spoken-readable text

#### 5. Spoken readability over visual fidelity
Reason:
- The product goal is not to reproduce the doc layout exactly
- The goal is to help a human read the content aloud smoothly

#### 6. Manual refresh plus lightweight polling
Reason:
- The desired sync fidelity is medium, not real-time collaborative editing
- Manual refresh is reliable
- Polling every few seconds is simple enough for MVP

#### 7. Line-based interaction model
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

### Entry shells
- `Code.gs`: public Docs add-on entrypoints
- `ReaderServer.gs`: public reader/server entrypoints
- `ReaderView.html`: reader page shell
- `ReaderStyles.html`: reader styles shell

### Add-on modules
- `AddonEntrypoints.gs`: `onOpen`, `onInstall`, and menu-triggered launch
- `AddonMenu.gs`: editor add-on menu construction
- `AddonHome.gs`: Docs add-on homepage card
- `AddonActions.gs`: add-on homepage open-link action and menu launch bridge
- `LaunchBridge.html`: small auto-launch page used by the Docs menu flow

### Reader server modules
- `ReaderConfig.gs`: server constants and scope values
- `ReaderLaunch.gs`: reader URL resolution and whole-document launch payload
- `ReaderDocument.gs`: `doGet`, payload fetch, version fetch, and document open
- `ReaderDiagnostics.gs`: logging, runtime snapshots, auth snapshots, and sanitization
- `ReaderNormalization.gs`: body parsing, paragraph/list/table processing, and display-line splitting
- `ReaderIdentity.gs`: section IDs, line IDs, structural keys, and version token helpers

### Reader client includes
- `ReaderMarkup.html`: page markup
- `ReaderConfigScript.html`: client constants and bootstrap normalization
- `ReaderDomScript.html`: state and DOM references
- `ReaderUtilsScript.html`: formatting and numeric helpers
- `ReaderPrefsScript.html`: local preference load/save and preference UI application
- `ReaderUiScript.html`: status, help, alignment, theme, focus, and inline control editors
- `ReaderTimingScript.html`: playback timing, scroll animation, and ETA math
- `ReaderRenderScript.html`: payload rendering, active-line logic, and progress display
- `ReaderDataScript.html`: payload fetch, polling, and diagnostics fetch
- `ReaderEventsScript.html`: event binding and keyboard/mouse/input handling
- `ReaderBootstrapScript.html`: startup sequence
- `ReaderBaseCss.html`, `ReaderLayoutCss.html`, `ReaderLineCss.html`, `ReaderOverlayCss.html`, `ReaderControlsCss.html`, `ReaderResponsiveCss.html`: split reader style layers

### Manifest
- `appsscript.json`: Apps Script manifest and add-on/web-app configuration

---

## Current implementation notes

### Reader URL requirement
The standalone add-on and the detached reader are two deployment surfaces.
DocPrompter supports an explicit script property handoff:

- `DOCPROMPTER_READER_WEB_APP_URL`

That property should contain the deployed reader web app `/exec` or `/dev` URL.
If the property is not set, the launch flow falls back to `ScriptApp.getService().getUrl()`, so the manifest still includes:

- `https://www.googleapis.com/auth/script.scriptapp`

Without either a configured reader URL or a same-project web app deployment, the add-on cannot open the detached reader.

### Menu launch note
The Docs menu path is whole-document-only and uses a tiny HTML launch bridge internally. That bridge exists only because Apps Script menu callbacks cannot directly open a browser tab by themselves.

### Diagnostics scope
The manifest also includes:

- `https://www.googleapis.com/auth/userinfo.email`

That scope is used only for detached-reader diagnostics so execution logs and the in-reader debug panel can report which account context the web app is actually running under.

### Current launch recommendation
For the current standalone MVP, the **editor add-on menu under `Extensions -> DocPrompter -> Open Reader`** is the primary launch path.
The **Docs add-on homepage** is supported, but it should stay secondary until a real deployed runtime pass confirms the card-flow behavior across the intended surfaces.

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
- a separate reader opens for the active document
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
2. Add the full `src/` tree from this repo
3. Create a **Web app** deployment for the reader
4. Copy the deployed `/exec` URL into the script property `DOCPROMPTER_READER_WEB_APP_URL`
5. Create or update the **Editor add-on** test deployment
6. Open the test doc, refresh it if needed, and use `Extensions -> DocPrompter -> Open Reader`

---

## Final product one-liner

Turn the current Google Doc into a clean presenter reading window for video calls.

## Runtime hardening pass

This version reduces add-on runtime brittleness in a few important ways:

- The add-on and reader code are split into focused Apps Script and HTML include modules instead of two monolithic files.
- The product now uses one launch path only: whole-document reader launch with explicit `docId`.
- The Docs menu no longer uses a chooser dialog and the add-on homepage no longer branches between document and selection actions.
- The separate reader relies on explicit `docId` and uses `DocumentApp.openById(docId)` instead of assuming an active editor context.
- The web app is configured to run as **USER_ACCESSING**, which is a safer fit for reading the current user’s document in the separate reader flow.
- The standalone add-on uses `createAddonMenu()` and `onInstall(e)` so the menu appears in the expected editor add-on surface.
- The detached reader supports an explicit `DOCPROMPTER_READER_WEB_APP_URL` script property so the add-on and reader deployments can be wired together intentionally.

### Practical recommendation

Use the project in this order of preference:

1. **Inside a Google Doc via `Extensions -> DocPrompter -> Open Reader`** for the smoothest MVP workflow
2. **Inside the Docs add-on card homepage** using `Open Reader`

### Known limitations that remain

- Browser behavior still decides whether the reader opens as a new window or a new tab.
- The add-on cannot reliably force always-on-top or window transparency.
- Polling-based refresh is intentionally moderate, not realtime.

---

## Changelog

### v3.6.1 (2026-04-10)
- Changed paragraph normalization to prefer sentence-aware display lines, with clause-level fallback only when a single sentence still exceeds the display limit.
- Stopped the orphan rebalancer from peeling words off sentence-complete lines, so natural breaks like `team:` stay attached to the sentence they belong to.
- Retuned the reader playback baseline and distance smoothing so the `0.5` to `1.5` speed range maps more closely to human speaking pace and produces steadier scroll velocity.

### v3.6.0 (2026-04-10)
- Refactored the Apps Script repo into focused server modules, reader script includes, and reader CSS layers so the project is substantially easier to navigate and maintain.
- Removed the source chooser, `Launch.html`, and all selection-snapshot plumbing so DocPrompter now launches the whole document only.
- Simplified the reader web-app contract to explicit `docId` handoff only.
- Replaced the menu chooser flow with a lightweight launch bridge so `Extensions -> DocPrompter -> Open Reader` opens the detached reader directly.

### v3.5.11 (2026-04-10)
- Forced explicit left alignment on reader lines and moved centered mode onto the line elements themselves so left-aligned reading no longer inherits stale centering.
- Rebuilt the footer layout so the transport controls stay anchored to the viewport center while the speed, font, and alignment controls stack vertically on the left.
- Retuned playback timing to a word-based estimate with lighter wrap weighting so autoplay and ETA no longer stall on large wrapped lines.
- Made `Space` commit any open inline control editor and toggle playback even when focus is still inside a reader control.

### v3.5.10 (2026-04-10)
- Corrected the alignment control so it shows the current alignment state instead of the toggle action, and reset older saved alignment state to left-aligned reading to avoid reopening in the previously misleading centered-line mode.

### v3.5.9 (2026-04-10)
- Fixed the reader footer geometry so long current-section labels are constrained inside a fixed progress column instead of shifting the bottom bar layout.
- Tightened spacing between wrapped display chunks, preserved larger gaps only for real source line breaks, and carried source-break metadata through the server-side line splitter.
- Retuned autoplay pacing so speed acts as a wider multiplier range while the ETA and playback cadence still adapt to measured wrap depth and larger font sizes.
- Added inline numeric editing for the speed and font controls so clicking the displayed value opens a direct-entry field.

### v3.5.8 (2026-04-09)
- Added a built-in `?` help overlay that opens automatically on first use and documents the main reader controls and shortcuts.
- Added click-to-activate and double-click-to-play behavior on reader lines so navigation can stay lightweight even without the footer controls.
- Added persistent current-section context plus elapsed/total timing readouts beside the existing progress and ETA indicators.
- Updated focus mode so the top bar and secondary chrome fade out after idle while the primary transport controls remain accessible.

### v3.5.7 (2026-04-09)
- Reworked the detached reader controls so transport actions sit at the bottom center, speed and font controls sit at the bottom left, and Start/End jump buttons are available alongside Back/Play/Forward.
- Tightened the autoplay speed range, expanded the font-size range, added a left-vs-centered line alignment toggle, and persisted the new alignment preference locally.
- Switched reader ETA from a flat per-line estimate to a text-length-and-punctuation weighted duration model so timing is more realistic for mixed short and long lines.
- Updated active-line scrolling so oversized lines are kept fully visible when possible and autoplay scroll motion eases smoothly instead of snapping between lines.
- Increased server-side display-line limits and added short-orphan rebalancing so long paragraphs are less likely to break into awkward detached fragments.

### v3.5.6 (2026-04-09)
- Fixed detached-reader bootstrap values being double-encoded in `ReaderView.html`, which could wrap `docId`, `sourceMode`, and `selectionToken` in literal quotes.
- Added defensive parameter normalization on the reader server so quoted launch parameters no longer break `doGet`, `getDocumentPayloadById`, or `getDocumentVersionById`.
- Added a normalization diagnostic log entry to make malformed reader query parameters visible in the execution log.

### v3.5.4 (2026-04-09)
- Added `onInstall(e)` and switched the menu to `createAddonMenu()` so the standalone editor add-on installs into the expected Docs surface.
- Added `addOns.common.openLinkUrlPrefixes` so the add-on can open the detached reader URL in versioned deployments.
- Added an explicit `DOCPROMPTER_READER_WEB_APP_URL` script property contract for the detached reader, with a same-project web app fallback for local testing.
- Removed the stale `@OnlyCurrentDoc` annotation and kept the broader Docs scope aligned with the current `openById(docId)` reader architecture.
- Increased the launch dialog size slightly so the default content no longer overflows as easily.

### v3.5.5 (2026-04-09)
- Added structured diagnostics around the add-on launch flow, detached reader bootstrap, and `getDocumentPayloadById` failures.
- Added a reader-side debug panel that surfaces server runtime details when document loading fails.
- Added detached-web-app authorization checks and logging ahead of `DocumentApp.openById(docId)`.
- Added the `userinfo.email` scope so diagnostics can report the available active/effective account emails from the detached reader context.

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
