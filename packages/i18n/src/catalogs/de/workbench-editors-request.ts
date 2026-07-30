/**
 * Workbench editors — the API request editor — German. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key; extends the
 * de register contract (`de/shared.ts`). Raw by design: HTTP methods,
 * header names, MIME types, auth scheme names (Basic Auth / Bearer
 * Token / API Key / OAuth 2.0 / AWS Signature v4 / Digest Auth /
 * OAuth 1.0), OAuth/PKCE spec params (Client ID, Client Secret, Code
 * Challenge Method, Code Verifier, Scope, State, refresh_token,
 * oauth_*), body-mode enums, `Docs` / `Params` tab names
 * (Einstellungen = Settings tab, S58 law), wire tokens
 * (Timing-Allow-Origin, resource-timing, Referer, Host, User-Agent,
 * SSE `ID`/`Retry`, Trailers), the phase ladder's DNS/TCP/TLS/TTFB
 * tokens, Cookies/Console view tabs and `Cookie jar` where en
 * capitalizes (S67). Assertion verdicts translate caps-for-caps
 * (BESTANDEN / FEHLGESCHLAGEN, fr/es precedent). Reuses the de
 * mints: **Senden** (Send), **Erben** (auth inherit, editors-shared),
 * der Zugriffstoken (settings-panes), das Cookie-Glas (bare jar =
 * das Glas), die Laufzeitumgebung (Netzwerk-Laufzeitumgebung =
 * network runtime), Assertions raw (workbench-live), die
 * Voreinstellung, Verschönern, der Body raw (Anfrage-Body legal,
 * genitive „Bodys“ never — rephrase), die Leitung = wire, die
 * Erfassung = capture, der Pool raw, das Back-end, lowercase `vault`
 * per the per-case token law. Twin labels quote the shared-conflicts
 * scalar registry (TLS-Mindest-/Höchstversion, TLS-Cipher-Suites,
 * HTTP/2 erlauben, Client-Zertifikat, Proxy-Anmeldedaten,
 * Unix-Socket, Anfrage-Zeitlimit, Antwortgrößen-Limit, Ursprüngliche
 * HTTP-Methode beibehalten, Authorization-Header beibehalten). HTTP
 * 3xx = die Umleitung (corpus law: rule kickers, panel, status
 * docs); weiterleiten stays the device-forwarding referent
 * (weitergeleitete Sendevorgänge). MINTS: Sicherer Modus /
 * Entwicklermodus = script execution modes; die Untergrenze = TLS
 * floor; der Sendevorgang = a send. Browser cert-interstitial paths
 * quote the browsers' own de UI (both localize de): Chrome
 * `Erweitert → Weiter zu … (unsicher)`, Firefox `Erweitert… →
 * Risiko akzeptieren und fortfahren`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Anfrage nicht gefunden.',
  'workbench.editors.request.loading': 'Anfrage wird geladen…',
  'workbench.editors.request.toast.deletedOtherTab': 'Die Anfrage wurde aus einem anderen Tab gelöscht',
  'workbench.editors.request.toast.updateFailed': 'Die Anfrage ließ sich nicht aktualisieren',
  'workbench.editors.request.toast.updateFailedDetail': 'Die Anfrage ließ sich nicht aktualisieren: {message}',
  'workbench.editors.request.toast.savedExample': 'Beispiel „{name}“ gespeichert',
  'workbench.editors.request.toast.saveExampleFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.request.toast.saveExampleFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  'workbench.editors.request.send.label': 'Senden',
  'workbench.editors.request.send.sending': 'Wird gesendet…',
  'workbench.editors.request.send.unresolvedTooltip':
    'Die Anfrage hat unaufgelöste Variablen. Definiere sie im vault, in der Umgebung, der Sammlung, dem ' +
    'Arbeitsbereich oder einem Live-Workflow, bevor du sendest.',
  'workbench.editors.request.send.remoteDispatchHint': 'Läuft auf {host} — dem verbundenen Back-end',
  'workbench.editors.request.send.stop': 'Stoppen',
  'workbench.editors.request.send.stopTooltip': 'Die Anfrage stoppen und behalten, was bereits angekommen ist',
  'workbench.editors.request.menu.copyAsCurl': 'Als cURL kopieren',
  'workbench.editors.request.menu.copyAsFetch': 'Als fetch kopieren',
  'workbench.editors.request.schemeHint':
    'Deine URL hat kein Schema. Sie wird als https:// gesendet — klicke in die URL-Leiste und drücke Tab ' +
    'oder die Eingabetaste, um es festzuschreiben.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Autorisierung',
  'workbench.editors.request.tab.headers': 'Header',
  'workbench.editors.request.tab.body': 'Body',
  'workbench.editors.request.tab.scripts': 'Scripts',
  'workbench.editors.request.tab.settings': 'Einstellungen',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'URL eingeben oder Text einfügen',
  'workbench.editors.request.method.customGroup': 'Benutzerdefiniert',
  'workbench.editors.request.method.usePrefix': 'Verwenden',
  'workbench.editors.request.method.forbiddenSuffix': 'lässt sich aus einem Browser nicht senden.',
  'workbench.editors.request.method.invalidHint': 'Methoden verwenden Buchstaben, Ziffern und Bindestriche (max. 32).',
  'workbench.editors.request.method.removeCustomAria': 'Benutzerdefinierte Methode {method} entfernen',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Zur Autorisierung gehen',
  'workbench.editors.request.goToBody': 'Zum Body gehen',
  'workbench.editors.request.goToSettings': 'Zu den Einstellungen gehen',
  'workbench.editors.request.headers.keyPlaceholder': 'Header',
  'workbench.editors.request.headers.hideAuto': 'Automatisch generierte Header ausblenden',
  'workbench.editors.request.headers.hiddenCount': '{count} ausgeblendet',
  'workbench.editors.request.headers.autoInfo':
    'Diese Header werden automatisch hinzugefügt und mit der Anfrage gesendet. Klicke auf das Info-Symbol ' +
    'einer Zeile für Details pro Header.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Duplikat — beim Senden ersetzt durch den {header}-Header, der aus dem Tab Autorisierung generiert wird.',
  'workbench.editors.request.headers.calculated': '<wird beim Senden der Anfrage berechnet>',
  'workbench.editors.request.headers.browserUserAgent': '<User-Agent des Browsers>',
  'workbench.editors.request.headers.hint.cacheControl':
    '„Cache-Control: no-cache“ wird vorsorglich hinzugefügt, damit der Server bei wiederholten Anfragen ' +
    'keine veralteten Antworten zurückgibt. Du kannst diesen Header in den Anfrage-Einstellungen entfernen ' +
    'oder einen neuen mit einem anderen Wert eingeben.',
  'workbench.editors.request.headers.hint.contentType':
    'Die Laufzeitumgebung berechnet den Content-Type aus der Body-Kodierung (form-data → ' +
    'multipart/form-data mit einer Boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; ' +
    'rohes JSON → application/json; etc.). Setze einen eigenen Header, um das zu überschreiben.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length wird aus der Bytegröße des serialisierten Body-Inhalts berechnet, bevor die Anfrage ' +
    'gesendet wird. Der Browser weigert sich, einen benutzergesetzten Content-Length zu übernehmen, der ' +
    'nicht zur tatsächlichen Body-Länge passt.',
  'workbench.editors.request.headers.hint.host':
    'Der Browser leitet Host aus der Ziel-URL ab und lässt nicht zu, dass Userland-Code ihn überschreibt.',
  'workbench.editors.request.headers.hint.userAgent':
    'Der User-Agent identifiziert den Client. Anfragen gehen mit dem eigenen User-Agent des Browsers ' +
    'hinaus; füge unten eine eigene User-Agent-Zeile hinzu, um ihn zu überschreiben.',
  'workbench.editors.request.headers.hint.accept':
    'Accept teilt dem Server mit, welche Medientypen der Client parsen kann. `*/*` lässt den Server ' +
    'wählen; überschreibe es mit einer engeren Auswahl (z. B. `application/json`), um die Antworten ' +
    'einzuschränken.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Kompressionsalgorithmen, die der Browser unterstützt. Vom Browser gesetzt und pro Verbindung ' +
    'ausgehandelt; aus Userland nicht überschreibbar.',
  'workbench.editors.request.headers.hint.connection':
    'HTTP/1.1-Verbindungswiederverwendung. Der Browser verwaltet den Verbindungs-Pool und lässt ' +
    'Userland-Code diesen Header nicht überschreiben.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <Anmeldedaten>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <Token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<Wert>',
  'workbench.editors.request.authPreview.accessTokenValue': '<Zugriffstoken>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <Zugriffstoken>',
  'workbench.editors.request.authPreview.basicHint':
    'Aus dem Tab Autorisierung generiert (Basic Auth). Benutzername und Passwort werden beim Senden der ' +
    'Anfrage base64-kodiert in diesen Header geschrieben.',
  'workbench.editors.request.authPreview.bearerHint':
    'Aus dem Tab Autorisierung generiert (Bearer Token). Der Token wird beim Senden der Anfrage zu diesem ' +
    'Header hinzugefügt.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    'Aus dem Tab Autorisierung generiert (API Key). Der Wert wird beim Senden der Anfrage zu diesem Header ' +
    'hinzugefügt.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    'Aus dem Tab Autorisierung generiert (API Key). Der Wert wird beim Senden der Anfrage zu diesem ' +
    'Query-Parameter hinzugefügt.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    'Aus dem Tab Autorisierung generiert (OAuth 2.0). Der Zugriffstoken wird beim Senden der Anfrage zu ' +
    'diesem Header hinzugefügt.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    'Aus dem Tab Autorisierung generiert (OAuth 2.0). Der Zugriffstoken wird beim Senden an die ' +
    'Anfrage-URL angehängt.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <Signatur>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<Zeitstempel der Anfrage>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    'Aus dem Tab Autorisierung generiert (AWS Signature v4). Die Anfrage wird beim Senden mit deinen ' +
    'Anmeldedaten signiert.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    'Aus dem Tab Autorisierung generiert (AWS Signature v4). Der Signatur-Zeitstempel wird beim Senden der ' +
    'Anfrage zu diesem Header hinzugefügt.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <Challenge-Antwort>',
  'workbench.editors.request.authPreview.digestHint':
    'Aus dem Tab Autorisierung generiert (Digest Auth). Der Wert wird beim Senden aus der Challenge des ' +
    'Servers berechnet, dann wird die Anfrage damit erneut gesendet.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <signierte Parameter>',
  'workbench.editors.request.authPreview.oauth1Hint':
    'Aus dem Tab Autorisierung generiert (OAuth 1.0). Die Anfrage wird beim Senden mit deinen ' +
    'Anmeldedaten signiert.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<signierte Parameter>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    'Aus dem Tab Autorisierung generiert (OAuth 1.0). Die oauth_*-Parameter werden beim Senden der Anfrage ' +
    'zur URL-Query hinzugefügt.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Authentifizierungstyp',
  'workbench.editors.request.auth.type.inherit': 'Authentifizierung vom übergeordneten Element erben',
  'workbench.editors.request.auth.type.none': 'Keine Authentifizierung',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1Token': 'Zugriffstoken',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'optional — leer für One-Legged-Aufrufe',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'optional — leer für One-Legged-Aufrufe',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Signaturmethode',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'optional',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth beantwortet die Challenge des Servers mit einer zweiten Anfrage, die in der Desktop-App ' +
    'und der CLI läuft. Sendevorgänge von dieser Oberfläche gehen ohne sie hinaus — der Server antwortet ' +
    'mit 401.',
  'workbench.editors.request.auth.inheritNote':
    'Die Autorisierungsdaten werden automatisch anhand der übergeordneten Sammlung konfiguriert.',
  'workbench.editors.request.auth.noneNote': 'Diese Anfrage verwendet keine Autorisierung.',
  'workbench.editors.request.auth.inheritDetail':
    'Diese Anfrage verwendet den Autorisierungshelfer ihrer übergeordneten Sammlung. Bearbeite den Tab ' +
    'Autorisierung der Sammlung, um ihn zu ändern.',
  'workbench.editors.request.auth.resizeRailAria': 'Größe der Authentifizierungstyp-Leiste ändern',
  'workbench.editors.request.auth.username': 'Benutzername',
  'workbench.editors.request.auth.password': 'Passwort',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': 'Schlüssel',
  'workbench.editors.request.auth.keyPlaceholder': 'z. B. X-API-Key',
  'workbench.editors.request.auth.value': 'Wert',
  'workbench.editors.request.auth.addTo': 'Hinzufügen zu',
  'workbench.editors.request.auth.addToHeader': 'Header',
  'workbench.editors.request.auth.addToQuery': 'Query-Parameter',
  'workbench.editors.request.auth.usernamePlaceholder': 'Benutzername',
  'workbench.editors.request.auth.passwordPlaceholder': 'Passwort',
  'workbench.editors.request.auth.tokenPlaceholder': 'Bearer-Token',
  'workbench.editors.request.auth.valuePlaceholder': 'API-Key-Wert',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': 'Dienstname',
  'workbench.editors.request.auth.awsRegion': 'Region',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'z. B. AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'Secret Access Key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'optional — nur temporäre (STS-)Anmeldedaten',
  'workbench.editors.request.auth.awsServicePlaceholder': 'z. B. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'z. B. us-east-1',
  'workbench.editors.request.auth.sendAsLabel': 'Autorisierungsdaten hinzufügen zu',
  'workbench.editors.request.auth.sendAsHeaders': 'Anfrage-Header',
  'workbench.editors.request.auth.sendAsUrl': 'Anfrage-URL',
  'workbench.editors.request.auth.presetLabel': 'Anbieter-Voreinstellung',
  'workbench.editors.request.auth.presetInfo':
    'Einen Anbieter zu wählen füllt seine Autorisierungs- und Token-Endpunkte, den Standard-Scope und den ' +
    'empfohlenen Flow vor. Wähle Benutzerdefiniert, um alles manuell zu konfigurieren.',
  'workbench.editors.request.auth.presetCustom': 'Benutzerdefiniert (keine Voreinstellung)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'Den Zugriffstoken in der URL zu senden ist veraltet',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 hat die Methode über den URI-Query-Parameter verfügbar gehalten, warnt aber davor: ' +
    'Tokens sickern in Server-Logs, HTTP-`Referer`-Header, den Browserverlauf und zwischengeschaltete ' +
    'Caches. Bevorzuge den standardmäßigen',
  'workbench.editors.request.oauth.queryWarningAfter': 'Header, sofern der Anbieter nicht die Query-Form verlangt.',
  'workbench.editors.request.oauth.currentToken': 'Aktueller Token',
  'workbench.editors.request.oauth.configureNewToken': 'Neuen Token konfigurieren',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': 'Noch kein Token — nutze unten Neuen Zugriffstoken abrufen',
  'workbench.editors.request.oauth.headerPrefix': 'Header-Präfix',
  'workbench.editors.request.oauth.autoRefresh': 'Token automatisch erneuern',
  'workbench.editors.request.oauth.autoRefreshDesc':
    'Dein abgelaufener Token wird vor dem Senden einer Anfrage automatisch erneuert.',
  'workbench.editors.request.oauth.status': 'Status',
  'workbench.editors.request.oauth.statusExpired':
    'Abgelaufen — das nächste Senden erneuert automatisch, wenn ein refresh_token gespeichert ist.',
  'workbench.editors.request.oauth.statusValid': 'Gültig · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Jetzt erneuern',
  'workbench.editors.request.oauth.disconnect': 'Trennen',
  'workbench.editors.request.oauth.tokenName': 'Token-Name',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Freie Beschriftung, sichtbar in der Liste der Anmeldedaten, wenn ein Arbeitsbereich mehrere Tokens ' +
    'für denselben Anbieter hält.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Gib einen Token-Namen ein…',
  'workbench.editors.request.oauth.grantType': 'Grant-Typ',
  'workbench.editors.request.oauth.callbackUrl': 'Callback-URL',
  'workbench.editors.request.oauth.detecting': 'Wird erkannt…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'Registriere diese URL bei deinem OAuth-Anbieter. Sie sieht anders aus als die',
  'workbench.editors.request.oauth.callbackTipBeforeHost':
    'URL in deiner Adressleiste, weil Chrome einen dedizierten Umleitungs-Host bereitstellt',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'für',
  'workbench.editors.request.oauth.callbackTipAfterApi':
    '. Die Erweiterungs-ID ist dieselbe; nur Host und Schema unterscheiden sich.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Mit dem Browser autorisieren',
  'workbench.editors.request.oauth.authUrl': 'Autorisierungs-URL',
  'workbench.editors.request.oauth.accessTokenUrl': 'Zugriffstoken-URL',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Wird automatisch generiert, wenn leer gelassen',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': 'z. B. read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': 'Wird für jede Autorisierungsanfrage automatisch generiert',
  'workbench.editors.request.oauth.clientAuthentication': 'Client-Authentifizierung',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Wo client_id / client_secret bei Token-POSTs mitfahren. Anbieter variieren — Auth0 / Keycloak ' +
    'verlangen typischerweise die Form als Basic-Header.',
  'workbench.editors.request.oauth.clientAuthBody': 'Client-Anmeldedaten im Body senden',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Als Basic-Auth-Header senden',
  'workbench.editors.request.oauth.advanced': 'Erweitert',
  'workbench.editors.request.oauth.advancedIntro': 'Hier kannst du deine OAuth2-Anfragen genauer anpassen.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Mehr über die Konfiguration erfahren',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh-Token-URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'Die meisten Anbieter verwenden die Zugriffstoken-URL auch zum Erneuern; gib nur dann eine eigene an, ' +
    'wenn der Anbieter einen eigenen Pfad bereitstellt.',
  'workbench.editors.request.oauth.authRequest': 'Autorisierungsanfrage',
  'workbench.editors.request.oauth.tokenRequest': 'Token-Anfrage',
  'workbench.editors.request.oauth.refreshRequest': 'Erneuerungsanfrage',
  'workbench.editors.request.oauth.getNewToken': 'Neuen Zugriffstoken abrufen',
  'workbench.editors.request.oauth.clearCookies': 'Cookies löschen',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Tokens werden pro Arbeitsbereich gespeichert unter',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. Lösche den Arbeitsbereich, um sie zu entfernen.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: Token erhalten',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: Autorisierung abgeschlossen',
  'workbench.editors.request.oauth.toast.failed': 'OAuth fehlgeschlagen: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: Zugriffstoken erneuert',
  'workbench.editors.request.oauth.toast.refreshFailed': 'Erneuerung fehlgeschlagen: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: getrennt',
  'workbench.editors.request.oauth.toast.callbackCopied': 'Callback-URL kopiert',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'Kopieren nicht unterstützt — wähle die URL manuell aus',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'Diese Anfrage hat keinen Body',
  'workbench.editors.request.body.beautify': 'Verschönern',
  'workbench.editors.request.body.format': 'Formatieren',
  'workbench.editors.request.body.formatAria': 'Body formatieren',
  'workbench.editors.request.body.queryTitle': 'Abfrage',
  'workbench.editors.request.body.queryInfoTitle': 'GraphQL-Abfrage',
  'workbench.editors.request.body.queryInfoSummary':
    'Wird als normaler POST mit einem JSON-Body aus { query, variables } gesendet. Schema-Introspektion ' +
    'und Autovervollständigung für Abfragen sind noch nicht verfügbar.',
  'workbench.editors.request.body.variablesTitle': 'GraphQL-Variablen',
  'workbench.editors.request.body.variablesInfoTitle': 'GraphQL-Variablen',
  'workbench.editors.request.body.variablesInfoSummary':
    'Definiere Variablen im JSON-Format, um sie aus der Abfrage zu referenzieren (z. B. $id).',
  'workbench.editors.request.body.kindText': 'Text',
  'workbench.editors.request.body.kindFile': 'Datei',
  'workbench.editors.request.body.newFile': 'Neue Datei vom lokalen Rechner',
  'workbench.editors.request.body.uploadedFiles': 'Hochgeladene Dateien',
  'workbench.editors.request.body.allAttached': 'Alle hochgeladenen Dateien sind bereits angehängt',
  'workbench.editors.request.body.selectFiles': 'Dateien auswählen',
  'workbench.editors.request.body.loadingFiles': 'Dateien werden geladen…',
  'workbench.editors.request.body.addFile': '+ Datei hinzufügen',
  'workbench.editors.request.body.uploadRequired': 'Hochladen erforderlich',
  'workbench.editors.request.body.deleteFileAria': '{filename} aus dem Arbeitsbereich löschen',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Schreiben',
  'workbench.editors.request.docs.preview': 'Vorschau',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'Dokumentiere diese Anfrage — warum es sie gibt, wann sie ausgeführt wird, der erwartete ' +
    'Autorisierungsumfang. Markdown wird unterstützt: Überschriften, Listen, Tabellen, Codeblöcke, Links. ' +
    '{{variable}}-Referenzen erscheinen in der Vorschau als Chips.',
  'workbench.editors.request.docs.placeholder':
    'Was macht diese Anfrage?\nWarum es sie gibt, wann sie ausgeführt wird, der erwartete Autorisierungsumfang.',
  'workbench.editors.request.docs.empty': 'Noch nichts dokumentiert — wechsle zu Schreiben, um Notizen hinzuzufügen.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Pre-Request',
  'workbench.editors.request.scripts.postResponse': 'Post-Response',
  'workbench.editors.request.scripts.preInfoTitle': 'Pre-Request-Script',
  'workbench.editors.request.scripts.preInfoSummary':
    'Läuft in einem isolierten iframe, bevor die Anfrage gesendet wird. Verändere die ausgehende Anfrage ' +
    'mit der oh-API:',
  'workbench.editors.request.scripts.postInfoTitle': 'Post-Response-Script',
  'workbench.editors.request.scripts.postInfoSummary':
    'Läuft in einem isolierten iframe, nachdem die Antwort angekommen ist. Assertion-Ergebnisse landen im ' +
    'Antwort-Panel:',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'einen Header hinzufügen oder ersetzen',
  'workbench.editors.request.scripts.apiSetQueryParam': 'einen Query-Parameter hinzufügen oder ersetzen',
  'workbench.editors.request.scripts.apiSetUrl': 'die Ziel-URL umschreiben',
  'workbench.editors.request.scripts.apiSetBody': 'den Anfrage-Body ersetzen',
  'workbench.editors.request.scripts.apiRequire': 'ein Script-Paket aus der Paketbibliothek laden',
  'workbench.editors.request.scripts.apiTest': 'eine Assertion registrieren',
  'workbench.editors.request.scripts.prePlaceholder': 'Nutze JavaScript, um diese Anfrage vor dem Senden zu verändern.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Nutze JavaScript, um diese Antwort nach dem Eintreffen zu testen und zu lesen.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.enabled': 'Aktiviert',
  'workbench.editors.request.settings.disabled': 'Deaktiviert',
  'workbench.editors.request.settings.followRedirects': 'Umleitungen automatisch folgen',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Folgt HTTP-3xx-Antworten zu ihrem Ziel. Schalte es aus, um bei der Umleitung selbst anzuhalten — die ' +
    'Antwort erscheint als opake Umleitung ohne Header und Body, nützlich um zu bestätigen, dass überhaupt ' +
    'eine Umleitung stattfindet.',
  'workbench.editors.request.settings.maxRedirects': 'Maximale Umleitungen',
  'workbench.editors.request.settings.maxRedirectsInfo':
    'Wie vielen Umleitungen ein Senden folgen darf, bevor es mit einem Fehler fehlschlägt, der das Limit ' +
    'nennt. Leer lassen für den Standardwert von 20. Setze 0, um bei jeder Umleitung sofort fehlzuschlagen.',
  'workbench.editors.request.settings.followOriginalMethod': 'Ursprüngliche HTTP-Methode beibehalten',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    'Behält die ursprüngliche Methode und den Body bei, wenn eine 301-, 302- oder 303-Umleitung die ' +
    'Anfrage normalerweise auf GET umstellen würde. 307- und 308-Umleitungen behalten die Methode ohnehin ' +
    'immer bei.',
  'workbench.editors.request.settings.followAuthHeader': 'Authorization-Header beibehalten',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    'Behält den Authorization-Header bei, wenn eine Umleitung zu einem anderen Origin wechselt. ' +
    'Normalerweise wird er bei einem Origin-übergreifenden Sprung verworfen, damit Anmeldedaten nie zu ' +
    'einem Host gelangen, den die Anfrage nicht adressiert hat.',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'Die Anmeldedaten gelangen zu dem Host, auf dem die Umleitungskette endet. Eine Antwort, deren Kette ' +
    'tatsächlich Origins überquert hat, wird markiert.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Browser-Cookies senden',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    'Hängt die vorhandenen Cookies des Browsers für die Zielseite an diese Anfrage an. Aus ist der sichere ' +
    'Standard: Die Anfrage wird ohne Cookies gesendet, sodass die Ergebnisse nicht von deinem angemeldeten ' +
    'Browser-Zustand abhängen.',
  'workbench.editors.request.settings.sslVerification': 'SSL-Zertifikatsprüfung',
  'workbench.editors.request.settings.sslVerificationSummary':
    'Prüft das TLS-Zertifikat des Servers gegen den vertrauenswürdigen CA-Speicher der Laufzeitumgebung — ' +
    'standardmäßig aktiv.',
  'workbench.editors.request.settings.sslVerificationDescription':
    'Ein Host mit einem selbstsignierten, abgelaufenen oder anderweitig nicht vertrauenswürdigen ' +
    'Zertifikat schlägt mit einem TLS-Zertifikatsfehler fehl — schalte die Prüfung aus, um ihn trotzdem zu ' +
    'erreichen, z. B. einen Entwicklungsserver mit selbstsigniertem Zertifikat.',
  'workbench.editors.request.settings.sslVerificationWarning':
    'Sendevorgänge überspringen die Prüfung der Serveridentität — jedes Zertifikat wird akzeptiert, auch ' +
    'selbstsignierte und abgelaufene. Die Antwort wird als ungeprüft markiert.',
  'workbench.editors.request.settings.tlsMin': 'TLS-Mindestversion',
  'workbench.editors.request.settings.tlsMinSummary':
    'Die niedrigste TLS-Protokollversion, die ein Senden aushandeln darf — leer behält den Standard der ' +
    'Laufzeitumgebung, TLS 1.2.',
  'workbench.editors.request.settings.tlsMinDescription':
    '1.0 oder 1.1 senkt die Untergrenze unter den Standard, um Legacy-Server zu erreichen — eine mit ' +
    'gesenkter Untergrenze gesendete Antwort wird markiert.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (Standard)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Sendevorgänge können TLS unter 1.2 aushandeln — Protokollversionen mit bekannten Schwächen. Die ' +
    'Antwort wird markiert.',
  'workbench.editors.request.settings.tlsMax': 'TLS-Höchstversion',
  'workbench.editors.request.settings.tlsMaxSummary':
    'Die höchste TLS-Protokollversion, die ein Senden aushandeln darf — leer behält den Standard der ' +
    'Laufzeitumgebung, TLS 1.3.',
  'workbench.editors.request.settings.tlsMaxDescription':
    'Senke sie, um zu prüfen, wie sich ein Server mit einem älteren Protokoll verhält — eventuell muss ' +
    'auch die Mindestversion sinken, sonst überlappen sich die beiden nicht.',
  'workbench.editors.request.settings.tlsVersionsHeading': 'Versionen',
  'workbench.editors.request.settings.tlsVersionLegacyDesc':
    'Veraltet, mit bekannten Schwächen — Sendevorgänge werden markiert.',
  'workbench.editors.request.settings.tlsVersion12Desc': 'Die Standard-Untergrenze.',
  'workbench.editors.request.settings.tlsVersion13Desc': 'Die Standard-Obergrenze — aktuelle gute Praxis.',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (Standard)',
  'workbench.editors.request.settings.tlsCipherSuites': 'TLS-Cipher-Suites',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'Die während des TLS-Handshakes angebotenen Cipher-Suites, als eine durch Doppelpunkte getrennte Liste ' +
    '— leer bietet die Standard-Suites der Laufzeitumgebung an.',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    'Der Server wählt die Suite aus dem Angebot, in seiner eigenen Präferenzreihenfolge.',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': 'Format',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'Eine TLS-1.3-Suite unter ihrem IANA-Namen.',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'Eine ältere Suite unter ihrem OpenSSL-Namen — beide Arten gehören in dieselbe Liste.',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': 'Verbindet die Einträge — keine Leerzeichen.',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Standard-Suites der Laufzeitumgebung',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    'Nur durch Doppelpunkte getrennte OpenSSL-Suite-Namen — keine Leerzeichen.',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 Hops (Standard)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Hop', other: '{count} Hops' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (Standard)',
  'workbench.editors.request.settings.resetToDefault': 'Auf Standard zurücksetzen',
  'workbench.editors.request.settings.resetRow': '{label} auf Standard zurücksetzen',
  'workbench.editors.request.settings.group.redirects': 'Umleitungen',
  'workbench.editors.request.settings.group.tls': 'TLS & Vertrauen',
  'workbench.editors.request.settings.group.connection': 'Verbindung',
  'workbench.editors.request.settings.group.cookies': 'Cookies',
  'workbench.editors.request.settings.group.execution': 'Ausführung & Limits',
  'workbench.editors.request.settings.groupInfo.connection':
    'Wie das Senden den Server erreicht — das gesprochene HTTP-Protokoll und der gewählte Weg: direkt, ' +
    'über einen Proxy, zu einer gepinnten Adresse oder in einen lokalen Socket.',
  'workbench.editors.request.settings.groupInfo.tls':
    'Was das Senden im TLS-Handshake prüft und anbietet — Zertifikatsprüfung, das Protokollfenster, die ' +
    'Cipher-Suites und ein Client-Zertifikat.',
  'workbench.editors.request.settings.groupInfo.redirects':
    'Was passiert, wenn der Server mit einer Umleitung antwortet — ob die Kette verfolgt wird, wie weit, ' +
    'und was die Folgeanfragen mitführen.',
  'workbench.editors.request.settings.groupInfo.cookies':
    'Ob Cookies das Senden begleiten — standardmäßig aus, damit Ergebnisse nie vom umgebenden ' +
    'Anmeldezustand abhängen.',
  'workbench.editors.request.settings.groupInfo.execution':
    'Wie der Lauf selbst begrenzt wird — der Script-Modus, das Zeitbudget und die Obergrenze der ' + 'Antwortgröße.',
  'workbench.editors.request.settings.httpVersion': 'HTTP-Version',
  'workbench.editors.request.settings.httpVersionSummary':
    'Wie das Senden HTTP spricht — Auto (Standard) bietet HTTP/2 neben HTTP/1.1 an und der Server wählt.',
  'workbench.editors.request.settings.httpVersionDescription':
    'Eine gepinnte Version, die der Server nicht spricht, schlägt mit einem klaren Fehler fehl — nie ein ' +
    'stiller Rückfall. Das Netzwerk-Popover der Antwort zeigt immer das tatsächlich auf der Leitung ' +
    'ausgehandelte Protokoll.',
  'workbench.editors.request.settings.httpVersionValuesHeading': 'Werte',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'Bietet beim TLS-Handshake HTTP/2 + HTTP/1.1 an und der Server wählt — schlichtes http:// bleibt bei ' +
    'HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion11Desc': 'Pinnt die klassische HTTP/1.1-Semantik.',
  'workbench.editors.request.settings.httpVersion2Desc': 'Pinnt HTTP/2 über das Handshake-Angebot.',
  'workbench.editors.request.settings.httpVersionPkDesc':
    'Spricht sofort HTTP/2 ohne Aushandlung — der Weg zu Klartext-HTTP/2-Servern.',
  'workbench.editors.request.settings.httpVersion3Desc': 'Wählt den Server direkt über QUIC an, ohne Rückfall auf TCP.',
  'workbench.editors.request.settings.exampleCaption': 'Beispiel-Senden',
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Auto — der Server wählt',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (prior knowledge)',
  'workbench.editors.request.settings.resolveToAddress': 'Zu Adresse auflösen',
  'workbench.editors.request.settings.resolveToAddressInfo':
    'Sendet diese Anfrage an eine bestimmte Serveradresse statt an das, was das DNS antwortet — der ' +
    'Hostname der URL wird weiterhin für TLS und den Host-Header verwendet, mit aktivierter Prüfung muss ' +
    'das Zertifikat also weiterhin zu ihm passen. Nützlich, um ein bestimmtes Back-end hinter einem ' +
    'Load-Balancer zu testen. Die URL behält ihren eigenen Port, und eine Umleitung zu einem anderen Host ' +
    'landet ebenfalls auf dieser Adresse. Leer lassen, um wie üblich über DNS aufzulösen.',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'System-DNS',
  'workbench.editors.request.settings.resolveToAddressError':
    'Nur IPv4- oder IPv6-Adressen — kein Hostname, kein Port.',
  'workbench.editors.request.settings.clientCertificate': 'Client-Zertifikat',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Präsentiert während des TLS-Handshakes ein Client-Zertifikat, für APIs hinter Mutual-TLS-Gateways, ' +
    'die den Aufrufer per Zertifikat authentifizieren. Wähle einen Zertifikatseintrag aus dem vault — die ' +
    'Anfrage speichert nur den Namen des Eintrags, und jedes Gerät präsentiert seinen eigenen ' +
    'vault-Eintrag dieses Namens; Zertifikat und Schlüssel verlassen den vault nie. Leer lassen, um ohne ' +
    'Client-Zertifikat zu verbinden.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Kein Client-Zertifikat',
  'workbench.editors.request.settings.clientCertificateDangling':
    'Kein vault-Zertifikatseintrag namens „{name}“ auf diesem Gerät — Sendevorgänge schlagen fehl, bis der ' +
    'Eintrag existiert oder diese Einstellung geleert wird.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxyInfo':
    'Leitet diese Anfrage über einen HTTP(S)-Proxy statt direkt zu verbinden. Die Verbindung zum Ziel wird ' +
    'durch den Proxy getunnelt, ein https-Austausch bleibt also Ende-zu-Ende verschlüsselt und die ' +
    'Zertifikatsprüfung läuft weiterhin gegen das Ziel. SOCKS-Proxys werden nicht unterstützt. ' +
    'Anmeldedaten gehören in die Einstellung „Proxy-Anmeldedaten“ darunter, nie in diese URL. Leer lassen ' +
    'für eine direkte Verbindung.',
  'workbench.editors.request.settings.proxyPlaceholder': 'Kein Proxy — direkte Verbindung',
  'workbench.editors.request.settings.proxyError':
    'Nur http://- oder https://-URLs mit Host und Port — keine Anmeldedaten in der URL, kein SOCKS.',
  'workbench.editors.request.settings.proxyResolveConflict':
    'Setzt auch „Zu Adresse auflösen“, aber ein Proxy löst den Hostnamen selbst auf — Sendevorgänge ' +
    'schlagen fehl, bis eine der beiden Einstellungen geleert wird.',
  'workbench.editors.request.settings.proxyCredentials': 'Proxy-Anmeldedaten',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    'Authentifiziere dich beim Proxy mit Anmeldedaten aus dem vault, als user:password in einem ' +
    'String-Eintrag. Die Anfrage speichert nur den Namen des Eintrags, und jedes Gerät löst ihn gegen ' +
    'seinen eigenen lokalen vault auf — die Anmeldedaten verlassen den vault nie und werden nur an den ' +
    'Proxy gesendet, nie an das Ziel. Leer lassen für einen Proxy ohne Authentifizierung.',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'Keine Authentifizierung',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'Kein vault-String-Eintrag namens „{name}“ auf diesem Gerät — Sendevorgänge schlagen fehl, bis der ' +
    'Eintrag existiert oder diese Einstellung geleert wird.',
  'workbench.editors.request.settings.unixSocket': 'Unix-Socket',
  'workbench.editors.request.settings.unixSocketInfo':
    'Wählt diesen lokalen Socket an — einen absoluten Unix-Socket-Pfad oder eine benannte Windows-Pipe wie ' +
    '\\\\.\\pipe\\name — statt eine TCP-Verbindung zu öffnen, z. B. einen Docker-Daemon oder einen lokalen ' +
    'Entwicklungsdienst, der auf einem Socket lauscht. Der Host der URL entscheidet nicht mehr, wohin die ' +
    'Verbindung geht, aber Host-Header, TLS-Servername und Zertifikatsprüfung verwenden ihn weiterhin, und ' +
    'eine Umleitung zu einem anderen Host wählt ebenfalls diesen Socket an. Leer lassen für eine normale ' +
    'TCP-Verbindung.',
  'workbench.editors.request.settings.unixSocketPlaceholder': 'Kein Socket — TCP-Verbindung',
  'workbench.editors.request.settings.unixSocketError':
    'Nur absolute Unix-Socket-Pfade (/…) oder benannte Windows-Pipes (\\\\.\\pipe\\…).',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'Setzt auch einen Proxy, aber ein Proxy-Tunnel kann keinen lokalen Socket anwählen — Sendevorgänge ' +
    'schlagen fehl, bis eine der beiden Einstellungen geleert wird.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'Setzt auch „Zu Adresse auflösen“, aber eine Socket-Verbindung löst keinen Hostnamen auf — ' +
    'Sendevorgänge schlagen fehl, bis eine der beiden Einstellungen geleert wird.',
  'workbench.editors.request.settings.cookieJar': 'Cookie-Glas verwenden',
  'workbench.editors.request.settings.cookieJarInfo':
    'Speichert die Set-Cookie-Antworten dieser Anfrage im app-eigenen Cookie-Glas und hängt passende ' +
    'Cookies automatisch an — so funktioniert eine Login-Anfrage gefolgt von einem authentifizierten ' +
    'Aufruf, ohne Cookie-Werte von Hand zu kopieren. Das Glas lebt im Speicher pro Arbeitsbereich, wird ' +
    'nur von Anfragen mit dieser Einstellung verwendet, synchronisiert nie und wird beim Beenden der App ' +
    'geleert. Ein selbst gesetzter Cookie-Header gewinnt immer. Aus ist der Standard: Es werden keine ' +
    'Cookies angehängt und Set-Cookie-Antworten werden verworfen.',
  'workbench.editors.request.settings.timeout': 'Anfrage-Zeitlimit',
  'workbench.editors.request.settings.timeoutInfo':
    'Maximale Zeit, die die gesamte Anfrage dauern darf — verbinden, auf die Antwort warten und den Body ' +
    'lesen. Läuft das Limit ab, wird das Senden abgebrochen und schlägt mit einem Timeout-Fehler fehl, der ' +
    'es nennt. Leer lassen für kein Limit pro Anfrage; nur die eigenen Timeouts des Netzwerk-Stacks gelten.',
  'workbench.editors.request.settings.timeoutPlaceholder': 'Kein Limit',
  'workbench.editors.request.settings.responseSizeLimit': 'Antwortgrößen-Limit',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'Maximale Größe des Antwort-Bodys, die von der Leitung gelesen wird; alles darüber wird abgeschnitten ' +
    'und die Antwort als gekürzt markiert. Leer lassen für das Standardlimit von 2 048 KB (2 MB). Erhöhe ' +
    'es auf bis zu 10 240 KB (10 MB) für größere Payloads, oder senke es, um zu testen, wie eine gekürzte ' +
    'Antwort aussieht.',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.managed.browserKicker': 'Vom Browser verwaltet',
  'workbench.editors.request.settings.managed.nodeKicker': 'Von der Laufzeitumgebung verwaltet',
  'workbench.editors.request.settings.managed.browserIntro':
    'Vom Browser für jede aus einer Erweiterung gesendete Anfrage festgelegt — angezeigt, damit du weißt, ' +
    'was nicht verhandelbar ist.',
  'workbench.editors.request.settings.managed.nodeIntro':
    'Von der Netzwerk-Laufzeitumgebung der App für jede Anfrage festgelegt — angezeigt, damit du weißt, ' +
    'was nicht verhandelbar ist.',
  'workbench.editors.request.settings.managed.hideBrowser': 'Vom Browser verwaltete Einstellungen ausblenden',
  'workbench.editors.request.settings.managed.hideNode': 'Von der Laufzeitumgebung verwaltete Einstellungen ausblenden',
  'workbench.editors.request.settings.managed.countBrowser': '{count} vom Browser verwaltet',
  'workbench.editors.request.settings.managed.countNode': '{count} von der Laufzeitumgebung verwaltet',
  'workbench.editors.request.settings.managed.on': 'An',
  'workbench.editors.request.settings.managed.off': 'Aus',
  'workbench.editors.request.settings.managed.auto': 'Auto',
  'workbench.editors.request.settings.managed.policy': 'Richtlinie',
  'workbench.editors.request.settings.managed.browser': 'Browser',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Nicht gesendet',
  'workbench.editors.request.settings.managed.httpVersion': 'HTTP-Version',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'Der Browser handelt HTTP/1.1, HTTP/2 oder HTTP/3 pro Verbindung aus; die fetch-API stellt keinen ' +
    'Versionswähler bereit.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Zertifikate werden nach Browser-Richtlinie geprüft. Eine Anfrage an einen Host mit ungültigem ' +
    'Zertifikat schlägt fehl; die Prüfung lässt sich nicht pro Anfrage deaktivieren.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'Bei einer 301/302/303-Umleitung stellt der Browser Nicht-GET-Methoden gemäß der fetch-Spezifikation ' +
    'auf GET um. 307/308 behalten die Methode immer bei.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'Der Browser entfernt den Authorization-Header, wenn eine Umleitung zu einem anderen Origin wechselt; ' +
    'dieses Sicherheitsverhalten lässt sich nicht überschreiben.',
  'workbench.editors.request.settings.managed.refererRedirect': 'Referer-Header bei Umleitung entfernen',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'Die Behandlung des Referer über Umleitungen hinweg folgt der Referrer-Richtlinie des Browsers für den ' +
    'Erweiterungskontext.',
  'workbench.editors.request.settings.managed.strictParser': 'Strikter HTTP-Parser',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'Der Netzwerk-Stack des Browsers weist fehlerhafte Antwort-Header immer zurück; einen toleranten Modus ' +
    'gibt es nicht.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'Der HTTP-Parser der Laufzeitumgebung weist fehlerhafte Antwort-Header zurück; einen toleranten Modus ' +
    'gibt es nicht.',
  'workbench.editors.request.settings.managed.encodeUrl': 'URL automatisch kodieren',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'Pfad und Query der URL werden vom URL-Parser prozent-kodiert, bevor die Anfrage auf die Leitung geht. ' +
    'Gib bereits kodierte Sequenzen ein, um sie unverändert zu behalten.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Cipher-Suite-Reihenfolge des Servers',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'Die TLS-Cipher-Aushandlung gehört dem Browser; weder Suite-Liste noch Reihenfolge sind konfigurierbar.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'Die fetch-API begrenzt die Umleitungskette auf etwa 20 Sprünge. Ein Limit pro Anfrage ist nicht ' +
    'umsetzbar: Der manuelle Umleitungsmodus liefert eine opake Antwort ohne Header, denen man folgen ' +
    'könnte.',
  'workbench.editors.request.settings.managed.tlsVersions': 'TLS-/SSL-Protokollversionen',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Die aktivierten TLS-Protokollversionen legt der Browser fest; eine Auswahl pro Anfrage ist nicht ' + 'verfügbar.',
  'workbench.editors.request.settings.managed.referer': 'Referer-Header',
  'workbench.editors.request.settings.managed.refererDesc':
    'Die Laufzeitumgebung hat keinen Seitenkontext, es geht also kein Referer auf die Leitung, sofern du ' +
    'nicht selbst einen als Header hinzufügst.',
  'workbench.editors.request.settings.managed.scripts': 'Pre-Request- / Post-Response-Scripts',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'Laufen hier nicht',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'Der Host, der die Sendevorgänge dieser Oberfläche beantwortet, hat keine Script-Laufzeitumgebung, ' +
    'Pre-Request- und Post-Response-Scripts werden also übersprungen und die Antwort trägt keine ' +
    'Script-Ergebnisse.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Sicherer Modus',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'Die Sendevorgänge dieser Oberfläche werden auf dem verbundenen Back-end ausgeführt, das Pre-Request- ' +
    'und Post-Response-Scripts in seiner isolierten sicheren Laufzeitumgebung ausführt: nur die ' +
    'oh.*-Script-API — kein Dateisystem, kein Prozesszugriff, kein Modul-Loader. Weitergeleitete ' +
    'Sendevorgänge laufen nie im Entwicklermodus, und jeder Lauf vermerkt auf der Antwort den Modus, in ' +
    'dem er ausgeführt wurde.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Script-Ausführung',
  'workbench.editors.request.settings.scriptModeSummary':
    'Wie Pre-Request- und Post-Response-Scripts dieses Arbeitsbereichs auf diesem Gerät laufen.',
  'workbench.editors.request.settings.scriptModeDescription':
    'Die Wahl gilt für jede Anfrage im Arbeitsbereich, bleibt auf diesem Gerät und synchronisiert nie — ' +
    'jeder Lauf vermerkt auf der Antwort den Modus, in dem er ausgeführt wurde.',
  'workbench.editors.request.settings.scriptModeModesHeading': 'Modi',
  'workbench.editors.request.settings.scriptModeSafe': 'Sicherer Modus',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Entwicklermodus',
  'workbench.editors.request.settings.scriptModeWarning':
    'Der Entwicklermodus führt die Scripts dieses Arbeitsbereichs mit vollem Systemzugriff aus — ' +
    'Dateisystem, Prozesse und Netzwerk. Aktiviere ihn nur, wenn du allen vertraust, die die Scripts ' +
    'dieses Arbeitsbereichs bearbeiten können. Workflow-Schritte und von anderen Geräten weitergeleitete ' +
    'Anfragen laufen weiterhin im sicheren Modus.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Script-Ausführung: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Empfohlen',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'Scripts laufen in der isolierten Script-Laufzeitumgebung der App — nur die oh.*-Script-API, ohne ' +
    'Dateisystem- oder Prozesszugriff und ohne Modul-Loader.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'Scripts laufen in einer vollständigen Node.js-Laufzeitumgebung — require, Dateisystem, Prozesse und ' +
    'Netzwerkzugriff.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'Nur verwenden, wenn du allen vertraust, die die Scripts dieses Arbeitsbereichs bearbeiten können',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'Gilt für jede Anfrage in diesem Arbeitsbereich, nur auf diesem Gerät — die Wahl synchronisiert nie.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Cookie im Glas dieses Arbeitsbereichs',
      other: '{count} Cookies im Glas dieses Arbeitsbereichs',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Inhalt des Cookie jar',
  'workbench.editors.request.settings.jar.infoSummary':
    'Die Cookies, die das In-Memory-Glas dieses Arbeitsbereichs gerade hält — gespeichert von ' +
    'Sendevorgängen mit Glas, angehängt an passende Sendevorgänge mit Glas, und weg, wenn die App beendet ' +
    'wird. Die Werte sind Sitzungs-Anmeldedaten und bleiben in der Netzwerk-Laufzeitumgebung der App; ' +
    'angezeigt werden nur Name, Geltungsbereich und Ablauf.',
  'workbench.editors.request.settings.jar.storedHeading': 'Gespeicherte Cookies',
  'workbench.editors.request.settings.jar.clear': 'Leeren',
  'workbench.editors.request.settings.jar.delete': '{name} löschen',
  'workbench.editors.request.settings.jar.expires': 'läuft ab {date}',
  'workbench.editors.request.settings.jar.session': 'Sitzung',
  'workbench.editors.request.settings.jar.httpsOnly': 'nur https',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Antwort',
  'workbench.editors.request.response.clear': 'Leeren',
  'workbench.editors.request.response.saveResponse': 'Antwort speichern',
  'workbench.editors.request.response.createWorkflow': 'Workflow erstellen',
  'workbench.editors.request.response.createWorkflowNew': 'Neuen Workflow erstellen',
  'workbench.editors.request.response.createWorkflowAttach': 'An bestehenden Workflow anhängen',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    'Speichere die Anfrage und verwende sie in einem Workflow',
  'workbench.editors.request.response.copyBody': 'Body kopieren',
  'workbench.editors.request.response.saveBodyToFile': 'Body in Datei speichern',
  'workbench.editors.request.response.saveBodyToFileTruncated':
    'Body in Datei speichern (gekürzt — speichert, was behalten wurde)',
  'workbench.editors.request.response.clearResponse': 'Antwort leeren',
  'workbench.editors.request.response.moreActionsAria': 'Weitere Antwort-Aktionen',
  'workbench.editors.request.response.copied': 'Kopiert',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Body',
  'workbench.editors.request.response.tab.headers': 'Header ({count})',
  'workbench.editors.request.response.tab.cookies': 'Cookies ({count})',
  'workbench.editors.request.response.tab.assertions': 'Assertions',
  'workbench.editors.request.response.tab.assertionsFailed': 'Assertions ({count} fehlgeschlagen)',
  'workbench.editors.request.response.tab.assertionsPassed': 'Assertions ({count} bestanden)',
  'workbench.editors.request.response.tab.console': 'Console ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Antwort-Metadaten',
  'workbench.editors.request.response.meta.timingTitle': 'Zeiten',
  'workbench.editors.request.response.meta.timingSummary': 'Gemessen rund um den fetch-Aufruf: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    'Die Plattform hat für diese Anfrage keinen resource-timing-Eintrag aufgezeichnet, es ist also keine ' +
    'Aufschlüsselung nach Phasen verfügbar.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'Netzwerk gesamt {duration}. Der Server hat dieser Origin-übergreifenden Anfrage keine Timing-Details ' +
    'offengelegt (kein Timing-Allow-Origin-Header), die Phasen DNS / Verbindung / TTFB / Download sind ' +
    'daher verborgen.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Umleitungen',
  'workbench.editors.request.response.meta.phase.stalled': 'Angehalten',
  'workbench.editors.request.response.meta.phase.dns': 'DNS-Lookup',
  'workbench.editors.request.response.meta.phase.connect': 'TCP-Verbindung',
  'workbench.editors.request.response.meta.phase.tls': 'TLS-Handshake',
  'workbench.editors.request.response.meta.phase.waiting': 'Warten (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Content-Download',
  'workbench.editors.request.response.meta.totalNetwork': 'Gesamt (Netzwerk)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS, Verbindung und TLS sind aus der Netzwerk-Laufzeitumgebung der App nicht pro Senden beobachtbar ' +
    '— sie sind in Warten enthalten.',
  'workbench.editors.request.response.meta.sizeTitle': 'Größe',
  'workbench.editors.request.response.meta.sizeSummary': 'Bytes in jede Richtung dieses Austauschs.',
  'workbench.editors.request.response.meta.responseSize': 'Antwortgröße',
  'workbench.editors.request.response.meta.requestSize': 'Anfragegröße',
  'workbench.editors.request.response.meta.rowHeaders': 'Header',
  'workbench.editors.request.response.meta.rowBody': 'Body',
  'workbench.editors.request.response.meta.rowCompressed': 'Komprimiert',
  'workbench.editors.request.response.meta.rowTransferred': 'Übertragen',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    'Header-Bytes wie sichtbar — HTTP/2+ komprimiert sie auf der Leitung.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Anfrage-Header zählen nur, was dieses Senden gesetzt hat; der Browser fügt seine eigenen hinzu ' +
    '(Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Body am Antwortgrößen-Limit von {cap} abgeschnitten; die volle Größe wird gezählt.',
  'workbench.editors.request.response.meta.noteTruncated': 'Body-Ansicht gekürzt; die volle Größe wird gezählt.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'Die Größe des Anfrage-Bodys ist ungefähr — die multipart-Boundary wird vom Browser generiert.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Größen auf der Leitung (komprimiert, übertragen) verborgen: Der Server hat kein Timing-Allow-Origin ' +
    'gesendet.',
  'workbench.editors.request.response.meta.networkTitle': 'Netzwerk',
  'workbench.editors.request.response.meta.networkSummary': 'Fakten auf Verbindungsebene zu diesem Austausch.',
  'workbench.editors.request.response.meta.httpVersion': 'HTTP-Version',
  'workbench.editors.request.response.meta.localAddress': 'Lokale Adresse',
  'workbench.editors.request.response.meta.remoteAddress': 'Remote-Adresse',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'HTTP-Version verborgen: Das ausgehandelte Protokoll war für dieses Senden nicht beobachtbar ' +
    '(Sendevorgänge über einen Proxy handeln im Tunnel aus).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'HTTP-Version verborgen: Die Plattform hat für diese Anfrage keinen Timing-Eintrag aufgezeichnet.',
  'workbench.editors.request.response.meta.noteNoIp':
    'Remote-Adresse nicht verfügbar: Die Erfassung auf der Leitung hat für diesen fetch nichts gesehen.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Lokale Adresse, TLS- und Zertifikatsdetails werden Erweiterungscode auf Chromium nicht offengelegt.',
  'workbench.editors.request.response.meta.tagUnverifiedTls': 'Ungeprüftes TLS',
  'workbench.editors.request.response.meta.unverifiedTlsTitle': 'SSL-Prüfung deaktiviert',
  'workbench.editors.request.response.meta.unverifiedTlsSummary':
    'Diese Anfrage wurde mit in ihren Einstellungen deaktivierter Zertifikatsprüfung gesendet. Die ' +
    'Verbindung war verschlüsselt, aber die Identität des Servers wurde nicht geprüft — jedes Zertifikat ' +
    'wurde akzeptiert, auch selbstsignierte und abgelaufene.',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'TLS-Untergrenze gesenkt',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'Diese Anfrage wurde mit einer TLS-Mindestversion unter 1.2 in ihren Einstellungen gesendet, die ' +
    'Verbindung durfte also TLS 1.0 oder 1.1 aushandeln — Protokollversionen mit bekannten Schwächen, die ' +
    'Laufzeitumgebungen standardmäßig deaktivieren.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization weitergegeben',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'Eine Umleitung führte diese Anfrage zu einem anderen Origin, und ihre Einstellungen behalten den ' +
    'Authorization-Header über Origins hinweg bei — die Anmeldedaten wurden also erneut an den neuen Host ' +
    'gesendet. Normalerweise wird der Header verworfen, wenn eine Umleitung den ursprünglichen Origin ' +
    'verlässt.',
  'workbench.editors.request.response.meta.executedOnTag': 'Gesendet von {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Auf dem verbundenen Back-end ausgeführt',
  'workbench.editors.request.response.meta.executedOnSummary':
    'Diese Anfrage hat „{name}“ gesendet — das Back-end, mit dem diese Oberfläche verbunden ist — nicht ' +
    'dieses Gerät. Der Zielserver sah die IP-Adresse und den Netzwerkstandort jener Maschine, geo- oder ' +
    'IP-basiertes Verhalten spiegelt also wider, wo das Back-end läuft. Aufgezeichnet bei diesem Lauf von ' +
    'dem Host, der ihn ausgeführt hat.',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'Diese Anfrage hat das In-Memory-Cookie-Glas des Arbeitsbereichs verwendet: Passende gespeicherte ' +
    'Cookies wurden automatisch angehängt, und Set-Cookie-Antworten wurden für spätere Sendevorgänge mit ' +
    'Glas behalten.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'An die erste Anfrage angehängt',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Nichts — kein gespeichertes Cookie passte, oder ein auf der Anfrage gesetzter Cookie-Header hat ' + 'gewonnen.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Aus Set-Cookie-Antworten gespeichert',
  'workbench.editors.request.response.meta.jarStoredNone': 'Nichts — keine Antwort hat ein Cookie gesetzt.',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Umleitung', other: '{count} Umleitungen' }),
  'workbench.editors.request.response.meta.redirectsTitle': 'Umleitungskette',
  'workbench.editors.request.response.meta.redirectsSummary':
    'Die Sprünge, denen diese Anfrage vor der endgültigen Antwort gefolgt ist — jeder zeigt die gesendete ' +
    'Anfrage und die Umleitung, mit der sie beantwortet wurde, aufgezeichnet beim Ausführen des Sendens.',
  'workbench.editors.request.response.meta.redirectMethodChanged':
    'Methode für die nächste Anfrage zu {method} geändert',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Authorization-Header verworfen — die nächste Anfrage wechselte zu einem anderen Origin',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Authorization-Header Origin-übergreifend erneut gesendet — von den Einstellungen dieser Anfrage ' + 'beibehalten',
  'workbench.editors.request.response.meta.redirectFinal': 'Endgültige Antwort',
  'workbench.editors.request.response.meta.streamedEnd': 'Stream beendet',
  'workbench.editors.request.response.meta.streamedStop': 'Gestoppt',
  'workbench.editors.request.response.meta.streamedCap': 'Stream gekappt',
  'workbench.editors.request.response.meta.streamedTimeout': 'Zeitüberschreitung mitten im Stream',
  'workbench.editors.request.response.meta.streamedError': 'Stream fehlgeschlagen',
  'workbench.editors.request.response.meta.streamedEndSummary':
    'Diese Antwort kam live als Stream herein, bis der Server den Stream geschlossen hat. Der Body unten ' +
    'ist die vollständige Erfassung.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    'Die Antwort streamte noch, als der Austausch endete, der Body unten ist also die teilweise Erfassung ' +
    'bis zu diesem Punkt — alles, was ankam, wurde behalten.',
  'workbench.editors.request.response.streamReceiving': 'Stream wird empfangen — {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': 'Verbunden mit {url}',
  'workbench.editors.request.response.sse.closed': 'Verbindung geschlossen',
  'workbench.editors.request.response.sse.stopped': 'Verbindung gestoppt',
  'workbench.editors.request.response.sse.capped': 'Erfassung gekappt — das Body-Limit wurde erreicht',
  'workbench.editors.request.response.sse.timedOut': 'Zeitüberschreitung der Verbindung',
  'workbench.editors.request.response.sse.failed': 'Verbindung fehlgeschlagen',
  'workbench.editors.request.response.sse.searchEvents': 'Ereignisse durchsuchen',
  'workbench.editors.request.response.sse.noMatches': 'Keine Ereignisse stimmen überein.',
  'workbench.editors.request.response.sse.waiting': 'Warten auf Ereignisse…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Ereignis', other: '{count} Ereignisse' }),
  'workbench.editors.request.response.sse.clearEvents': 'Ereignisse leeren (nur Anzeige)',
  'workbench.editors.request.response.sse.newEvents': 'Neue Ereignisse',
  'workbench.editors.request.response.sse.sortOrder': 'Sortierung',
  'workbench.editors.request.response.sse.newestFirst': 'Neueste zuerst',
  'workbench.editors.request.response.sse.oldestFirst': 'Älteste zuerst',
  'workbench.editors.request.response.sse.groupByName': 'Nach Ereignisnamen gruppieren',
  'workbench.editors.request.response.sse.rowsPerGroup': 'Zeilen pro Gruppe',
  'workbench.editors.request.response.sse.noLimit': 'Kein Limit',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'Größe',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': 'Ereignisdetails',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'Antwort bei {cap} abgeschnitten (ursprünglich {size}).',
  'workbench.editors.request.response.body.increaseLimit': 'Limit erhöhen',
  'workbench.editors.request.response.body.limitHint':
    'Das Limit lässt sich unter Einstellungen → API-Anfragen anpassen.',
  'workbench.editors.request.response.body.viewPickerAria': 'Body-Ansicht',
  'workbench.editors.request.response.body.preview': 'Vorschau',
  'workbench.editors.request.response.body.wrapLines': 'Zeilen umbrechen',
  'workbench.editors.request.response.body.unwrapLines': 'Zeilenumbruch aufheben',
  'workbench.editors.request.response.body.renderAnsi': 'ANSI-Farben darstellen',
  'workbench.editors.request.response.body.plainAnsi': 'Reinen Text anzeigen',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Body filtern (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Body filtern (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Body filtern (Metrik-Familien)',
  'workbench.editors.request.response.body.filterAria': 'Body filtern',
  'workbench.editors.request.response.body.invalidJsonPath': 'Ungültiger JSONPath-Ausdruck.',
  'workbench.editors.request.response.body.invalidXPath':
    'Ungültiger XPath-Ausdruck, oder das Dokument lässt sich nicht parsen.',
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Ungültiger Metrik-Selektor.',
  'workbench.editors.request.response.body.noMatches': 'Keine Treffer für diesen Pfad.',
  'workbench.editors.request.response.body.showingLastMatch': 'Der letzte Treffer wird angezeigt.',
  'workbench.editors.request.response.body.hexCapNotice': 'Die Hex-Ansicht zeigt die ersten {shown} von {total}.',
  'workbench.editors.request.response.body.previewIframeTitle': 'Antwortvorschau',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'PDF-Vorschau',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Antwortbild',
  'workbench.editors.request.response.body.imagePreviewFailed':
    'Die Bilddaten lassen sich nicht dekodieren — sieh dir die rohen Bytes in der Hex-Ansicht an.',
  'workbench.editors.request.response.body.mediaPreviewAria': 'Medienvorschau',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'Die Mediendaten lassen sich nicht dekodieren — sieh dir die rohen Bytes in der Hex-Ansicht an.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Anfrage-Body nicht gesendet — der Browser kann an GET- oder HEAD-Anfragen keinen Body anhängen.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Doppelte JSON-Schlüssel — der letzte Wert wird angezeigt: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Abgeschnittener Body — Vorschau und Filter zeigen nur die vollständig erfassten Werte.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    'Dekodierung ohne Schema (Best Effort) — Feldnummern werden angezeigt; Verschachtelung und Text ' +
    'werden aus den Bytes auf der Leitung abgeleitet.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Name',
  'workbench.editors.request.response.headers.value': 'Wert',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Header filtern',
  'workbench.editors.request.response.headers.copyAll': 'Alle Header kopieren',
  'workbench.editors.request.response.headers.copyAria': '{name} kopieren',
  'workbench.editors.request.response.headers.copyTitle': 'Header kopieren',
  'workbench.editors.request.response.headers.empty': 'Keine Header',
  'workbench.editors.request.response.headers.noMatch': 'Kein Header stimmt mit „{query}“ überein',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Name',
  'workbench.editors.request.response.cookies.value': 'Wert',
  'workbench.editors.request.response.cookies.copyAria': 'Set-Cookie für {name} kopieren',
  'workbench.editors.request.response.cookies.copyTitle': 'Set-Cookie-Zeile kopieren',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'Diese Anfrage lief mit eingeschlossenen Anmeldedaten, der Browser hat diese Cookies also ' +
    'möglicherweise gespeichert (abhängig von den Attributen jedes Cookies) und sendet sie bei künftigen ' +
    'Anfragen mit Anmeldedaten mit.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'Der Server hat diese Cookies gesendet, aber diese Anfrage lief mit weggelassenen Anmeldedaten (dem ' +
    'Standard), der Browser hat sie also verworfen — nichts wurde gespeichert.',
  'workbench.editors.request.response.cookies.noteJarOff':
    'Diese Cookies wurden nicht gespeichert — diese Anfrage lief ohne das Cookie-Glas (dem Standard), ' +
    'oder das Glas hat keines von ihnen angenommen.',
  'workbench.editors.request.response.cookies.noteJarStored':
    'Diese Anfrage lief mit aktiviertem Cookie-Glas, das {names} im In-Memory-Glas des Arbeitsbereichs ' +
    'für künftige Anfragen mit Glas gespeichert hat.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'Diese Anfrage lief mit aktiviertem Cookie-Glas, das {names} im In-Memory-Glas des Arbeitsbereichs ' +
    'für künftige Anfragen mit Glas gespeichert hat. Einige wurden auf zwischenliegenden ' +
    'Umleitungssprüngen gesetzt, ihre Set-Cookie-Zeilen stehen also nicht hier — nur die Header der ' +
    'endgültigen Antwort.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'BESTANDEN',
  'workbench.editors.request.response.assertions.fail': 'FEHLGESCHLAGEN',
  'workbench.editors.request.response.console.preRequest': 'Pre-Request',
  'workbench.editors.request.response.console.postResponse': 'Post-Response',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Anfrage wird gesendet…',
  'workbench.editors.request.response.empty.prompt': 'Sende die Anfrage, um hier die Antwort zu sehen.',
  'workbench.editors.request.response.error.title': 'Anfrage konnte nicht gesendet werden',
  'workbench.editors.request.response.error.openInTab': 'In neuem Tab öffnen',
  'workbench.editors.request.response.error.certSteps.summary':
    'Lokale Entwicklungsserver laufen meist mit einem selbstsignierten Zertifikat, das du akzeptieren ' + 'musst.',
  'workbench.editors.request.response.error.certSteps.step1': 'Öffne die URL in einem neuen Tab',
  'workbench.editors.request.response.error.certSteps.step2': 'Akzeptiere die Zertifikatswarnung',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': 'Erweitert → Weiter zu … (unsicher)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox':
    'Erweitert… → Risiko akzeptieren und fortfahren',
  'workbench.editors.request.response.error.certSteps.step3': 'Sende die Anfrage erneut',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': 'neuer Tab',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': 'Erweitert',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ Senden',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': 'Weiter zu … (unsicher)',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': 'Risiko akzeptieren und fortfahren',
} as const satisfies Catalog;
