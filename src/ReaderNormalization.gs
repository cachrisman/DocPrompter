function normalizeDocumentBody_(body) {
  const sections = [];
  const lines = [];
  const firstLineIndexBySectionId = {};
  let sectionCounter = 0;

  const nextSectionCounter = function () {
    sectionCounter += 1;
    return sectionCounter;
  };

  const numChildren = body.getNumChildren();
  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      processParagraph_(child.asParagraph(), sections, lines, firstLineIndexBySectionId, nextSectionCounter);
      continue;
    }

    if (type === DocumentApp.ElementType.LIST_ITEM) {
      processListItem_(child.asListItem(), sections, lines, firstLineIndexBySectionId, nextSectionCounter);
      continue;
    }

    if (type === DocumentApp.ElementType.TABLE) {
      processTable_(child.asTable(), sections, lines, firstLineIndexBySectionId, nextSectionCounter);
    }
  }

  sections.forEach(function (section) {
    section.firstLineIndex = firstLineIndexBySectionId[section.id] || 0;
  });

  return {
    sections: sections,
    lines: lines
  };
}

function processParagraph_(paragraph, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const text = cleanText_(paragraph.getText());
  if (!text) return;

  const heading = paragraph.getHeading();
  const isHeading = heading && heading !== DocumentApp.ParagraphHeading.NORMAL;
  const headingLevelNumber = getHeadingLevelNumber_(heading);
  const sectionId = buildSectionId_(getSectionStructuralKey_(paragraph), nextSectionCounter());

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

function processListItem_(item, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const text = cleanText_(item.getText());
  if (!text) return;

  const spokenText = getListGlyphPrefix_(item) + text;
  const sectionId = buildSectionId_(getSectionStructuralKey_(item), nextSectionCounter());

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
    for (let rowIndex = 1; rowIndex < numRows; rowIndex++) {
      processTableRowWithHeaders_(table.getRow(rowIndex), headers, sections, lines, firstLineIndexBySectionId, nextSectionCounter);
    }
    return;
  }

  processTableRowWithHeaders_(table.getRow(0), [], sections, lines, firstLineIndexBySectionId, nextSectionCounter);
}

function processTableRowWithHeaders_(row, headers, sections, lines, firstLineIndexBySectionId, nextSectionCounter) {
  const rawValues = getTableRowTexts_(row).map(cleanText_);
  const hasContent = rawValues.some(function (value) {
    return !!value;
  });
  if (!hasContent) return;

  const sectionId = buildSectionId_(getSectionStructuralKey_(row), nextSectionCounter());
  const blockLines = [];

  if (headers.length === rawValues.length && headers.length > 0) {
    blockLines.push(rawValues[0] || 'Row');

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
