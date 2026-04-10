const READER_WEB_APP_URL_PROPERTY_ = 'DOCPROMPTER_READER_WEB_APP_URL';
const DOCS_SCOPE_ = 'https://www.googleapis.com/auth/documents';
const USERINFO_EMAIL_SCOPE_ = 'https://www.googleapis.com/auth/userinfo.email';
const HEADING_DISPLAY_LINE_LIMIT_ = 120;
const PARAGRAPH_DISPLAY_LINE_LIMIT_ = 170;
const LIST_DISPLAY_LINE_LIMIT_ = 150;
const TABLE_DISPLAY_LINE_LIMIT_ = 150;

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getLaunchContext() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  const context = {
    hasSelection: !!selection,
    docId: doc.getId(),
    title: doc.getName()
  };

  logDiagnostic_('get_launch_context', context);

  return context;
}

function prepareReaderLaunch(sourceMode) {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  sourceMode = sourceMode === 'selection' ? 'selection' : 'document';
  const readerTarget = getReaderWebAppTarget_();
  const webAppUrl = readerTarget.url;

  const selectionToken = sourceMode === 'selection' ? cacheCurrentSelection_(docId) : '';
  if (sourceMode === 'selection' && !selectionToken) {
    sourceMode = 'document';
  }

  logDiagnostic_('prepare_reader_launch', {
    docId: docId,
    requestedSourceMode: arguments.length ? arguments[0] : 'document',
    resolvedSourceMode: sourceMode,
    selectionTokenCreated: !!selectionToken,
    readerUrl: webAppUrl,
    readerUrlSource: readerTarget.source,
    readerUrlMode: readerTarget.mode
  });

  return {
    url: webAppUrl,
    docId: docId,
    sourceMode: sourceMode,
    selectionToken: selectionToken
  };
}

function getReaderWebAppUrl_() {
  return getReaderWebAppTarget_().url;
}

function getReaderWebAppTarget_() {
  const configuredUrl = getConfiguredReaderWebAppUrl_();
  if (configuredUrl) {
    return buildReaderUrlInfo_(configuredUrl, 'script_property');
  }

  const service = ScriptApp.getService();
  const implicitUrl = service && service.isEnabled() ? service.getUrl() : '';
  if (implicitUrl) {
    return buildReaderUrlInfo_(normalizeReaderWebAppUrl_(implicitUrl), 'script_service');
  }

  throw new Error(
    'DocPrompter reader URL is not configured. Deploy the project as a web app and set the script property ' +
      READER_WEB_APP_URL_PROPERTY_ +
      ' to that /exec or /dev URL.'
  );
}

function getConfiguredReaderWebAppUrl_() {
  const raw = PropertiesService.getScriptProperties().getProperty(READER_WEB_APP_URL_PROPERTY_);
  return raw ? normalizeReaderWebAppUrl_(raw) : '';
}

