function buildAddonHome_(e) {
  const card = CardService.newCardBuilder();

  const intro = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph()
        .setText('Turn the current Google Doc into a separate reading window for video calls.')
    );

  try {
    const doc = DocumentApp.getActiveDocument();

    intro.addWidget(
      CardService.newTextButton()
        .setText('Open Reader')
        .setOnClickAction(CardService.newAction().setFunctionName('launchReaderFromAddon'))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
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
          .setTopLabel('Document ID')
          .setContent(doc.getId())
      );
    card.addSection(status);
  } catch (err) {
    intro.addWidget(
      CardService.newTextParagraph()
        .setText('Open this add-on from inside a Google Doc to launch the detached reader for the active file.')
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
