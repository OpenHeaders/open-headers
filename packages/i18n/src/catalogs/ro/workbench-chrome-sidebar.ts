/**
 * Workbench chrome — the navigator plane — Romanian. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key. Entity names,
 * collection names, and counts ride raw inside keyed values; `VAULT` /
 * `Vault` / `delete-wins` / `cURL` / `fetch` / the Live prefix ride
 * raw. Section headers keep en's caps (REGULI, VARIABILE LIVE — the
 * shared-workspace ACTIV precedent). Reuses mints: Schiță = Scratch,
 * Ciornă = Draft, Blocare = Block, suprascriere = override, colecție /
 * flux de lucru / mediu / specificație carried; rule-type names align
 * with the chrome registry (Antet / Blocare / Redirecționare /
 * Parametru de interogare / Injectare / Întârziere / Corp cerere API /
 * Răspuns API). File mints: Biblioteca de pachete carried; substituire
 * = supersede (the superseded local edit — decided over înlocuire =
 * Replace and suprascriere = Override); acoperire = rule-match
 * coverage (scope-widened — the S19 third referent beside sferă = the
 * variable scope and rază de acțiune = the debug reach); suprascriere
 * de pauză = pause override; reluare = resume / unpause; revenire =
 * revert; ignorare = mute (Anulare ignorare = unmute); nemascat =
 * unredacted (mascare = redact carried from panel-inspector); peer
 * carried; „Instrumente › Trafic” = the Tools › Traffic settings path
 * (the settings file quotes it). The confirm-delete sandwich keeps its
 * en edge spaces around the bold name. Plurals one / few / other
 * (element / elemente / de elemente, folder / foldere / de foldere);
 * the overview tags take a colon frame (active: {count}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'REGULI',
  'workbench.sidebar.section.templates': 'ȘABLOANE',
  'workbench.sidebar.section.requests': 'CERERI',
  'workbench.sidebar.section.workflows': 'FLUXURI DE LUCRU',
  'workbench.sidebar.section.environments': 'MEDII',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': 'VARIABILE DE SPAȚIU DE LUCRU',
  'workbench.sidebar.section.liveVariables': 'VARIABILE LIVE',
  'workbench.sidebar.section.packageLibrary': 'BIBLIOTECA DE PACHETE',
  'workbench.sidebar.section.specs': 'SPECIFICAȚII',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'Interceptor de browser',
  'workbench.sidebar.view.apiRequests': 'Cereri API',
  'workbench.sidebar.view.workflows': 'Fluxuri de lucru',
  'workbench.sidebar.view.variables': 'Variabile',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'Regulă nouă',
  'workbench.sidebar.header.addRequest': 'Adăugare cerere',
  'workbench.sidebar.header.createNewEnvironment': 'Creare mediu nou',
  'workbench.sidebar.header.createNewSpec': 'Creare specificație nouă',
  'workbench.sidebar.header.newWorkflow': 'Flux de lucru nou',
  'workbench.sidebar.header.newTemplateCollection': 'Colecție de șabloane nouă',
  'workbench.sidebar.header.exportSelected': 'Export selecție ({count})…',
  'workbench.sidebar.header.exportSelectedAria': 'Export elemente selectate ({count})',
  'workbench.sidebar.header.clearSelection': 'Golire selecție',
  'workbench.sidebar.header.clearSelectionAria': 'Golire selecție pentru export',
  'workbench.sidebar.header.selectOpenedTab': 'Selectare fila deschisă',
  'workbench.sidebar.header.selectOpenedTabAria': 'Selectare fila deschisă',
  'workbench.sidebar.header.expandAll': 'Extindere toate',
  'workbench.sidebar.header.expandAllAria': 'Extindere toate',
  'workbench.sidebar.header.collapseAll': 'Restrângere toate',
  'workbench.sidebar.header.collapseAllAria': 'Restrângere toate',
  'workbench.sidebar.behavior.title': 'Comportament',
  'workbench.sidebar.behavior.openEntriesSingleClick': 'Deschidere intrări cu un singur clic',
  'workbench.sidebar.behavior.openCollectionsSingleClick': 'Deschidere colecții cu un singur clic',
  'workbench.sidebar.behavior.openFoldersSingleClick': 'Deschidere foldere cu un singur clic',
  'workbench.sidebar.behavior.alwaysSelectOpened': 'Selectare întotdeauna fila deschisă',
  'workbench.sidebar.appearance.title': 'Aspect vizual',
  'workbench.sidebar.appearance.showIndentGuides': 'Afișare ghidaje de indentare',
  'workbench.sidebar.dnd.itemsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} element', few: '{count} elemente', other: '{count} de elemente' }),
  'workbench.sidebar.toast.itemsMoved': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} element mutat',
      few: '{count} elemente mutate',
      other: '{count} de elemente mutate',
    }),
  'workbench.sidebar.toast.moveFailed': 'Mutarea a eșuat',
  'workbench.sidebar.filterPlaceholder': 'Filtrare',

  // ── Sidebar: speed-search bar (on-demand, dual filter/search mode) ──
  'workbench.sidebar.menu.search': 'Căutare',
  'workbench.sidebar.search.searchPlaceholder': 'Căutare',
  'workbench.sidebar.search.modeSearch': 'Căutare: evidențiază rândurile potrivite',
  'workbench.sidebar.search.modeFilter': 'Filtrare: ascunde rândurile nepotrivite',
  'workbench.sidebar.search.noMatches': 'Nicio potrivire',
  'workbench.sidebar.search.close': 'Închidere căutare',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': 'Colecție nouă',
  'workbench.sidebar.menu.newRequest': 'Cerere nouă',
  'workbench.sidebar.menu.import': 'Import…',
  'workbench.sidebar.menu.addRule': 'Adăugare regulă',
  'workbench.sidebar.menu.addRequest': 'Adăugare cerere',
  'workbench.sidebar.menu.addFolder': 'Adăugare folder',
  'workbench.sidebar.menu.rename': 'Redenumire',
  'workbench.sidebar.menu.editVariables': 'Editare variabile',
  'workbench.sidebar.menu.createWorkflow': 'Creare flux de lucru…',
  'workbench.sidebar.menu.export': 'Export…',
  'workbench.sidebar.menu.delete': 'Ștergere',
  'workbench.sidebar.menu.duplicate': 'Duplicare',
  'workbench.sidebar.menu.copyAs': 'Copiere ca',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.convertToGraphql': 'Conversie în cerere GraphQL',
  'workbench.sidebar.menu.pauseCollection': 'Pauză colecție',
  'workbench.sidebar.menu.unpauseCollection': 'Reluare colecție',
  'workbench.sidebar.menu.pauseFolder': 'Pauză folder',
  'workbench.sidebar.menu.unpauseFolder': 'Reluare folder',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'Resetare suprascriere de pauză a colecției',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'Resetare suprascriere de pauză a folderului',
  'workbench.sidebar.menu.clearNestedPauseOverrides': 'Golire suprascrieri de pauză imbricate',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': 'în pauză',
  'workbench.sidebar.badge.draft': 'ciornă',
  'workbench.sidebar.badge.unresolved': 'nerezolvat',
  'workbench.sidebar.badge.off': 'dezactivat',
  'workbench.sidebar.badge.incomplete': 'incomplet',
  'workbench.sidebar.badge.scratch': 'schiță',
  'workbench.sidebar.badge.scripts': 'scripturi',
  'workbench.sidebar.badge.specDrift': 'modificat',
  'workbench.sidebar.badge.scriptsTooltip':
    'Această cerere importată va executa JavaScript la rulare. Deschideți-o pentru a revizui scripturile.',
  'workbench.sidebar.badge.dirtyAria': 'modificări nesalvate',
  'workbench.sidebar.rule.enable': 'Activare regulă',
  'workbench.sidebar.rule.disable': 'Dezactivare regulă',
  'workbench.sidebar.env.setActive': 'Setare ca activ',
  'workbench.sidebar.env.setInactive': 'Setare ca inactiv',
  'workbench.sidebar.env.setDefault': 'Setare ca implicit',
  'workbench.sidebar.env.unsetDefault': 'Anulare implicit',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} var.',
      few: '{count} var.',
      other: '{count} de var.',
    }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variabilă live legată de acest flux de lucru',
      few: '{count} variabile live legate de acest flux de lucru',
      other: '{count} de variabile live legate de acest flux de lucru',
    }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'Folderul este gol',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'Colecția este goală',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'Nicio cerere încă',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'Niciun șablon încă',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'Adăugați o regulă sau un folder pentru a începe.',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'Adăugați o cerere sau un folder pentru a începe.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'Salvați o regulă ca șablon pentru a-l popula.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': 'Salvați o regulă ca șablon din editor.',
  'workbench.sidebar.placeholder.addRule': 'Adăugare regulă',
  'workbench.sidebar.placeholder.addFolder': 'Adăugare folder',
  'workbench.sidebar.placeholder.addRequest': 'Adăugare cerere',
  'workbench.sidebar.emptySection': 'Niciun element în această secțiune',
  'workbench.sidebar.emptySectionCreate': 'Creare',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'Șabloane de sistem',
  'workbench.sidebar.ruleType.header': 'Antet',
  'workbench.sidebar.ruleType.block': 'Blocare',
  'workbench.sidebar.ruleType.redirect': 'Redirecționare',
  'workbench.sidebar.ruleType.queryParam': 'Parametru de interogare',
  'workbench.sidebar.ruleType.inject': 'Injectare',
  'workbench.sidebar.ruleType.delay': 'Întârziere',
  'workbench.sidebar.ruleType.requestBody': 'Corp cerere API',
  'workbench.sidebar.ruleType.response': 'Răspuns API',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': 'Variabile de spațiu de lucru',
  'workbench.sidebar.singleton.liveVariables': 'Variabile Live',
  'workbench.sidebar.singleton.packageLibrary': 'Biblioteca de pachete',

  // ── Sidebar: default entity names ───────────────────────────────────
  // (New Rules/Requests Collection promoted to `shared.defaults.*` when
  // the save modals became their second converted consumer; New
  // Environment followed when App's env-selector create flow converted.)
  'workbench.sidebar.defaults.newFolder': 'Folder nou',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': 'Ștergere element?',
  'workbench.sidebar.confirmDelete.bodyPrefix': 'Sigur doriți să ștergeți ',
  'workbench.sidebar.confirmDelete.bodySuffix': '? Această acțiune nu poate fi anulată.',
  'workbench.sidebar.confirmDelete.ok': 'Ștergere',
  'workbench.sidebar.toast.toggleRuleFailed': 'Comutarea regulii a eșuat',
  'workbench.sidebar.toast.renameExampleFailed': 'Redenumirea exemplului a eșuat',
  'workbench.sidebar.toast.duplicateExampleFailed': 'Duplicarea exemplului a eșuat',
  'workbench.sidebar.toast.deleteExampleFailed': 'Ștergerea exemplului a eșuat',
  'workbench.sidebar.toast.createRequestCollectionFailed': 'Crearea colecției de cereri a eșuat',
  'workbench.sidebar.toast.createEnvironmentFailed': 'Crearea mediului a eșuat',
  'workbench.sidebar.toast.createSpecFailed': 'Crearea specificației a eșuat',
  'workbench.sidebar.toast.renameSpecFailed': 'Redenumirea specificației a eșuat',
  'workbench.sidebar.toast.deleteSpecFailed': 'Ștergerea specificației a eșuat',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': 'S-a revenit asupra modificării',
  'workbench.activityFeed.revertFailed': 'Revenirea a eșuat: {reason}',
  'workbench.activityFeed.emptyTitle': 'Nicio activitate încă',
  'workbench.activityFeed.emptyHint': 'Modificările primite de la peeri vor apărea aici.',
  'workbench.activityFeed.view': 'Vizualizare',
  'workbench.activityFeed.mute': 'Ignorare',
  'workbench.activityFeed.unmute': 'Anulare ignorare',
  'workbench.activityFeed.muteTip':
    'Suprimă rândurile viitoare de activitate primită pentru această entitate. Rândurile anterioare se păstrează.',
  'workbench.activityFeed.unmuteTip': 'Nu mai suprimă activitatea primită pentru această entitate.',
  'workbench.activityFeed.revert': 'Revenire',
  'workbench.activityFeed.revertTip':
    'Aplică inversul acestei modificări. Emite o mutație nouă care readuce entitatea la starea dinaintea modificării primite.',
  'workbench.activityFeed.revertUnavailableDelete':
    'Ștergerile sunt permanente și nu se poate reveni asupra lor (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': 'Nu se poate reveni asupra acestei modificări.',
  'workbench.activityFeed.revertUnavailableParentGone': 'Folderul din care provine acest element nu mai există.',
  'workbench.activityFeed.kind.created': 'Creat',
  'workbench.activityFeed.kind.createdTip': 'O entitate nouă a sosit de la un peer.',
  'workbench.activityFeed.kind.edited': 'Editat',
  'workbench.activityFeed.kind.editedTip': 'Un peer a editat câmpuri ale acestei entități.',
  'workbench.activityFeed.kind.deleted': 'Șters',
  'workbench.activityFeed.kind.deletedTip': 'Un peer a șters această entitate.',
  'workbench.activityFeed.kind.superseded': 'Editare locală substituită',
  'workbench.activityFeed.kind.supersededTip': 'O mutație primită a substituit editarea dvs. locală în curs.',
  'workbench.activityFeed.kind.sensitiveRotation': 'Câmp sensibil rotit',
  'workbench.activityFeed.kind.sensitiveRotationTip':
    'Un câmp sensibil (secret / token / antet sensibil) a fost înlocuit.',
  'workbench.activityFeed.kind.scopeWidened': 'Acoperire extinsă',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'O condiție a regulii a fost relaxată — regula se potrivește acum cu un set mai larg de adrese URL și metode.',
  'workbench.activityFeed.kind.agentObserved': 'Citire de către agent',
  'workbench.activityFeed.kind.agentObservedTip':
    'Un agent a citit trafic live prin nivelul de observare MCP — proiecții mascate dintr-o sursă armată.',
  'workbench.activityFeed.kind.rehomed': 'Mutat la rădăcina colecției',
  'workbench.activityFeed.kind.rehomedTip':
    'Folderul său a fost șters sau mutat în el însuși de un alt peer, așa că acest element a fost reatașat la rădăcina colecției.',
  'workbench.activityFeed.rawRead': 'Nemascat',
  'workbench.activityFeed.rawReadTip':
    'Această citire a proiectat valori brute — acordarea de acces la citiri de sesiune nemascate era activă în „Instrumente › Trafic”.',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} șablon',
      few: '{count} șabloane',
      other: '{count} de șabloane',
    }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} folder',
      few: '· {count} foldere',
      other: '· {count} de foldere',
    }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} subfolder',
      few: '· {count} subfoldere',
      other: '· {count} de subfoldere',
    }),
  'workbench.overview.stats.activeTag': 'active: {count}',
  'workbench.overview.stats.disabledTag': 'dezactivate: {count}',
  'workbench.overview.stats.draftTag': 'ciorne: {count}',
  'workbench.overview.stats.pausedTag': 'În pauză',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Folder · {count} regulă',
      few: 'Folder · {count} reguli',
      other: 'Folder · {count} de reguli',
    }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Folder · {count} cerere',
      few: 'Folder · {count} cereri',
      other: 'Folder · {count} de cereri',
    }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Folder · {count} șablon',
      few: 'Folder · {count} șabloane',
      other: 'Folder · {count} de șabloane',
    }),
  'workbench.overview.status.draft': 'Ciornă',
  'workbench.overview.status.incomplete': 'Incomplet',
  'workbench.overview.status.disabled': 'Dezactivat',
  'workbench.overview.status.paused': 'În pauză',
  'workbench.overview.status.active': 'Activ',
  'workbench.overview.action.addRule': 'Adăugare regulă',
  'workbench.overview.action.addRequest': 'Adăugare cerere',
  'workbench.overview.action.pause': 'Pauză',
  'workbench.overview.action.resume': 'Reluare',
  'workbench.overview.action.pauseCollectionTooltip': 'Pune în pauză toate regulile din această colecție',
  'workbench.overview.action.resumeCollectionTooltip': 'Reia toate regulile din această colecție',
  'workbench.overview.action.pauseFolderTooltip': 'Pune în pauză toate regulile din acest folder',
  'workbench.overview.action.resumeFolderTooltip': 'Reia toate regulile din acest folder',
  'workbench.overview.action.variables': 'Variabile',
  'workbench.overview.action.variablesTooltip': 'Editați variabilele cu sfera acestei colecții',
  'workbench.overview.action.variablesTooltipTemplate': 'Editați variabilele cu sfera acestei colecții de șabloane',
  'workbench.overview.caption.description': 'Descriere',
  'workbench.overview.caption.contents': 'Cuprins',
  'workbench.overview.empty.collectionNotFound': 'Colecția nu a fost găsită',
  'workbench.overview.empty.folderNotFound': 'Folderul nu a fost găsit',
  'workbench.overview.empty.requestCollectionNotFound': 'Colecția de cereri nu a fost găsită',
  'workbench.overview.empty.templateCollectionNotFound': 'Colecția de șabloane nu a fost găsită',
  'workbench.overview.empty.noItems': 'Niciun element încă',
  'workbench.overview.empty.noRequests': 'Nicio cerere încă',
  'workbench.overview.empty.templatesCollection':
    'Niciun șablon în această colecție. Salvați o regulă ca șablon pentru a popula această colecție.',
  'workbench.overview.empty.templatesFolder':
    'Niciun șablon încă — salvați o regulă ca șablon din editorul de reguli pentru a popula acest folder.',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'Căutare colecție',
  'workbench.collectionPicker.empty': 'Nicio colecție încă — una este creată pentru dvs. la import.',
  'workbench.collectionPicker.noMatch': 'Nicio colecție corespunzătoare.',
  'workbench.collectionPicker.newCollection': 'Colecție nouă',
} as const satisfies Catalog;
