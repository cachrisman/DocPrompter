function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function prepareReaderLaunch() {
  return prepareReaderLaunch_();
}

function doGet(e) {
  return buildReaderResponse_(e);
}

function getDocumentPayloadById(docId) {
  return getDocumentPayloadById_(docId);
}

function getDocumentVersionById(docId) {
  return getDocumentVersionById_(docId);
}

function getReaderRuntimeDiagnostics(docId) {
  return getReaderRuntimeDiagnostics_(docId);
}

function logClientEvent(eventName, payload) {
  return logClientEvent_(eventName, payload);
}
