function prepareReaderLaunch_() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const readerTarget = getReaderWebAppTarget_();
  const launch = {
    url: readerTarget.url,
    docId: docId
  };

  launch.openUrl = buildReaderOpenUrl_(launch);

  logDiagnostic_('prepare_reader_launch', {
    docId: docId,
    title: doc.getName(),
    readerUrl: readerTarget.url,
    readerUrlSource: readerTarget.source,
    readerUrlMode: readerTarget.mode,
    openUrl: launch.openUrl
  });

  return launch;
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

function buildReaderOpenUrl_(launch) {
  return launch.url + '?docId=' + encodeURIComponent(launch.docId);
}