function normalizeReaderWebAppUrl_(value) {
  const url = String(value || '').trim();
  if (!url) return '';

  if (!/^https:\/\/script\.google\.com\/macros\//.test(url)) {
    throw new Error(
      'The script property ' +
        READER_WEB_APP_URL_PROPERTY_ +
        ' must be a Google Apps Script web app URL that starts with https://script.google.com/macros/.'
    );
  }

  if (/[?#]/.test(url)) {
    throw new Error(
      'The script property ' +
        READER_WEB_APP_URL_PROPERTY_ +
        ' must use the base web app URL without query parameters or fragments.'
    );
  }

  return url.replace(/\/+$/, '');
}

function buildReaderUrlInfo_(url, source) {
  return {
    url: url,
    source: source || 'unknown',
    mode: /\/dev$/.test(url) ? 'dev' : (/\/exec$/.test(url) ? 'exec' : 'unknown')
  };
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const rawSourceMode = params.sourceMode || '';
  const rawDocId = params.docId || '';
  const rawSelectionToken = params.selectionToken || '';
  const sourceMode = normalizeSourceMode_(rawSourceMode);
  const docId = normalizeStringParam_(rawDocId);
  const selectionToken = normalizeStringParam_(rawSelectionToken);
  const readerTarget = getReaderWebAppTarget_();

  if (
    rawSourceMode !== sourceMode ||
    rawDocId !== docId ||
    rawSelectionToken !== selectionToken
  ) {
    logDiagnostic_('reader_query_params_normalized', {
      query: sanitizeForLog_(params),
      normalized: {
        docId: docId,
        sourceMode: sourceMode,
        hasSelectionToken: !!selectionToken
      }
    });
  }

  logDiagnostic_('reader_do_get', {
    query: sanitizeForLog_(params),
    readerUrl: readerTarget.url,
    readerUrlSource: readerTarget.source,
    readerUrlMode: readerTarget.mode,
    runtime: buildRuntimeDiagnostics_(docId)
  });

  const template = HtmlService.createTemplateFromFile('ReaderView');
  template.sourceMode = sourceMode;
  template.docId = docId;
  template.selectionToken = selectionToken;

  return template
    .evaluate()
    .setTitle('DocPrompter Reader')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDocumentPayloadById(docId, sourceMode, selectionToken) {
  docId = normalizeStringParam_(docId);
  sourceMode = normalizeSourceMode_(sourceMode);
  selectionToken = normalizeStringParam_(selectionToken);

  if (!docId) {
    throw new Error('Missing docId.');
  }

  logDiagnostic_('get_document_payload_start', {
    docId: docId,
    sourceMode: sourceMode,
    hasSelectionToken: !!selectionToken,
    runtime: buildRuntimeDiagnostics_(docId)
  });

  const doc = openReaderDocumentById_(docId);
  const title = doc.getName();
  const sections = [];
  const lines = [];
  const firstLineIndexBySectionId = {};
  let sectionCounter = 0;

  const nextSectionCounter = function () {
    sectionCounter += 1;
    return sectionCounter;
  };

  if (sourceMode === 'selection' && selectionToken) {
    const selectionPayload = getCachedSelection_(selectionToken);
    if (selectionPayload && selectionPayload.docId === docId) {
      const parsed = JSON.parse(selectionPayload.payload);
      return {
        title: title,
        sourceMode: 'selection',
        generatedAt: new Date().toISOString(),
        version: buildVersionToken_(doc),
        sections: parsed.sections || [],
        lines: parsed.lines || [],
        warning: 'Selection snapshot'
      };
    }
  }

  processBody_(doc.getBody(), sections, lines, firstLineIndexBySectionId, nextSectionCounter);

  sections.forEach(function (section) {
    section.firstLineIndex = firstLineIndexBySectionId[section.id] || 0;
  });

  return {
    title: title,
    sourceMode: 'document',
    generatedAt: new Date().toISOString(),
    version: buildVersionToken_(doc),
    sections: sections,
    lines: lines,
    warning: sourceMode === 'selection' ? 'Selection snapshot unavailable; showing full document' : ''
  };
}

function getDocumentVersionById(docId) {
  docId = normalizeStringParam_(docId);

  if (!docId) {
    throw new Error('Missing docId.');
  }

  const doc = openReaderDocumentById_(docId);
  return {
    version: buildVersionToken_(doc)
  };
}

function openReaderDocumentById_(docId) {
  const docsAuth = getScopeAuthorizationSnapshot_([DOCS_SCOPE_]);
  if (docsAuth.status === 'REQUIRED') {
    const authError = new Error(
      'Reader web app is not authorized for Google Docs access yet. Open the authorization URL and grant access: ' +
        (docsAuth.authorizationUrl || '[no authorization URL returned]')
    );
    logDiagnostic_('reader_document_open_unauthorized', {
      docId: docId,
      runtime: buildRuntimeDiagnostics_(docId),
      docsAuthorization: docsAuth,
      error: authError
    });
    throw authError;
  }

  try {
    const doc = DocumentApp.openById(docId);
    logDiagnostic_('reader_document_open_success', {
      docId: docId,
      title: doc.getName()
    });
    return doc;
  } catch (err) {
    logDiagnostic_('reader_document_open_error', {
      docId: docId,
      runtime: buildRuntimeDiagnostics_(docId),
      error: err
    });
    throw new Error(
      'Could not open document ' +
        docId +
        '. See the execution log entry `reader_document_open_error` for detached reader diagnostics.'
    );
  }
}

function getReaderRuntimeDiagnostics(docId) {
  const diagnostics = buildRuntimeDiagnostics_(normalizeStringParam_(docId || ''));
  logDiagnostic_('reader_runtime_diagnostics_requested', diagnostics);
  return diagnostics;
}

function normalizeSourceMode_(value) {
  return normalizeStringParam_(value) === 'selection' ? 'selection' : 'document';
}

function normalizeStringParam_(value) {
  if (value === null || value === undefined) return '';

  let normalized = String(value).trim();
  let previous = null;

  while (normalized && normalized !== previous) {
    previous = normalized;

    try {
      const parsed = JSON.parse(normalized);
      if (typeof parsed === 'string') {
        normalized = parsed.trim();
        continue;
      }
    } catch (err) {}

    if (
      (normalized.charAt(0) === '"' && normalized.charAt(normalized.length - 1) === '"') ||
      (normalized.charAt(0) === "'" && normalized.charAt(normalized.length - 1) === "'")
    ) {
      normalized = normalized.substring(1, normalized.length - 1).trim();
    }
  }

  return normalized;
}

function logClientEvent(eventName, payload) {
  logDiagnostic_('client_' + String(eventName || 'event'), {
    payload: sanitizeForLog_(payload)
  });
}

function buildRuntimeDiagnostics_(docId) {
  const readerTarget = getReaderWebAppTargetSafely_();
  const docsAuth = getScopeAuthorizationSnapshot_([DOCS_SCOPE_]);
  const emailAuth = getScopeAuthorizationSnapshot_([USERINFO_EMAIL_SCOPE_]);

  return {
    docId: docId || '',
    readerTarget: readerTarget,
    session: getSessionSnapshot_(),
    authorization: {
      script: getScopeAuthorizationSnapshot_([]),
      documents: docsAuth,
      userinfoEmail: emailAuth
    }
  };
}

function getReaderWebAppTargetSafely_() {
  try {
    return getReaderWebAppTarget_();
  } catch (err) {
    return {
      url: '',
      source: 'error',
      mode: 'unknown',
      error: String(err && err.message ? err.message : err)
    };
  }
}

function getSessionSnapshot_() {
  return {
    activeUserEmail: safelyGetEmail_(function () {
      return Session.getActiveUser().getEmail();
    }),
    effectiveUserEmail: safelyGetEmail_(function () {
      return Session.getEffectiveUser().getEmail();
    }),
    activeUserLocale: safelyExecute_(function () {
      return Session.getActiveUserLocale();
    }, ''),
    temporaryActiveUserKey: safelyExecute_(function () {
      return Session.getTemporaryActiveUserKey();
    }, ''),
    scriptTimeZone: safelyExecute_(function () {
      return Session.getScriptTimeZone();
    }, '')
  };
}

function getScopeAuthorizationSnapshot_(scopes) {
  try {
    const info = scopes && scopes.length
      ? ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, scopes)
      : ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    return {
      scopes: scopes || [],
      status: String(info.getAuthorizationStatus()),
      authorizationUrl: info.getAuthorizationUrl() || ''
    };
  } catch (err) {
    return {
      scopes: scopes || [],
      status: 'ERROR',
      authorizationUrl: '',
      error: String(err && err.message ? err.message : err)
    };
  }
}

function safelyGetEmail_(fn) {
  const value = safelyExecute_(fn, '');
  return value || '[blank]';
}

function safelyExecute_(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    return fallback;
  }
}

