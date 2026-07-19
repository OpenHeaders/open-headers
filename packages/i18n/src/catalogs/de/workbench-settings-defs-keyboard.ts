/**
 * Workbench settings — keyboard-category setting definitions — German.
 * Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts` key for
 * key. Chord notation and physical key names (ArrowDown, Enter,
 * Space, ⌘K, Alt+C, …) ride raw inside keyed values — localized key
 * names are a deferred Phase I workstream. Action labels reuse the
 * shipped `workbench.shortcuts.action.*` and `popup.shortcuts.*` de
 * wording verbatim (S35 reuse law): Debug-Modus umschalten /
 * Befehlspalette / Seitenleisten / Unteres Panel / Aktivitäts-Feed /
 * Tastenkürzel / Design durchschalten; popup tab names quote the
 * shipped de labels („Diese Seite“, „Alle Regeln“, „Sammlungen“).
 * MINTS: der Import-Hub (`workbench-import-export.ts` must reuse);
 * cheatsheet = die Kurzübersicht; preset = die Voreinstellung;
 * chord = die Tastenfolge (chrome regions caption precedent);
 * spacebar in prose = die Leertaste. Brand tokens never compounded:
 * „Standardwerte von OpenHeaders“, „Im Stil von VS Code“.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'Debug-Modus umschalten',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    'Schaltet den Debug-Modus von jeder Oberfläche aus ein oder aus. Löst nur aus, wenn kein Textfeld ' +
    'fokussiert ist.',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'Der Debug-Modus ist in Chrome und Edge verfügbar.',
  'workbench.settings.def.keyboard.commandPalette.label': 'Befehlspalette öffnen',
  'workbench.settings.def.keyboard.commandPalette.description': 'Das Overlay der Befehlspalette anzeigen.',
  'workbench.settings.def.keyboard.openSettings.label': 'Einstellungen öffnen',
  'workbench.settings.def.keyboard.openSettings.description': 'Das Einstellungsfenster öffnen.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': 'Linke Seitenleiste umschalten',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': 'Die linke Seitenleiste anzeigen oder ausblenden.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': 'Rechte Seitenleiste umschalten',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': 'Die rechte Seitenleiste anzeigen oder ausblenden.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': 'Unteres Panel umschalten',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': 'Das untere Panel anzeigen oder ausblenden.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': 'Aktivitäts-Feed umschalten',
  'workbench.settings.def.keyboard.toggleActivityFeed.description':
    'Das Panel Aktivitäts-Feed anzeigen oder ausblenden.',
  'workbench.settings.def.keyboard.newRule.label': 'Element erstellen',
  'workbench.settings.def.keyboard.newRule.description': 'Das Erstellen-Menü für Regeln und API-Anfragen öffnen.',
  'workbench.settings.def.keyboard.newTab.label': 'Neuer Tab',
  'workbench.settings.def.keyboard.newTab.description': 'Einen neuen Tab mit einem API-Anfrage-Entwurf öffnen.',
  'workbench.settings.def.keyboard.import.label': 'Importieren',
  'workbench.settings.def.keyboard.import.description':
    'Den Import-Hub für curl, HAR und Arbeitsbereich-Dateien öffnen.',
  'workbench.settings.def.keyboard.save.label': 'Speichern',
  'workbench.settings.def.keyboard.save.description': 'Den aktiven Editor-Tab speichern.',
  'workbench.settings.def.keyboard.closeTab.label': 'Tab schließen',
  'workbench.settings.def.keyboard.closeTab.description': 'Den fokussierten Editor-Tab schließen.',
  'workbench.settings.def.keyboard.previousTab.label': 'Vorheriger Tab',
  'workbench.settings.def.keyboard.previousTab.description': 'Den vorherigen Editor-Tab fokussieren.',
  'workbench.settings.def.keyboard.nextTab.label': 'Nächster Tab',
  'workbench.settings.def.keyboard.nextTab.description': 'Den nächsten Editor-Tab fokussieren.',
  'workbench.settings.def.keyboard.tabSearch.label': 'Tabs durchsuchen',
  'workbench.settings.def.keyboard.tabSearch.description': 'Eine Suche über alle offenen Tabs öffnen.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'Filter des aktiven Bereichs fokussieren',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    'Den Fokus in das Filterfeld des Seitenleisten-Bereichs setzen, in dem du dich gerade befindest.',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': 'Linke Seitenleiste fokussieren',
  'workbench.settings.def.keyboard.focusLeftSidebar.description':
    'Den Tastaturfokus auf die linke Seitenleiste setzen.',
  'workbench.settings.def.keyboard.focusEditor.label': 'Editor fokussieren',
  'workbench.settings.def.keyboard.focusEditor.description': 'Den Tastaturfokus auf den Editor-Bereich setzen.',
  'workbench.settings.def.keyboard.focusRightSidebar.label': 'Rechte Seitenleiste fokussieren',
  'workbench.settings.def.keyboard.focusRightSidebar.description':
    'Den Tastaturfokus auf die rechte Seitenleiste setzen.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': 'Unteres Panel fokussieren',
  'workbench.settings.def.keyboard.focusBottomPanel.description':
    'Den Tastaturfokus auf die Tab-Zeile des unteren Panels setzen.',
  'workbench.settings.def.keyboard.terminalNewTab.label': 'Neuer Terminal-Tab',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    'Einen frischen Terminal-Tab starten, während das Terminal-Panel fokussiert ist; überall sonst behält die ' +
    'Tastenfolge ihre übliche Aktion Neuer Tab. Nur in der Desktop-App.',
  'workbench.settings.def.keyboard.showShortcutHelp.label': 'Tastenkürzel-Hilfe anzeigen',
  'workbench.settings.def.keyboard.showShortcutHelp.description': 'Die Kurzübersicht der Tastenkürzel anzeigen.',
  'workbench.settings.def.keyboard.find.label': 'Im Editor suchen',
  'workbench.settings.def.keyboard.find.description':
    'Das Such-Widget im fokussierten Code-Editor öffnen. Löst nur aus, wenn der Editor den Fokus hat — ' +
    'kollidiert nicht mit globalen Kürzeln.',
  'workbench.settings.def.keyboard.replace.label': 'Im Editor ersetzen',
  'workbench.settings.def.keyboard.replace.description':
    'Das Suchen-und-Ersetzen-Widget im fokussierten Code-Editor öffnen. Löst nur aus, wenn der Editor den ' +
    'Fokus hat — kollidiert nicht mit globalen Kürzeln.',
  'workbench.settings.def.keyboard.formatCode.label': 'Code formatieren',
  'workbench.settings.def.keyboard.formatCode.description':
    'Den Inhalt des fokussierten Code-Editors formatieren. Löst nur aus, wenn der Editor den Fokus hat — ' +
    'kollidiert nicht mit globalen Kürzeln.',
  'workbench.settings.def.keyboard.preset.label': 'Tastenkürzel-Voreinstellung',
  'workbench.settings.def.keyboard.preset.description':
    'Der Basissatz an Kürzeln. Kürzel, die du anpasst, liegen über der Voreinstellung und überstehen einen ' +
    'Wechsel.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'Standardwerte von OpenHeaders',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'Im Stil von VS Code',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': 'Popup — Tastenkürzel-Hilfe umschalten',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'Die Kurzübersicht der Tastenkürzel des Popups anzeigen oder ausblenden.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'Popup — Optionsmenü umschalten',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description':
    'Das Options-Dropdown in der Fußzeile öffnen oder schließen.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'Popup — Suche fokussieren',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    'Den Tastaturfokus in das Suchfeld des aktiven Tabs setzen.',
  'workbench.settings.def.keyboard.popup.prevPage.label': 'Popup — Vorherige Seite',
  'workbench.settings.def.keyboard.popup.prevPage.description':
    'Zur vorherigen Seite der Regeln im aktiven Tab springen.',
  'workbench.settings.def.keyboard.popup.nextPage.label': 'Popup — Nächste Seite',
  'workbench.settings.def.keyboard.popup.nextPage.description':
    'Zur nächsten Seite der Regeln im aktiven Tab springen.',
  'workbench.settings.def.keyboard.popup.moveDown.label': 'Popup — Nach unten',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'Den Fokus eine Zeile nach unten bewegen. ArrowDown ist immer als Alias verfügbar.',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'Popup — Nach oben',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'Den Fokus auf die vorherige Zeile bewegen. ArrowUp ist immer als Alias verfügbar.',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'Popup — Ausklappen / in Unterzeilen wechseln',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'Die fokussierte Zeile ausklappen. ArrowRight und Enter sind immer als Alias verfügbar.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'Popup — Einklappen / Unterzeilen verlassen',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'Die fokussierte Zeile einklappen. ArrowLeft ist immer als Alias verfügbar.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'Popup — Zeile umschalten',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    'Die fokussierte Regel ein- oder ausschalten. Standard ist die Leertaste.',
  'workbench.settings.def.keyboard.popup.editRow.label': 'Popup — Zeile bearbeiten',
  'workbench.settings.def.keyboard.popup.editRow.description': 'Die fokussierte Regel im Arbeitsbereich-Editor öffnen.',
  'workbench.settings.def.keyboard.popup.copyValue.label': 'Popup — Wert kopieren',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'Den Hauptwert der fokussierten Zeile in die Zwischenablage kopieren.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'Popup — Zeile löschen',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'Die fokussierte Zeile zum Löschen vormerken. Drücke erneut (oder Enter), um zu bestätigen.',
  'workbench.settings.def.keyboard.popup.addRule.label': 'Popup — Regel hinzufügen',
  'workbench.settings.def.keyboard.popup.addRule.description': 'Eine neue Regel aus dem Popup heraus erstellen.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label': 'Popup — Pause aller Regeln umschalten (global)',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'Alle Regeln in allen Sammlungen pausieren oder fortsetzen.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label':
    'Popup — Pause umschalten (fokussierte Sammlung / fokussierter Ordner)',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    'Die fokussierte Sammlung oder den fokussierten Ordner im Tab „Sammlungen“ pausieren oder fortsetzen. ' +
    'Wirkt nicht auf einzelne Regelzeilen — Regeln verwenden stattdessen den Aktiv-Schalter (Space).',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'Popup — Design durchschalten',
  'workbench.settings.def.keyboard.popup.cycleTheme.description':
    'Zwischen hellem, dunklem und automatischem Design rotieren.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'Popup — Kompaktmodus umschalten',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'Das Popup zwischen kompakter und komfortabler Dichte umschalten.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': 'Popup — Arbeitsbereich öffnen',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': 'Den vollständigen Arbeitsbereich-Tab öffnen.',
  'workbench.settings.def.keyboard.popup.openSettings.label': 'Popup — Einstellungen öffnen',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    'Die Einstellungsseite in einem neuen Arbeitsbereich-Tab öffnen. Entspricht dem Kürzel im Arbeitsbereich.',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'Popup — Tab „Diese Seite“',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': 'Den Regel-Tab „Diese Seite“ aktivieren.',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'Popup — Tab „Alle Regeln“',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': 'Den Tab „Alle Regeln“ aktivieren.',
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'Popup — Tab „Sammlungen“',
  'workbench.settings.def.keyboard.popup.tabCollections.description': 'Den Tab „Sammlungen“ aktivieren.',
  'workbench.settings.def.keyboard.popup.toggleSurface.label': 'Popup — Oberfläche umschalten (Popup ↔ Seitenpanel)',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    'Aus der Kopfzeile des Popups zwischen den Layouts Popup und Seitenpanel wechseln.',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'Popup — Tour öffnen',
  'workbench.settings.def.keyboard.popup.openTourGuide.description':
    'Die Willkommens-Tour aus jedem Popup-Tab erneut abspielen.',
} as const satisfies Catalog;
