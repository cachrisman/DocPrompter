# Deployment, QA, Known Issues, and Backlog

## Blockers before broader rollout

1. **Run a real deployed end-to-end test.**
   The biggest remaining risk is actual Apps Script add-on runtime behavior, especially around card actions, file-scope authorization, and web-app launch flow.

2. **Choose the reader web-app access model intentionally.**
   The committed manifest currently uses:
   - `executeAs: USER_ACCESSING`
   - `access: MYSELF`

   That is fine for owner-only development, but it is not the same as broader internal testing. Widen access only when the target audience and auth model are explicit.

## Deployment checklist

1. Create the Apps Script project and add:
   - `Code.gs`
   - `ReaderServer.gs`
   - `Launch.html`
   - `ReaderView.html`
   - `ReaderStyles.html`
   - `appsscript.json`

2. Confirm the manifest includes:
   - Docs scope
   - container UI scope
   - `script.scriptapp` scope
   - add-on config
   - web app config with an access level that matches the intended audience

3. Deploy the web app with:
   - **Execute as:** User accessing the app
   - **Who has access:** the intended test audience
   - Current committed default: owner-only (`MYSELF`)

4. Test in this order:
   - custom Docs menu flow first
   - Workspace Add-on homepage/card flow second

5. Verify the reader launch passes:
   - `docId`
   - `sourceMode`
   - `selectionToken` when relevant

6. Verify selection snapshot cache behavior:
   - selection token is created
   - token is readable by the reader
   - expired token falls back gracefully to full document

7. Test browser behavior:
   - popup blockers
   - new tab vs new window behavior
   - keyboard shortcuts in the standalone reader

## QA test plan

### Basic launch
- Full document launch works.
- Selection launch works.
- No-selection launch falls back to full document.
- Popup blocker shows an explicit warning and the launch dialog stays open instead of reporting false success.

### Reader behavior
- Current line indicator updates clearly.
- Space toggles play/pause.
- Left/Up moves back one line.
- Right/Down moves forward one line.
- Theme, speed, font size, and focus mode persist after reload.

### Content transformation
- Headings render distinctly and appear in section jump.
- Lists remain readable, including nested items.
- Tables are converted into row-grouped readable text.
- Repeated identical lines are not dropped from selection snapshots.

### Refresh and sync
- Manual refresh works in full-document mode.
- Polling detects changes in full-document mode.
- Selection snapshots stay intentionally static after launch.
- Refresh preserves approximate reading position.

### Add-on/runtime
- Custom menu launch works from a bound Google Doc.
- Workspace Add-on homepage flow opens the reader directly.
- File-scope permission flow is understandable.

## Known issues

- Multi-row tables currently assume row 0 is a header row. Headerless data tables will be flattened less accurately until explicit header detection is added.
- ETA is an approximation based on a fixed baseline seconds-per-display-line model.
- Selection mode is a launch-time snapshot, not a live evolving slice of the doc.
- Partial-text selections that span multiple styled text runs can still normalize less cleanly than plain paragraph selections because Google Docs exposes them as fragmented range elements.
- The committed manifest uses `webapp.access = MYSELF`, which is right for owner-only development but will block broader testing until access is widened intentionally.

## Backlog / future improvements

### High priority
- Run and document a real deployed runtime test.
- Improve position restore further for heavily edited documents.
- Add clearer inline error states for permission, popup, and expired snapshot failures.

### Medium priority
- Add better client-side line measurement instead of char-count wrapping.
- Improve table header detection and headerless table handling.
- Add richer cue-line styling for `Note:`, `Pause:`, and `Emphasis:` markers.

### Lower priority
- Persist position/resume state.
- Add narrow layout presets.
- Add rehearsal analytics and duration estimates based on actual interaction data.