function logDiagnostic_(eventName, payload) {
  const entry = {
    ts: new Date().toISOString(),
    event: eventName,
    payload: sanitizeForLog_(payload)
  };
  console.log(JSON.stringify(entry));
}

function sanitizeForLog_(value) {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      message: value.message || String(value),
      stack: value.stack || ''
    };
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog_);
  }

  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = sanitizeForLog_(value[key]);
    });
    return out;
  }

  return value;
}

function cacheCurrentSelection_(docId) {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  if (!selection) return '';

  const sections = [];
  const lines = [];
  const firstLineIndexBySectionId = {};
  let sectionCounter = 0;

  processRangeElements_(selection.getRangeElements(), sections, lines, firstLineIndexBySectionId, function () {
    sectionCounter += 1;
    return sectionCounter;
  });

  sections.forEach(function (section) {
    section.firstLineIndex = firstLineIndexBySectionId[section.id] || 0;
  });

  if (!lines.length) return '';

  const token = Utilities.getUuid();
  const payload = JSON.stringify({
    sections: sections,
    lines: lines
  });
  const wrapped = JSON.stringify({
    docId: docId,
    payload: payload
  });

  if (wrapped.length > 95000) {
    Logger.log('Selection payload too large for cache; falling back to full document.');
    return '';
  }

  try {
    CacheService.getUserCache().put(token, wrapped, 21600);
    return token;
  } catch (err) {
    Logger.log('Failed to cache selection payload: ' + err);
    return '';
  }
}

