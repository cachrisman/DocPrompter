function onOpen(e) {
  try {
    logDiagnostic_('on_open_start', {
      triggerType: 'onOpen'
    });

    createDocPrompterMenu_()
      .addItem('Open Reading View', 'showLaunchUi')
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

function onInstall(e) {
  logDiagnostic_('on_install', {
    triggerType: 'onInstall'
  });
  onOpen(e);
}

function showLaunchUi() {
  try {
    const doc = DocumentApp.getActiveDocument();
    logDiagnostic_('show_launch_ui_start', {
      docId: doc ? doc.getId() : '',
      title: doc ? doc.getName() : ''
    });

    const html = HtmlService.createHtmlOutputFromFile('Launch')
      .setWidth(380)
      .setHeight(260);
    DocumentApp.getUi().showModalDialog(html, 'DocPrompter');

    logDiagnostic_('show_launch_ui_success', {
      docId: doc ? doc.getId() : ''
    });
  } catch (err) {
    logDiagnostic_('show_launch_ui_error', {
      error: err
    });
    throw err;
  }
}

function createDocPrompterMenu_() {
  const ui = DocumentApp.getUi();
  return ui.createAddonMenu ? ui.createAddonMenu() : ui.createMenu('DocPrompter');
}

function buildAddonHome_(e) {
  const card = CardService.newCardBuilder();

  const intro = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph()
        .setText('Turn the current Google Doc or selected text into a separate reading window for video calls.')
    );

  try {
    const doc = DocumentApp.getActiveDocument();
    const selection = doc.getSelection();
    const docId = doc.getId();

    intro
      .addWidget(
        CardService.newTextButton()
          .setText('Open full document')
          .setOnClickAction(CardService.newAction().setFunctionName('launchDocumentReaderFromAddon_'))
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      );

    if (selection) {
      intro.addWidget(
        CardService.newTextButton()
          .setText('Open current selection')
          .setOnClickAction(CardService.newAction().setFunctionName('launchSelectionReaderFromAddon_'))
      );
    }

    intro.addWidget(
      CardService.newTextButton()
        .setText('Open launch dialog')
        .setOnClickAction(CardService.newAction().setFunctionName('openLaunchDialogFromAddon_'))
    );

    card.addSection(intro);

    const status = CardService.newCardSection()
      .setHeader('Current document')
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('Title')
          .setContent(doc.getName())
      )
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('Selection detected')
          .setContent(selection ? 'Yes' : 'No')
      )
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('Document ID')
          .setContent(docId)
      );
    card.addSection(status);
  } catch (err) {
    intro.addWidget(
      CardService.newTextParagraph()
        .setText('Open this add-on from inside a Google Doc to inspect the active file and launch the reader.')
    );
    card.addSection(intro);
  }

  const help = CardService.newCardSection()
    .setHeader('How it works')
    .addWidget(
      CardService.newTextParagraph()
        .setText('The add-on provides discovery and launch. The actual reading experience opens in a separate browser window or tab.')
    );
  card.addSection(help);

  return card.build();
}

function onFileScopeGranted_(e) {
  return buildAddonHome_(e);
}

function openLaunchDialogFromAddon_(e) {
  try {
    showLaunchUi();
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Launch dialog opened.')
      )
      .build();
  } catch (err) {
    logDiagnostic_('addon_open_launch_dialog_error', {
      error: err
    });
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Could not open dialog here. Use “Open full document” or “Open current selection” instead.')
      )
      .build();
  }
}

function launchDocumentReaderFromAddon_(e) {
  return buildAddonOpenLinkResponse_('document');
}

function launchSelectionReaderFromAddon_(e) {
  return buildAddonOpenLinkResponse_('selection');
}

function buildAddonOpenLinkResponse_(sourceMode) {
  const launch = prepareReaderLaunch(sourceMode || 'document');
  const params = [
    'docId=' + encodeURIComponent(launch.docId),
    'sourceMode=' + encodeURIComponent(launch.sourceMode || 'document')
  ];

  if (launch.selectionToken && launch.sourceMode === 'selection') {
    params.push('selectionToken=' + encodeURIComponent(launch.selectionToken));
  }

  const url = launch.url + '?' + params.join('&');

  const openLink = CardService.newOpenLink()
    .setUrl(url)
    .setOpenAs(CardService.OpenAs.FULL_SIZE)
    .setOnClose(CardService.OnClose.NOTHING);

  logDiagnostic_('addon_open_link_response', {
    requestedSourceMode: sourceMode || 'document',
    resolvedSourceMode: launch.sourceMode || 'document',
    docId: launch.docId,
    launchUrl: launch.url,
    finalUrl: url
  });

  return CardService.newActionResponseBuilder()
    .setOpenLink(openLink)
    .build();
}
