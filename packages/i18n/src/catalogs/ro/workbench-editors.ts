/**
 * Workbench editors — shared editor chrome — Romanian. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the {column}
 * / {header} / {key} / {name} / {language} / {message} holes, `Tests`
 * group label raw per the de/es parity lock, lowercase en `vault` raw
 * lowercase (per-case token law) with secret as its head noun, JSON /
 * URL / HTTP / CONNECT / PUBLISH / QoS / Socket.IO / OK raw. script =
 * script; fragment de cod = snippet; pachet / Biblioteca de pachete per
 * script-packages; package-flow strings shared with
 * `workbench-script-packages.ts` (duplicate name, not-found) reuse its
 * ro sentences verbatim. Autorizare = the Authorization field / tab;
 * secret = secret (shipped mints). MINTS: Moștenire = the Inherit
 * option label (the noun form of panel.ts's Moștenește aspectul —
 * `workbench-editors-request.ts` MUST reuse it); În bloc = Bulk;
 * Cheie-valoare = Key-Value; Formatare = Format; ciornă de cerere =
 * request draft (ciornă carried from the Draft mint); Corp = the bare
 * `Body` tab noun (prose keeps corpul cererii / corpul răspunsului per
 * the shipped mints); subprotocol = subprotocol; pereche de metadate =
 * metadata pair; ultima dorință = last will (prose; the `Last Will`
 * tab rides raw); stabilirea conexiunii = dial; trailer raw (trailerul
 * — a loanword, not a glossary token); broker; hook (hook-uri).
 * Snippet titles read as infinitives-as-nouns, assertions as
 * statements.
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': 'Mai multe informații',

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': 'Detalii conexiune',
  'workbench.editors.session.subprotocol': 'Subprotocol',
  'workbench.editors.session.extensions': 'Extensii',
  'workbench.editors.session.closeCode': 'Cod de închidere',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Cheie',
  'workbench.editors.grid.value': 'Valoare',
  'workbench.editors.grid.description': 'Descriere',
  'workbench.editors.grid.showColumns': 'Afișare coloane',
  'workbench.editors.grid.tableOptions': 'Opțiuni tabel',
  'workbench.editors.grid.bulk': 'În bloc',
  'workbench.editors.grid.keyValue': 'Cheie-valoare',
  'workbench.editors.grid.selectAllAria': 'Activați sau dezactivați toate rândurile',
  'workbench.editors.grid.selectAllTitle': 'Activare / dezactivare toate',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Redimensionare coloana {column}',
  'workbench.editors.grid.overriddenBy': 'Duplicat — suprascris de rândul {header} pe care l-ați adăugat.',
  'workbench.editors.grid.suggestionValueAria': 'Valoarea {key}',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': 'Colecția de cereri nu a fost găsită.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Folderul nu a fost găsit.',
  'workbench.editors.ancestorScripts.saveFailed': 'Scripturile nu au putut fi salvate.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'Scripturile nu au putut fi salvate: {message}',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': 'Colecția de cereri nu a fost găsită.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Folderul nu a fost găsit.',
  'workbench.editors.ancestorAuth.saveFailed': 'Autorizarea nu a putut fi salvată.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'Autorizarea nu a putut fi salvată: {message}',

  // ── Ancestor settings (collection/folder inheritable settings) ─────
  'workbench.editors.ancestorSettings.saveFailed': 'Setările nu au putut fi salvate.',
  'workbench.editors.ancestorSettings.saveFailedDetail': 'Setările nu au putut fi salvate: {message}',

  // ── Request container editor (a collection / folder: one tab, sections) ──
  'workbench.editors.requestContainer.tab.overview': 'Prezentare generală',
  'workbench.editors.requestContainer.auth.emptyTitle': 'Nicio autentificare configurată',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection':
    'Selectați un tip de autorizare pentru cererile din această colecție',
  'workbench.editors.requestContainer.auth.emptySubtitleFolder':
    'Selectați un tip de autorizare pentru cererile din acest folder',
  'workbench.editors.requestContainer.auth.authTypes': 'Tipuri de autentificare',
  'workbench.editors.requestContainer.auth.authTypesInfo':
    'Rezerva unui container: câte o intrare pentru fiecare schemă de care au nevoie cererile sale. Cererile setate pe Moștenire folosesc intrarea implicită, un model de gazdă direcționează cererile potrivite către o altă intrare, iar o cerere poate alege una după nume.',
  'workbench.editors.requestContainer.auth.authTypesInfoHeading': 'Tipuri',
  'workbench.editors.requestContainer.auth.addEntryAria': 'Adăugare tip de autentificare',
  'workbench.editors.requestContainer.auth.inheritedTag': 'Moștenită',
  'workbench.editors.requestContainer.auth.rename': 'Redenumire',
  'workbench.editors.requestContainer.auth.noneEntryNote':
    'Cererile care folosesc această intrare se trimit fără autorizare.',
  'workbench.editors.requestContainer.auth.defaultTag': 'Implicită',
  'workbench.editors.requestContainer.auth.setDefault': 'Setare ca implicită',
  'workbench.editors.requestContainer.auth.deleteEntry': 'Ștergere',
  'workbench.editors.requestContainer.auth.entryActionsAria': 'Acțiuni pentru intrare',
  'workbench.editors.requestContainer.auth.appliesTo': 'Aplicare la gazda',
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    'O cerere setată pe Moștenire, a cărei gazdă din adresa URL se potrivește, primește această intrare înaintea celei implicite.',
  'workbench.editors.requestContainer.auth.appliesToOptionalTag': '(opțional)',
  'workbench.editors.requestContainer.auth.appliesToInfoSummary':
    'Restrânge această intrare la cererile a căror gazdă din adresa URL se potrivește cu modelul.',
  'workbench.editors.requestContainer.auth.appliesToInfoRules':
    'Fără distincție între majuscule și minuscule; * se potrivește cu orice șir de caractere, un model fără el este o potrivire exactă a gazdei. Portul și calea nu contează niciodată. Lăsați-l gol și intrarea este atinsă doar ca implicită sau prin alegerea unei cereri.',
  'workbench.editors.requestContainer.auth.resetToInherited': 'Resetare la moștenit',
  'workbench.editors.requestContainer.auth.resetConfirm': 'Eliminați intrările folderului? Cererile revin la colecție.',
  'workbench.editors.requestContainer.deletedElsewhere': 'Acest element a fost șters într-o altă fereastră.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': 'Se încarcă exemplul…',
  'workbench.editors.responseExample.notFound': 'Exemplul nu a fost găsit.',
  'workbench.editors.responseExample.toast.deletedOtherTab': 'Exemplul a fost șters dintr-o altă filă',
  'workbench.editors.responseExample.toast.saveFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.responseExample.toast.saveFailedDetail': 'Salvarea exemplului a eșuat: {message}',
  'workbench.editors.responseExample.openAsRequest': 'Deschidere ca cerere',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'Creează o ciornă de cerere nouă, pornind de la cererea acestui exemplu',
  'workbench.editors.responseExample.editStatus': 'Editare cod de stare',
  'workbench.editors.responseExample.statusPlaceholder': 'Introduceți codul răspunsului',
  'workbench.editors.responseExample.capturedTooltip': 'Capturat la {date}',
  'workbench.editors.responseExample.moreActionsAria': 'Mai multe acțiuni pentru răspuns',
  'workbench.editors.responseExample.tab.body': 'Corp',
  'workbench.editors.responseExample.tab.headers': 'Antete ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Limbajul corpului',
  'workbench.editors.responseExample.format': 'Formatare',
  'workbench.editors.responseExample.formatBody': 'Formatare corp',
  'workbench.editors.responseExample.noFormatter': 'Niciun formatator pentru {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Fragmente de cod',
  'workbench.editors.scriptEditor.packages': 'Pachete',
  'workbench.editors.scriptEditor.searchSnippets': 'Căutare fragmente de cod',
  'workbench.editors.scriptEditor.searchPackages': 'Căutare pachete',
  'workbench.editors.scriptEditor.noSnippetFound': 'Niciun fragment de cod găsit',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'Niciun pachet în acest spațiu de lucru încă',
  'workbench.editors.scriptEditor.noPackageFound': 'Niciun pachet găsit',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Deschidere Biblioteca de pachete →',
  'workbench.editors.scriptEditor.saveToPackage': 'Salvare în Biblioteca de pachete',
  'workbench.editors.scriptEditor.newPackage': 'Pachet nou',
  'workbench.editors.scriptEditor.newPackageName': 'Numele pachetului nou',
  'workbench.editors.scriptEditor.back': 'Înapoi',
  'workbench.editors.scriptEditor.create': 'Creare',
  'workbench.editors.scriptEditor.orAppend': 'Sau adăugați la un pachet existent:',
  'workbench.editors.scriptEditor.noPackagesYet': 'Niciun pachet încă',
  'workbench.editors.scriptEditor.savedTo': 'Salvat în „{name}”',
  'workbench.editors.scriptEditor.packageCreated': 'Pachetul „{name}” a fost creat',
  'workbench.editors.scriptEditor.duplicatePackage': 'Un pachet numit „{name}” există deja în acest spațiu de lucru.',
  'workbench.editors.scriptEditor.packageNotFound': 'Pachetul nu a fost găsit — este posibil să fi fost șters.',
  'workbench.editors.scriptEditor.saveFailed': 'Salvarea a eșuat',
  'workbench.editors.scriptEditor.menuFind': 'Căutare',
  'workbench.editors.scriptEditor.group.request': 'Cerere',
  'workbench.editors.scriptEditor.group.variables': 'Variabile',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.group.requests': 'Cereri',
  'workbench.editors.scriptEditor.group.response': 'Răspuns',
  'workbench.editors.scriptEditor.group.close': 'Închidere',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Trimitere cerere HTTP',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Trimitere cerere HTTP cu corp JSON',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Citire variabilă',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Setare variabilă',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Citire secret din vault',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Setare antet',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Eliminare antet',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Setare parametru de interogare',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Eliminare parametru de interogare',
  'workbench.editors.scriptEditor.snippet.setUrl': 'Setare adresă URL',
  'workbench.editors.scriptEditor.snippet.setMethod': 'Setare metodă',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Setare corp JSON',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Codul de stare este 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Corpul răspunsului conține un șir',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Corpul răspunsului este egal cu un șir',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'Valoarea JSON din corpul răspunsului este corectă',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Antetul Content-Type este prezent',
  'workbench.editors.scriptEditor.snippet.responseTime': 'Timpul de răspuns este sub 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Salvare valoare din răspuns într-o variabilă',
  'workbench.editors.scriptEditor.group.connect': 'Conectare',
  'workbench.editors.scriptEditor.group.send': 'Trimitere',
  'workbench.editors.scriptEditor.group.message': 'Mesaj',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': 'Setare ofertă de subprotocoale',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': 'Reluare la o încercare de reconectare',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': 'Rescriere mesaj trimis',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': 'Eliminare mesaj trimis',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Redenumire eveniment Socket.IO',
  'workbench.editors.scriptEditor.snippet.wsReply': 'Răspuns la un mesaj',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': 'Numărare mesaje pe parcursul sesiunii',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Emitere eveniment Socket.IO',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': 'Mesajul este JSON',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': 'Salvare valoare din mesaj într-o variabilă',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': 'Sesiunea s-a închis curat',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': 'Au sosit mesaje',
  'workbench.editors.scriptEditor.group.publish': 'Publicare',
  'workbench.editors.scriptEditor.snippet.mqttSetClientId': 'Setare id de client',
  'workbench.editors.scriptEditor.snippet.mqttSetCredentials': 'Setare acreditări CONNECT',
  'workbench.editors.scriptEditor.snippet.mqttAddSubscription': 'Abonare la un subiect la conectare',
  'workbench.editors.scriptEditor.snippet.mqttSetWill': 'Setare ultima dorință',
  'workbench.editors.scriptEditor.snippet.mqttSetUserProperty': 'Setare proprietate de utilizator CONNECT',
  'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt': 'Marcare încercare de reconectare',
  'workbench.editors.scriptEditor.snippet.mqttSetPayload': 'Rescriere conținut util trimis',
  'workbench.editors.scriptEditor.snippet.mqttSetTopic': 'Redirecționare către alt subiect',
  'workbench.editors.scriptEditor.snippet.mqttSetFlags': 'Setare QoS și retain',
  'workbench.editors.scriptEditor.snippet.mqttDropMessage': 'Eliminare mesaj trimis',
  'workbench.editors.scriptEditor.snippet.mqttReply': 'Publicare răspuns',
  'workbench.editors.scriptEditor.snippet.mqttCountMessages': 'Numărare mesaje pe parcursul sesiunii',
  'workbench.editors.scriptEditor.snippet.mqttAssertJson': 'Conținutul util este JSON',
  'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue': 'Salvare valoare din conținutul util într-o variabilă',
  'workbench.editors.scriptEditor.snippet.mqttClosedClean': 'Deconectat curat',
  'workbench.editors.scriptEditor.snippet.mqttMessageCount': 'Au sosit mesaje',
  'workbench.editors.scriptEditor.group.invoke': 'Invocare',
  'workbench.editors.scriptEditor.snippet.grpcSetMetadata': 'Setare pereche de metadate',
  'workbench.editors.scriptEditor.snippet.grpcRemoveMetadata': 'Eliminare pereche de metadate',
  'workbench.editors.scriptEditor.snippet.grpcSetMessage': 'Rescriere mesaj de cerere',
  'workbench.editors.scriptEditor.snippet.grpcLogCall': 'Înregistrare apel în jurnal',
  'workbench.editors.scriptEditor.snippet.grpcLogMessage': 'Înregistrare mesaj decodat în jurnal',
  'workbench.editors.scriptEditor.snippet.grpcCountMessages': 'Numărare mesaje pe parcursul apelului',
  'workbench.editors.scriptEditor.snippet.grpcAssertDecoded': 'Mesaj decodat',
  'workbench.editors.scriptEditor.snippet.grpcAssertField': 'Câmpul mesajului este setat',
  'workbench.editors.scriptEditor.snippet.grpcSaveMessageValue': 'Salvare valoare din mesaj într-o variabilă',
  'workbench.editors.scriptEditor.snippet.grpcStatusOk': 'Starea este OK',
  'workbench.editors.scriptEditor.snippet.grpcMessageCount': 'Au sosit mesaje',
  'workbench.editors.scriptEditor.snippet.grpcTrailerCheck': 'Trailerul este prezent',
  'workbench.editors.scriptEditor.snippet.logRequest': 'Înregistrare cerere în jurnal',
  'workbench.editors.scriptEditor.snippet.parseJsonBody': 'Parsare corp JSON',
  'workbench.editors.scriptEditor.snippet.findResponseHeader': 'Găsire antet de răspuns',
  'workbench.editors.scriptEditor.snippet.logResponse': 'Înregistrare răspuns în jurnal',
  'workbench.editors.scriptEditor.snippet.logDial': 'Înregistrare stabilire conexiune în jurnal',
  'workbench.editors.scriptEditor.snippet.logOutgoingMessage': 'Înregistrare mesaj trimis în jurnal',
  'workbench.editors.scriptEditor.snippet.logMessage': 'Înregistrare mesaj în jurnal',
  'workbench.editors.scriptEditor.snippet.logClose': 'Înregistrare închidere în jurnal',
  'workbench.editors.scriptEditor.snippet.wsReplyBinary': 'Răspuns cu un cadru binar',
  'workbench.editors.scriptEditor.snippet.wsNothingDropped': 'Nimic nu a fost eliminat',
  'workbench.editors.scriptEditor.snippet.mqttSetResponseTopic': 'Setare subiect de răspuns',
  'workbench.editors.scriptEditor.snippet.mqttSetPublishUserProperty': 'Setare proprietate de utilizator PUBLISH',
  'workbench.editors.scriptEditor.snippet.mqttConnackAccepted': 'Brokerul a acceptat sesiunea',
  'workbench.editors.scriptEditor.snippet.grpcLogStatus': 'Înregistrare stare în jurnal',
} as const satisfies Catalog;