function getCachedSelection_(selectionToken) {
  if (!selectionToken) return null;
  const raw = CacheService.getUserCache().get(selectionToken);
  return raw ? JSON.parse(raw) : null;
}

function processBody_(body, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const numChildren = body.getNumChildren();

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    processElement_(child, sections, lines, firstLineIndexBySectionId, nextSectionCounter);
  }
}

function processRangeElements_(rangeElements, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const seen = {};

  rangeElements.forEach(function (rangeElement) {
    const el = rangeElement.getElement();
    const key = getRangeElementIdentityKey_(rangeElement) || getSectionStructuralKey_(el, rangeElement);
    if (seen[key]) return;
    seen[key] = true;

    processElement_(el, sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement);
  });
}

function processElement_(el, sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement) {
  const type = el.getType();

  if (type === DocumentApp.ElementType.PARAGRAPH) {
    processParagraph_(el.asParagraph(), sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement);
    return;
  }

  if (type === DocumentApp.ElementType.LIST_ITEM) {
    processListItem_(el.asListItem(), sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement);
    return;
  }

  if (type === DocumentApp.ElementType.TABLE) {
    processTable_(el.asTable(), sections, lines, firstLineIndexBySectionId, nextSectionCounter);
    return;
  }

  if (type === DocumentApp.ElementType.TABLE_ROW) {
    processTableRow_(el.asTableRow(), sections, lines, firstLineIndexBySectionId, nextSectionCounter);
    return;
  }

  if (type === DocumentApp.ElementType.TEXT) {
    const parent = el.getParent();
    if (!parent) return;

    if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
      processParagraph_(parent.asParagraph(), sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement);
      return;
    }

    if (parent.getType() === DocumentApp.ElementType.LIST_ITEM) {
      processListItem_(parent.asListItem(), sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement);
    }
  }
}

function processParagraph_(paragraph, sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement) {
  let text = getElementText_(paragraph, rangeElement);
  text = cleanText_(text);

  if (!text) return;

  const heading = paragraph.getHeading();
  const isHeading = heading && heading !== DocumentApp.ParagraphHeading.NORMAL;
  const headingLevelNumber = getHeadingLevelNumber_(heading);

  const sectionId = buildSectionId_(getSectionStructuralKey_(paragraph, rangeElement), nextSectionCounter());
  sections.push({
    id: sectionId,
    type: isHeading ? 'heading' : 'paragraph',
    text: text,
    level: isHeading ? String(heading) : null,
    levelNumber: headingLevelNumber
  });

  firstLineIndexBySectionId[sectionId] = lines.length;

  splitIntoDisplayLines_(text, isHeading ? HEADING_DISPLAY_LINE_LIMIT_ : PARAGRAPH_DISPLAY_LINE_LIMIT_).forEach(function (displayLine, localIndex) {
    const lineText = displayLine.text || '';
    lines.push({
      id: buildLineId_(sectionId, localIndex),
      sectionId: sectionId,
      kind: isHeading ? 'heading' : 'paragraph',
      text: lineText,
      isCue: isCueLine_(lineText),
      sourceBreakBefore: !!displayLine.sourceBreakBefore
    });
  });
}

function processListItem_(item, sections, lines, firstLineIndexBySectionId, nextSectionCounter, rangeElement) {
  let text = getElementText_(item, rangeElement);
  text = cleanText_(text);

  if (!text) return;

  const glyph = getListGlyphPrefix_(item);
  const spokenText = glyph + text;

  const sectionId = buildSectionId_(getSectionStructuralKey_(item, rangeElement), nextSectionCounter());
  sections.push({
    id: sectionId,
    type: 'list',
    text: spokenText
  });

  firstLineIndexBySectionId[sectionId] = lines.length;

  splitIntoDisplayLines_(spokenText, LIST_DISPLAY_LINE_LIMIT_).forEach(function (displayLine, localIndex) {
    const lineText = displayLine.text || '';
    lines.push({
      id: buildLineId_(sectionId, localIndex),
      sectionId: sectionId,
      kind: 'list',
      text: lineText,
      isCue: isCueLine_(lineText),
      sourceBreakBefore: !!displayLine.sourceBreakBefore
    });
  });
}

