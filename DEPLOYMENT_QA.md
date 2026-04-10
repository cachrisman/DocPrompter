# Deployment, QA, Known Issues, and Backlog

## Blockers before broader rollout

1. **Run a real deployed end-to-end test.**
   The biggest remaining risk is actual Apps Script add-on runtime behavior, especially around card actions, file-scope authorization, and web-app launch flow.

2. **Choose the reader web-app access model intentionally.**
   The committed manifest currently uses:
   - `executeAs: USER_ACCESSING`
   - `access: MYSELF`

   That is fine for owner-only development, but it is not the same as broader internal testing. Widen access only when the target audience and auth model are explicit.

3. **Wire the reader URL intentionally for standalone add-on testing.**
   Recommended setup:
   - create a reader web app deployment
   - copy its `/exec` URL into the script property `DOCPROMPTER_READER_WEB_APP_URL`
   - then update the editor add-on deployment

## Deployment checklist

1. Create the Apps Script project and add the full `src/` tree from this repo.

2. Confirm the manifest includes:
   - Docs scope
   - container UI scope
   - `script.scriptapp` scope
   - `userinfo.email` scope if detached-reader identity diagnostics are enabled
   - add-on config
   - `openLinkUrlPrefixes` for the detached reader URL
   - web app config with an access level that matches the intended audience

3. Deploy the web app with:
   - **Execute as:** User accessing the app
   - **Who has access:** the intended test audience
   - Current committed default: owner-only (`MYSELF`)

4. Save the web app `/exec` URL into the script property:
   - `DOCPROMPTER_READER_WEB_APP_URL`

5. Create or update the editor add-on deployment and install the test deployment for your account if needed.

6. Test in this order:
   - `Extensions -> DocPrompter -> Open Reader` menu flow first
   - Workspace Add-on homepage/card flow second

7. Verify the reader launch passes:
   - `docId`
   - the configured reader web app URL

8. Test browser behavior:
   - popup blockers
   - new tab vs new window behavior
   - keyboard shortcuts in the standalone reader

## QA test plan

### Basic launch
- Menu launch opens the detached reader for the current document.
- Homepage/card launch opens the same detached reader path.
- No chooser UI appears anywhere.
- Popup blocker shows an explicit warning in the launch bridge instead of failing silently.

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
- Repeated identical lines remain present when normalization produces them.

### Refresh and sync
- Manual refresh works.
- Polling detects changes.
- Refresh preserves approximate reading position.

### Add-on/runtime
- `Extensions -> DocPrompter` appears after install or refresh.
- Editor add-on test deployment opens from a standalone project.
- Workspace Add-on homepage flow opens the reader directly.
- File-scope permission flow is understandable.
- Reader failures surface runtime diagnostics in the execution log and in the reader debug panel.

## Known issues

- Multi-row tables currently assume row 0 is a header row. Headerless data tables will be flattened less accurately until explicit header detection is added.
- ETA is still heuristic and depends on the current pacing model plus rendered wrap depth.
- The committed manifest uses `webapp.access = MYSELF`, which is right for owner-only development but will block broader testing until access is widened intentionally.
- The Docs menu flow still uses a tiny launch bridge under the hood because Apps Script menu callbacks cannot directly open browser tabs.

## Backlog / future improvements

### High priority
- Run and document a real deployed runtime test.
- Improve position restore further for heavily edited documents.
- Add clearer inline error states for permission and popup failures.

### Medium priority
- Add better client-side line measurement instead of char-count wrapping.
- Improve table header detection and headerless table handling.
- Add richer cue-line styling for `Note:`, `Pause:`, and `Emphasis:` markers.

### Lower priority
- Persist position/resume state.
- Add narrow layout presets.
- Add rehearsal analytics and duration estimates based on actual interaction data.
