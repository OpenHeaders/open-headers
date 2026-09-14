/**
 * Workbench settings — the keyboard setting-definition corpus —
 * Romanian. Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts`
 * key for key; see that file for the corpus rules. Chord notation and
 * key names (ArrowDown / ArrowUp / ArrowRight / ArrowLeft / Enter /
 * Space) ride raw (S46); curl / HAR / VS Code raw. The popup labels
 * keep the `Popup —` prefix as the spaced aside dash (Fereastra popup
 * — În jos) with the shipped `popup.shortcuts.*` ro wording verbatim
 * after it (Focalizare căutare / Pagina anterioară / Pagina următoare
 * / În jos / În sus / Extindere / intrare în sub-rânduri / Restrângere
 * / ieșire din sub-rânduri / Comutare activat / dezactivat / Editare
 * regulă / Copiere valoare / Adăugare regulă nouă / Pauză / reluare
 * toate regulile / Pauză / reluare colecție sau folder / Meniu de
 * opțiuni / Schimbare temă / Mod compact / Deschidere spațiu de lucru
 * / Deschidere setări / Fila „Această pagină” / Fila „Toate regulile” /
 * Fila „Colecții” / Comutare fereastră popup / panou lateral /
 * Deschidere tur ghidat); the cheatsheet and delete rows take the
 * settings-page wording (Ajutor pentru scurtături / Ștergere rând).
 * MINTS: fișă de referință = cheatsheet; centrul de import = the
 * import hub (`workbench-import-export.ts` MUST reuse); tasta spațiu =
 * the spacebar; Implicit OpenHeaders / În stilul VS Code = the preset
 * pair; Creare element = Create Item; Căutare în file = Search Tabs;
 * Focalizare filtrul secțiunii active; Filă nouă de terminal.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'Comutare mod Depanare',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    'Activează sau dezactivează modul Depanare de pe orice suprafață. Se declanșează doar când niciun câmp de text nu este focalizat.',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'Modul Depanare este disponibil în browserele Chrome și Edge.',
  'workbench.settings.def.keyboard.commandPalette.label': 'Deschidere paleta de comenzi',
  'workbench.settings.def.keyboard.commandPalette.description': 'Afișează suprapunerea paletei de comenzi.',
  'workbench.settings.def.keyboard.openSettings.label': 'Deschidere setări',
  'workbench.settings.def.keyboard.openSettings.description': 'Deschide fereastra modală de setări.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': 'Comutare bară laterală stângă',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': 'Afișează sau ascunde bara laterală stângă.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': 'Comutare bară laterală dreaptă',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': 'Afișează sau ascunde bara laterală dreaptă.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': 'Comutare panou inferior',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': 'Afișează sau ascunde panoul inferior.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': 'Comutare Flux de activitate',
  'workbench.settings.def.keyboard.toggleActivityFeed.description': 'Afișează sau ascunde panoul Flux de activitate.',
  'workbench.settings.def.keyboard.newRule.label': 'Creare element',
  'workbench.settings.def.keyboard.newRule.description': 'Deschide meniul de creare pentru reguli și cereri API.',
  'workbench.settings.def.keyboard.newTab.label': 'Filă nouă',
  'workbench.settings.def.keyboard.newTab.description': 'Deschide o filă nouă cu o ciornă de cerere API.',
  'workbench.settings.def.keyboard.import.label': 'Import',
  'workbench.settings.def.keyboard.import.description':
    'Deschide centrul de import pentru curl, HAR și fișiere de spațiu de lucru.',
  'workbench.settings.def.keyboard.save.label': 'Salvare',
  'workbench.settings.def.keyboard.save.description': 'Salvează fila de editor activă.',
  'workbench.settings.def.keyboard.closeTab.label': 'Închidere filă',
  'workbench.settings.def.keyboard.closeTab.description': 'Închide fila de editor focalizată.',
  'workbench.settings.def.keyboard.previousTab.label': 'Fila anterioară',
  'workbench.settings.def.keyboard.previousTab.description': 'Focalizează fila de editor anterioară.',
  'workbench.settings.def.keyboard.nextTab.label': 'Fila următoare',
  'workbench.settings.def.keyboard.nextTab.description': 'Focalizează fila de editor următoare.',
  'workbench.settings.def.keyboard.tabSearch.label': 'Căutare în file',
  'workbench.settings.def.keyboard.tabSearch.description':
    'Deschide o suprapunere de căutare în toate filele deschise.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'Focalizare filtrul secțiunii active',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    'Mută focalizarea în câmpul de filtrare al secțiunii din bara laterală în care vă aflați.',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': 'Focalizare bară laterală stângă',
  'workbench.settings.def.keyboard.focusLeftSidebar.description':
    'Mută focalizarea tastaturii pe bara laterală stângă.',
  'workbench.settings.def.keyboard.focusEditor.label': 'Focalizare editor',
  'workbench.settings.def.keyboard.focusEditor.description': 'Mută focalizarea tastaturii pe zona editorului.',
  'workbench.settings.def.keyboard.focusRightSidebar.label': 'Focalizare bară laterală dreaptă',
  'workbench.settings.def.keyboard.focusRightSidebar.description':
    'Mută focalizarea tastaturii pe bara laterală dreaptă.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': 'Focalizare panou inferior',
  'workbench.settings.def.keyboard.focusBottomPanel.description':
    'Mută focalizarea tastaturii pe rândul de file al panoului inferior.',
  'workbench.settings.def.keyboard.terminalNewTab.label': 'Filă nouă de terminal',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    'Pornește o filă nouă de terminal cât timp panoul Terminal este focalizat; în altă parte, combinația își păstrează acțiunea obișnuită Filă nouă. Doar în aplicația desktop.',
  'workbench.settings.def.keyboard.showShortcutHelp.label': 'Afișare ajutor pentru scurtături',
  'workbench.settings.def.keyboard.showShortcutHelp.description':
    'Afișează fișa de referință a scurtăturilor de tastatură.',
  'workbench.settings.def.keyboard.find.label': 'Căutare în editor',
  'workbench.settings.def.keyboard.find.description':
    'Deschide widgetul de căutare în editorul de cod focalizat. Se declanșează doar când editorul are focalizarea — nu interferează cu scurtăturile globale.',
  'workbench.settings.def.keyboard.replace.label': 'Înlocuire în editor',
  'workbench.settings.def.keyboard.replace.description':
    'Deschide widgetul de căutare și înlocuire în editorul de cod focalizat. Se declanșează doar când editorul are focalizarea — nu interferează cu scurtăturile globale.',
  'workbench.settings.def.keyboard.formatCode.label': 'Formatare cod',
  'workbench.settings.def.keyboard.formatCode.description':
    'Formatează conținutul editorului de cod focalizat. Se declanșează doar când editorul are focalizarea — nu interferează cu scurtăturile globale.',
  'workbench.settings.def.keyboard.preset.label': 'Presetare',
  'workbench.settings.def.keyboard.preset.description':
    'Setul de bază de scurtături. Scurtăturile personalizate de dvs. rămân deasupra presetării și supraviețuiesc schimbării ei.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'Implicit OpenHeaders',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'În stilul VS Code',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': 'Fereastra popup — Ajutor pentru scurtături',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'Afișează sau ascunde fișa de referință a scurtăturilor de tastatură din fereastra popup.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'Fereastra popup — Meniu de opțiuni',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description':
    'Deschide sau închide lista derulantă de opțiuni din subsol.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'Fereastra popup — Focalizare căutare',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    'Mută focalizarea tastaturii în câmpul de căutare al filei active.',
  'workbench.settings.def.keyboard.popup.prevPage.label': 'Fereastra popup — Pagina anterioară',
  'workbench.settings.def.keyboard.popup.prevPage.description': 'Sare la pagina anterioară de reguli din fila activă.',
  'workbench.settings.def.keyboard.popup.nextPage.label': 'Fereastra popup — Pagina următoare',
  'workbench.settings.def.keyboard.popup.nextPage.description': 'Sare la pagina următoare de reguli din fila activă.',
  'workbench.settings.def.keyboard.popup.moveDown.label': 'Fereastra popup — În jos',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'Avansează rândul focalizat. ArrowDown este disponibilă întotdeauna ca alias.',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'Fereastra popup — În sus',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'Mută focalizarea pe rândul anterior. ArrowUp este disponibilă întotdeauna ca alias.',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'Fereastra popup — Extindere / intrare în sub-rânduri',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'Extinde rândul focalizat. ArrowRight și Enter sunt disponibile întotdeauna ca aliasuri.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'Fereastra popup — Restrângere / ieșire din sub-rânduri',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'Restrânge rândul focalizat. ArrowLeft este disponibilă întotdeauna ca alias.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'Fereastra popup — Comutare activat / dezactivat',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    'Activează sau dezactivează regula focalizată. Implicit pe tasta spațiu.',
  'workbench.settings.def.keyboard.popup.editRow.label': 'Fereastra popup — Editare regulă',
  'workbench.settings.def.keyboard.popup.editRow.description':
    'Deschide regula focalizată în editorul spațiului de lucru.',
  'workbench.settings.def.keyboard.popup.copyValue.label': 'Fereastra popup — Copiere valoare',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'Copiază valoarea principală a rândului focalizat în clipboard.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'Fereastra popup — Ștergere rând',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'Pregătește rândul focalizat pentru ștergere. Apăsați din nou (sau Enter) pentru confirmare.',
  'workbench.settings.def.keyboard.popup.addRule.label': 'Fereastra popup — Adăugare regulă nouă',
  'workbench.settings.def.keyboard.popup.addRule.description': 'Creează o regulă nouă din fereastra popup.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label':
    'Fereastra popup — Pauză / reluare toate regulile (global)',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'Pune în pauză sau reia fiecare regulă din fiecare colecție.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label':
    'Fereastra popup — Pauză / reluare colecție sau folder (focalizat)',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    'Pune în pauză sau reia colecția ori folderul focalizat din fila „Colecții”. Nu are efect asupra rândurilor de reguli individuale — regulile folosesc în schimb comutatorul de activare (Space).',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'Fereastra popup — Schimbare temă',
  'workbench.settings.def.keyboard.popup.cycleTheme.description':
    'Rotește între temele luminoasă, întunecată și automată.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'Fereastra popup — Mod compact',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'Comută fereastra popup între densitatea compactă și cea aerisită.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': 'Fereastra popup — Deschidere spațiu de lucru',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': 'Deschide fila completă a spațiului de lucru.',
  'workbench.settings.def.keyboard.popup.openSettings.label': 'Fereastra popup — Deschidere setări',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    'Deschide pagina de setări într-o filă nouă a spațiului de lucru. Se potrivește cu asocierea din spațiul de lucru.',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'Fereastra popup — Fila „Această pagină”',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': 'Activează fila de reguli „Această pagină”.',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'Fereastra popup — Fila „Toate regulile”',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': 'Activează fila „Toate regulile”.',
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'Fereastra popup — Fila „Colecții”',
  'workbench.settings.def.keyboard.popup.tabCollections.description': 'Activează fila „Colecții”.',
  'workbench.settings.def.keyboard.popup.toggleSurface.label':
    'Fereastra popup — Comutare fereastră popup / panou lateral',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    'Comută între aspectul de fereastră popup și cel de panou lateral din antetul ferestrei popup.',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'Fereastra popup — Deschidere tur ghidat',
  'workbench.settings.def.keyboard.popup.openTourGuide.description':
    'Reia turul de bun venit din orice filă a ferestrei popup.',
} as const satisfies Catalog;