function processTable_(table, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const numRows = table.getNumRows();
  if (numRows === 0) return;

  let headers = [];
  if (numRows > 1) {
    headers = getTableRowTexts_(table.getRow(0)).map(cleanText_);
  }

  if (numRows > 1) {
    for (let r = 1; r < numRows; r++) {
      const row = table.getRow(r);
      processTableRowWithHeaders_(row, headers, sections, lines, firstLineIndexBySectionId, nextSectionCounter);
    }
  } else {
    processTableRowWithHeaders_(table.getRow(0), [], sections, lines, firstLineIndexBySectionId, nextSectionCounter);
  }
}

function processTableRow_(row, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  processTableRowWithHeaders_(row, [], sections, lines, firstLineIndexBySectionId, nextSectionCounter);
}

function processTableRowWithHeaders_(row, headers, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const rawValues = getTableRowTexts_(row).map(cleanText_);
  const values = rawValues.filter(Boolean);
  if (!values.length) return;

  const sectionId = buildSectionId_(getSectionStructuralKey_(row), nextSectionCounter());
  const blockLines = [];

  if (headers.length === rawValues.length && headers.length > 0) {
    const titleCandidate = rawValues[0] || 'Row';
    blockLines.push(titleCandidate);

    for (let i = 1; i < rawValues.length; i++) {
      if (!rawValues[i]) continue;
      const key = headers[i] || ('Column ' + (i + 1));
      blockLines.push(key + ': ' + rawValues[i]);
    }
  } else {
    rawValues.forEach(function (value) {
      if (value) blockLines.push(value);
    });
  }

  sections.push({
    id: sectionId,
    type: 'table',
    text: blockLines.join('\n')
  });

  firstLineIndexBySectionId[sectionId] = lines.length;

  let localIndex = 0;
  blockLines.forEach(function (lineText, blockIndex) {
    splitIntoDisplayLines_(lineText, TABLE_DISPLAY_LINE_LIMIT_).forEach(function (displayLine, displayIndex) {
      const displayText = displayLine.text || '';
      lines.push({
        id: buildLineId_(sectionId, localIndex),
        sectionId: sectionId,
        kind: 'table',
        text: displayText,
        isCue: isCueLine_(displayText),
        sourceBreakBefore: !!displayLine.sourceBreakBefore || (blockIndex > 0 && displayIndex === 0)
      });
      localIndex += 1;
    });
  });
}

function getTableRowTexts_(row) {
  const out = [];
  const numCells = row.getNumCells();

  for (let c = 0; c < numCells; c++) {
    out.push(row.getCell(c).getText());
  }

  return out;
}

function getElementText_(element, rangeElement) {
  const rangeElementElement = rangeElement && rangeElement.getElement ? rangeElement.getElement() : null;
  const useRangeElementText = !!(
    rangeElement &&
    rangeElement.isPartial &&
    rangeElement.isPartial() &&
    rangeElementElement &&
    rangeElementElement !== element &&
    rangeElementElement.getText
  );
  const fullText = useRangeElementText
    ? rangeElementElement.getText()
    : (element.getText ? element.getText() : '');
  if (!rangeElement) return fullText;

  if (!rangeElement.isPartial()) return fullText;

  const start = rangeElement.getStartOffset();
  const end = rangeElement.getEndOffsetInclusive();

  if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end >= start) {
    return fullText.substring(start, end + 1);
  }

  return fullText;
}

function getListGlyphPrefix_(item) {
  try {
    const nesting = item.getNestingLevel ? item.getNestingLevel() : 0;
    const indent = new Array((nesting || 0) + 1).join('  ');
    return indent + '- ';
  } catch (e) {
    return '- ';
  }
}

function getHeadingLevelNumber_(heading) {
  const map = {};
  map[DocumentApp.ParagraphHeading.HEADING1] = 1;
  map[DocumentApp.ParagraphHeading.HEADING2] = 2;
  map[DocumentApp.ParagraphHeading.HEADING3] = 3;
  map[DocumentApp.ParagraphHeading.HEADING4] = 4;
  map[DocumentApp.ParagraphHeading.HEADING5] = 5;
  map[DocumentApp.ParagraphHeading.HEADING6] = 6;
  return map[heading] || null;
}

