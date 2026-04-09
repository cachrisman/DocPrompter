function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getLaunchContext() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  return {
    hasSelection: !!selection,
    docId: doc.getId(),
    title: doc.getName()
  };
}

function prepareReaderLaunch(sourceMode) {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  sourceMode = sourceMode === 'selection' ? 'selection' : 'document';

  const selectionToken = sourceMode === 'selection' ? cacheCurrentSelection_(docId) : '';
  if (sourceMode === 'selection' && !selectionToken) {
    sourceMode = 'document';
  }

  return {
    url: ScriptApp.getService().getUrl(),
    docId: docId,
    sourceMode: sourceMode,
    selectionToken: selectionToken
  };
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const sourceMode = params.sourceMode || 'document';
  const docId = params.docId || '';
  const selectionToken = params.selectionToken || '';

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
  if (!docId) {
    throw new Error('Missing docId.');
  }

  sourceMode = sourceMode || 'document';

  const doc = DocumentApp.openById(docId);
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
  if (!docId) {
    throw new Error('Missing docId.');
  }

  const doc = DocumentApp.openById(docId);
  return {
    version: buildVersionToken_(doc)
  };
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

  splitIntoDisplayLines_(text, isHeading ? 90 : 120).forEach(function (lineText, localIndex) {
    lines.push({
      id: buildLineId_(sectionId, localIndex),
      sectionId: sectionId,
      kind: isHeading ? 'heading' : 'paragraph',
      text: lineText,
      isCue: isCueLine_(lineText)
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

  splitIntoDisplayLines_(spokenText, 110).forEach(function (lineText, localIndex) {
    lines.push({
      id: buildLineId_(sectionId, localIndex),
      sectionId: sectionId,
      kind: 'list',
      text: lineText,
      isCue: isCueLine_(lineText)
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
  blockLines.forEach(function (lineText) {
    splitIntoDisplayLines_(lineText, 110).forEach(function (displayLine) {
      lines.push({
        id: buildLineId_(sectionId, localIndex),
        sectionId: sectionId,
        kind: 'table',
        text: displayLine,
        isCue: isCueLine_(displayLine)
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

  paragraphs.forEach(function (paragraph) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return;

    let current = '';

    words.forEach(function (word) {
      const candidate = current ? current + ' ' + word : word;
      if (candidate.length <= limit || !current) {
        current = candidate;
      } else {
        out.push(current);
        current = word;
      }
    });

    if (current) out.push(current);
  });

  return out;
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
