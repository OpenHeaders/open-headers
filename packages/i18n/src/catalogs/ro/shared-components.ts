/**
 * Shared component families — Romanian. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for
 * the family map and the raw technical plane (`{{ns.*}}` references,
 * claim/algorithm names, key caps and glyphs, format examples). Mints:
 * variabilă = variable; mediu = environment; colecție = collection;
 * secret = secret; generator = generator; sferă = scope; referință =
 * reference; învechit = stale; captură = capture; doc = dock;
 * fereastră de instrumente = tool window; cuprins = table of contents;
 * parametru = parameter; directivă = directive; simulare / simulat =
 * mock; injectare = inject; eliminare = drop; înlocuire = replace;
 * suprascriere = override (Live). JWT part names (Header / Payload /
 * Signature) and header field names ride raw — RFC vocabulary; the
 * head noun carries them into prose (editorul JWT, valoarea JSON,
 * parametrii URL, directivele CSP). The two peer-execute notices quote
 * the Backup and Sync › Your devices row labels — the ro settings file
 * quotes THESE values verbatim when it lands („Permiteți browserelor
 * acestui dispozitiv să trimită cereri”, „Permiteți altor dispozitive
 * conectate să trimită cereri”, „Copie de rezervă și sincronizare ›
 * Dispozitivele dvs.”).
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': 'Editare valoare',
  'shared.templateInput.showValue': 'Afișare valoare',
  'shared.templateInput.hideValue': 'Ascundere valoare',
  'shared.templateInput.clearValue': 'Golire valoare',
  'shared.templateInput.unresolvedDot': 'Conține o variabilă nerezolvată',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': 'Creare variabilă „{name}”',
  'shared.templateInput.createNamedInScope': 'Creare variabilă „{name}” în {scope}',
  'shared.templateInput.noMatches': 'Nicio potrivire',
  'shared.templateInput.footerNavigate': '↑↓ navigare',
  'shared.templateInput.footerSelect': '↵ selectare',
  'shared.templateInput.footerClose': 'esc închidere',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': 'Capturată la rulare',
  'shared.templateInput.totpPreview': 'TOTP {digits} cifre · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP {digits} cifre · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(gol)',
  'shared.templateInput.staleBadge': 'învechită',
  'shared.templateInput.needsRerunBadge': 'necesită rerulare',
  'shared.templateInput.disabledBadge': 'dezactivată',
  // Namespace-scaffold / reserved rows: core mints the English subtitle
  // for its own (locale-free) plane; the UI resolves these keys from the
  // row's kind + scope instead of rendering core's copy.
  'shared.templateInput.scaffold.vault': 'Adăugare secret',
  'shared.templateInput.scaffold.env': 'Adăugare variabilă de mediu',
  'shared.templateInput.scaffold.collection': 'Adăugare variabilă de colecție',
  'shared.templateInput.scaffold.workspace': 'Adăugare variabilă de spațiu de lucru',
  'shared.templateInput.scaffold.dynamic': 'Generatoare încorporate — uuid, timestamp, …',
  'shared.templateInput.reservedFile': 'Referințele la fișiere vor fi disponibile în curând',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': 'Introduceți valoarea',
  'shared.templateInput.foundIn': 'Găsită în:',
  'shared.templateInput.scopeFixedTooltip':
    'Sfera este fixată de prefixul {prefix} — editați referința pentru a o schimba.',
  'shared.templateInput.addToScope': 'Adăugare la: {scope}',
  'shared.templateInput.addToPickScope': 'Adăugare la: alegeți sfera',
  'shared.templateInput.resolvedDefault': 'Rezolvată: implicit',
  'shared.templateInput.resolvedDefaultNoEnv': 'Rezolvată: implicit (niciun mediu activ)',
  'shared.templateInput.noActiveEnvHint':
    'Niciun mediu selectat — alegeți unul din comutatorul de medii pentru a adăuga o variabilă de mediu.',
  'shared.templateInput.noCollectionHint':
    'Nicio colecție activă — deschideți o colecție pentru a adăuga o variabilă de colecție.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': 'Mediu · {name}',
  'shared.templateInput.scope.collectionNamed': 'Colecție · {name}',
  'shared.templateInput.scope.workspace': 'Spațiu de lucru',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · suprascriere',
  'shared.templateInput.scope.stepNamed': 'Pas · {capture}',
  'shared.templateInput.scope.fileNamed': 'Fișier · {name}',
  'shared.templateInput.scope.dynamic': 'Dinamică',
  'shared.templateInput.scope.unresolved': 'Nerezolvată',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': 'Mediu',
  'shared.templateInput.createScope.collection': 'Colecție',
  'shared.templateInput.createScope.workspace': 'Spațiu de lucru',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'niciun mediu activ',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': 'Referință goală',
  'shared.templateInput.unresolved.unknownNamespace': 'Spațiu de nume necunoscut',
  'shared.templateInput.unresolved.dynamic':
    'Nu există niciun generator încorporat cu acest nume. Alegeți unul din lista de sugestii {{dynamic.…}}.',
  'shared.templateInput.unresolved.step': 'Se rezolvă doar cât timp rulează un lanț de flux de lucru Live.',
  'shared.templateInput.unresolved.envNotSet': 'Nu este setată în mediul „{name}”.',
  'shared.templateInput.unresolved.noActiveEnv': 'Niciun mediu activ nu este selectat.',
  'shared.templateInput.unresolved.live':
    'Nu există nicio variabilă Live cu acest nume (sau nu are încă o valoare în cache).',
  'shared.templateInput.unresolved.notDefined': 'Nu este definită în nicio sferă.',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': 'Alegeți o sferă din „Adăugare la”',
  'shared.templateInput.save.totpInVaultEditor': 'Secretele TOTP se editează în editorul Vault',
  'shared.templateInput.save.vaultKindChanged': 'Tipul intrării Vault s-a schimbat între timp',
  'shared.templateInput.save.notEditable': 'Nu poate fi editată',
  'shared.templateInput.save.noActiveEnv': 'Niciun mediu activ',
  'shared.templateInput.save.noCollection': 'Nicio colecție în context',
  'shared.templateInput.save.saved': 'Salvat',
  'shared.templateInput.save.duplicateName': 'O variabilă cu acest nume există deja în această sferă.',
  'shared.templateInput.save.notFound': 'Variabila nu a fost găsită — este posibil să fi fost ștearsă.',
  'shared.templateInput.save.failed': 'Salvarea a eșuat',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': 'Setare ca variabilă',
  'shared.templateInput.setAsNewVariable': 'Setare ca variabilă nouă',
  'shared.templateInput.variableName': 'Numele variabilei',
  'shared.templateInput.variableValue': 'Valoarea variabilei',
  'shared.templateInput.valuePlaceholder': 'Valoare',
  'shared.templateInput.menu.cut': 'Decupare',
  'shared.templateInput.menu.paste': 'Lipire',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Secret Vault',
  'shared.templateInput.completion.scope.env': 'Mediu',
  'shared.templateInput.completion.scope.collection': 'Colecție',
  'shared.templateInput.completion.scope.workspace': 'Spațiu de lucru',
  'shared.templateInput.completion.scope.live': 'Sursă',
  'shared.templateInput.completion.scope.step': 'Captură de pas din fluxul sursei',
  'shared.templateInput.completion.scope.file': 'Referință la fișier',
  'shared.templateInput.completion.scope.dynamic': 'Generator dinamic',
  'shared.templateInput.completion.staleSuffix': '(învechită)',
  'shared.templateInput.completion.comingSoon': 'în curând',
  'shared.templateInput.completion.capturedAtRuntime': 'capturată la rulare',
  'shared.templateInput.completion.totpDetail': 'Cod TOTP ({digits} cifre, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': 'Valoare ascunsă (sferă sensibilă).',
  'shared.templateInput.completion.valueHiddenStale': 'Valoare ascunsă (variabilă Live învechită).',
  'shared.templateInput.completion.valueDoc': '**Valoare:** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**Valoare învechită:** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': 'Capturată când rulează fluxul de lucru.',
  'shared.templateInput.completion.totpDoc':
    '**Cod TOTP** — {algorithm}, {digits} cifre, se reîmprospătează la fiecare {period}s.',
  'shared.templateInput.completion.totpDocIssuer':
    '**Cod TOTP** pentru **{issuer}** — {algorithm}, {digits} cifre, se reîmprospătează la fiecare {period}s.',
  'shared.templateInput.completion.secretManagerDoc':
    '**Referință la managerul de secrete** — `{reference}`. Rezolvată din manager la trimitere; valoarea nu este stocată niciodată.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'Decodat',
  'shared.valueEditors.encodedPreview': 'Previzualizare codată',
  'shared.valueEditors.cannotEncode': 'Nu se poate coda — valoarea editată nu este validă pentru acest tip',
  'shared.valueEditors.encodedCopied': 'Valoarea codată a fost copiată în clipboard',
  'shared.valueEditors.copyFailed': 'Copierea în clipboard a eșuat',
  'shared.valueEditors.openAsDocument': 'Deschidere ca document',
  'shared.valueEditors.decode': 'Decodare',
  'shared.valueEditors.decodeChipView': 'Vizualizare decodată — {title}',
  'shared.valueEditors.decodeChipEdit': 'Decodare și editare — {title}',
  'shared.valueEditors.editJwt': 'Editare JWT',
  'shared.valueEditors.viewJwt': 'Vizualizare JWT',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'Valoare decodată',
  'shared.valueEditors.glance.openTab': 'Deschidere în filă nouă',
  'shared.valueEditors.glance.openModal': 'Deschidere ca fereastră modală',
  'shared.valueEditors.glance.moreClaims': 'încă {count}',
  'shared.valueEditors.glance.signatureElided':
    'Semnătura nu este afișată — deschideți documentul sau fereastra modală pentru tokenul complet.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': 'Nume',
  'shared.valueEditors.grid.key': 'Cheie',
  'shared.valueEditors.grid.value': 'Valoare',
  'shared.valueEditors.grid.flag': 'indicator',
  'shared.valueEditors.grid.ariaNamePairs': 'Perechi nume/valoare',
  'shared.valueEditors.grid.ariaKeyPairs': 'Perechi cheie/valoare',
  'shared.valueEditors.grid.ariaRowName': 'Numele rândului {row}',
  'shared.valueEditors.grid.ariaRowKey': 'Cheia rândului {row}',
  'shared.valueEditors.grid.ariaRowValue': 'Valoarea rândului {row}',
  'shared.valueEditors.grid.moveRowUp': 'Mutare rând {row} în sus',
  'shared.valueEditors.grid.moveRowDown': 'Mutare rând {row} în jos',
  'shared.valueEditors.grid.deleteRow': 'Ștergere rând {row}',
  'shared.valueEditors.grid.addRow': 'Adăugare rând',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'Editor JWT',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': 'Modificat',
  'shared.valueEditors.jwt.decodeErrorTitle': 'Tokenul nu a putut fi decodat',
  'shared.valueEditors.jwt.decoded': 'Decodat',
  'shared.valueEditors.jwt.encoded': 'Codat',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Revendicări:',
  'shared.valueEditors.jwt.rawToken': 'Token brut',
  'shared.valueEditors.jwt.pasteOrEdit': 'Lipiți sau editați tokenul brut',
  'shared.valueEditors.jwt.notDecodable': 'Nu este un JWT decodabil',
  'shared.valueEditors.jwt.structure': 'Structură:',
  'shared.valueEditors.jwt.resignWithSecret': 'Resemnare cu secret',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} din antet',
  'shared.valueEditors.jwt.signingSecret': 'Secret de semnare',
  'shared.valueEditors.jwt.secretMemoryNote': 'Păstrat doar în memorie și eliminat la închiderea editorului.',
  'shared.valueEditors.jwt.tokenExpired': 'Token expirat',
  'shared.valueEditors.jwt.tokenNotExpired': 'Token neexpirat',
  'shared.valueEditors.jwt.expiredOn': 'A expirat la {date}',
  'shared.valueEditors.jwt.expiresOn': 'Expiră la {date}',
  'shared.valueEditors.jwt.resigned': 'Token resemnat cu {algorithm}',
  'shared.valueEditors.jwt.resignedDescription':
    'Salvarea scrie tokenul semnat cu secretul dvs. — previzualizarea de mai sus este exact ceea ce se salvează.',
  'shared.valueEditors.jwt.cannotResign': 'Acest algoritm nu poate fi resemnat',
  'shared.valueEditors.jwt.cannotResignDescription':
    'Doar algoritmii HMAC (HS256, HS384, HS512) pot fi resemnați aici. Semnătura originală este păstrată în schimb.',
  'shared.valueEditors.jwt.signError': 'Tokenul nu a putut fi semnat',
  'shared.valueEditors.jwt.signatureInvalid': 'Semnătura nu mai este validă',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    'Semnătura originală este păstrată ca atare, așa că serverele care o verifică vor respinge tokenul editat. Introduceți un secret de semnare pentru a-l resemna.',
  'shared.valueEditors.jwt.copied': 'JWT copiat în clipboard',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'Payload JWT',
  'shared.valueEditors.valueTitle.urlEncoded': 'Valoare codată URL',
  'shared.valueEditors.valueTitle.base64': 'Valoare Base64',
  'shared.valueEditors.valueTitle.hex': 'Valoare codată hexazecimal',
  'shared.valueEditors.valueTitle.timestamp': 'Marcaj de timp Unix',
  'shared.valueEditors.valueTitle.json': 'Valoare JSON',
  'shared.valueEditors.valueTitle.jsonString': 'Șir între ghilimele',
  'shared.valueEditors.valueTitle.dataUri': 'URI de date',
  'shared.valueEditors.valueTitle.cookie': 'Valoare Cookie',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'Dată HTTP',
  'shared.valueEditors.valueTitle.queryString': 'Șir de interogare',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Antet Link',
  'shared.valueEditors.valueTitle.authParams': 'Parametri Authorization',
  'shared.valueEditors.valueTitle.acceptList': 'Listă Accept',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Secret Vault',
  'shared.scopeColors.environment': 'Variabilă de mediu',
  'shared.scopeColors.collection': 'Variabilă de colecție',
  'shared.scopeColors.workspace': 'Variabilă de spațiu de lucru',
  'shared.scopeColors.live': 'Variabilă Live (susținută de un flux de lucru)',
  'shared.scopeColors.step': 'Captură de pas din fluxul de lucru',
  'shared.scopeColors.file': 'Referință la fișier',
  'shared.scopeColors.dynamic': 'Generator dinamic',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'Editare ca JWT',
  'shared.valueEditors.editTooltip.urlEncoded': 'Editare valoare codată URL',
  'shared.valueEditors.editTooltip.base64': 'Editare valoare Base64',
  'shared.valueEditors.editTooltip.hex': 'Editare valoare codată hexazecimal',
  'shared.valueEditors.editTooltip.timestamp': 'Editare marcaj de timp',
  'shared.valueEditors.editTooltip.json': 'Editare ca JSON',
  'shared.valueEditors.editTooltip.jsonString': 'Editare șir între ghilimele',
  'shared.valueEditors.editTooltip.dataUri': 'Editare conținut URI de date',
  'shared.valueEditors.editTooltip.cookie': 'Editare perechi cookie',
  'shared.valueEditors.editTooltip.csp': 'Editare directive CSP',
  'shared.valueEditors.editTooltip.httpDate': 'Editare dată HTTP',
  'shared.valueEditors.editTooltip.queryString': 'Editare perechi de interogare',
  'shared.valueEditors.editTooltip.cacheControl': 'Editare directive de cache',
  'shared.valueEditors.editTooltip.hsts': 'Editare directive HSTS',
  'shared.valueEditors.editTooltip.contentDisposition': 'Editare parametri de dispunere',
  'shared.valueEditors.editTooltip.link': 'Editare linkuri',
  'shared.valueEditors.editTooltip.authParams': 'Editare parametri de autentificare',
  'shared.valueEditors.editTooltip.acceptList': 'Editare listă Accept',

  // ── Default entity names (multi-surface: sidebar create actions +
  //    save-modal prefilled collection create). 'User Templates' is NOT
  //    here — it identity-compares against the background seed and
  //    stays raw everywhere. ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': 'Colecție nouă de reguli',
  'shared.defaults.newRequestsCollection': 'Colecție nouă de cereri',
  'shared.defaults.newEnvironment': 'Mediu nou',
  'shared.defaults.newSpec': 'Specificație nouă',

  // ── Rule-type registry (multi-surface: workbench create menus +
  //    overviews + command palette + tool-window info, popup
  //    AddRulePalette). Labels and descriptions single-source every
  //    create/picker menu; type ids and code badges (HDR…) stay raw. ──
  'shared.ruleTypes.header.label': 'Modificare antete',
  'shared.ruleTypes.header.description': 'Adăugare, suprascriere sau eliminare de antete HTTP',
  'shared.ruleTypes.requestBody.label': 'Modificare corp cerere API',
  'shared.ruleTypes.requestBody.description': 'Suprascrie sau transformă corpul cererii API (doar fetch/XHR)',
  'shared.ruleTypes.response.label': 'Modificare răspuns API',
  'shared.ruleTypes.response.description':
    'Simulează sau modifică starea, corpul și antetele răspunsului API (doar fetch/XHR)',
  'shared.ruleTypes.queryParam.label': 'Modificare parametri de interogare',
  'shared.ruleTypes.queryParam.description': 'Adăugare, suprascriere sau eliminare de parametri URL',
  'shared.ruleTypes.inject.label': 'Injectare script/foaie de stil',
  'shared.ruleTypes.inject.description': 'Injectează JavaScript sau CSS în pagini',
  'shared.ruleTypes.ws.label': 'Modificare mesaje WebSocket',
  'shared.ruleTypes.ws.description': 'Înlocuiește, injectează sau elimină cadre WebSocket (doar socketurile paginii)',
  'shared.ruleTypes.sse.label': 'Modificare Server-Sent Events',
  'shared.ruleTypes.sse.description': 'Înlocuiește, injectează sau elimină evenimente SSE (doar fluxurile paginii)',
  'shared.ruleTypes.block.label': 'Blocare cereri',
  'shared.ruleTypes.block.description': 'Împiedică finalizarea cererilor',
  'shared.ruleTypes.redirect.label': 'Redirecționare cereri',
  'shared.ruleTypes.redirect.description': 'Redirecționează către o altă adresă URL',
  'shared.ruleTypes.delay.label': 'Întârziere cereri',
  'shared.ruleTypes.delay.description': 'Adaugă latență cererilor de rețea (doar fetch/XHR)',
  'shared.ruleTypes.auth.label': 'Răspuns la provocarea de autentificare',
  'shared.ruleTypes.auth.description':
    'Furnizează acreditări pentru o provocare de autentificare HTTP/proxy (necesită modul Depanare)',

  // ── Request-kind registry (workbench create menus that author a
  //    request without a destination in hand: tab-strip `+`, editor
  //    empty state). Labels single-source the four protocol rows; the
  //    code badges (HTTP / gRPC / WS / S.IO) stay raw. ──
  'shared.requestKinds.http.label': 'HTTP',
  'shared.requestKinds.grpc.label': 'gRPC',
  'shared.requestKinds.websocket.label': 'WebSocket',
  'shared.requestKinds.socketio.label': 'Socket.IO',
  'shared.requestKinds.mqtt.label': 'MQTT',
  'shared.requestKinds.graphql.label': 'GraphQL',

  // ── System rule-template registry (same surfaces as the rule types).
  //    Template keys, icons, conditions, and form values stay raw data;
  //    embedded code/URLs inside descriptions travel inside the value. ──
  'shared.ruleTemplates.blankRule': 'Regulă goală',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS și securitate',
  'shared.ruleTemplates.folder.authentication': 'Autentificare',
  'shared.ruleTemplates.folder.privacy': 'Confidențialitate',
  'shared.ruleTemplates.folder.testing': 'Testare',
  'shared.ruleTemplates.folder.urlHandling': 'Gestionare URL',
  'shared.ruleTemplates.folder.tracking': 'Urmărire',
  'shared.ruleTemplates.folder.debugging': 'Depanare',
  'shared.ruleTemplates.folder.appearance': 'Aspect',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'Coduri de stare',
  'shared.ruleTemplates.folder.dynamic': 'Dinamic',

  'shared.ruleTemplates.corsBypass.name': 'Ocolire CORS',
  'shared.ruleTemplates.corsBypass.description':
    'Elimină antetele CORS restrictive pentru a permite cereri cross-origin în timpul dezvoltării',
  'shared.ruleTemplates.removeCsp.name': 'Eliminare CSP',
  'shared.ruleTemplates.removeCsp.description': 'Elimină antetele Content-Security-Policy pentru dezvoltare',
  'shared.ruleTemplates.allowEmbedding.name': 'Permitere încorporare',
  'shared.ruleTemplates.allowEmbedding.description': 'Elimină X-Frame-Options pentru a permite încorporarea în iframe',
  'shared.ruleTemplates.apiAuth.name': 'Injectare autentificare API',
  'shared.ruleTemplates.apiAuth.description': 'Injectează automat antetul Authorization în apelurile API',
  'shared.ruleTemplates.customUa.name': 'User-Agent personalizat',
  'shared.ruleTemplates.customUa.description': 'Suprascrie antetul User-Agent pentru anumite domenii',
  'shared.ruleTemplates.blockCookies.name': 'Blocare cookie-uri',
  'shared.ruleTemplates.blockCookies.description': 'Elimină antetul Cookie din cererile trimise',
  'shared.ruleTemplates.testMerge.name': 'Test îmbinare (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    'Testați operația Îmbinare adăugând la sfârșitul unui antet de răspuns.\n1. Activați această regulă\n2. Deschideți ' +
    'httpbin.org într-o filă nouă\n3. Rulați în consolă: fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",' +
    'r.headers.get("Content-Type"))})\n4. Content-Type ar trebui să afișeze "application/json, x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': 'Blocare trackere',
  'shared.ruleTemplates.blockTrackers.description': 'Blochează scripturile de analiză și urmărire',
  'shared.ruleTemplates.blockAds.name': 'Blocare reclame',
  'shared.ruleTemplates.blockAds.description': 'Blochează domeniile obișnuite ale rețelelor de publicitate',
  'shared.ruleTemplates.redirectDomain.name': 'Redirecționare domeniu',
  'shared.ruleTemplates.redirectDomain.description': 'Redirecționează tot traficul de la un domeniu la altul',
  'shared.ruleTemplates.forceHttps.name': 'Forțare HTTPS',
  'shared.ruleTemplates.forceHttps.description':
    'Trece de la HTTP la HTTPS — folosește un grup de captură regex pentru a păstra calea completă',
  'shared.ruleTemplates.removeUtm.name': 'Eliminare parametri UTM',
  'shared.ruleTemplates.removeUtm.description': 'Elimină parametrii de urmărire UTM din adresele URL',
  'shared.ruleTemplates.addDebug.name': 'Adăugare indicator de depanare',
  'shared.ruleTemplates.addDebug.description': 'Adaugă un parametru de interogare debug=true la apelurile API',
  'shared.ruleTemplates.darkMode.name': 'CSS pentru modul întunecat',
  'shared.ruleTemplates.darkMode.description': 'Injectează o foaie de stil de bază pentru modul întunecat',
  'shared.ruleTemplates.consoleLogger.name': 'Jurnal în consolă',
  'shared.ruleTemplates.consoleLogger.description': 'Înregistrează toate cererile fetch în consolă',
  'shared.ruleTemplates.slowApi.name': 'API lent (2s)',
  'shared.ruleTemplates.slowApi.description':
    'Adaugă o întârziere de 2 secunde apelurilor API — testați stările de încărcare',
  'shared.ruleTemplates.timeoutTest.name': 'Test de expirare (5s)',
  'shared.ruleTemplates.timeoutTest.description': 'Adaugă o întârziere de 5 secunde — testați gestionarea expirării',
  'shared.ruleTemplates.restBodyOverride.name': 'Suprascriere corp REST',
  'shared.ruleTemplates.restBodyOverride.description': 'Înlocuiește corpul cererii cu un payload JSON static',
  'shared.ruleTemplates.graphqlOverride.name': 'Suprascriere GraphQL',
  'shared.ruleTemplates.graphqlOverride.description':
    'Suprascrie corpul unei cereri GraphQL cu o interogare și variabile personalizate',
  'shared.ruleTemplates.mock200.name': 'Simulare 200 JSON',
  'shared.ruleTemplates.mock200.description': 'Returnează un răspuns JSON reușit pentru un endpoint API REST',
  'shared.ruleTemplates.mock404.name': 'Simulare 404',
  'shared.ruleTemplates.mock404.description': 'Returnează un răspuns 404 Not Found',
  'shared.ruleTemplates.mock500.name': 'Simulare eroare de server',
  'shared.ruleTemplates.mock500.description':
    'Returnează un răspuns 500 Internal Server Error — testați gestionarea erorilor',
  'shared.ruleTemplates.mockGraphql.name': 'Simulare răspuns GraphQL',
  'shared.ruleTemplates.mockGraphql.description':
    'Returnează un răspuns personalizat pentru o anumită operație GraphQL',
  'shared.ruleTemplates.mockDynamic.name': 'Răspuns REST dinamic',
  'shared.ruleTemplates.mockDynamic.description':
    'Interceptează răspunsul real al API-ului REST și îl modifică cu JavaScript — injectați date de test, eliminați ' +
    'câmpuri sau transformați forma răspunsului',
  'shared.ruleTemplates.mockDynamicGraphql.name': 'Răspuns GraphQL dinamic',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    'Interceptează răspunsul unei anumite operații GraphQL și îl modifică cu JavaScript — remodelați datele, injectați ' +
    'câmpuri simulate sau simulați erori',

  // ── Dock-layout chrome (shared shell: workbench + devtools panel).
  //    Slot labels feed the Move-to submenu, drop-zone overlays, and
  //    the restore rows on both surfaces. ────────────────────────────
  'shared.dock.slot.leftTop': 'Stânga sus',
  'shared.dock.slot.leftBottom': 'Stânga jos',
  'shared.dock.slot.rightTop': 'Dreapta sus',
  'shared.dock.slot.rightBottom': 'Dreapta jos',
  'shared.dock.slot.bottomLeft': 'Jos stânga',
  'shared.dock.slot.bottomRight': 'Jos dreapta',
  // Stacked (rows) bottom-split names for the same two slots.
  'shared.dock.slot.bottomTop': 'Jos, partea superioară',
  'shared.dock.slot.bottomBottom': 'Jos, partea inferioară',
  'shared.dock.hide': 'Ascundere',
  'shared.dock.moveTo': 'Mutare în',
  'shared.dock.currentSlot': 'poziția curentă',
  'shared.dock.showToolWindowNames': 'Afișare nume ferestre de instrumente',
  'shared.dock.hideThisDock': 'Ascundere doc',
  'shared.dock.closeDock': 'Închidere doc',
  'shared.dock.panelOptions': 'Opțiuni panou',
  'shared.dock.hidePanel': 'Ascundere panou',

  // ── Docs panel chrome (shared reader: workbench + devtools panel).
  //    Registry titles/summaries resolve per-surface via the
  //    raw-or-key DocSection idiom; these are the reader's own
  //    labels. Key caps / chords (↑↓ ↵ esc ← →) stay raw. ─────────────
  'shared.docs.title': 'Documentație',
  'shared.docs.contents': 'Cuprins',
  'shared.docs.ariaOpenToc': 'Deschidere cuprins',
  'shared.docs.ariaCloseToc': 'Închidere cuprins',
  'shared.docs.filterPlaceholder': 'Filtrare secțiuni',
  'shared.docs.noMatches': 'Nicio potrivire',
  'shared.docs.hint.navigate': 'navigare',
  'shared.docs.hint.open': 'deschidere',
  'shared.docs.hint.back': 'înapoi',
  'shared.docs.hint.contents': 'cuprins',
  'shared.docs.previous': 'Anterior',
  'shared.docs.next': 'Următor',
  'shared.docs.previousTooltip': 'Anterior: {title}',
  'shared.docs.nextTooltip': 'Următor: {title}',

  // ── Docs section primitives (shared: workbench + devtools panel).
  //    Callout kind labels, the Example block's structural labels, the
  //    surface-context banner, and the in-section TOC header. The DNR
  //    engine tag, BrowserTag versions, and every SVG-internal label
  //    (incl. the surface-glyph <title>s) stay raw. ────────────────────
  'shared.docs.callout.note': 'Notă',
  'shared.docs.callout.warning': 'Avertisment',
  'shared.docs.callout.tip': 'Sfat',
  'shared.docs.callout.limitation': 'Limitare',
  'shared.docs.example.rule': 'Regulă:',
  'shared.docs.example.before': 'Înainte:',
  'shared.docs.example.after': 'După:',
  'shared.docs.example.appliesTo': 'Se aplică la:',
  'shared.docs.example.wontApply': 'Nu se aplică la:',
  'shared.docs.example.suggestion': 'Sugestie:',
  'shared.docs.onThisPage': 'Pe această pagină',
  'shared.docs.copyCode': 'Copiere cod',
  'shared.docs.surfaces.header': 'Unde veți vedea acest lucru',
  'shared.docs.surfaces.popup': 'Popup',
  'shared.docs.surfaces.sidePanel': 'Panou lateral',
  'shared.docs.surfaces.workbench': 'Workbench',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'Bazat pe script',

  // ── Split-layout orientation (shared/split-layout) — overflow-menu
  //    entries for the two-pane split direction. ─────────────────────
  'shared.splitLayout.horizontal': 'Aspect orizontal — unul lângă altul',
  'shared.splitLayout.vertical': 'Aspect vertical — unul sub altul',

  // ── Desktop teaser (shared/desktop-teaser) — placeholder body for
  //    capability-gated features on browser hosts: per-feature
  //    explainer + the download CTA. ──────────────────────────────────
  // Grouped-timeline row window — the per-group escape hatch when the
  // rows-per-group limit hides a group's older messages (gRPC + WS
  // message timelines share these).
  'shared.timelineGroup.showOlder': 'Afișare încă {count} mai vechi',
  // Compose-editor toolbar wrap toggle — shared by every request
  // editor's Monaco compose surface.
  'shared.codeEditor.wrap': 'Încadrare',
  'shared.codeEditor.find': 'Căutare',
  'shared.codeEditor.replace': 'Înlocuire',
  'shared.codeEditor.format': 'Formatare',
  // The Format action's refusal alert title — the parse error's
  // own text rides the description verbatim.
  'shared.codeEditor.formatError': 'Nu se poate formata — eroare de parsare',
  // The compose toolbars' "Editor" dropdown — live display knobs,
  // grouped by scope (the pane-local Wrap vs the global editor.*
  // settings the Settings page also edits).
  'shared.editorMenu.label': 'Editor',
  'shared.editorMenu.thisEditor': 'Acest editor',
  'shared.editorMenu.allEditors': 'Toate editoarele',
  'shared.editorMenu.lineNumbers': 'Numere de linie',
  'shared.editorMenu.whitespace': 'Spații albe',
  'shared.editorMenu.lineEnds': 'Terminații de linie',
  'shared.timelineGroup.showNewestOnly': 'Afișare doar a celor mai noi {count}',
  // Peer-execute refusal notice — the host-aware reading of the wire's
  // two-tier opt-in refusal (the quoted phrases are the settings rows'
  // own labels, verbatim).
  'shared.peerExecute.localDisabled':
    'Trimiterea din browserele acestui dispozitiv este dezactivată în aplicația desktop. Activați „Permiteți browserelor acestui dispozitiv să trimită cereri” în Copie de rezervă și sincronizare › Dispozitivele dvs.',
  'shared.peerExecute.remoteDisabled':
    'Trimiterea de pe alte dispozitive este dezactivată pe gazda conectată. Activați „Permiteți altor dispozitive conectate să trimită cereri” în Copie de rezervă și sincronizare › Dispozitivele dvs. de pe acel computer.',
  'shared.peerExecute.enableCta': 'Activare în aplicația desktop',
  // ── Execution place (the chip beside Send / Connect / Invoke) ───────
  'shared.executionPlace.info': 'Unde rulează această solicitare',
  'shared.executionPlace.chip.here': 'Rulează aici',
  'shared.executionPlace.chip.desktopApp': 'Rulează în aplicația desktop',
  'shared.executionPlace.chip.server': 'Rulează pe {place}',
  'shared.executionPlace.chip.needsDesktopApp': 'Necesită aplicația desktop',
  'shared.executionPlace.chip.notForwarded': 'Indisponibil încă pe {place}',
  'shared.executionPlace.chip.unavailable': 'Indisponibil aici',
  'shared.executionPlace.chip.cannotRunOn': 'Indisponibil încă: {place}',
  'shared.executionPlace.role.here': 'acest dispozitiv',
  'shared.executionPlace.role.desktopApp': 'aplicația desktop',
  'shared.executionPlace.role.server': 'server',
  'shared.executionPlace.reason.runsHere': 'Rulează în această aplicație, pe acest computer.',
  'shared.executionPlace.reason.runsHereBrowser': 'Rulează în extensie, pe acest computer.',
  'shared.executionPlace.reason.runsHerePageRealm': 'Rulează în extensie prin socketul browserului, pe acest computer.',
  'shared.executionPlace.reason.contextSend':
    'Trimisă de backend-ul conectat {place} și rezolvată acolo. Destinația vede adresa și locația de rețea a acelei mașini.',
  'shared.executionPlace.reason.companionInvoke':
    'Apelurile gRPC sunt redirecționate către aplicația desktop de pe acest computer — browserul nu are o stivă HTTP/2 care să expună trailerele.',
  'shared.executionPlace.reason.companionRequired':
    'Conectați aplicația desktop pentru a invoca — compunerea și salvarea funcționează aici.',
  'shared.executionPlace.reason.tcpScheme':
    'Adresele mqtt:// și mqtts:// deschid un socket TCP brut, pe care browserul nu îl poate deschide. Deschideți această solicitare în aplicația desktop sau treceți la ws:// ori wss:// pentru a vă conecta aici.',
  'shared.executionPlace.reason.sessionNotForwarded': 'Sesiunile nu sunt încă redirecționate către {place}.',
  'shared.executionPlace.reason.noRuntime': 'Acest tip de solicitare rulează în aplicația desktop sau pe un server.',
  'shared.executionPlace.reason.delegatedDesktopApp':
    'Rezolvată aici; aplicația desktop deschide conexiunea în numele acestei cereri.',
  'shared.executionPlace.reason.delegatedServer':
    'Rezolvată aici; {place} deschide conexiunea în numele acestei cereri. Valorile rezolvate, inclusiv secretele, ajung acolo.',
  'shared.executionPlace.picker.title': 'Rulează pe',
  'shared.executionPlace.option.here': 'Acest dispozitiv',
  'shared.executionPlace.option.desktopApp': 'Aplicația desktop',
  'shared.executionPlace.option.server': 'Serverul',
  'shared.executionPlace.knob.cookieJar': 'depozitul Cookie',
  'shared.executionPlace.knobsNotApplied': 'Nu se aplică pe {place}: {knobs}.',
  'shared.executionPlace.reason.preferenceUnavailable':
    'Locul de rulare setat pentru această solicitare este {place}, indisponibil de aici deocamdată.',
  'shared.desktopTeaser.cta': 'Descărcare aplicație desktop',
  'shared.desktopTeaser.openApp': 'Deschidere în aplicația desktop',
  'shared.desktopTeaser.launchApp': 'Deschidere aplicație desktop',
  'shared.desktopTeaser.otherPlatforms': 'Alte platforme și canale',
  'shared.desktopTeaser.terminal.title': 'Terminal integrat',
  'shared.desktopTeaser.terminal.body':
    'Deschideți un terminal real în spațiul dvs. de lucru — propriul shell, rulând local chiar lângă regulile și cererile dvs.',
  'shared.desktopTeaser.git.title': 'Istoric Git',
  'shared.desktopTeaser.git.body':
    'Parcurgeți cronologia commit-urilor spațiului dvs. de lucru, cu detalii per commit și diferențe pe fișiere.',
  'shared.desktopTeaser.commit.title': 'Commit',
  'shared.desktopTeaser.commit.body':
    'Revizuiți și comiteți modificările spațiului dvs. de lucru — un arbore de fișiere bifabil, cu diferențe pe fișier și o casetă pentru mesajul de commit.',
  'shared.desktopTeaser.proxy.title': 'Proxy de captură',
  'shared.desktopTeaser.proxy.body':
    'Capturați traficul HTTP(S) în timp real cu proxy-ul încorporat și inspectați fiecare cerere pe măsură ce are loc.',
  'shared.desktopTeaser.mcp.title': 'AI · Server MCP',
  'shared.desktopTeaser.mcp.body': 'Conectați asistenți AI la spațiile dvs. de lucru prin serverul MCP încorporat.',
  'shared.desktopTeaser.liveNetwork.title': 'Rețea Live',
  'shared.desktopTeaser.liveNetwork.body':
    'Urmăriți în timp real traficul unei file de browser în aplicația desktop, transmis din extensie — fără DevTools.',

  // ── Settings rows ──────────────────────────────────────────────────
  'shared.settingsRows.enabled': 'Activat',
  'shared.settingsRows.disabled': 'Dezactivat',
  'shared.settingsRows.reset': 'Resetare {label} la valoarea implicită',
} as const satisfies Catalog;