function splitIntoDisplayLines_(text, maxChars) {
  const cleaned = cleanText_(text);
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n+/);
  const out = [];
  const limit = maxChars || 120;

  paragraphs.forEach(function (paragraph, paragraphIndex) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return;

    const paragraphLines = [];
    let current = '';

    words.forEach(function (word) {
      const candidate = current ? current + ' ' + word : word;
      if (candidate.length <= limit || !current) {
        current = candidate;
      } else {
        paragraphLines.push(current);
        current = word;
      }
    });

    if (current) paragraphLines.push(current);
    rebalanceDisplayLines_(paragraphLines, limit);

    paragraphLines.forEach(function (lineText, lineIndex) {
      out.push({
        text: lineText,
        sourceBreakBefore: paragraphIndex > 0 && lineIndex === 0
      });
    });
  });
  return out;
}

function rebalanceDisplayLines_(lines, limit) {
  if (!lines || lines.length < 2) return;

  for (let i = 1; i < lines.length; i++) {
    let previous = lines[i - 1];
    let current = lines[i];

    while (
      current.length < Math.round(limit * 0.28) &&
      previous.indexOf(' ') > 0 &&
      previous.length > Math.round(limit * 0.45)
    ) {
      const splitIndex = previous.lastIndexOf(' ');
      const movedWord = previous.substring(splitIndex + 1);
      previous = previous.substring(0, splitIndex);
      current = movedWord + ' ' + current;
    }

    lines[i - 1] = previous;
    lines[i] = current;
  }
}

function cleanText_(text) {
  return String(text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function isCueLine_(text) {
  const value = String(text || '');
  return /^note:/i.test(value) || /^pause:/i.test(value) || /^emphasis:/i.test(value);
}

function getRangeElementIdentityKey_(rangeElement) {
  if (!rangeElement || !rangeElement.getElement) return '';

  try {
    const el = rangeElement.getElement();
    const partialKey = rangeElement.isPartial()
      ? ':' + rangeElement.getStartOffset() + ':' + rangeElement.getEndOffsetInclusive()
      : '';
    return getElementPath_(el) + partialKey;
  } catch (e) {
    return '';
  }
}

function buildLineId_(sectionId, localIndex) {
  return sectionId + '-line-' + localIndex;
}

function getSectionStructuralKey_(el, rangeElement) {
  const anchor = getSectionAnchorElement_(el, rangeElement);
  const basePath = getElementPath_(anchor);
  if (!rangeElement || !rangeElement.isPartial()) {
    return basePath;
  }

  try {
    const rangeEl = rangeElement.getElement();
    const offsets = ':' + rangeElement.getStartOffset() + ':' + rangeElement.getEndOffsetInclusive();
    if (rangeEl && rangeEl !== anchor) {
      return basePath + '|partial=' + getElementPath_(rangeEl) + offsets;
    }
    return basePath + offsets;
  } catch (e) {
    return basePath;
  }
}

function getSectionAnchorElement_(el, rangeElement) {
  const candidate = el || (rangeElement && rangeElement.getElement ? rangeElement.getElement() : null);
  if (!candidate || !candidate.getType) return candidate;

  try {
    if (candidate.getType() === DocumentApp.ElementType.TEXT) {
      const parent = candidate.getParent();
      if (!parent || !parent.getType) return candidate;

      const parentType = parent.getType();
      if (parentType === DocumentApp.ElementType.PARAGRAPH || parentType === DocumentApp.ElementType.LIST_ITEM) {
        return parent;
      }
    }
  } catch (e) {
    return candidate;
  }

  return candidate;
}

function getElementPath_(el) {
  if (!el) return '';

  const parts = [];
  let current = el;
  let depth = 0;

  while (current && depth < 50) {
    let typeName = 'UNKNOWN';
    try {
      typeName = String(current.getType());
    } catch (e) {
      typeName = 'UNKNOWN';
    }

    const parent = current.getParent ? current.getParent() : null;
    let childIndex = 0;

    if (parent && parent.getChildIndex) {
      try {
        childIndex = parent.getChildIndex(current);
      } catch (e) {
        childIndex = 0;
      }
    }

    parts.push(typeName + ':' + childIndex);
    current = parent;
    depth += 1;
  }

  return parts.reverse().join('/');
}

function buildSectionId_(structuralKey, fallbackIndex) {
  if (!structuralKey) return 'sec-' + fallbackIndex;

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, structuralKey);
  const encoded = Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
  return 'sec-' + encoded.substring(0, 12);
}

function buildVersionToken_(doc) {
  const bodyText = cleanText_(doc.getBody().getText());
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bodyText);
  const encoded = Utilities.base64EncodeWebSafe(digest);
  return doc.getId() + ':' + encoded.substring(0, 32);
}
