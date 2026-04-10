function getReaderRuntimeDiagnostics_(docId) {
  const diagnostics = buildRuntimeDiagnostics_(normalizeStringParam_(docId || ''));
  logDiagnostic_('reader_runtime_diagnostics_requested', diagnostics);
  return diagnostics;
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

function logClientEvent_(eventName, payload) {
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
