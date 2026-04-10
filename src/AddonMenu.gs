function createDocPrompterMenu_() {
  const ui = DocumentApp.getUi();
  return ui.createAddonMenu ? ui.createAddonMenu() : ui.createMenu('DocPrompter');
}
