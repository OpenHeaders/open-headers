/**
 * Import/export family — Romanian. Mirrors
 * `catalogs/en/workbench-import-export.ts` key for key. Raw by design
 * inside keyed sentences: brand + format proper nouns (Postman /
 * Insomnia / Bruno / Thunder Client / HAR / OpenAPI / cURL per the
 * glossary), file extensions and filenames rendered as code chips
 * (`.bru`, `.har`, `.openheaders.yaml`, `bruno.json`), export ids /
 * fingerprints / entity names ({id} / {name} holes carry data), uid /
 * workspace.uid, `{{ _.var }}` / `{{var}}` / `{{baseUrl}}` /
 * `{{clientId}}` / `{{clientSecret}}` template tokens, oh.* API, the
 * Postman-UI walkthrough steps (Postman's own UI is English; the glyph
 * labels and its menu rows stay English as ja / ko / ru do),
 * Insomnia's Preferences → Data → Export path, the DevTools Network
 * menu rows and the ` · ` separator glyphs; lowercase-en `vault` rides
 * raw and lowercase (vault criptat, Decriptare vault, secrete din vault
 * în text clar) while the capitalized `Vault decriptat` keeps the
 * product noun — the case law both ways. Quotes the shipped ro mints:
 * centrul de import = the import hub (settings keyboard defs), the
 * merge strategies „Adăugare ca noi” / „Înlocuire” / „Omitere”
 * (settings defs), eliminare / transformare = drop / transform (the
 * settings import-report wording), Migrare din alt instrument =
 * Migrate from another tool (workbench-chrome), „Copiere ca cURL” (the
 * panel request menu), frază de acces = passphrase (shared-conflicts),
 * text clar = plaintext (settings panes), amprentă = fingerprint (the
 * trust pane), specificație, Presetare = preset, aplicația desktop /
 * asociere carried, publicare / nepublicată, text cifrat = ciphertext
 * (system-status), rapoarte de import (settings), Aplicație › Date =
 * the settings path. MINTS: literal strict = strict literal; coliziune
 * = collision; relegare = rebind (legări rupte = broken bindings);
 * Scanare acest computer = Scan this computer; Detectat = detected;
 * anonimizare carried; exemplu salvat = saved example; variabilă
 * globală = global variable; entitate = entity; tărie = passphrase
 * strength (slabă / mediocră / bună / puternică); depozit de date = a
 * data store; the report sentence reads `Importate` + count + word +
 * `(inclusiv` … `și` … `)` + `în` + `{count} spațiu de lucru` — `into`
 * = `în`; the word plurals carry their own form (colecție / colecții /
 * de colecții …); count chips take colon frames (omise: {count};
 * nerezolvate: {count}; noi: +{count}; referințe: {count}; secrete:
 * {count}); the sentence-initial en `Cookies` (prose) reads
 * Cookie-urile (the hyphen keeps the capitalized token legal).
 * Plurals one / few / other (fișier / fișiere / de fișiere, entitate /
 * entități / de entități, element / elemente / de elemente, secret /
 * secrete / de secrete, referință / referințe / de referințe, cerere /
 * cereri / de cereri, folder / foldere / de foldere, notă / note / de
 * note). ALL-CAPS section headers keep en's caps (IMPORT DIN HAR /
 * IMPORT DIN POSTMAN / IMPORT ÎN / IMPORT CA).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'Export',
  'workbench.importExport.export.cancel': 'Anulare',
  'workbench.importExport.export.download': 'Descărcare',
  'workbench.importExport.export.sourceLabel': 'Sursă:',
  'workbench.importExport.export.scopeLabel': 'Sferă:',
  'workbench.importExport.export.filenameLabel': 'Nume fișier:',
  'workbench.importExport.export.scopeWholeWorkspace': 'Întregul spațiu de lucru',
  'workbench.importExport.export.vaultSecrets': 'Secrete Vault',
  'workbench.importExport.export.vaultOmit': 'Omitere (implicit)',
  'workbench.importExport.export.vaultEncrypted': 'Criptat (frază de acces)',
  'workbench.importExport.export.vaultPlaintext': 'Text clar (avansat)',
  'workbench.importExport.export.passphrasePlaceholder': 'Frază de acces',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'Confirmați fraza de acces',
  'workbench.importExport.export.hintPlaceholder':
    'Indiciu opțional (vizibil destinatarului — niciodată fraza de acces în sine)',
  'workbench.importExport.export.strengthEmpty': 'introduceți o frază de acces',
  'workbench.importExport.export.strengthWeak': 'slabă',
  'workbench.importExport.export.strengthFair': 'mediocră',
  'workbench.importExport.export.strengthGood': 'bună',
  'workbench.importExport.export.strengthStrong': 'puternică',
  'workbench.importExport.export.strengthNote':
    'Tăria frazei de acces: {label}. Partajați fraza de acces pe alt canal (Signal, manager de parole, voce). Oricine are fraza de acces poate citi fiecare secret din acest export.',
  'workbench.importExport.export.plaintextTitle': 'Secretele în text clar pot fi citite de oricine vede acest fișier',
  'workbench.importExport.export.plaintextUseOnly':
    'Folosiți doar la partajarea cu un sistem în care aveți încredere deplină (de ex. o copie de rezervă pe propriul disc criptat).',
  'workbench.importExport.export.switchToEncrypted': 'Comutare la criptat (recomandat)',
  'workbench.importExport.export.acknowledgeRisks': 'Înțeleg riscurile',
  'workbench.importExport.export.fingerprintsTitle': 'Criptat — partajați aceste amprente cu destinatarul',
  'workbench.importExport.export.ciphertextFingerprint': 'Amprenta textului cifrat:',
  'workbench.importExport.export.keyFingerprint': 'Amprenta cheii:',
  'workbench.importExport.export.fingerprintMatchNote':
    'După ce destinatarul introduce fraza de acces, va vedea aceeași amprentă a cheii dacă se potrivește cu a dvs.',
  'workbench.importExport.export.advanced': 'Avansat',
  'workbench.importExport.export.strictLiteralLabel': 'Literal strict — export doar a ceea ce am selectat',
  'workbench.importExport.export.strictLiteralHelp':
    'Implicit, alegerea unei colecții sau a unui folder aduce fiecare descendent plus containerele părinte, ca importul să stea pe picioarele lui. Cu literal strict activat, se livrează doar uid-urile alese — destinatarul vede dependențe lipsă pentru tot ce nu ați inclus.',
  'workbench.importExport.export.oauthNote':
    'Secretele de client OAuth sunt omise întotdeauna, indiferent de modul vault. Destinatarul le introduce pe ale sale la prima autentificare.',
  'workbench.importExport.export.exportFailed': 'Exportul a eșuat',
  'workbench.importExport.export.exportedShareFingerprints':
    'Exportat {filename} — partajați amprentele cu destinatarul',
  'workbench.importExport.export.exported': 'Exportat {filename}',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'IMPORT',
  'workbench.importExport.hub.closeAria': 'Închidere import',
  'workbench.importExport.hub.readingFile': 'Se citește fișierul…',
  'workbench.importExport.hub.pastePlaceholder': 'Lipiți o comandă curl sau o adresă URL',
  'workbench.importExport.hub.continueAria': 'Continuare import',
  'workbench.importExport.hub.notRecognized':
    'Nerecunoscut încă — lipiți o comandă curl, o adresă URL, un fișier HAR, un export Postman / Insomnia / Bruno, un document OpenAPI sau un export de spațiu de lucru.',
  'workbench.importExport.hub.dropAria': 'Plasați aici un fișier sau un folder importabil',
  'workbench.importExport.hub.dropTitle': 'Plasați un fișier sau un folder pentru import',
  'workbench.importExport.hub.kindHar': 'Captură HAR',
  'workbench.importExport.hub.kindPostman': 'Colecție sau copie de rezervă Postman',
  'workbench.importExport.hub.kindInsomnia': 'Export Insomnia',
  'workbench.importExport.hub.kindBrunoSuffix': 'fișier sau folder de colecție',
  'workbench.importExport.hub.kindOpenapi': 'Document OpenAPI 3.x',
  'workbench.importExport.hub.kindGraphqlSchema': 'Schemă GraphQL (SDL sau JSON de introspecție)',
  'workbench.importExport.hub.kindWorkspaceSuffix': 'export de spațiu de lucru',
  'workbench.importExport.hub.autoDetected': 'Formatul este recunoscut automat.',
  'workbench.importExport.hub.browseFiles': 'Răsfoire fișiere…',
  'workbench.importExport.hub.browseFolder': 'Răsfoire folder…',
  'workbench.importExport.hub.switchingFrom': 'Treceți de la',
  'workbench.importExport.hub.switchingOr': 'sau',
  'workbench.importExport.hub.migrateCta': 'Migrare din alt instrument',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles':
    'Niciun fișier Bruno în acel folder — se așteptau fișiere .bru sau un bruno.json.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fișier nu a putut fi citit și a fost omis.',
      few: '{count} fișiere nu au putut fi citite și au fost omise.',
      other: '{count} de fișiere nu au putut fi citite și au fost omise.',
    }),
  'workbench.importExport.modals.readFailed': 'Nu s-a putut citi {name}: {message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `${plural(locale, Number(count), {
      one: 'Importată {count} entitate',
      few: 'Importate {count} entități',
      other: 'Importate {count} de entități',
    })} din „${label}”`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': 'IMPORT EXPORT DE SPAȚIU DE LUCRU',
  'workbench.importExport.preview.closeAria': 'Închidere previzualizare import',
  'workbench.importExport.preview.cancel': 'Anulare',
  'workbench.importExport.preview.emptyFile': 'Plasați un fișier .openheaders.yaml pentru a-l previzualiza.',
  'workbench.importExport.preview.emptyClipboard': 'Lipiți un export de spațiu de lucru pentru a-l previzualiza.',
  'workbench.importExport.preview.preparing': 'Se pregătește importul…',
  'workbench.importExport.preview.footerExportInfo': 'Export {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'Alegeți un fișier de previzualizat',
  'workbench.importExport.preview.footerNoData': 'Fără date',
  'workbench.importExport.preview.importInto': 'Import în:',
  'workbench.importExport.preview.staleTitle': 'Spațiul de lucru s-a schimbat de la deschiderea acestei previzualizări',
  'workbench.importExport.preview.staleDescription':
    'Redeschideți previzualizarea importului pentru a reîmprospăta diff-ul, apoi reîncercați.',
  'workbench.importExport.preview.advanced': 'Avansat',
  'workbench.importExport.preview.advancedCount': 'Avansat ({count})',
  'workbench.importExport.preview.previewFailed': 'Previzualizarea a eșuat',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `Import — ${plural(locale, Number(count), {
      one: '{count} element',
      few: '{count} elemente',
      other: '{count} de elemente',
    })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'Import în',
  'workbench.importExport.target.current': 'Curent',
  'workbench.importExport.target.new': 'Nou',
  'workbench.importExport.target.pickExisting': 'Alegere existent',
  'workbench.importExport.target.noActiveWorkspace': 'Niciun spațiu de lucru activ',
  'workbench.importExport.target.selectWorkspace': 'Selectați un spațiu de lucru',
  'workbench.importExport.target.landsOnOrg': 'Ajunge pe {name} și se sincronizează cu dispozitivele sale',
  'workbench.importExport.target.staysLocal': 'Rămâne pe acest dispozitiv',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': 'Avansat',
  'workbench.importExport.advanced.closeAria': 'Închidere panou avansat',
  'workbench.importExport.advanced.backupRestoreLabel': 'Este al meu — preferă actualizarea după uid',
  'workbench.importExport.advanced.backupRestoreHelp':
    'Comută coliziunile potrivite după uid de la „Adăugare ca noi” la „Înlocuire”. Omisă pentru entitățile editate local după crearea exportului.',
  'workbench.importExport.advanced.trustExportLabel': 'Încredere în acest export — păstrează indicatoarele de activare',
  'workbench.importExport.advanced.trustExportHelp':
    'Regulile / fluxurile de lucru Live / variabilele Live importate ajung dezactivate implicit. Activați doar când aveți încredere în expeditor.',
  'workbench.importExport.advanced.stripScriptsLabel': 'Eliminare scripturi ale cererilor la import',
  'workbench.importExport.advanced.stripScriptsHelp':
    'Elimină scripturile pre-cerere și post-răspuns din fiecare cerere importată. Recomandat când expeditorul este necunoscut.',
  'workbench.importExport.advanced.omitOAuthLabel': 'Omitere configurații OAuth',
  'workbench.importExport.advanced.omitOAuthHelp':
    'Implicit, configurațiile OAuth2 călătoresc cu cererea (punct final de token, id de client, sfere — niciodată secretul de client sau tokenurile). Cu această opțiune activată, fiecare cerere OAuth2 ajunge cu autorizarea setată la niciuna.',
  'workbench.importExport.advanced.keepOrderLabel': 'Păstrare ordine colecție țintă la actualizare',
  'workbench.importExport.advanced.keepOrderHelp':
    'Implicit, o colecție actualizată preia ordinea copiilor din export. Cu această opțiune activată, ordinea existentă din țintă se păstrează.',
  'workbench.importExport.advanced.workspaceSettingsLabel': 'Includere setări la nivel de spațiu de lucru',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    'Rezervat pentru o viitoare listă de setări permise cu semantică de spațiu de lucru. Lista curentă este goală — nimic nu se livrează prin acest comutator în v1.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'Refuz la coliziune de workspace.uid',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    'Implicit, importul într-un spațiu de lucru nou regenerează silențios uid-ul spațiului de lucru la coliziune. Cu această opțiune activată, un spațiu de lucru existent cu același uid blochează importul.',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': 'Respingere',
  'workbench.importExport.chips.plaintextLabel': 'Secrete în text clar',
  'workbench.importExport.chips.plaintextTitle': 'Acest export conține secrete din vault în text clar.',
  'workbench.importExport.chips.plaintextBody':
    'Oricine are acest fișier poate citi fiecare secret pe care îl poartă. Luați în calcul reemiterea în formă criptată înainte de a-l redirecționa.',
  'workbench.importExport.chips.skippedLabel': 'omise: {count}',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entitate nu a putut fi analizată și va fi omisă.',
      few: '{count} entități nu au putut fi analizate și vor fi omise.',
      other: '{count} de entități nu au putut fi analizate și vor fi omise.',
    }),
  'workbench.importExport.chips.andMore': '…și încă {count}',
  'workbench.importExport.chips.dedupSameLabel': 'Importat deja aici',
  'workbench.importExport.chips.dedupSameTitle': 'Ați importat acest export ({id}) aici pe {date}.',
  'workbench.importExport.chips.dedupSameBody':
    'Reimportarea lui va aplica alegerile dvs. curente de strategie per entitate.',
  'workbench.importExport.chips.dedupOtherLabel': 'Importat în altă parte',
  'workbench.importExport.chips.dedupOtherTitle': 'Ați importat exportul {id} și în „{name}”.',
  'workbench.importExport.chips.dedupOtherBody': 'Acel spațiu de lucru nu este afectat de acest import.',
  'workbench.importExport.chips.dedupUidLabel': 'Sursa există deja',
  'workbench.importExport.chips.dedupUidTitle': 'Un spațiu de lucru din această sursă există deja („{name}”).',
  'workbench.importExport.chips.dedupUidBody':
    'Comutați ținta de mai sus pentru a-l reîmprospăta sau importați ca o copie nouă.',
  'workbench.importExport.chips.staleLabel': 'Date modificate',
  'workbench.importExport.chips.staleTitle': 'Spațiul de lucru țintă a fost modificat de altă filă.',
  'workbench.importExport.chips.staleBody':
    'Arborele de coliziuni de mai jos a fost reîmprospătat — revizuiți și apăsați din nou „Import”.',
  'workbench.importExport.chips.previewErrorLabel': 'Previzualizarea a eșuat',
  'workbench.importExport.chips.previewErrorTitle': 'Nu s-a putut calcula diff-ul coliziunilor.',
  'workbench.importExport.chips.unresolvedLabel': 'nerezolvate: {count}',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} referință nerezolvată.',
      few: '{count} referințe nerezolvate.',
      other: '{count} de referințe nerezolvate.',
    }),
  'workbench.importExport.chips.unresolvedBody':
    'Aceste nume nu se rezolvă nici în export, nici în țintă. Importurile vor ajunge ca legări rupte — relegați odată ce entitatea lipsă apare.',
  'workbench.importExport.chips.referencedBy': 'referințe: {count}',
  'workbench.importExport.chips.summaryThen': 'Atunci:',
  'workbench.importExport.chips.summaryNow': 'Acum:',
  'workbench.importExport.chips.summaryNew': 'noi: {count}',
  'workbench.importExport.chips.summaryKept': 'păstrate: {count}',
  'workbench.importExport.chips.summaryRemoved': 'eliminate: {count}',
  'workbench.importExport.chips.showBreakdown': 'Afișare defalcare per secțiune',
  'workbench.importExport.chips.hideBreakdown': 'Ascundere defalcare',
  'workbench.importExport.chips.sectionNew': '(noi: +{count})',
  'workbench.importExport.chips.sectionRemoved': '(eliminate: {count})',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'vault criptat — {count} secret',
      few: 'vault criptat — {count} secrete',
      other: 'vault criptat — {count} de secrete',
    }),
  'workbench.importExport.vault.hintFromSender': 'Indiciu de la expeditor:',
  'workbench.importExport.vault.enterPassphrase':
    'Introduceți fraza de acces pentru a decripta aceste secrete local. Omiterea decriptării continuă cu restul importului — secretele sunt pur și simplu omise.',
  'workbench.importExport.vault.passphrasePlaceholder': 'Frază de acces',
  'workbench.importExport.vault.decrypt': 'Decriptare vault',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault decriptat — {count} secret gata de import',
      few: 'Vault decriptat — {count} secrete gata de import',
      other: 'Vault decriptat — {count} de secrete gata de import',
    }),
  'workbench.importExport.vault.keyFingerprint': 'Amprenta cheii:',
  'workbench.importExport.vault.compareWithSender': '(comparați cu expeditorul)',
  'workbench.importExport.vault.ciphertextFingerprint': 'Amprenta textului cifrat:',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} secret nu a putut fi decodat — va fi omis din import',
      few: '{count} secrete nu au putut fi decodate — vor fi omise din import',
      other: '{count} de secrete nu au putut fi decodate — vor fi omise din import',
    }),
  'workbench.importExport.vault.andMore': '…și încă {count}',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'Anulare',
  'workbench.importExport.import.importCta': 'Import',
  'workbench.importExport.import.importCtaCount': 'Import ({count})',
  'workbench.importExport.import.importShortcutTooltip': 'Import ({shortcut})',
  'workbench.importExport.import.importTo': 'IMPORT ÎN',
  'workbench.importExport.import.hintNavigate': 'navigare',
  'workbench.importExport.import.hintSelect': 'selectare',
  'workbench.importExport.import.hintImport': 'import',
  'workbench.importExport.import.hintClose': 'închidere',
  'workbench.importExport.import.cantReadFile': 'Nu s-a putut citi acest fișier',
  'workbench.importExport.import.failedCreateCollection': 'Crearea colecției a eșuat',
  'workbench.importExport.import.importFailed': 'Importul a eșuat: {message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transformare',
      few: '{count} transformări',
      other: '{count} de transformări',
    }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} eliminare',
      few: '{count} eliminări',
      other: '{count} de eliminări',
    }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Importată {count} cerere',
      few: 'Importate {count} cereri',
      other: 'Importate {count} de cereri',
    }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'IMPORT DIN HAR',
  'workbench.importExport.har.tooltipChooseFile': 'Alegeți mai întâi un fișier .har',
  'workbench.importExport.har.tooltipSelectEntry': 'Selectați cel puțin o intrare',
  'workbench.importExport.har.footerSelected': '{selected} din {total} selectate',
  'workbench.importExport.har.footerChooseFile': 'Alegeți un fișier .har',
  'workbench.importExport.har.introPrefix': 'Importați un fișier',
  'workbench.importExport.har.introSuffix':
    '(HTTP Archive) exportat din DevTools sau dintr-un proxy. Fiecare intrare devine o cerere de destinație în colecția aleasă. Cookie-urile și încărcările multipart sunt eliminate cu adnotări de urmărire; antetele de autorizare sunt promovate la tipuri de autorizare de primă clasă.',
  'workbench.importExport.har.filterPlaceholder': 'Filtrare după adresa URL / metodă / nume',
  'workbench.importExport.har.selectAll': 'Selectare toate',
  'workbench.importExport.har.selectNone': 'Niciuna',
  'workbench.importExport.har.readFailed': 'Citirea fișierului HAR a eșuat: {message}',
  'workbench.importExport.har.dropTitle': 'Plasați aici un fișier .har sau apăsați pentru a alege unul',
  'workbench.importExport.har.dropHint': 'Exportat din DevTools Network → clic dreapta → Save all as HAR',
  'workbench.importExport.har.noImportableEntries': 'Fișierul nu are intrări importabile.',
  'workbench.importExport.har.noFilterMatch': 'Nicio intrare nu se potrivește cu filtrul.',
  'workbench.importExport.har.showingFirst':
    'Se afișează primele {shown} din {total}. Folosiți filtrul pentru a restrânge.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transformare aplicată sursei',
      few: '{count} transformări aplicate sursei',
      other: '{count} de transformări aplicate sursei',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} eliminare înregistrată',
      few: '{count} eliminări înregistrate',
      other: '{count} de eliminări înregistrate',
    }),
  'workbench.importExport.har.transformsTooltip':
    'Transformările rescriu câmpurile sursei în echivalente normalizate — de ex. promovarea antetelor Authorization la tipuri de autorizare de primă clasă.',
  'workbench.importExport.har.dropsTooltip':
    'Eliminările sunt câmpuri ale sursei care nu se mapează pe model (cookie-uri, încărcări multipart etc.). Fiecare are o adnotare de urmărire în raportul complet.',
  'workbench.importExport.har.reportHover':
    'Treceți cursorul pentru detalii · lista completă în exportul raportului de import (Aplicație › Date)',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'IMPORT DIN CURL',
  'workbench.importExport.curl.tooltipPasteFirst': 'Lipiți mai întâi o comandă curl',
  'workbench.importExport.curl.tooltipEnterName': 'Introduceți un nume',
  'workbench.importExport.curl.introPrefix': 'Lipiți o comandă',
  'workbench.importExport.curl.introSuffix':
    '— de exemplu, „Copiere ca cURL” din fereastra DevTools a browserului sau din documentația API.',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': 'Nu s-a putut analiza această comandă',
  'workbench.importExport.curl.parseFallback': 'Nu s-a putut analiza — verificați comanda și încercați din nou.',
  'workbench.importExport.curl.nameLabel': 'NUME',
  'workbench.importExport.curl.namePlaceholder': 'Cum apare această cerere în bara laterală',
  'workbench.importExport.curl.failedCreateRequest': 'Crearea cererii a eșuat',
  'workbench.importExport.curl.importedName': 'Importat „{name}”',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} antet', few: '{count} antete', other: '{count} de antete' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} parametru de interogare',
      few: '{count} parametri de interogare',
      other: '{count} de parametri de interogare',
    }),
  'workbench.importExport.curl.noBody': 'fără corp',
  'workbench.importExport.curl.bodyType': 'corp {type}',
  'workbench.importExport.curl.noAuth': 'fără autorizare',
  'workbench.importExport.curl.authType': 'autorizare {type}',
  'workbench.importExport.curl.droppedWord': 'eliminat',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'IMPORT DIN POSTMAN',
  'workbench.importExport.postman.intro':
    'Importați un fișier JSON Postman Collection v2.1. Structura de foldere, variabilele de colecție, documentația și setările cererilor, autorizarea per cerere (basic / bearer / api-key / OAuth 2.0) și scripturile cererilor (traduse în interfața oh.* API unde este posibil) sunt păstrate. AWS sigv4 și încărcările de fișiere sunt urmărite ca eliminări. Opțional, atașați un fișier de mediu Postman pentru a obține un mediu corespunzător.',
  'workbench.importExport.postman.tooltipChooseFile': 'Alegeți mai întâi un fișier de colecție',
  'workbench.importExport.postman.tooltipEnterName': 'Introduceți un nume de colecție',
  'workbench.importExport.postman.collectionNameLabel': 'NUME COLECȚIE',
  'workbench.importExport.postman.collectionNamePlaceholder': 'Nume pentru noua colecție',
  'workbench.importExport.postman.readFileFailed': 'Citirea fișierului a eșuat: {message}',
  'workbench.importExport.postman.readEnvFailed': 'Citirea mediului a eșuat: {message}',
  'workbench.importExport.postman.parsedCollection': 'COLECȚIE ANALIZATĂ',
  'workbench.importExport.postman.requestsLabel': 'Cereri:',
  'workbench.importExport.postman.foldersLabel': 'Foldere:',
  'workbench.importExport.postman.collectionVarsLabel': 'Variabile de colecție:',
  'workbench.importExport.postman.folderTree': 'Arbore de foldere',
  'workbench.importExport.postman.optionalEnvFile': 'OPȚIONAL · FIȘIER DE MEDIU',
  'workbench.importExport.postman.environmentLabel': 'Mediu: {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var.', few: '{count} var.', other: '{count} de var.' }),
  'workbench.importExport.postman.secretCount': 'secrete: {count}',
  'workbench.importExport.postman.remove': 'Eliminare',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variabilă de mediu eliminată (intrări dezactivate)',
      few: '{count} variabile de mediu eliminate (intrări dezactivate)',
      other: '{count} de variabile de mediu eliminate (intrări dezactivate)',
    }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Plasați aici un fișier JSON Postman Collection v2.1 sau apăsați pentru a alege unul',
  'workbench.importExport.postman.dropEnvTitle': 'Plasați aici un fișier JSON Postman Environment (opțional)',
  'workbench.importExport.postman.dropCollectionHint':
    'Exportat din Postman → Collection → ⋯ → Export (Collection v2.1)',
  'workbench.importExport.postman.dropEnvHint': 'Exportat din Postman → Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} folder', few: '{count} foldere', other: '{count} de foldere' }),
  'workbench.importExport.postman.oneEnvironment': '1 mediu',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'IMPORT DIN COPIE DE REZERVĂ POSTMAN',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Importați un export de date de rezervă Postman. Colecțiile, mediile, variabilele globale și presetările de antete sunt recunoscute; presetările de antete ajung ca reguli de antete nepublicate. Scripturile, OAuth 2.0, AWS sigv4 și încărcările de fișiere sunt urmărite ca eliminări.',
  'workbench.importExport.sectioned.titleInsomnia': 'IMPORT DIN INSOMNIA',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Importați un export Insomnia (JSON v4 sau YAML v5). Spațiile de lucru devin colecții cu arborii lor de foldere; mediile se aplatizează (submediile se îmbină peste baza lor) și referințele {{ _.var }} se rescriu ca {{var}}; specificațiile API încorporate sunt păstrate ca specificații editabile legate de colecțiile lor generate.',
  'workbench.importExport.sectioned.titleBruno': 'IMPORT DIN BRUNO',
  'workbench.importExport.sectioned.blurbBruno':
    'Importați o cerere Bruno .bru sau un întreg folder de colecție. Metoda, antetele, parametrii, corpul și autorizarea basic/bearer/api-key sunt păstrate; un folder aduce arborele său de foldere, ordinea și mediile; scripturile, testele și blocurile de documentație sunt urmărite ca eliminări.',
  'workbench.importExport.sectioned.titleOpenapi': 'IMPORT DIN OPENAPI',
  'workbench.importExport.sectioned.blurbOpenapi':
    'Importați un document OpenAPI 3.x (JSON sau YAML). Operațiile devin cereri sub {{baseUrl}}, etichetele devin foldere, parametrii și corpurile cererilor sunt păstrate (corpurile doar cu schemă primesc un schelet substituent), iar schemele de securitate se mapează pe autorizare — completați substituenții {{clientId}}/{{clientSecret}} după import. Documentul poate trăi mai departe ca specificație editabilă legată de colecția generată.',
  'workbench.importExport.sectioned.titleGraphqlSchema': 'IMPORT SCHEMĂ GRAPHQL',
  'workbench.importExport.sectioned.blurbGraphqlSchema':
    'Importați o schemă GraphQL — text SDL sau un rezultat de introspecție. Ajunge ca specificație editabilă pe care cererile GraphQL o leagă ca sursă de schemă; deschideți-o apoi pentru a genera o colecție de cereri din câmpurile ei rădăcină.',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'Nimic analizat încă',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'Fiecare colecție are nevoie de un nume',
  'workbench.importExport.sectioned.cantReadImport': 'Nu s-a putut citi acest import',
  'workbench.importExport.sectioned.readInputFailed': 'Citirea intrării a eșuat: {message}',
  'workbench.importExport.sectioned.importAs': 'IMPORT CA',
  'workbench.importExport.sectioned.specWithCollection': 'Specificație cu o colecție',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'Documentul trăiește mai departe ca specificație editabilă, legată de colecția generată.',
  'workbench.importExport.sectioned.collectionOnly': 'Colecție',
  'workbench.importExport.sectioned.collectionOnlyHelp': 'Doar conversie — documentul în sine nu este păstrat.',
  'workbench.importExport.sectioned.specificationsSection': 'SPECIFICAȚII · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'COLECȚII · {count}',
  'workbench.importExport.sectioned.environmentsSection': 'MEDII · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': 'PRESETĂRI DE ANTETE · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'Nume colecție',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var.', few: '{count} var.', other: '{count} de var.' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} antet', few: '{count} antete', other: '{count} de antete' }),
  'workbench.importExport.sectioned.presetsNote':
    'Fiecare presetare ajunge ca regulă de antete nepublicată — adăugați condiții și publicați-o când este gata; nimic nu atinge traficul live până atunci.',
  'workbench.importExport.sectioned.nothingImportable': 'Nimic importabil în acest fișier',
  'workbench.importExport.sectioned.nothingImportableDesc':
    'Fișierul a fost analizat, dar fiecare secțiune a fost goală sau eliminată — vedeți notele de import de mai jos.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cerere', few: '{count} cereri', other: '{count} de cereri' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} specificație',
      few: '{count} specificații',
      other: '{count} de specificații',
    }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} mediu', few: '{count} medii', other: '{count} de medii' }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} regulă de antete (nepublicată)',
      few: '{count} reguli de antete (nepublicate)',
      other: '{count} de reguli de antete (nepublicate)',
    }),
  'workbench.importExport.sectioned.importedLead': 'Importate: {parts}',
  'workbench.importExport.sectioned.emptyFinish': 'Import încheiat — nimic de adus',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': 'Migrare din alt instrument',
  'workbench.importExport.migrate.scanCta': 'Scanare acest computer',
  'workbench.importExport.migrate.pullCta': 'Import din contul Postman',
  'workbench.importExport.migrate.scanNote':
    'Scanarea verifică o listă fixă de foldere de aplicații și citește doar fișierele de date ale instrumentelor (copii de rezervă și depozite locale). Nu deschide niciodată fișiere de acreditări, cookie-uri sau sesiuni și nimic nu părăsește acest computer. Importarea a orice este un pas separat, explicit.',
  'workbench.importExport.migrate.scanFailed':
    'Scanarea nu a putut rula — încercați din nou sau folosiți centrul de import cu un fișier exportat.',
  'workbench.importExport.migrate.backupReadFailed': 'Fișierul de rezervă nu a putut fi citit.',
  'workbench.importExport.migrate.localReadFailed': 'Datele locale nu au putut fi citite.',
  'workbench.importExport.migrate.detected': 'Detectat',
  'workbench.importExport.migrate.notFound': 'Negăsit',
  'workbench.importExport.migrate.cancel': 'Anulare',
  'workbench.importExport.migrate.fromAccount': 'Import din contul dvs. Postman',
  'workbench.importExport.migrate.localDataPrefix':
    'Aveți date locale Insomnia, Thunder Client sau Bruno? Exportați-le din instrument și plasați fișierul în',
  'workbench.importExport.migrate.importHub': 'centrul de import',
  'workbench.importExport.migrate.localDataSuffix': '— sau scanați acest computer cu aplicația desktop Open Headers.',
  'workbench.importExport.migrate.desktopConnected':
    'Aplicația dvs. desktop este conectată — alegeți acolo „Migrare din alt instrument”; progresul se oglindește aici, iar spațiile de lucru importate se sincronizează.',
  'workbench.importExport.migrate.desktopNeeded':
    'Scanarea are nevoie de aplicația desktop; odată ce rulează acolo, spațiile de lucru importate se sincronizează în acest browser.',
  'workbench.importExport.migrate.closeConfirmTitle': 'Închideți importul?',
  'workbench.importExport.migrate.closeListingContent':
    'Spațiile dvs. de lucru sunt încă în curs de listare — conturile mari pot dura un minut. Închiderea abandonează listarea.',
  'workbench.importExport.migrate.closeListingOk': 'Continuare așteptare',
  'workbench.importExport.migrate.closeSelectingContent':
    'Selecția dvs. de spații de lucru se va pierde. Nimic nu a fost importat încă.',
  'workbench.importExport.migrate.closeSelectingOk': 'Continuare selectare',
  'workbench.importExport.migrate.closeAnyway': 'Închidere oricum',
  'workbench.importExport.migrate.discardAndClose': 'Renunțare și închidere',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman's UI is English, so the glyph labels
  // and its menu rows stay English.
  'workbench.importExport.pull.keyIntro':
    'Lipiți o cheie API Postman pentru a lista spațiile dvs. de lucru și a alege pe care să le importați.',
  'workbench.importExport.pull.keyAria': 'Cheie API Postman',
  'workbench.importExport.pull.listCta': 'Listare spații de lucru',
  'workbench.importExport.pull.listFailed': 'Spațiile de lucru nu au putut fi listate.',
  'workbench.importExport.pull.startFailed': 'Importul nu a putut porni.',
  'workbench.importExport.pull.quipContacting': 'Se contactează contul dvs. Postman',
  'workbench.importExport.pull.quipCounting': 'Se numără colecțiile',
  'workbench.importExport.pull.quipWeighing': 'Se cântăresc mediile',
  'workbench.importExport.pull.quipWrangling': 'Se strunesc spațiile de lucru',
  'workbench.importExport.pull.quipAlphabetizing': 'Se alfabetizează folderele',
  'workbench.importExport.pull.quipSniffing': 'Se adulmecă cererile',
  'workbench.importExport.pull.quipUntangling': 'Se descâlcesc variabilele',
  'workbench.importExport.pull.quipStacking': 'Se stivuiesc antetele',
  'workbench.importExport.pull.pickIntro':
    'Fiecare spațiu de lucru Postman selectat ajunge în propriul spațiu de lucru, păstrându-și numele exact, cu un raport la sfârșitul rulării.',
  'workbench.importExport.pull.noWorkspaces': 'Niciun spațiu de lucru găsit în acest cont.',
  'workbench.importExport.pull.workspaceCounts': 'colecții: {collections} · medii: {environments}',
  'workbench.importExport.pull.importCta': 'Import selectate',
  'workbench.importExport.pull.back': 'Înapoi',
  'workbench.importExport.pull.steps.menuA': 'În aplicația Postman sau la https://postman.co',
  'workbench.importExport.pull.steps.menuB': 'Meniul Settings → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Bara laterală stângă → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': 'Puneți un nume oarecare → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'Copiați cheia → lipiți-o mai sus',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'Furnizor',
  'workbench.importExport.detection.dataFoundCol': 'Date găsite',
  'workbench.importExport.detection.contentsCol': 'Conținut',
  'workbench.importExport.detection.backupFrom': 'Copie de rezervă din {date}',
  'workbench.importExport.detection.localData': 'Date locale',
  'workbench.importExport.detection.importCta': 'Import…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'Sau exportați-le (Preferences → Data → Export), apoi plasați fișierul în',
  'workbench.importExport.detection.backupContents':
    'colecții: {collections} · medii: {environments} · presetări de antete: {headerPresets} · variabile globale: {globals}',
  'workbench.importExport.detection.localContents':
    'colecții: {collections} · medii: {environments} · cereri: {requests}',
  'workbench.importExport.detection.emptyScanned': 'Nu s-au găsit depozite de date importabile pe acest computer.',
  'workbench.importExport.detection.emptyNotScanned':
    'Nimic scanat încă — „Scanare acest computer” listează aici datele importabile.',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fișier de depozit a fost omis —',
      few: '{count} fișiere de depozit au fost omise —',
      other: '{count} de fișiere de depozit au fost omise —',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Raport de import Postman',
  'workbench.importExport.report.noReport': 'Niciun raport de import găsit pentru acest spațiu de lucru.',
  'workbench.importExport.report.cleanImport': 'Totul s-a importat curat — fără eliminări sau transformări.',
  'workbench.importExport.report.copyOk': 'Raport copiat ca JSON',
  'workbench.importExport.report.copyAnonymizedOk': 'Raport anonimizat copiat ca JSON',
  'workbench.importExport.report.copyFailed': 'Raportul nu a putut fi copiat.',
  'workbench.importExport.report.copyReport': 'Copiere raport',
  'workbench.importExport.report.download': 'Descărcare',
  'workbench.importExport.report.anonymizeTooltip':
    'Pentru partajare publică (de ex. o problemă pe GitHub): numele spațiilor de lucru devin „Spațiu de lucru N”, iar valorile rescrise sunt cenzurate. Căile, motivele și numărătorile rămân, ca raportul să poată fi depanat în continuare.',
  'workbench.importExport.report.anonymize': 'Anonimizare',
  'workbench.importExport.report.close': 'Închidere',
  'workbench.importExport.report.openWorkspace': 'Deschidere spațiu de lucru',
  'workbench.importExport.report.countsLine': 'colecții: {collections} · medii: {environments} · cereri: {requests}',
  'workbench.importExport.report.savedExamplesPart': 'exemple salvate: {count}',
  'workbench.importExport.report.globalVariablesPart': 'variabile globale: {count}',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} notă', few: '{count} note', other: '{count} de note' }),
  'workbench.importExport.report.summaryImported': 'Importate',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'colecție', few: 'colecții', other: 'de colecții' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'mediu', few: 'medii', other: 'de medii' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'cerere', few: 'cereri', other: 'de cereri' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'exemplu salvat', few: 'exemple salvate', other: 'de exemple salvate' }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'variabilă globală',
      few: 'variabile globale',
      other: 'de variabile globale',
    }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} spațiu de lucru',
      few: '{count} spații de lucru',
      other: '{count} de spații de lucru',
    }),
  'workbench.importExport.report.withOpen': '(inclusiv',
  'workbench.importExport.report.and': 'și',
  'workbench.importExport.report.into': 'în',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': 'anterior',
  'workbench.importExport.reimport.previouslyImported': '(importat anterior {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} problemă nouă de la ultimul import',
      few: '{count} probleme noi de la ultimul import',
      other: '{count} de probleme noi de la ultimul import',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} intrare anterior neacceptată este acum gestionată',
      few: '{count} intrări anterior neacceptate sunt acum gestionate',
      other: '{count} de intrări anterior neacceptate sunt acum gestionate',
    }),
  'workbench.importExport.reimport.countsChanged': 'Numărătorile s-au schimbat de la ultimul import',
  'workbench.importExport.reimport.minorChanges': 'Modificări minore față de ultimul import',
  'workbench.importExport.reimport.newDrops': 'Eliminări noi ({count})',
  'workbench.importExport.reimport.dropsResolved': 'Eliminări rezolvate ({count})',
  'workbench.importExport.reimport.newTransforms': 'Transformări noi ({count})',
  'workbench.importExport.reimport.transformsResolved': 'Transformări care nu mai sunt necesare ({count})',
} as const satisfies Catalog;
