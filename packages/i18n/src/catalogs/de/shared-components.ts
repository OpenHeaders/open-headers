/**
 * Shared component families — German. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for the
 * family rules and the raw-by-design technical plane. Mints: stale =
 * veraltet; override (Live) = Überschreibung; mock verbs = simulieren;
 * dock rides raw (n.); JWT Header/Payload/Claims/Signature ride raw
 * (RFC 7519 structure vocabulary, fr/es precedent); tool window =
 * Werkzeugfenster (n.); Workbench surface label = Arbeitsbereich-Editor
 * (awareness mint).
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': 'Wert bearbeiten',
  'shared.templateInput.showValue': 'Wert anzeigen',
  'shared.templateInput.hideValue': 'Wert ausblenden',
  'shared.templateInput.clearValue': 'Wert löschen',
  'shared.templateInput.unresolvedDot': 'Enthält eine unaufgelöste Variable',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': 'Variable „{name}“ erstellen',
  'shared.templateInput.createNamedInScope': 'Variable „{name}“ in {scope} erstellen',
  'shared.templateInput.noMatches': 'Keine Treffer',
  'shared.templateInput.footerNavigate': '↑↓ navigieren',
  'shared.templateInput.footerSelect': '↵ auswählen',
  'shared.templateInput.footerClose': 'esc schließen',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': 'Zur Laufzeit erfasst',
  'shared.templateInput.totpPreview': 'TOTP {digits}-stellig · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP {digits}-stellig · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(leer)',
  'shared.templateInput.staleBadge': 'veraltet',
  'shared.templateInput.needsRerunBadge': 'Neuausführung nötig',
  'shared.templateInput.disabledBadge': 'deaktiviert',
  // Namespace-scaffold / reserved rows: core mints the English subtitle
  // for its own (locale-free) plane; the UI resolves these keys from the
  // row's kind + scope instead of rendering core's copy.
  'shared.templateInput.scaffold.vault': 'Secret hinzufügen',
  'shared.templateInput.scaffold.env': 'Umgebungsvariable hinzufügen',
  'shared.templateInput.scaffold.collection': 'Sammlungsvariable hinzufügen',
  'shared.templateInput.scaffold.workspace': 'Arbeitsbereich-Variable hinzufügen',
  'shared.templateInput.scaffold.dynamic': 'Integrierte Generatoren — uuid, timestamp, …',
  'shared.templateInput.reservedFile': 'Dateireferenzen kommen bald',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': 'Wert eingeben',
  'shared.templateInput.foundIn': 'Gefunden in:',
  'shared.templateInput.scopeFixedTooltip':
    'Der Geltungsbereich ist durch das Präfix {prefix} festgelegt — ändere die Referenz, um ihn zu wechseln.',
  'shared.templateInput.addToScope': 'Hinzufügen zu: {scope}',
  'shared.templateInput.addToPickScope': 'Hinzufügen zu: Geltungsbereich wählen',
  'shared.templateInput.resolvedDefault': 'Aufgelöst: Standard',
  'shared.templateInput.resolvedDefaultNoEnv': 'Aufgelöst: Standard (keine aktive Umgebung)',
  'shared.templateInput.noActiveEnvHint':
    'Keine Umgebung ausgewählt — wähle eine im Umgebungsumschalter, um eine Umgebungsvariable hinzuzufügen.',
  'shared.templateInput.noCollectionHint':
    'Keine aktive Sammlung — öffne eine Sammlung, um eine Sammlungsvariable hinzuzufügen.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': 'Umgebung · {name}',
  'shared.templateInput.scope.collectionNamed': 'Sammlung · {name}',
  'shared.templateInput.scope.workspace': 'Arbeitsbereich',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · Überschreibung',
  'shared.templateInput.scope.stepNamed': 'Schritt · {capture}',
  'shared.templateInput.scope.fileNamed': 'Datei · {name}',
  'shared.templateInput.scope.dynamic': 'Dynamisch',
  'shared.templateInput.scope.unresolved': 'Unaufgelöst',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': 'Umgebung',
  'shared.templateInput.createScope.collection': 'Sammlung',
  'shared.templateInput.createScope.workspace': 'Arbeitsbereich',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'keine aktive Umgebung',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': 'Leere Referenz',
  'shared.templateInput.unresolved.unknownNamespace': 'Unbekannter Namespace',
  'shared.templateInput.unresolved.dynamic':
    'Kein integrierter Generator mit diesem Namen. Wähle einen aus der {{dynamic.…}}-Vorschlagsliste.',
  'shared.templateInput.unresolved.step': 'Löst sich nur auf, während eine Live-Workflow-Kette läuft.',
  'shared.templateInput.unresolved.envNotSet': 'In Umgebung „{name}“ nicht gesetzt.',
  'shared.templateInput.unresolved.noActiveEnv': 'Keine aktive Umgebung ausgewählt.',
  'shared.templateInput.unresolved.live':
    'Keine Live-Variable mit diesem Namen (oder noch kein zwischengespeicherter Wert).',
  'shared.templateInput.unresolved.notDefined': 'In keinem Geltungsbereich definiert.',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': 'Wähle einen Geltungsbereich unter „Hinzufügen zu“',
  'shared.templateInput.save.totpInVaultEditor': 'TOTP-Secrets müssen im Vault-Editor bearbeitet werden',
  'shared.templateInput.save.vaultKindChanged': 'Die Art des Vault-Eintrags hat sich zwischenzeitlich geändert',
  'shared.templateInput.save.notEditable': 'Nicht bearbeitbar',
  'shared.templateInput.save.noActiveEnv': 'Keine aktive Umgebung',
  'shared.templateInput.save.noCollection': 'Keine Sammlung im Kontext',
  'shared.templateInput.save.saved': 'Gespeichert',
  'shared.templateInput.save.duplicateName':
    'Eine Variable mit diesem Namen existiert in diesem Geltungsbereich bereits.',
  'shared.templateInput.save.notFound': 'Variable nicht gefunden — sie wurde möglicherweise gelöscht.',
  'shared.templateInput.save.failed': 'Speichern fehlgeschlagen',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': 'Als Variable setzen',
  'shared.templateInput.setAsNewVariable': 'Als neue Variable setzen',
  'shared.templateInput.variableName': 'Variablenname',
  'shared.templateInput.variableValue': 'Variablenwert',
  'shared.templateInput.valuePlaceholder': 'Wert',
  'shared.templateInput.menu.cut': 'Ausschneiden',
  'shared.templateInput.menu.paste': 'Einfügen',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Vault-Secret',
  'shared.templateInput.completion.scope.env': 'Umgebung',
  'shared.templateInput.completion.scope.collection': 'Sammlung',
  'shared.templateInput.completion.scope.workspace': 'Arbeitsbereich',
  'shared.templateInput.completion.scope.live': 'Quelle',
  'shared.templateInput.completion.scope.step': 'Capture eines Quell-Flow-Schritts',
  'shared.templateInput.completion.scope.file': 'Dateireferenz',
  'shared.templateInput.completion.scope.dynamic': 'Dynamischer Generator',
  'shared.templateInput.completion.staleSuffix': '(veraltet)',
  'shared.templateInput.completion.comingSoon': 'kommt bald',
  'shared.templateInput.completion.capturedAtRuntime': 'zur Laufzeit erfasst',
  'shared.templateInput.completion.totpDetail': 'TOTP-Code ({digits} Stellen, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': 'Wert verborgen (sensibler Geltungsbereich).',
  'shared.templateInput.completion.valueHiddenStale': 'Wert verborgen (veraltete Live-Variable).',
  'shared.templateInput.completion.valueDoc': '**Wert:** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**Veralteter Wert:** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': 'Wird erfasst, wenn der Workflow läuft.',
  'shared.templateInput.completion.totpDoc':
    '**TOTP-Code** — {algorithm}, {digits} Stellen, erneuert sich alle {period}s.',
  'shared.templateInput.completion.totpDocIssuer':
    '**TOTP-Code** für **{issuer}** — {algorithm}, {digits} Stellen, erneuert sich alle {period}s.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'Dekodiert',
  'shared.valueEditors.encodedPreview': 'Kodierte Vorschau',
  'shared.valueEditors.cannotEncode': 'Kodieren nicht möglich — der bearbeitete Wert ist für diesen Typ ungültig',
  'shared.valueEditors.encodedCopied': 'Kodierter Wert in die Zwischenablage kopiert',
  'shared.valueEditors.copyFailed': 'Kopieren in die Zwischenablage fehlgeschlagen',
  'shared.valueEditors.openAsDocument': 'Als Dokument öffnen',
  'shared.valueEditors.decode': 'Dekodieren',
  'shared.valueEditors.decodeChipView': 'Dekodiert ansehen — {title}',
  'shared.valueEditors.decodeChipEdit': 'Dekodieren und bearbeiten — {title}',
  'shared.valueEditors.editJwt': 'JWT bearbeiten',
  'shared.valueEditors.viewJwt': 'JWT ansehen',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'Dekodierter Wert',
  'shared.valueEditors.glance.openTab': 'In neuem Tab öffnen',
  'shared.valueEditors.glance.openModal': 'Als Modal öffnen',
  'shared.valueEditors.glance.moreClaims': '+{count} weitere',
  'shared.valueEditors.glance.signatureElided':
    'Signature wird nicht angezeigt — öffne Dokument oder Modal für den vollständigen Token.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': 'Name',
  'shared.valueEditors.grid.key': 'Schlüssel',
  'shared.valueEditors.grid.value': 'Wert',
  'shared.valueEditors.grid.flag': 'Flag',
  'shared.valueEditors.grid.ariaNamePairs': 'Name/Wert-Paare',
  'shared.valueEditors.grid.ariaKeyPairs': 'Schlüssel/Wert-Paare',
  'shared.valueEditors.grid.ariaRowName': 'Name von Zeile {row}',
  'shared.valueEditors.grid.ariaRowKey': 'Schlüssel von Zeile {row}',
  'shared.valueEditors.grid.ariaRowValue': 'Wert von Zeile {row}',
  'shared.valueEditors.grid.moveRowUp': 'Zeile {row} nach oben verschieben',
  'shared.valueEditors.grid.moveRowDown': 'Zeile {row} nach unten verschieben',
  'shared.valueEditors.grid.deleteRow': 'Zeile {row} löschen',
  'shared.valueEditors.grid.addRow': 'Zeile hinzufügen',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'JWT-Editor',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': 'Geändert',
  'shared.valueEditors.jwt.decodeErrorTitle': 'Token konnte nicht dekodiert werden',
  'shared.valueEditors.jwt.decoded': 'Dekodiert',
  'shared.valueEditors.jwt.encoded': 'Kodiert',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Claims:',
  'shared.valueEditors.jwt.rawToken': 'Roher Token',
  'shared.valueEditors.jwt.pasteOrEdit': 'Rohen Token einfügen oder bearbeiten',
  'shared.valueEditors.jwt.notDecodable': 'Kein dekodierbarer JWT',
  'shared.valueEditors.jwt.structure': 'Struktur:',
  'shared.valueEditors.jwt.resignWithSecret': 'Mit Secret neu signieren',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} aus dem Header',
  'shared.valueEditors.jwt.signingSecret': 'Signatur-Secret',
  'shared.valueEditors.jwt.secretMemoryNote': 'Bleibt nur im Speicher und wird beim Schließen des Editors verworfen.',
  'shared.valueEditors.jwt.tokenExpired': 'Token abgelaufen',
  'shared.valueEditors.jwt.tokenNotExpired': 'Token nicht abgelaufen',
  'shared.valueEditors.jwt.expiredOn': 'Abgelaufen am {date}',
  'shared.valueEditors.jwt.expiresOn': 'Läuft ab am {date}',
  'shared.valueEditors.jwt.resigned': 'Token mit {algorithm} neu signiert',
  'shared.valueEditors.jwt.resignedDescription':
    'Speichern schreibt den mit deinem Secret signierten Token — die Vorschau oben ist genau das, was ' +
    'gespeichert wird.',
  'shared.valueEditors.jwt.cannotResign': 'Dieser Algorithmus kann nicht neu signiert werden',
  'shared.valueEditors.jwt.cannotResignDescription':
    'Nur HMAC-Algorithmen (HS256, HS384, HS512) können hier neu signiert werden. Die ursprüngliche Signature ' +
    'wird stattdessen übernommen.',
  'shared.valueEditors.jwt.signError': 'Token konnte nicht signiert werden',
  'shared.valueEditors.jwt.signatureInvalid': 'Signature nicht mehr gültig',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    'Die ursprüngliche Signature bleibt unverändert, daher lehnen Server, die sie prüfen, den bearbeiteten ' +
    'Token ab. Gib ein Signatur-Secret ein, um ihn neu zu signieren.',
  'shared.valueEditors.jwt.copied': 'JWT in die Zwischenablage kopiert',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'JWT-Payload',
  'shared.valueEditors.valueTitle.urlEncoded': 'URL-kodierter Wert',
  'shared.valueEditors.valueTitle.base64': 'Base64-Wert',
  'shared.valueEditors.valueTitle.hex': 'Hex-kodierter Wert',
  'shared.valueEditors.valueTitle.timestamp': 'Unix-Timestamp',
  'shared.valueEditors.valueTitle.json': 'JSON-Wert',
  'shared.valueEditors.valueTitle.jsonString': 'String in Anführungszeichen',
  'shared.valueEditors.valueTitle.dataUri': 'Data-URI',
  'shared.valueEditors.valueTitle.cookie': 'Cookie-Wert',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'HTTP-Datum',
  'shared.valueEditors.valueTitle.queryString': 'Query-String',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Link-Header',
  'shared.valueEditors.valueTitle.authParams': 'Autorisierungsparameter',
  'shared.valueEditors.valueTitle.acceptList': 'Accept-Liste',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Vault-Secret',
  'shared.scopeColors.environment': 'Umgebungsvariable',
  'shared.scopeColors.collection': 'Sammlungsvariable',
  'shared.scopeColors.workspace': 'Arbeitsbereich-Variable',
  'shared.scopeColors.live': 'Live-Variable (Workflow-gestützt)',
  'shared.scopeColors.step': 'Workflow-Schritt-Capture',
  'shared.scopeColors.file': 'Dateireferenz',
  'shared.scopeColors.dynamic': 'Dynamischer Generator',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'Als JWT bearbeiten',
  'shared.valueEditors.editTooltip.urlEncoded': 'URL-kodierten Wert bearbeiten',
  'shared.valueEditors.editTooltip.base64': 'Base64-Wert bearbeiten',
  'shared.valueEditors.editTooltip.hex': 'Hex-kodierten Wert bearbeiten',
  'shared.valueEditors.editTooltip.timestamp': 'Timestamp bearbeiten',
  'shared.valueEditors.editTooltip.json': 'Als JSON bearbeiten',
  'shared.valueEditors.editTooltip.jsonString': 'String in Anführungszeichen bearbeiten',
  'shared.valueEditors.editTooltip.dataUri': 'Data-URI-Inhalt bearbeiten',
  'shared.valueEditors.editTooltip.cookie': 'Cookie-Paare bearbeiten',
  'shared.valueEditors.editTooltip.csp': 'CSP-Direktiven bearbeiten',
  'shared.valueEditors.editTooltip.httpDate': 'HTTP-Datum bearbeiten',
  'shared.valueEditors.editTooltip.queryString': 'Query-Paare bearbeiten',
  'shared.valueEditors.editTooltip.cacheControl': 'Cache-Direktiven bearbeiten',
  'shared.valueEditors.editTooltip.hsts': 'HSTS-Direktiven bearbeiten',
  'shared.valueEditors.editTooltip.contentDisposition': 'Disposition-Parameter bearbeiten',
  'shared.valueEditors.editTooltip.link': 'Links bearbeiten',
  'shared.valueEditors.editTooltip.authParams': 'Auth-Parameter bearbeiten',
  'shared.valueEditors.editTooltip.acceptList': 'Accept-Liste bearbeiten',

  // ── Default entity names (multi-surface: sidebar create actions +
  //    save-modal prefilled collection create). 'User Templates' is NOT
  //    here — it identity-compares against the background seed and
  //    stays raw everywhere. ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': 'Neue Regelsammlung',
  'shared.defaults.newRequestsCollection': 'Neue Anfragensammlung',
  'shared.defaults.newEnvironment': 'Neue Umgebung',
  'shared.defaults.newSpec': 'Neue Spezifikation',

  // ── Rule-type registry (multi-surface: workbench create menus +
  //    overviews + command palette + tool-window info, popup
  //    AddRulePalette). Labels and descriptions single-source every
  //    create/picker menu; type ids and code badges (HDR…) stay raw. ──
  'shared.ruleTypes.header.label': 'Header ändern',
  'shared.ruleTypes.header.description': 'HTTP-Header hinzufügen, überschreiben oder entfernen',
  'shared.ruleTypes.requestBody.label': 'API-Anfrage-Body ändern',
  'shared.ruleTypes.requestBody.description': 'API-Anfrage-Body überschreiben oder transformieren (nur fetch/XHR)',
  'shared.ruleTypes.response.label': 'API-Antwort ändern',
  'shared.ruleTypes.response.description':
    'API-Antwortstatus, -Body und -Header simulieren oder ändern (nur fetch/XHR)',
  'shared.ruleTypes.queryParam.label': 'Query-Parameter ändern',
  'shared.ruleTypes.queryParam.description': 'URL-Parameter hinzufügen, überschreiben oder entfernen',
  'shared.ruleTypes.inject.label': 'Skript/Stylesheet injizieren',
  'shared.ruleTypes.inject.description': 'JavaScript oder CSS in Seiten injizieren',
  'shared.ruleTypes.ws.label': 'WebSocket-Nachrichten ändern',
  'shared.ruleTypes.ws.description': 'WebSocket-Frames ersetzen, injizieren oder verwerfen (nur Seiten-Sockets)',
  'shared.ruleTypes.sse.label': 'Server-Sent Events ändern',
  'shared.ruleTypes.sse.description': 'SSE-Events ersetzen, injizieren oder verwerfen (nur Seiten-Streams)',
  'shared.ruleTypes.block.label': 'Anfragen blockieren',
  'shared.ruleTypes.block.description': 'Verhindert, dass Anfragen abgeschlossen werden',
  'shared.ruleTypes.redirect.label': 'Anfragen umleiten',
  'shared.ruleTypes.redirect.description': 'Zu einer anderen URL umleiten',
  'shared.ruleTypes.delay.label': 'Anfragen verzögern',
  'shared.ruleTypes.delay.description': 'Netzwerk-Anfragen mit Latenz versehen (nur fetch/XHR)',
  'shared.ruleTypes.auth.label': 'Auth-Challenge beantworten',
  'shared.ruleTypes.auth.description':
    'Anmeldedaten für eine HTTP-/Proxy-Auth-Challenge bereitstellen (erfordert Debug-Modus)',

  // ── System rule-template registry (same surfaces as the rule types).
  //    Template keys, icons, conditions, and form values stay raw data;
  //    embedded code/URLs inside descriptions travel inside the value. ──
  'shared.ruleTemplates.blankRule': 'Leere Regel',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS & Sicherheit',
  'shared.ruleTemplates.folder.authentication': 'Authentifizierung',
  'shared.ruleTemplates.folder.privacy': 'Privatsphäre',
  'shared.ruleTemplates.folder.testing': 'Testen',
  'shared.ruleTemplates.folder.urlHandling': 'URL-Handling',
  'shared.ruleTemplates.folder.tracking': 'Tracking',
  'shared.ruleTemplates.folder.debugging': 'Debugging',
  'shared.ruleTemplates.folder.appearance': 'Erscheinungsbild',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'Statuscodes',
  'shared.ruleTemplates.folder.dynamic': 'Dynamisch',

  'shared.ruleTemplates.corsBypass.name': 'CORS umgehen',
  'shared.ruleTemplates.corsBypass.description':
    'Restriktive CORS-Header entfernen, um Cross-Origin-Anfragen während der Entwicklung zu erlauben',
  'shared.ruleTemplates.removeCsp.name': 'CSP entfernen',
  'shared.ruleTemplates.removeCsp.description': 'Content-Security-Policy-Header für die Entwicklung entfernen',
  'shared.ruleTemplates.allowEmbedding.name': 'Einbetten erlauben',
  'shared.ruleTemplates.allowEmbedding.description': 'X-Frame-Options entfernen, um iframes zu erlauben',
  'shared.ruleTemplates.apiAuth.name': 'API-Auth-Injektion',
  'shared.ruleTemplates.apiAuth.description': 'Authorization-Header automatisch in API-Aufrufe injizieren',
  'shared.ruleTemplates.customUa.name': 'Eigener User-Agent',
  'shared.ruleTemplates.customUa.description': 'Den User-Agent-Header für bestimmte Domains überschreiben',
  'shared.ruleTemplates.blockCookies.name': 'Cookies blockieren',
  'shared.ruleTemplates.blockCookies.description': 'Cookie-Header aus ausgehenden Anfragen entfernen',
  'shared.ruleTemplates.testMerge.name': 'Merge testen (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    'Teste die Merge-Operation durch Anfügen an einen Antwort-Header.\n1. Aktiviere diese Regel\n2. Öffne ' +
    'httpbin.org in einem neuen Tab\n3. Führe in der Konsole aus: fetch("https://httpbin.org/get").then(r=>{' +
    'console.log("Content-Type:",r.headers.get("Content-Type"))})\n4. Content-Type sollte ' +
    '"application/json, x-openheaders-merged" anzeigen',
  'shared.ruleTemplates.blockTrackers.name': 'Tracker blockieren',
  'shared.ruleTemplates.blockTrackers.description': 'Analyse- und Tracking-Skripte blockieren',
  'shared.ruleTemplates.blockAds.name': 'Werbung blockieren',
  'shared.ruleTemplates.blockAds.description': 'Gängige Werbenetzwerk-Domains blockieren',
  'shared.ruleTemplates.redirectDomain.name': 'Domain umleiten',
  'shared.ruleTemplates.redirectDomain.description': 'Den gesamten Traffic von einer Domain auf eine andere umleiten',
  'shared.ruleTemplates.forceHttps.name': 'HTTPS erzwingen',
  'shared.ruleTemplates.forceHttps.description':
    'HTTP auf HTTPS anheben — nutzt eine Regex-Capture-Gruppe, um den vollen Pfad zu erhalten',
  'shared.ruleTemplates.removeUtm.name': 'UTM-Parameter entfernen',
  'shared.ruleTemplates.removeUtm.description': 'UTM-Tracking-Parameter aus URLs entfernen',
  'shared.ruleTemplates.addDebug.name': 'Debug-Flag hinzufügen',
  'shared.ruleTemplates.addDebug.description': 'API-Aufrufen einen debug=true-Query-Parameter hinzufügen',
  'shared.ruleTemplates.darkMode.name': 'Dark-Mode-CSS',
  'shared.ruleTemplates.darkMode.description': 'Ein einfaches Dark-Mode-Stylesheet injizieren',
  'shared.ruleTemplates.consoleLogger.name': 'Konsolen-Logger',
  'shared.ruleTemplates.consoleLogger.description': 'Alle fetch-Anfragen in der Konsole protokollieren',
  'shared.ruleTemplates.slowApi.name': 'Langsame API (2s)',
  'shared.ruleTemplates.slowApi.description': 'API-Aufrufe um 2 Sekunden verzögern — Ladezustände testen',
  'shared.ruleTemplates.timeoutTest.name': 'Timeout-Test (5s)',
  'shared.ruleTemplates.timeoutTest.description': '5 Sekunden Verzögerung hinzufügen — Timeout-Behandlung testen',
  'shared.ruleTemplates.restBodyOverride.name': 'REST-Body-Override',
  'shared.ruleTemplates.restBodyOverride.description': 'Den Anfrage-Body durch einen statischen JSON-Payload ersetzen',
  'shared.ruleTemplates.graphqlOverride.name': 'GraphQL-Override',
  'shared.ruleTemplates.graphqlOverride.description':
    'Einen GraphQL-Anfrage-Body mit eigener Query und Variablen überschreiben',
  'shared.ruleTemplates.mock200.name': '200-JSON simulieren',
  'shared.ruleTemplates.mock200.description': 'Eine erfolgreiche JSON-Antwort für einen REST-API-Endpunkt zurückgeben',
  'shared.ruleTemplates.mock404.name': '404 simulieren',
  'shared.ruleTemplates.mock404.description': 'Eine 404-Not-Found-Antwort zurückgeben',
  'shared.ruleTemplates.mock500.name': 'Serverfehler simulieren',
  'shared.ruleTemplates.mock500.description': 'Einen 500 Internal Server Error zurückgeben — Fehlerbehandlung testen',
  'shared.ruleTemplates.mockGraphql.name': 'GraphQL-Antwort simulieren',
  'shared.ruleTemplates.mockGraphql.description':
    'Eine eigene Antwort für eine bestimmte GraphQL-Operation zurückgeben',
  'shared.ruleTemplates.mockDynamic.name': 'Dynamische REST-Antwort',
  'shared.ruleTemplates.mockDynamic.description':
    'Die echte REST-API-Antwort abfangen und mit JavaScript verändern — Testdaten injizieren, Felder entfernen ' +
    'oder die Antwortform transformieren',
  'shared.ruleTemplates.mockDynamicGraphql.name': 'Dynamische GraphQL-Antwort',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    'Die Antwort einer bestimmten GraphQL-Operation abfangen und mit JavaScript verändern — Daten umformen, ' +
    'Mock-Felder injizieren oder Fehler simulieren',

  // ── Dock-layout chrome (shared shell: workbench + devtools panel).
  //    Slot labels feed the Move-to submenu, drop-zone overlays, and
  //    the restore rows on both surfaces. ────────────────────────────
  'shared.dock.slot.leftTop': 'Links oben',
  'shared.dock.slot.leftBottom': 'Links unten',
  'shared.dock.slot.rightTop': 'Rechts oben',
  'shared.dock.slot.rightBottom': 'Rechts unten',
  'shared.dock.slot.bottomLeft': 'Unten links',
  'shared.dock.slot.bottomRight': 'Unten rechts',
  'shared.dock.hide': 'Ausblenden',
  'shared.dock.moveTo': 'Verschieben nach',
  'shared.dock.currentSlot': 'aktueller Platz',
  'shared.dock.showToolWindowNames': 'Namen der Werkzeugfenster anzeigen',
  'shared.dock.hideThisDock': 'Dieses Dock ausblenden',
  'shared.dock.closeDock': 'Dock schließen',
  'shared.dock.panelOptions': 'Panel-Optionen',
  'shared.dock.hidePanel': 'Panel ausblenden',

  // ── Docs panel chrome (shared reader: workbench + devtools panel).
  //    Registry titles/summaries resolve per-surface via the
  //    raw-or-key DocSection idiom; these are the reader's own
  //    labels. Key caps / chords (↑↓ ↵ esc ← →) stay raw. ─────────────
  'shared.docs.title': 'Docs',
  'shared.docs.contents': 'Inhalt',
  'shared.docs.ariaOpenToc': 'Inhaltsverzeichnis öffnen',
  'shared.docs.ariaCloseToc': 'Inhaltsverzeichnis schließen',
  'shared.docs.filterPlaceholder': 'Abschnitte filtern',
  'shared.docs.noMatches': 'Keine Treffer',
  'shared.docs.hint.navigate': 'navigieren',
  'shared.docs.hint.open': 'öffnen',
  'shared.docs.hint.back': 'zurück',
  'shared.docs.hint.contents': 'Inhalt',
  'shared.docs.previous': 'Zurück',
  'shared.docs.next': 'Weiter',
  'shared.docs.previousTooltip': 'Zurück: {title}',
  'shared.docs.nextTooltip': 'Weiter: {title}',

  // ── Docs section primitives (shared: workbench + devtools panel).
  //    Callout kind labels, the Example block's structural labels, the
  //    surface-context banner, and the in-section TOC header. The DNR
  //    engine tag, BrowserTag versions, and every SVG-internal label
  //    (incl. the surface-glyph <title>s) stay raw. ────────────────────
  'shared.docs.callout.note': 'Hinweis',
  'shared.docs.callout.warning': 'Warnung',
  'shared.docs.callout.tip': 'Tipp',
  'shared.docs.callout.limitation': 'Einschränkung',
  'shared.docs.example.rule': 'Regel:',
  'shared.docs.example.before': 'Vorher:',
  'shared.docs.example.after': 'Nachher:',
  'shared.docs.example.appliesTo': 'Gilt für:',
  'shared.docs.example.wontApply': 'Gilt nicht für:',
  'shared.docs.example.suggestion': 'Vorschlag:',
  'shared.docs.onThisPage': 'Auf dieser Seite',
  'shared.docs.copyCode': 'Code kopieren',
  'shared.docs.surfaces.header': 'Wo du das siehst',
  'shared.docs.surfaces.popup': 'Popup',
  'shared.docs.surfaces.sidePanel': 'Seitenpanel',
  'shared.docs.surfaces.workbench': 'Arbeitsbereich-Editor',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'Skriptbasiert',

  // ── Split-layout orientation (shared/split-layout) — overflow-menu
  //    entries for the two-pane split direction. ─────────────────────
  'shared.splitLayout.horizontal': 'Horizontales Layout — nebeneinander',
  'shared.splitLayout.vertical': 'Vertikales Layout — gestapelt',

  // Grouped-timeline row window — the per-group escape hatch when the
  // rows-per-group limit hides a group's older messages (gRPC + WS
  // message timelines share these).
  'shared.timelineGroup.showOlder': '{count} ältere anzeigen',
  'shared.timelineGroup.showNewestOnly': 'Nur die neuesten {count} anzeigen',
  // Compose-editor toolbar wrap toggle + the "Editor" dropdown.
  'shared.codeEditor.wrap': 'Zeilenumbruch',
  'shared.editorMenu.label': 'Editor',
  'shared.editorMenu.thisEditor': 'Dieser Editor',
  'shared.editorMenu.allEditors': 'Alle Editoren',
  'shared.editorMenu.lineNumbers': 'Zeilennummern',
  'shared.editorMenu.whitespace': 'Leerzeichen',
  'shared.editorMenu.lineEnds': 'Zeilenenden',
  // Peer-execute refusal notice (the quoted phrases are the settings
  // rows' own labels, verbatim).
  'shared.peerExecute.localDisabled':
    'Das Senden über die Browser dieses Geräts ist in der Desktop-App ausgeschaltet. Aktiviere „Browsern ' +
    'dieses Geräts das Senden von Anfragen erlauben“ unter Einstellungen → Backend.',
  'shared.peerExecute.remoteDisabled':
    'Das Senden von anderen Geräten ist auf dem verbundenen Host ausgeschaltet. Aktiviere „Anderen ' +
    'verbundenen Geräten das Senden von Anfragen erlauben“ in dessen Einstellungen → Backend auf jener ' +
    'Maschine.',
  'shared.peerExecute.enableCta': 'In der Desktop-App aktivieren',

  // ── Desktop teaser ─────────────────────────────────────────────────
  'shared.desktopTeaser.cta': 'Desktop-App herunterladen',
  'shared.desktopTeaser.openApp': 'In der Desktop-App öffnen',
  'shared.desktopTeaser.otherPlatforms': 'Weitere Plattformen und Kanäle',
  'shared.desktopTeaser.terminal.title': 'Integriertes Terminal',
  'shared.desktopTeaser.terminal.body':
    'Öffne ein echtes Terminal direkt im Arbeitsbereich — deine eigene Shell, lokal ausgeführt, gleich neben deinen Regeln und Anfragen.',
  'shared.desktopTeaser.git.title': 'Git-Verlauf',
  'shared.desktopTeaser.git.body':
    'Durchstöbere die Commit-Chronik deines Arbeitsbereichs — mit Details pro Commit und Datei-Diffs.',
  'shared.desktopTeaser.proxy.title': 'Capture-Proxy',
  'shared.desktopTeaser.proxy.body':
    'Erfasse laufenden HTTP(S)-Verkehr mit dem integrierten Proxy und untersuche jede Anfrage in dem Moment, in dem sie passiert.',
  'shared.desktopTeaser.mcp.title': 'KI · MCP-Server',
  'shared.desktopTeaser.mcp.body':
    'Verbinde KI-Assistenten über den integrierten MCP-Server mit deinen Arbeitsbereichen.',
  'shared.desktopTeaser.liveNetwork.title': 'Live-Netzwerk',
  'shared.desktopTeaser.liveNetwork.body':
    'Beobachte den Verkehr eines Browser-Tabs live in der Desktop-App, gestreamt von der Erweiterung — ganz ohne ' +
    'DevTools.',
} as const satisfies Catalog;
