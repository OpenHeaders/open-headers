/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — Romanian. Mirrors `catalogs/en/panel-quick-editor.ts` key for
 * key; compact mirrors of workbench controls reuse the
 * `workbench.editors.rule.fields.*` keys (S35). Raw by design: names,
 * URLs, `{{template}}` chips, status codes, MIME values, code / JSON
 * placeholders, the CSS / JS / GraphQL / cURL proper nouns, core
 * validator sentences, the req / res wire chips and op glyphs. Mints:
 * popover raw (popover-ul — never fereastră popup, which stays the
 * extension popup); reorientare = retarget; ascultător = listener;
 * conținut util = payload (prose); cadru = frame (carried); modificare
 * = the modification (mod); separator de îmbinare = merge separator;
 * ciornă = draft; Original / Acum / Viitor = Original / Now / Future;
 * referință amânată = deferred ref; Simulare / Modificare = the Mock /
 * Modify tags (Simulare carried from shared-components); the snapshot
 * op chips read as lowercase infinitives-as-nouns (injectare /
 * suprascriere / adăugare la sfârșit / îmbinare / eliminare — the
 * shared ledger's op nouns).
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': 'Golire nume regulă',
  'panel.quickEditor.renameTitle': '{name} — apăsați pentru redenumire',
  'panel.quickEditor.enabledOn': 'Activată',
  'panel.quickEditor.enabledOff': 'Dezactivată',
  'panel.quickEditor.ruleEnabledAria': 'Regulă activată',
  'panel.quickEditor.openInTab': 'Deschidere în filă',
  'panel.quickEditor.openInWorkspace': 'Deschidere în spațiul de lucru →',
  'panel.quickEditor.saveButton': 'Salvare',
  'panel.quickEditor.openToInspect': 'Deschideți în spațiul de lucru pentru a inspecta sau modifica această regulă.',
  'panel.quickEditor.variableMissing':
    'Variabilă lipsă — treceți cursorul peste referința roșie pentru a o crea și a activa salvarea.',
  'panel.quickEditor.retargetHint': 'Ajustați condițiile de mai jos pentru a reorienta regula.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Regulă actualizată',
  'panel.quickEditor.toast.ruleNotFound': 'Regula nu a fost găsită — este posibil să fi fost ștearsă.',
  'panel.quickEditor.toast.saveFailed': 'Salvarea a eșuat',
  'panel.quickEditor.toast.toggleFailed': 'Regula nu a putut fi comutată',
  'panel.quickEditor.toast.changedElsewhere':
    'Regula s-a schimbat în altă parte — închideți și redeschideți popover-ul.',
  'panel.quickEditor.toast.noWorkspace': 'Niciun spațiu de lucru activ',
  'panel.quickEditor.toast.collectionCreateFailed': 'Nu s-a putut crea o colecție pentru regulă',
  'panel.quickEditor.toast.folderCreateFailed':
    'Folderul „{name}” nu a putut fi creat — se salvează la rădăcina colecției.',
  'panel.quickEditor.toast.createFailed': 'Regula nu a putut fi creată',
  'panel.quickEditor.toast.createdDraft': 'Regulă creată ca ciornă — publicați-o din spațiul de lucru.',
  'panel.quickEditor.toast.created': 'Regulă creată',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Alegeți unde se salvează regula',
  'panel.quickEditor.destination.savingTo': 'Se salvează în',
  'panel.quickEditor.destination.newTag': 'nouă',
  'panel.quickEditor.destination.autoNamed': 'Auto — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Auto — rădăcina colecției',
  'panel.quickEditor.destination.root': 'Rădăcina colecției',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Afișați și editați când se declanșează această regulă',
  'panel.quickEditor.conditions.label': 'Condiții',
  'panel.quickEditor.conditions.none': 'niciuna — nu se potrivește cu nicio cerere',

  // Header quick editors (single-mod hover + whole-list + create).
  // Operation options reuse the workbench op keys; validator sentences
  // from core ride raw — only the UI fallbacks are keyed here.
  'panel.quickEditor.header.addHeader': 'Adăugare antet',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Separator de îmbinare',
  'panel.quickEditor.header.directionRequest': 'Cerere',
  'panel.quickEditor.header.directionResponse': 'Răspuns',
  'panel.quickEditor.validation.nameRequired': 'Numele antetului este obligatoriu.',
  'panel.quickEditor.validation.invalidName': 'Nume de antet nevalid.',
  'panel.quickEditor.validation.invalidValue': 'Valoare de antet nevalidă.',
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Comutare la {operation}',

  // Typed bodies — popover-only copy. Field labels / option words that
  // mirror a workbench control reuse its key (see the station comment
  // above); the ws direction words differ from the workbench's
  // parenthesized pair, so they are popover-local (glyphs ride raw).
  'panel.quickEditor.redirect.targetPlaceholder': 'de ex. https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint':
    'Cererile potrivite sunt trimise la această adresă URL înainte de a ajunge în rețea.',
  'panel.quickEditor.delay.hint':
    'Navigările sunt întârziate cu până la 30.000 ms; XHR/fetch este plafonat la 5.000 ms. Subresursele nu sunt întârziate.',
  'panel.quickEditor.block.editHint': 'Cererile potrivite sunt blocate înainte de a ajunge în rețea.',
  'panel.quickEditor.block.blockRequestsTo': 'Blocare cereri către',
  'panel.quickEditor.block.createHint':
    'Cererile potrivite sunt anulate înainte de a părăsi browserul — pagina vede o eroare de rețea.',
  'panel.quickEditor.response.tagModify': 'Modificare',
  'panel.quickEditor.response.tagMock': 'Simulare',
  'panel.quickEditor.response.dynamicBody':
    'Această regulă își construiește răspunsul cu JavaScript. Deschideți în spațiul de lucru pentru a edita scriptul.',
  'panel.quickEditor.requestBody.hint': 'Cererile potrivite sunt trimise cu acest corp în locul celui al paginii.',
  'panel.quickEditor.requestBody.dynamicBody':
    'Această regulă își construiește corpul cu JavaScript. Deschideți în spațiul de lucru pentru a edita scriptul.',
  'panel.quickEditor.inject.sourceUrlLabel': 'Adresa URL sursă',
  'panel.quickEditor.inject.loadsStylesheetHint':
    'Paginile potrivite încarcă această foaie de stil pe măsură ce se încarcă.',
  'panel.quickEditor.inject.loadsScriptHint': 'Paginile potrivite încarcă acest script pe măsură ce se încarcă.',
  'panel.quickEditor.inject.injectedHint': 'Injectat în paginile potrivite pe măsură ce se încarcă.',
  'panel.quickEditor.message.incoming': 'Primite ⬇',
  'panel.quickEditor.message.outgoing': 'Trimise ⬆',
  'panel.quickEditor.message.injectedConnectionsHint':
    'Injectat pe conexiunile potrivite înainte ca ascultătorii să îl vadă.',
  'panel.quickEditor.message.injectedStreamsHint':
    'Injectat pe fluxurile potrivite înainte ca ascultătorii să îl vadă.',
  'panel.quickEditor.message.replacedFramesHint':
    'Cadrele potrivite sunt înlocuite cu acest conținut util înainte de a fi văzute.',
  'panel.quickEditor.message.replacedEventsHint':
    'Evenimentele potrivite sunt înlocuite cu acest conținut util înainte de a fi văzute.',
  'panel.quickEditor.message.droppedFramesHint': 'Cadrele potrivite sunt eliminate înainte de a fi văzute.',
  'panel.quickEditor.message.droppedEventsHint': 'Evenimentele potrivite sunt eliminate înainte de a fi văzute.',
  'panel.quickEditor.queryParam.addAction': 'Adăugare acțiune',
  'panel.quickEditor.queryParam.removeAllWarning':
    '„Eliminare toate” elimină întregul șir de interogare — celelalte operații din această regulă vor fi ignorate.',
  'panel.quickEditor.auth.challengesHint':
    'Răspunde la provocările de autentificare ale serverului (401) și ale proxy-ului (407) pe cererile potrivite.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  // Raw by design: header names/values, `{{template}}` text, the
  // sibling-mod rows (req / res wire chips, op glyphs, the wire-shaped
  // hover title) and the snapshot byline's direction word
  // (request/response — wire vocabulary beside the raw header name).
  'panel.ruleHover.tagRuleEdited': 'Regulă editată',
  'panel.ruleHover.tagVariableChanged': 'Variabilă schimbată',
  'panel.ruleHover.tagDeleted': 'Ștearsă',
  'panel.ruleHover.tagDisabled': 'Dezactivată',
  'panel.ruleHover.tagModRemoved': 'Modificare eliminată',
  'panel.ruleHover.tagConditionsMismatch': 'Condițiile nu se potrivesc',
  'panel.ruleHover.tagWontFire': 'Nu se va declanșa',
  'panel.ruleHover.tagTitle.ruleDisabled':
    'Indicatorul de activare al regulii este oprit — nu se va declanșa pe nicio cerere viitoare.',
  'panel.ruleHover.tagTitle.modGone': 'Modificarea potrivită a fost eliminată din regulă.',
  'panel.ruleHover.tagTitle.conditionsMismatch': 'Condițiile regulii nu mai acoperă această adresă URL.',
  'panel.ruleHover.tagTitle.nameUnresolved':
    'Șablonul numelui de antet nu poate fi rezolvat complet (de ex. face referire la un TOTP). DNR respinge caracterele de șablon literale în numele de antete.',
  'panel.ruleHover.tagTitle.valueUnresolved': 'Șablonul valorii antetului nu poate fi rezolvat complet.',
  'panel.ruleHover.tagTitle.separatorUnresolved': 'Șablonul separatorului de îmbinare nu poate fi rezolvat complet.',
  'panel.ruleHover.deletedBody':
    'Această regulă a fost ștearsă. Captura de mai sus arată ce a făcut când s-a declanșat.',
  'panel.ruleHover.modRemovedBody':
    'Modificarea potrivită a fost eliminată din regulă. Deschideți în spațiul de lucru pentru a o recrea sau ajusta.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'injectare',
  'panel.ruleHover.snapshot.opOverride': 'suprascriere',
  'panel.ruleHover.snapshot.opAppend': 'adăugare la sfârșit',
  'panel.ruleHover.snapshot.opMerge': 'îmbinare',
  'panel.ruleHover.snapshot.opRemove': 'eliminare',
  'panel.ruleHover.snapshot.templateTitle': 'Șablonul dinaintea rezolvării variabilelor la momentul declanșării',
  'panel.ruleHover.snapshot.nameDriftTitle':
    'Același șablon — o variabilă referită se rezolvă acum la un alt nume de antet',
  'panel.ruleHover.snapshot.cancels': 'anulează „{rule}”',
  'panel.ruleHover.snapshot.original': 'Original',
  'panel.ruleHover.snapshot.now': 'Acum',
  'panel.ruleHover.snapshot.future': 'Viitor',
  'panel.ruleHover.snapshot.futureTitle': 'Ce ar primi următoarea cerere potrivită',
  'panel.ruleHover.snapshot.removed': 'eliminat',
  'panel.ruleHover.snapshot.empty': '(gol)',
  'panel.ruleHover.snapshot.totpNote':
    'Referințele TOTP / amânate se rezolvă la momentul cererii și nu sunt capturate aici.',
  'panel.ruleHover.snapshot.alsoByRule': 'Tot de această regulă pe această cerere',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': 'regula a fost ștearsă — nu se va declanșa',
  'panel.ruleHover.future.ruleDisabled': 'regula este dezactivată — nu se va declanșa',
  'panel.ruleHover.future.modGone': 'această modificare a fost eliminată din regulă',
  'panel.ruleHover.future.conditionsMismatch': 'condițiile regulii nu se mai potrivesc cu această adresă URL',
  'panel.ruleHover.future.nameUnresolved': 'șablonul numelui de antet nu poate fi rezolvat — regula nu se va declanșa',
  'panel.ruleHover.future.valueUnresolved': 'șablonul valorii nu poate fi rezolvat — regula nu se va declanșa',
  'panel.ruleHover.future.separatorUnresolved':
    'șablonul mergeSeparator nu poate fi rezolvat — regula nu se va declanșa',
  'panel.ruleHover.future.templateTitle': 'Șablon: {template}',
} as const satisfies Catalog;
