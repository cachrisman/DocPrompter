function buildReaderResponse_(e) {
  const params = (e && e.parameter) || {};
  const rawDocId = params.docId || '';
  const docId = normalizeStringParam_(rawDocId);
  const readerTarget = getReaderWebAppTarget_();

  if (rawDocId !== docId) {
    logDiagnostic_('reader_query_params_normalized', {
      query: sanitizeForLog_(params),
      normalized: {
        docId: docId
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
  template.docId = docId;

  return template
    .evaluate()
    .setTitle('DocPrompter Reader')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDocumentPayloadById_(docId) {
  docId = normalizeStringParam_(docId);

  if (!docId) {
    throw new Error('Missing docId.');
  }

  logDiagnostic_('get_document_payload_start', {
    docId: docId,
    runtime: buildRuntimeDiagnostics_(docId)
  });

  const doc = openReaderDocumentById_(docId);
  const normalized = normalizeDocumentBody_(doc.getBody());

  return {
    title: doc.getName(),
    generatedAt: new Date().toISOString(),
    version: buildVersionToken_(doc),
    sections: normalized.sections,
    lines: normalized.lines
  };
}

function getDocumentVersionById_(docId) {
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
