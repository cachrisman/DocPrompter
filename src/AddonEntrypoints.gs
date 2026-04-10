function onOpen_(e) {
  try {
    logDiagnostic_('on_open_start', {
      triggerType: 'onOpen'
    });

    createDocPrompterMenu_()
      .addItem('Open Reader', 'openReaderFromMenu')
      .addToUi();

    logDiagnostic_('on_open_success', {
      triggerType: 'onOpen'
    });
  } catch (err) {
    logDiagnostic_('on_open_error', {
      error: err
    });
    Logger.log('onOpen menu creation skipped: ' + err);
  }
}

function onInstall_(e) {
  logDiagnostic_('on_install', {
    triggerType: 'onInstall'
  });
  onOpen_(e);
}

function openReaderFromMenu_() {
  try {
    const doc = DocumentApp.getActiveDocument();
    logDiagnostic_('menu_open_reader_start', {
      docId: doc ? doc.getId() : '',
      title: doc ? doc.getName() : ''
    });

    showReaderLaunchBridge_();

    logDiagnostic_('menu_open_reader_success', {
      docId: doc ? doc.getId() : ''
    });
  } catch (err) {
    logDiagnostic_('menu_open_reader_error', {
      error: err
    });
    throw err;
  }
}
