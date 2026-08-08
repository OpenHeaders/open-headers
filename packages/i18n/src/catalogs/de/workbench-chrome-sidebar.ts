/**
 * Workbench chrome — the navigator plane — German. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key; extends the
 * de register contract (`de/shared.ts`). Reuses the de mints:
 * Arbeitsbereich-Variablen / Live-Variablen / Paketbibliothek,
 * rule-type names from the shipped `popup.ruleType.*` set, pause
 * vocabulary Pausieren / Fortsetzen, aufklappen / zuklappen
 * (expand / collapse, S70), Überschreibung = override
 * (panel-inspector precedent), Verdrängung = supersede
 * (workbench-chrome). MINT: rule-match scope-widened = die
 * Abdeckung — a separate referent from Geltungsbereich
 * (variable/cookie scope) and Reichweite (debug reach), the S19
 * separate-referent law kept intact; Zurücknehmen = revert.
 * Badges stay terse markers (nouns keep their capital per German
 * orthography); `vars` / `Scripts` / `Vault` / `delete-wins` ride
 * raw. de plurals: one/other. Entity names, collection names, and
 * counts ride raw inside keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'REGELN',
  'workbench.sidebar.section.templates': 'VORLAGEN',
  'workbench.sidebar.section.requests': 'ANFRAGEN',
  'workbench.sidebar.section.workflows': 'WORKFLOWS',
  'workbench.sidebar.section.environments': 'UMGEBUNGEN',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': 'ARBEITSBEREICH-VARIABLEN',
  'workbench.sidebar.section.liveVariables': 'LIVE-VARIABLEN',
  'workbench.sidebar.section.packageLibrary': 'PAKETBIBLIOTHEK',
  'workbench.sidebar.section.specs': 'SPEZIFIKATIONEN',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'HTTP-Regeln',
  'workbench.sidebar.view.apiRequests': 'API-Anfragen',
  'workbench.sidebar.view.workflows': 'Workflows',
  'workbench.sidebar.view.variables': 'Variablen',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'Neue Regel',
  'workbench.sidebar.header.addRequest': 'Anfrage hinzufügen',
  'workbench.sidebar.header.createNewEnvironment': 'Neue Umgebung erstellen',
  'workbench.sidebar.header.createNewSpec': 'Neue Spezifikation erstellen',
  'workbench.sidebar.header.newWorkflow': 'Neuer Workflow',
  'workbench.sidebar.header.newTemplateCollection': 'Neue Vorlagen-Sammlung',
  'workbench.sidebar.header.exportSelected': '{count} ausgewählte exportieren…',
  'workbench.sidebar.header.exportSelectedAria': 'Die {count} ausgewählten Elemente exportieren',
  'workbench.sidebar.header.clearSelection': 'Auswahl aufheben',
  'workbench.sidebar.header.clearSelectionAria': 'Export-Auswahl aufheben',
  'workbench.sidebar.header.selectOpenedTab': 'Geöffneten Tab auswählen',
  'workbench.sidebar.header.selectOpenedTabAria': 'Geöffneten Tab auswählen',
  'workbench.sidebar.header.expandAll': 'Alle aufklappen',
  'workbench.sidebar.header.expandAllAria': 'Alle aufklappen',
  'workbench.sidebar.header.collapseAll': 'Alle zuklappen',
  'workbench.sidebar.header.collapseAllAria': 'Alle zuklappen',
  'workbench.sidebar.behavior.title': 'Verhalten',
  'workbench.sidebar.behavior.openEntriesSingleClick': 'Einträge mit Einfachklick öffnen',
  'workbench.sidebar.behavior.openCollectionsSingleClick': 'Sammlungen mit Einfachklick öffnen',
  'workbench.sidebar.behavior.openFoldersSingleClick': 'Ordner mit Einfachklick öffnen',
  'workbench.sidebar.behavior.alwaysSelectOpened': 'Geöffneten Tab immer auswählen',
  'workbench.sidebar.filterPlaceholder': 'Filtern',

  // ── Sidebar: Schnellsuchleiste (bei Bedarf, dualer Modus) ──
  'workbench.sidebar.menu.search': 'Suchen',
  'workbench.sidebar.search.searchPlaceholder': 'Suchen',
  'workbench.sidebar.search.modeSearch': 'Suche: passende Zeilen hervorheben',
  'workbench.sidebar.search.modeFilter': 'Filter: nicht passende Zeilen ausblenden',
  'workbench.sidebar.search.noMatches': 'Keine Treffer',
  'workbench.sidebar.search.close': 'Suche schließen',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': 'Neue Sammlung',
  'workbench.sidebar.menu.newRequest': 'Neue Anfrage',
  'workbench.sidebar.menu.import': 'Importieren…',
  'workbench.sidebar.menu.addRule': 'Regel hinzufügen',
  'workbench.sidebar.menu.addRequest': 'Anfrage hinzufügen',
  'workbench.sidebar.menu.addGrpcRequest': 'gRPC-Anfrage hinzufügen',
  'workbench.sidebar.menu.addWebSocketRequest': 'WebSocket-Anfrage hinzufügen',
  'workbench.sidebar.menu.addSocketIoRequest': 'Socket.IO-Anfrage hinzufügen',
  'workbench.sidebar.menu.addFolder': 'Ordner hinzufügen',
  'workbench.sidebar.menu.rename': 'Umbenennen',
  'workbench.sidebar.menu.editVariables': 'Variablen bearbeiten',
  'workbench.sidebar.menu.createWorkflow': 'Workflow erstellen…',
  'workbench.sidebar.menu.export': 'Exportieren…',
  'workbench.sidebar.menu.delete': 'Löschen',
  'workbench.sidebar.menu.duplicate': 'Duplizieren',
  'workbench.sidebar.menu.copyAs': 'Kopieren als',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.pauseCollection': 'Sammlung pausieren',
  'workbench.sidebar.menu.unpauseCollection': 'Sammlung fortsetzen',
  'workbench.sidebar.menu.pauseFolder': 'Ordner pausieren',
  'workbench.sidebar.menu.unpauseFolder': 'Ordner fortsetzen',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'Pausen-Überschreibung der Sammlung zurücksetzen',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'Pausen-Überschreibung des Ordners zurücksetzen',
  'workbench.sidebar.menu.clearNestedPauseOverrides': 'Verschachtelte Pausen-Überschreibungen entfernen',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': 'pausiert',
  'workbench.sidebar.badge.draft': 'Entwurf',
  'workbench.sidebar.badge.unresolved': 'ungelöst',
  'workbench.sidebar.badge.off': 'aus',
  'workbench.sidebar.badge.incomplete': 'unvollständig',
  'workbench.sidebar.badge.scratch': 'Skizze',
  'workbench.sidebar.badge.scripts': 'Scripts',
  'workbench.sidebar.badge.specDrift': 'geändert',
  'workbench.sidebar.badge.scriptsTooltip':
    'Diese importierte Anfrage führt beim Ausführen JavaScript aus. Öffne sie, um die Scripts zu prüfen.',
  'workbench.sidebar.badge.dirtyAria': 'ungespeicherte Änderungen',
  'workbench.sidebar.rule.enable': 'Regel aktivieren',
  'workbench.sidebar.rule.disable': 'Regel deaktivieren',
  'workbench.sidebar.env.setActive': 'Aktiv setzen',
  'workbench.sidebar.env.setInactive': 'Inaktiv setzen',
  'workbench.sidebar.env.setDefault': 'Als Standard festlegen',
  'workbench.sidebar.env.unsetDefault': 'Standard entfernen',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} var',
      other: '{count} vars',
    }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Live-Variable an diesen Workflow gebunden',
      other: '{count} Live-Variablen an diesen Workflow gebunden',
    }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'Ordner ist leer',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'Sammlung ist leer',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'Noch keine Anfragen',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'Noch keine Vorlagen',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'Füge eine Regel oder einen Ordner hinzu, um loszulegen.',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'Füge eine Anfrage oder einen Ordner hinzu, um loszulegen.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'Speichere eine Regel als Vorlage, um ihn zu füllen.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': 'Speichere eine Regel als Vorlage aus dem Editor.',
  'workbench.sidebar.placeholder.addRule': 'Regel hinzufügen',
  'workbench.sidebar.placeholder.addFolder': 'Ordner hinzufügen',
  'workbench.sidebar.placeholder.addRequest': 'Anfrage hinzufügen',
  'workbench.sidebar.emptySection': 'Keine Elemente in diesem Bereich',
  'workbench.sidebar.emptySectionCreate': 'Erstellen',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'Systemvorlagen',
  'workbench.sidebar.ruleType.header': 'Header',
  'workbench.sidebar.ruleType.block': 'Blockieren',
  'workbench.sidebar.ruleType.redirect': 'Umleiten',
  'workbench.sidebar.ruleType.queryParam': 'Query-Parameter',
  'workbench.sidebar.ruleType.inject': 'Injizieren',
  'workbench.sidebar.ruleType.delay': 'Verzögerung',
  'workbench.sidebar.ruleType.requestBody': 'API-Anfrage-Body',
  'workbench.sidebar.ruleType.response': 'API-Antwort',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': 'Arbeitsbereich-Variablen',
  'workbench.sidebar.singleton.liveVariables': 'Live-Variablen',
  'workbench.sidebar.singleton.packageLibrary': 'Paketbibliothek',

  // ── Sidebar: default entity names ───────────────────────────────────
  'workbench.sidebar.defaults.newFolder': 'Neuer Ordner',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': 'Element löschen?',
  'workbench.sidebar.confirmDelete.bodyPrefix': 'Willst du ',
  'workbench.sidebar.confirmDelete.bodySuffix': ' wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  'workbench.sidebar.confirmDelete.ok': 'Löschen',
  'workbench.sidebar.toast.toggleRuleFailed': 'Regel konnte nicht umgeschaltet werden',
  'workbench.sidebar.toast.renameExampleFailed': 'Beispiel konnte nicht umbenannt werden',
  'workbench.sidebar.toast.duplicateExampleFailed': 'Beispiel konnte nicht dupliziert werden',
  'workbench.sidebar.toast.deleteExampleFailed': 'Beispiel konnte nicht gelöscht werden',
  'workbench.sidebar.toast.createRequestCollectionFailed': 'Anfragen-Sammlung konnte nicht erstellt werden',
  'workbench.sidebar.toast.createEnvironmentFailed': 'Umgebung konnte nicht erstellt werden',
  'workbench.sidebar.toast.createSpecFailed': 'Spezifikation konnte nicht erstellt werden',
  'workbench.sidebar.toast.renameSpecFailed': 'Spezifikation konnte nicht umbenannt werden',
  'workbench.sidebar.toast.deleteSpecFailed': 'Spezifikation konnte nicht gelöscht werden',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────
  'workbench.sidebar.dnd.dragToReorderFolder': 'Zum Neuordnen des Ordners ziehen',

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': 'Änderung zurückgenommen',
  'workbench.activityFeed.revertFailed': 'Zurücknehmen fehlgeschlagen: {reason}',
  'workbench.activityFeed.emptyTitle': 'Noch keine Aktivität',
  'workbench.activityFeed.emptyHint': 'Eingehende Änderungen von Peers erscheinen hier.',
  'workbench.activityFeed.view': 'Anzeigen',
  'workbench.activityFeed.mute': 'Stummschalten',
  'workbench.activityFeed.unmute': 'Stummschaltung aufheben',
  'workbench.activityFeed.muteTip':
    'Unterdrückt weitere eingehende Aktivitätszeilen für diese Entität. Vergangene Zeilen bleiben erhalten.',
  'workbench.activityFeed.unmuteTip': 'Eingehende Aktivität für diese Entität nicht mehr unterdrücken.',
  'workbench.activityFeed.revert': 'Zurücknehmen',
  'workbench.activityFeed.revertTip':
    'Wendet das Inverse dieser Änderung an. Erzeugt eine neue Mutation, die die Entität in ihren Zustand vor ' +
    'dem Eingang zurückversetzt.',
  'workbench.activityFeed.revertUnavailableDelete':
    'Löschungen sind endgültig und können nicht zurückgenommen werden (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': 'Diese Änderung kann nicht zurückgenommen werden.',
  'workbench.activityFeed.kind.created': 'Erstellt',
  'workbench.activityFeed.kind.createdTip': 'Eine neue Entität ist von einem Peer eingetroffen.',
  'workbench.activityFeed.kind.edited': 'Bearbeitet',
  'workbench.activityFeed.kind.editedTip': 'Ein Peer hat Felder dieser Entität bearbeitet.',
  'workbench.activityFeed.kind.deleted': 'Gelöscht',
  'workbench.activityFeed.kind.deletedTip': 'Ein Peer hat diese Entität gelöscht.',
  'workbench.activityFeed.kind.superseded': 'Lokale Änderung verdrängt',
  'workbench.activityFeed.kind.supersededTip': 'Eine eingehende Mutation hat deine laufende lokale Änderung verdrängt.',
  'workbench.activityFeed.kind.sensitiveRotation': 'Sensibles Feld rotiert',
  'workbench.activityFeed.kind.sensitiveRotationTip':
    'Ein sensibles Feld (Secret / Token / sensibler Header) wurde ersetzt.',
  'workbench.activityFeed.kind.scopeWidened': 'Abdeckung erweitert',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'Eine Regelbedingung wurde gelockert — die Regel trifft jetzt mehr Kombinationen aus URL und Methode.',
  'workbench.activityFeed.kind.agentObserved': 'Agent-Lesezugriff',
  'workbench.activityFeed.kind.agentObservedTip':
    'Ein Agent hat Live-Traffic über die MCP-Stufe observe gelesen — geschwärzte Projektionen einer scharf ' +
    'geschalteten Quelle.',
  'workbench.activityFeed.rawRead': 'Ungeschwärzt',
  'workbench.activityFeed.rawReadTip':
    'Dieser Lesezugriff projizierte Rohwerte — die Freigabe für ungeschwärzte Sitzungs-Lesezugriffe war in ' +
    'Einstellungen → Traffic-Monitor aktiviert.',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Regel',
      other: '{count} Regeln',
    }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Anfrage',
      other: '{count} Anfragen',
    }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Vorlage',
      other: '{count} Vorlagen',
    }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} Ordner',
      other: '· {count} Ordner',
    }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} Unterordner',
      other: '· {count} Unterordner',
    }),
  'workbench.overview.stats.activeTag': '{count} aktiv',
  'workbench.overview.stats.disabledTag': '{count} deaktiviert',
  'workbench.overview.stats.draftTag': '{count} im Entwurf',
  'workbench.overview.stats.pausedTag': 'Pausiert',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Ordner · {count} Regel',
      other: 'Ordner · {count} Regeln',
    }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Ordner · {count} Anfrage',
      other: 'Ordner · {count} Anfragen',
    }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Ordner · {count} Vorlage',
      other: 'Ordner · {count} Vorlagen',
    }),
  'workbench.overview.status.draft': 'Entwurf',
  'workbench.overview.status.incomplete': 'Unvollständig',
  'workbench.overview.status.disabled': 'Deaktiviert',
  'workbench.overview.status.paused': 'Pausiert',
  'workbench.overview.status.active': 'Aktiv',
  'workbench.overview.action.addRule': 'Regel hinzufügen',
  'workbench.overview.action.addRequest': 'Anfrage hinzufügen',
  'workbench.overview.action.pause': 'Pausieren',
  'workbench.overview.action.resume': 'Fortsetzen',
  'workbench.overview.action.pauseCollectionTooltip': 'Alle Regeln in dieser Sammlung pausieren',
  'workbench.overview.action.resumeCollectionTooltip': 'Alle Regeln in dieser Sammlung fortsetzen',
  'workbench.overview.action.pauseFolderTooltip': 'Alle Regeln in diesem Ordner pausieren',
  'workbench.overview.action.resumeFolderTooltip': 'Alle Regeln in diesem Ordner fortsetzen',
  'workbench.overview.action.variables': 'Variablen',
  'workbench.overview.action.variablesTooltip': 'Die auf diese Sammlung begrenzten Variablen bearbeiten',
  'workbench.overview.action.variablesTooltipRequest':
    'Die auf diese Anfragen-Sammlung begrenzten Variablen bearbeiten',
  'workbench.overview.action.variablesTooltipTemplate':
    'Die auf diese Vorlagen-Sammlung begrenzten Variablen bearbeiten',
  'workbench.overview.action.scripts': 'Scripts',
  'workbench.overview.action.scriptsTooltipCollection':
    'Scripts bearbeiten, die für jede Anfrage in dieser Sammlung laufen',
  'workbench.overview.action.scriptsTooltipFolder': 'Scripts bearbeiten, die für jede Anfrage in diesem Ordner laufen',
  'workbench.overview.action.auth': 'Autorisierung',
  'workbench.overview.action.authTooltipCollection':
    'Die Standard-Autorisierung festlegen, die jede Anfrage in dieser Sammlung erbt',
  'workbench.overview.action.authTooltipFolder':
    'Die Standard-Autorisierung festlegen, die jede Anfrage in diesem Ordner erbt',
  'workbench.overview.caption.description': 'Beschreibung',
  'workbench.overview.caption.contents': 'Inhalt',
  'workbench.overview.empty.collectionNotFound': 'Sammlung nicht gefunden',
  'workbench.overview.empty.folderNotFound': 'Ordner nicht gefunden',
  'workbench.overview.empty.requestCollectionNotFound': 'Anfragen-Sammlung nicht gefunden',
  'workbench.overview.empty.templateCollectionNotFound': 'Vorlagen-Sammlung nicht gefunden',
  'workbench.overview.empty.noItems': 'Noch keine Elemente',
  'workbench.overview.empty.noRequests': 'Noch keine Anfragen',
  'workbench.overview.empty.templatesCollection':
    'Keine Vorlagen in dieser Sammlung. Speichere eine Regel als Vorlage, um diese Sammlung zu füllen.',
  'workbench.overview.empty.templatesFolder':
    'Noch keine Vorlagen — speichere eine Regel im Regel-Editor als Vorlage, um diesen Ordner zu füllen.',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'Sammlung suchen',
  'workbench.collectionPicker.empty': 'Noch keine Sammlungen — beim Import wird eine für dich erstellt.',
  'workbench.collectionPicker.noMatch': 'Keine passenden Sammlungen.',
  'workbench.collectionPicker.newCollection': 'Neue Sammlung',
} as const satisfies Catalog;
