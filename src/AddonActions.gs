function launchReaderFromAddon(e) {
  return buildAddonOpenLinkResponse_();
}

function showReaderLaunchBridge_() {
  const html = HtmlService.createHtmlOutputFromFile('LaunchBridge')
    .setWidth(320)
    .setHeight(120);
  DocumentApp.getUi().showModelessDialog(html, 'Opening DocPrompter');
}

function buildAddonOpenLinkResponse_() {
  const launch = prepareReaderLaunch();
  const openUrl = launch.openUrl || buildReaderOpenUrl_(launch);

  const openLink = CardService.newOpenLink()
    .setUrl(openUrl)
    .setOpenAs(CardService.OpenAs.FULL_SIZE)
    .setOnClose(CardService.OnClose.NOTHING);

  logDiagnostic_('addon_open_link_response', {
    docId: launch.docId,
    launchUrl: launch.url,
    openUrl: openUrl
  });

  return CardService.newActionResponseBuilder()
    .setOpenLink(openLink)
    .build();
}
