function buildLineId_(sectionId, localIndex) {
  return sectionId + '-line-' + localIndex;
}

function getSectionStructuralKey_(el) {
  return getElementPath_(el);
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
