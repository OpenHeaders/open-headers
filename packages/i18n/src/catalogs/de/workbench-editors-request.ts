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
  'workbench.editors.request.toast.invalidSetting':
    '{label} ist ungültig — korrigiere es in den Einstellungen, bevor du speicherst.',
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
  'workbench.editors.request.spec.selectLabel': 'OpenAPI-Spezifikation',
  'workbench.editors.request.spec.none': 'Mit dieser Anfrage ist keine OpenAPI-Spezifikation verknüpft.',
  'workbench.editors.request.spec.selectPlaceholder': 'OpenAPI-Spezifikation verknüpfen…',
  'workbench.editors.request.spec.inheritedPlaceholder': 'Aus der Sammlung geerbt: {name}',
  'workbench.editors.request.spec.fromCollection': 'Aus der Sammlung {name}',
  'workbench.editors.request.spec.missing': 'Die verknüpfte Spezifikation ist nicht mehr in diesem Arbeitsbereich.',
  'workbench.editors.request.spec.parseFailure': 'Spezifikation konnte nicht gelesen werden: {message}',
  'workbench.editors.request.spec.drifted': 'Die Spezifikation hat sich nach dem Erzeugen dieser Sammlung geändert.',
  'workbench.editors.request.spec.operation': 'Operation',
  'workbench.editors.request.spec.noOperation': 'Keine Operation der Spezifikation passt zu {method} {url}.',
  'workbench.editors.request.spec.inSync': 'Mit der Spezifikation synchron.',
  'workbench.editors.request.spec.fieldDiffers': 'Das Feld {field} weicht von der Spezifikation ab.',
  'workbench.editors.request.spec.apply': 'Übernehmen',
  'workbench.editors.request.spec.applyAll': 'Alle übernehmen',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'URL eingeben oder Text einfügen',
  'workbench.editors.request.url.socketCta':
    'URL im Socket-Stil — Sendevorgänge wählen {path} über die Unix-Socket-Einstellung an.',
  'workbench.editors.request.url.socketCtaApply': 'Übernehmen',
  'workbench.editors.request.method.customGroup': 'Benutzerdefiniert',
  'workbench.editors.request.method.usePrefix': 'Verwenden',
  'workbench.editors.request.method.forbiddenSuffix': 'lässt sich aus einem Browser nicht senden.',
  'workbench.editors.request.method.invalidHint': 'Methoden verwenden Buchstaben, Ziffern und Bindestriche (max. 32).',
  'workbench.editors.request.method.removeCustomAria': 'Benutzerdefinierte Methode {method} entfernen',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Zur Autorisierung gehen',
  'workbench.editors.request.goToBody': 'Zum Body gehen',
  'workbench.editors.request.headers.keyPlaceholder': 'Header',
  'workbench.editors.request.headers.hideAuto': 'Automatisch generierte Header ausblenden',
  'workbench.editors.request.headers.hiddenCount': '{count} ausgeblendet',
  'workbench.editors.request.headers.autoInfo':
    'Diese Header werden automatisch hinzugefügt und mit der Anfrage gesendet. Klicke auf das Info-Symbol ' +
    'einer Zeile für Details pro Header.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Dieser Header ist ein Duplikat und wird vom {header}-Header aus den Autorisierungseinstellungen überschrieben.',
  'workbench.editors.request.headers.calculated': '<wird beim Senden der Anfrage berechnet>',
  'workbench.editors.request.headers.browserUserAgent': '<User-Agent des Browsers>',
  'workbench.editors.request.headers.hint.cacheControl':
    '„Cache-Control: no-cache“ geht mit jedem Senden von einem Browser-Host hinaus, damit der Server bei wiederholten Anfragen nie aus einem veralteten Cache antwortet. Eigene Cache-Control-Zeile hinzufügen, um einen anderen Wert zu senden.',
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
  'workbench.editors.request.headers.hint.node.host':
    'Beim Senden aus der Ziel-URL abgeleitet. Eine eigene Host-Zeile ersetzt ihn auf der Leitung.',
  'workbench.editors.request.headers.hint.node.connection':
    'Die Node-Laufzeit hält Verbindungen offen und poolt sie je Origin. Eine eigene Connection-Zeile ersetzt sie.',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'Der Fetch-Client der Node-Laufzeit sendet einen Platzhalter. Eine eigene Zeile ersetzt ihn.',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    'Vom Fetch-Client der Node-Laufzeit bei jedem Senden gesetzt. Eine eigene Zeile ersetzt ihn.',
  'workbench.editors.request.headers.hint.node.userAgent':
    'Die Node-Laufzeit weist diese App bei jedem Senden aus. Eigene User-Agent-Zeile hinzufügen, um einen anderen zu senden.',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'Kompression, die die Node-Laufzeit annimmt und für Sie dekodiert. Eine eigene Zeile ersetzt sie — der Antwortkörper kommt dann so an, wie er gesendet wurde.',

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
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<signierte Parameter>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    'Aus dem Tab Autorisierung erzeugt (AWS Signature v4). Die X-Amz-*-Parameter werden beim Senden an die URL-Query angehängt.',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <signierte Parameter>',
  'workbench.editors.request.authPreview.edgeGridHint':
    'Aus dem Tab Autorisierung erzeugt (Akamai EdgeGrid). Die Anfrage wird beim Senden mit Ihren Anmeldedaten signiert.',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <signiertes JWT>',
  'workbench.editors.request.authPreview.asapHint':
    'Aus dem Tab Autorisierung erzeugt (ASAP). Beim Senden wird ein frisches Token mit Ihrem privaten Schlüssel signiert und diesem Header hinzugefügt.',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<abgedeckte Komponenten>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<Signatur>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    'Aus dem Tab Autorisierung erzeugt (HTTP-Nachrichtensignatur). Die Anfrage wird beim Senden mit deinem Schlüssel signiert.',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<Hash des Bodys>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    'Aus dem Tab Autorisierung erzeugt (HTTP-Nachrichtensignatur). Der Body-Hash wird beim Senden berechnet.',
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
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <signierte Parameter>',
  'workbench.editors.request.authPreview.hawkHint':
    'Aus dem Tab Autorisierung generiert (Hawk Authentication). Die Anfrage wird beim Senden mit deinen ' +
    'Anmeldedaten signiert.',
  'workbench.editors.request.authPreview.jwtValue': '<signiertes JWT>',
  'workbench.editors.request.authPreview.jwtHint':
    'Aus dem Tab Autorisierung generiert (JWT Bearer). Das Token wird beim Senden signiert und zu diesem ' +
    'Header hinzugefügt.',
  'workbench.editors.request.authPreview.jwtQueryHint':
    'Aus dem Tab Autorisierung generiert (JWT Bearer). Das Token wird beim Senden signiert und zu diesem ' +
    'Query-Parameter hinzugefügt.',
  'workbench.editors.request.authPreview.inheritedFrom': 'Geerbt von {source} — im übergeordneten Element bearbeiten.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Authentifizierungstyp',
  'workbench.editors.request.auth.group.credentials': 'Zugangsdaten',
  'workbench.editors.request.auth.group.token': 'Token',
  'workbench.editors.request.auth.group.signing': 'Signierung',
  'workbench.editors.request.auth.group.consumer': 'Consumer',
  'workbench.editors.request.auth.group.attributes': 'Attribute',
  'workbench.editors.request.auth.group.delivery': 'Übermittlung',
  'workbench.editors.request.auth.group.challenge': 'Challenge',
  'workbench.editors.request.auth.group.grant': 'Grant',
  'workbench.editors.request.auth.group.advanced': 'Erweitert',
  'workbench.editors.request.auth.group.coverage': 'Abdeckung',
  'workbench.editors.request.auth.group.parameters': 'Parameter',
  'workbench.editors.request.auth.typeInfo.none':
    'Nichts wird hinzugefügt \u2014 die Anfrage geht genau so hinaus, wie ihre Tabs Headers und Params es zeigen.',
  'workbench.editors.request.auth.typeInfo.basic':
    'Benutzername und Passwort werden mit einem Doppelpunkt verbunden, base64-kodiert und bei jedem Senden als Authorization: Basic-Header geschickt \u2014 kodiert, nicht verschlüsselt, also nur über HTTPS.',
  'workbench.editors.request.auth.typeInfo.bearer':
    'Das Token wird bei jedem Senden unverändert hinter dem Schema Bearer im Authorization-Header geschickt.',
  'workbench.editors.request.auth.typeInfo.apiKey':
    'Der Schlüssel benennt einen Header oder einen Query-Parameter, und der Wert reist darin \u2014 das einfache Zugangsdaten-Schema der meisten öffentlichen APIs.',
  'workbench.editors.request.auth.typeInfo.digest':
    'Das erste Senden holt die 401-Challenge des Servers (realm, nonce, qop); die Zugangsdaten werden damit in response= gehasht und die Anfrage wird wiederholt \u2014 das Passwort selbst reist nie.',
  'workbench.editors.request.auth.typeInfo.oauth1':
    'Die Consumer- und Token-Zugangsdaten signieren einen Basis-String aus Methode, URL und Parametern; die signierten oauth_*-Parameter reisen im Authorization-Header oder in der URL, Nonce, Zeitstempel und Version werden bei jedem Senden erzeugt.',
  'workbench.editors.request.auth.typeInfo.hawk':
    'Ein MAC über Methode, URL, Zeitstempel, Nonce und die optionalen Attribute reist in einem Authorization: Hawk-Header; Zeitstempel und Nonce werden bei jedem Senden erzeugt.',
  'workbench.editors.request.auth.typeInfo.jwt':
    'Bei jedem Senden wird aus dem Schlüsselmaterial hier ein frisches JWT erzeugt und signiert \u2014 Header, Payload und Signatur unten \u2014 und als Bearer-Token oder Query-Parameter übermittelt.',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    'Das Paar, das zur base64-Zugangsinformation wird \u2014 beide werden gesendet, kodiert, aber nicht verschlüsselt.',
  'workbench.editors.request.auth.groupInfo.bearer.token':
    'Das Token, wie der Server es ausgestellt hat; das Schema Bearer wird auf der Leitung vorangestellt.',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    'Der Name und das Geheimnis \u2014 der Name ist der Header oder Parameter, der Wert ist das, was darin reist.',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery':
    'Wo der Schlüssel landet: in einem Request-Header oder als Query-Parameter an der URL.',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    'Das Paar, aus dem die Challenge-Antwort berechnet wird \u2014 der Benutzername reist, das Passwort nur als Teil des Antwort-Hashes.',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    'Wie der 401-Schritt bei Desktop- und CLI-Sendungen behandelt wird \u2014 automatisch beantwortet und wiederholt, sofern nicht deaktiviert.',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    'Die Methode, die den Basis-String signiert \u2014 HMAC mit den Geheimnissen, RSA mit dem privaten Schlüssel oder PLAINTEXT \u2014 und ob der Body hineingehasht wird.',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    'Die Zugangsdaten der Anwendung \u2014 der Schlüssel reist als oauth_consumer_key, das Geheimnis (oder der private Schlüssel) nur über oauth_signature.',
  'workbench.editors.request.auth.groupInfo.oauth1.token':
    'Das Access-Token-Paar des Benutzers aus dem dreibeinigen Ablauf \u2014 für einbeinige Aufrufe beide leer lassen.',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'Wo die oauth_*-Parameter landen \u2014 im Authorization-Header (mit optionalem Realm) oder im Query-String der URL.',
  'workbench.editors.request.auth.groupInfo.hawk.credentials':
    'Die id reist im Header; der Schlüssel nur über den MAC, den er berechnet.',
  'workbench.editors.request.auth.groupInfo.hawk.signing':
    'Der Digest des MAC, und ob der Request-Body als hash= hineingehasht wird.',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    'Die optionalen Attribute des Schemas \u2014 Anwendungsdaten (ext), die Anwendungs-ID (app) und die delegierende (dlg) \u2014 signiert, wenn vorhanden.',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'Der im JWT-Header genannte Algorithmus und das Schlüsselmaterial, das signiert \u2014 ein gemeinsames Geheimnis für HS, ein privater Schlüssel für RS / PS / ES.',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'Was das JWT trägt \u2014 die Payload-Claims, zusätzliche geschützte Header und die optionale Lebensdauer als iat / exp.',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    'Wo das signierte JWT landet \u2014 im Authorization-Header hinter seinem Präfix oder als Query-Parameter token.',
  'workbench.editors.request.auth.rowInfo.basicUsername': 'Reist vor dem Doppelpunkt in der base64-Zugangsinformation.',
  'workbench.editors.request.auth.rowInfo.basicPassword':
    'Reist nach dem Doppelpunkt \u2014 kodiert, nie verschlüsselt, also nur über HTTPS.',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    'Wird unverändert hinter Bearer gesendet; ein eingefügtes \u201eBearer \u2026\u201c verliert hier sein Präfix.',
  'workbench.editors.request.auth.rowInfo.apiKeyKey':
    'Der Header-Name oder der Name des Query-Parameters, in dem der Wert reist.',
  'workbench.editors.request.auth.rowInfo.apiKeyValue':
    'Das Geheimnis, das als Wert des Headers oder des Parameters gesendet wird.',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    'Header setzt den Schlüssel auf die Anfrage; Query Params hängt ihn an die URL, wo er in Logs landet.',
  'workbench.editors.request.auth.rowInfo.digestUsername': 'Reist als username= in der Antwort auf die Challenge.',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    'Reist nie \u2014 es wird mit Realm, Nonce und Methode in response= gehasht.',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry':
    'Stoppt den automatischen zweiten Schritt: die 401 wird als Antwort zurückgegeben, statt beantwortet zu werden.',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    'Benennt den Signieralgorithmus in oauth_signature_method und wählt den Zugangsdaten-Satz unten.',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    'Hasht einen Nicht-Formular-Body mit dem Hash der Methode in oauth_body_hash, signiert mit dem Rest.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey':
    'Identifiziert die Anwendung \u2014 reist als oauth_consumer_key.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    'Signiert die Anfrage zusammen mit dem Token-Geheimnis; es reist nie, nur oauth_signature.',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'Der PEM-Schlüssel, der den Basis-String für die RSA-Methoden signiert \u2014 nur die Signatur reist.',
  'workbench.editors.request.auth.rowInfo.oauth1Token':
    'Das Access-Token des Benutzers, gesendet als oauth_token; leer für einbeinige Aufrufe.',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    'Die zweite Hälfte des Signierschlüssels; es reist nie, nur oauth_signature.',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    'Header trägt die oauth_*-Parameter im Authorization-Header; Query Params hängt sie an die URL.',
  'workbench.editors.request.auth.rowInfo.oauth1Realm':
    'Wird als realm= am Anfang des Headers wiederholt und benennt den Schutzbereich.',
  'workbench.editors.request.auth.rowInfo.hawkAuthId': 'Identifiziert die Zugangsdaten \u2014 reist als id= im Header.',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey': 'Das gemeinsame Geheimnis, das mac= berechnet; es reist nie.',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm':
    'Der HMAC-Digest, den der MAC und der Payload-Hash verwenden.',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash':
    'Hasht den Body und seinen Content-Type in hash= und bindet die Payload an die Signatur.',
  'workbench.editors.request.auth.rowInfo.hawkExt':
    'Anwendungsspezifische Daten \u2014 reisen als ext= und werden signiert.',
  'workbench.editors.request.auth.rowInfo.hawkApp': 'Die Anwendungs-ID \u2014 reist als app= und wird signiert.',
  'workbench.editors.request.auth.rowInfo.hawkDlg':
    'Die delegierende Anwendungs-ID \u2014 reist als dlg= nach app= und wird signiert.',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm':
    'Wird als alg in den geschützten Header geschrieben und wählt das Schlüsselfeld unten.',
  'workbench.editors.request.auth.rowInfo.jwtSecret':
    'Das gemeinsame HMAC-Geheimnis, das die Signatur erzeugt; es reist nie.',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64':
    'Dekodiert das Geheimnis vor dem Signieren aus base64, für so ausgestellte Geheimnisse.',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey':
    'Der private PEM-Schlüssel, der die Signatur für RS / PS / ES erzeugt; nur die Signatur reist.',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'Die Claims als JSON \u2014 Vorlagen werden bei jedem Senden aufgelöst; ein hier gesetztes iat oder exp gewinnt über die Lebensdauer.',
  'workbench.editors.request.auth.rowInfo.jwtHeaders':
    'Zusätzliche geschützte Header als JSON (kid ist der übliche); alg und typ werden automatisch ergänzt.',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn':
    'Stempelt iat und exp beim Signieren in die Payload, damit jedes Senden eine frische Lebensdauer trägt.',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    'Header sendet das JWT im Authorization-Header; Query Params hängt es als token= an die URL.',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'Das Schema vor dem JWT im Authorization-Header \u2014 standardmäßig Bearer; leer sendet das nackte Token.',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    'Der Secret Key signiert Methode, Pfad, Query, Header und den Payload-Hash; die Signatur reist in einem Authorization: AWS4-HMAC-SHA256-Header mit X-Amz-Date oder als X-Amz-*-Query-Parameter \u2014 nichts Geheimes reist mit.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    'Der Access Key reist in Credential=, der Secret Key nur über die Signatur, die er berechnet; das Session Token reist als X-Amz-Security-Token für temporäre Anmeldedaten.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    'Der Credential Scope, aus dem der Signierschlüssel abgeleitet wird \u2014 Dienst und Region; bleibt eines leer, wird es aus einem AWS-Hostnamen abgeleitet (die Region fällt auf us-east-1 zurück).',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    'Wo die Signatur landet \u2014 der Authorization-Header mit X-Amz-Date oder X-Amz-*-Query-Parameter für Endpunkte, die keinen Header annehmen.',
  'workbench.editors.request.auth.rowInfo.awsAccessKey':
    'Identifiziert das Schlüsselpaar \u2014 reist in Credential= vor dem Scope.',
  'workbench.editors.request.auth.rowInfo.awsSecretKey':
    'Das Schlüsselmaterial, aus dem der Signierschlüssel abgeleitet wird; es reist nie mit.',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'Das STS-Session-Token \u2014 reist als X-Amz-Security-Token, signiert, nur für temporäre Anmeldedaten.',
  'workbench.editors.request.auth.rowInfo.awsService':
    'Der Dienst im Credential Scope (s3, execute-api, \u2026); leer wird er aus einem AWS-Hostnamen abgeleitet. s3 signiert zusätzlich den Payload-Hash als Header.',
  'workbench.editors.request.auth.rowInfo.awsRegion':
    'Die Region im Credential Scope; leer wird sie aus einem AWS-Hostnamen abgeleitet, sonst us-east-1.',
  'workbench.editors.request.auth.rowInfo.awsAddTo':
    'Ein Header (Standard) oder die URL-Query \u2014 die vorsignierte Form für Endpunkte, die keinen Header annehmen.',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    'Das Client Secret signiert Methode, Schema, Host, Pfad, die gelisteten Header und einen Hash des POST-Bodys; die Tokens, ein Zeitstempel und eine Nonce pro Sendung sowie die Signatur reisen in einem Authorization: EG1-HMAC-SHA256-Header \u2014 das Secret reist nie mit.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    'Die beiden Tokens reisen im Header als client_token= und access_token=; das Client Secret nur über die Signatur, die es ableitet.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    'Was die Signatur über die Anfragezeile hinaus abdeckt \u2014 die Header, die eine API benennt, in dieser Reihenfolge, und den POST-Body-Hash, begrenzt durch das Byte-Fenster (128 KiB des Schemas, sofern die API nichts anderes sagt).',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken':
    'Identifiziert den API-Client \u2014 reist als client_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken':
    'Identifiziert die Anmeldedaten \u2014 reist als access_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret':
    'Das Schlüsselmaterial, aus dem der Signierschlüssel pro Sendung abgeleitet wird; es reist nie mit.',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    'Header-Namen, die in die Signatur eingehen, kommagetrennt, in Signierreihenfolge; ein gelisteter Header, den die Anfrage nicht trägt, wird übersprungen, ungelistete werden nie signiert.',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    'Das Byte-Fenster eines POST-Bodys, das der Content-Hash abdeckt; leer = die 131072 des Schemas.',
  'workbench.editors.request.auth.typeInfo.asap':
    'Pro Sendung wird ein frisches JWT geprägt \u2014 Aussteller, Audience und Subject als Claims, iat / exp von der Uhr, eine eindeutige jti-Nonce \u2014 mit dem privaten Schlüssel unter dem kid-Header signiert und als Bearer-Token geliefert; der Schlüssel reist nie mit.',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'Die im JWT-Header genannte asymmetrische Familie, die Key ID, über die der Empfänger den öffentlichen Schlüssel findet, und der private Schlüssel, der signiert.',
  'workbench.editors.request.auth.groupInfo.asap.token':
    'Was das Token behauptet \u2014 wer es ausgestellt hat, für wen, in wessen Namen, zusätzliche Claims und wie lange es lebt (standardmäßig die Stundengrenze des Schemas).',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm':
    'Benennt die Signierfamilie im Header; HS erlaubt das Schema nicht.',
  'workbench.editors.request.auth.rowInfo.asapKeyId':
    'Reist als kid \u2014 aussteller/schlüsselname nach dem Layout des Schemas; der Empfänger holt darüber den öffentlichen Schlüssel.',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    'Das PEM (oder Atlassians data:application/pkcs8-Form), das signiert; es reist nie mit.',
  'workbench.editors.request.auth.rowInfo.asapIssuer': 'Die registrierte Dienstkennung \u2014 reist als iss.',
  'workbench.editors.request.auth.rowInfo.asapAudience':
    'Für wen das Token ist \u2014 reist als aud; ein Array über zusätzliche Claims.',
  'workbench.editors.request.auth.rowInfo.asapSubject':
    'In wessen Namen \u2014 reist als sub; leer sendet den Aussteller.',
  'workbench.editors.request.auth.rowInfo.asapClaims':
    'Zusätzliche Claims, zuletzt gemischt \u2014 sie gewinnen über jeden zusammengesetzten Claim, jti / iat / exp eingeschlossen.',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn':
    'Die als exp \u2212 iat gestempelte Lebensdauer; leer = 3600, die Grenze des Schemas.',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    'Die Anfrage wird beim Senden signiert (RFC 9421): Aus den abgedeckten Komponenten — Methode, Ziel, benannte Header, ein Content-Digest des Bodys — plus den Signaturparametern entsteht eine Signaturbasis, die mit dem Schlüssel signiert und als Signature-Input und Signature gesendet wird; der Schlüssel selbst wird nie gesendet.',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    'Der registrierte Algorithmus, die Schlüssel-ID, über die der Prüfer den Schlüssel findet, und der signierende Schlüssel — ein privater PEM-Schlüssel oder das gemeinsame Geheimnis bei hmac-sha256.',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    'Was die Signatur abdeckt: die Komponenten in Signierreihenfolge — abgeleitete wie @method und @target-uri, Header nach Namen — und ob ein Content-Digest des Bodys erzeugt wird, damit er abgedeckt werden kann.',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    'Die @signature-params-Metadaten: das Label beider Header, die Zeitpunkte created / expires, eine Nonce pro Sendung, der alg-Parameter, ein Anwendungs-Tag.',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    'Einer der sechs registrierten Algorithmen; der Prüfer muss den passenden Schlüssel besitzen. rsa-pss-sha512 führt die Beispiele der RFC an.',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    'Wird als keyid gesendet — der Prüfer holt darüber den öffentlichen Schlüssel (oder das Geheimnis). Leer lässt den Parameter weg.',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey':
    'Das signierende PEM — PKCS#8, PKCS#1 oder SEC1; es wird nie gesendet.',
  'workbench.editors.request.auth.rowInfo.httpSigSecret':
    'Das mit dem Prüfer geteilte Geheimnis — der HMAC-Schlüssel; es wird nie gesendet.',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64':
    'Das Geheimnis ist base64-Text — wird vor dem Signieren zu rohen Schlüsselbytes dekodiert.',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    'Durch Leerzeichen getrennt, in Signierreihenfolge: @method, @target-uri, @authority, @scheme, @request-target, @path, @query und Header-Namen. Ein abgedeckter Header, den die Anfrage nicht trägt, lässt das Senden fehlschlagen.',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    'Erzeugt Content-Digest über die Body-Bytes (RFC 9530), damit content-digest abgedeckt werden kann; eine Sendung ohne Body hasht den leeren Inhalt. Multipart-Bodys können nicht gehasht werden.',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'Der Wörterbuchschlüssel, unter dem Signature-Input und Signature diese Signatur tragen; leer = sig1.',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    'Schreibt created = den Signierzeitpunkt; Prüfer lehnen darüber veraltete Signaturen ab. Aus lässt den Parameter weg (und expires mit ihm).',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn':
    'Schreibt expires = created + diese Sekunden; leer schreibt keinen Ablauf.',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    'Schreibt pro Sendung eine frische zufällige Nonce — der Replay-Schutz für Prüfer, die sie nachhalten.',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    'Schreibt alg mit dem Algorithmus; aus überlässt es dem Schlüssel, den der Prüfer auflöst (der Standard der RFC).',
  'workbench.editors.request.auth.rowInfo.httpSigTag':
    'Ein anwendungsspezifischer tag-Parameter, damit der Prüfer Signaturen unterscheiden kann; leer lässt ihn weg.',
  'workbench.editors.request.auth.typeInfo.oauth2':
    'Der Client holt ein Access-Token beim Anbieter \u2014 eine Browser-Autorisierung und dann ein Token-Austausch, oder ein direkter Austausch für Maschinen- und Passwort-Grants \u2014 und jedes Senden trägt es als Bearer-Token, bei Ablauf erneuert, wenn ein Refresh-Token ausgestellt wurde.',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    'Das Token, das diese Konfiguration gerade hält \u2014 was das Senden hinter Bearer trägt, und ob es sich selbst erneuert.',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    'Wie ein neues Token beschafft wird \u2014 der Grant, die Endpunkte des Anbieters, die Identität des Clients und was angefragt wird.',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced':
    'Der Refresh-Schritt und die zusätzlichen Parameter jeder der drei Anfragen an den Anbieter.',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    'Das JWT, das diese Konfiguration ausstellt — als Client-Assertion bei jeder Token-Anfrage oder als der JWT-Bearer-Grant selbst.',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    'Das Access-Token, das der letzte Ablauf gespeichert hat \u2014 bei jedem Senden hinter Bearer geschickt; leer, bis ein Ablauf läuft.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP (RFC 9449) bindet das Token an ein beim Austausch erzeugtes Schlüsselpaar: jede Token-Anfrage und jeder Versand trägt einen für Methode und URL dieser Anfrage signierten Nachweis, der Anbieter stellt das Token als DPoP aus und es wird unter diesem Schema gesendet — Header-Präfix und URL-Modus treten zurück. Der Schlüssel bleibt beim gespeicherten Token, nie in der Konfiguration.',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    'Die Signaturfamilie des Nachweises — das Schlüsselpaar wird passend erzeugt. ES256 akzeptiert jede DPoP-Installation.',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'Das Schema vor dem Token im Authorization-Header — leer wird der vom Anbieter ausgestellte token_type gesendet (standardmäßig Bearer); gesetzt gewinnt er auf der Leitung.',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    'Ein abgelaufenes Access-Token wird vor dem Senden erneuert — mit dem Refresh-Token, wenn der Anbieter eines ausgestellt hat, oder durch erneutes Ausführen eines Grants ohne Browser.',
  'workbench.editors.request.auth.rowInfo.oauth2Status':
    'Wie lange das gespeicherte Token gültig bleibt; Erneuern tauscht es jetzt, Trennen vergisst es.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName':
    'Eine Bezeichnung für dieses Token in der App \u2014 nichts auf der Leitung.',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    'Der grant_type des Token-Austauschs und die Schritte davor — eine Browser-Autorisierung bei Code-Grants, keine bei Client-, Passwort- oder JWT-Bearer-Zugangsdaten.',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    'Die redirect_uri, an die der Anbieter den Browser mit dem Code zurückschickt \u2014 beim Anbieter registrieren.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl':
    'Der Autorisierungs-Endpunkt des Anbieters, an den der Browser zuerst geschickt wird.',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    'Der Geräteautorisierungs-Endpunkt des Anbieters (RFC 8628) — liefert den Benutzercode und die Verifizierungs-URL, die Sie auf einem beliebigen Gerät freigeben, während dieser Host den Token-Endpunkt abfragt.',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    'Die Issuer-Kennung des Anbieters oder seine /.well-known/-Metadaten-URL. Ermitteln liest das Metadaten-Dokument (RFC 8414 / OpenID Connect Discovery), füllt die Endpunkt-Zeilen darunter aus und listet auf, was das Dokument zu Ihren Einstellungen sagt — sonst ändert sich nichts, und die Zeilen bleiben danach Ihre.',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl':
    'Der Token-Endpunkt des Anbieters, an dem der Code (oder die Zugangsdaten) getauscht wird.',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    'Der Benutzername des Ressourceninhabers, im Body der Token-Anfrage gesendet \u2014 nur beim Passwort-Grant.',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    'Das Passwort des Ressourceninhabers, im Body der Token-Anfrage gesendet \u2014 nur beim Passwort-Grant.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId':
    'Identifiziert die Anwendung \u2014 auf der Autorisierungs-URL und in der Token-Anfrage.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    'Authentifiziert die Anwendung am Token-Endpunkt \u2014 im Body oder als Basic-Header gemäß Client-Authentifizierung.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE: die code_challenge auf der Autorisierungs-URL ist der S256-Digest eines pro Ablauf erzeugten Verifiers.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    'Pro Ablauf erzeugt und als code_verifier im Token-Austausch gesendet, um zu belegen, dass derselbe Client ihn gestartet hat.',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    'Die angefragten Scopes \u2014 leerzeichengetrennt als scope auf der Autorisierungs-URL oder in der Token-Anfrage gesendet.',
  'workbench.editors.request.auth.rowInfo.oauth2State':
    'Pro Ablauf erzeugt und vom Anbieter zurückgegeben, damit der Rücksprung dieser Autorisierung zugeordnet wird.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    'Wie sich der Client in der Token-Anfrage ausweist — die Zugangsdaten im Formular-Body oder als Authorization: Basic-Header, oder ein signiertes client_assertion anstelle des Secrets.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    'Der iss-Claim der Grant-Assertion — das beim Anbieter registrierte Dienstkonto oder der Consumer-Key.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    'Der optionale sub-Claim — der Nutzer, in dessen Namen das Token handelt (Delegation, Impersonation); leer sendet keinen.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    'Zusätzliche Claims, die in die Grant-Assertion gemischt werden und die zusammengesetzten überschreiben — Anbieter-Claims oder ein eigener scope.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    'Die JWS-Familie, mit der die Assertion signiert wird — asymmetrisch für den privaten Schlüssel, HS256/384/512 für das Client-Secret.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId':
    'Der kid-Header, der den registrierten Schlüssel benennt, damit der Anbieter die richtige öffentliche Hälfte wählt.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    'Der Signaturschlüssel — PEM, rohes DER oder die Form data:application/pkcs8; wird nie exportiert.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'Der aud-Claim — leer sendet die Access-Token-URL; FAPI und Keycloak erwarten stattdessen die Issuer-Kennung.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    'exp minus iat, beim Signieren gestempelt — standardmäßig 300 Sekunden; der Anbieter kann deckeln (Google: eine Stunde).',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    'Zusätzliches JSON geschützter Header, das in die Assertion gemischt wird — Azures x5t#S256-Zertifikatsfingerabdruck.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl':
    'Der Endpunkt, an den der Refresh-Austausch postet \u2014 leer bedeutet die Access-Token-URL.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest':
    'Zusätzliche Parameter an der Autorisierungs-URL (audience, prompt, \u2026).',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    'Zusätzliche Parameter der Token-Anfrage \u2014 jeder reist gemäß seinem Senden in im Formular-Body, einem Header oder der URL.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    'Zusätzliche Parameter der Refresh-Anfrage \u2014 jeder reist gemäß seinem Senden in im Formular-Body, einem Header oder der URL.',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    'Request-Header sendet das Token hinter Bearer im Authorization-Header; Request-URL hängt es als access_token an \u2014 veraltet, nur für alte Anbieter.',
  'workbench.editors.request.auth.type.inherit': 'Authentifizierung vom übergeordneten Element erben',
  'workbench.editors.request.auth.type.none': 'Keine Authentifizierung',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'HTTP-Nachrichtensignatur',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1Token': 'Zugriffstoken',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'optional — leer für One-Legged-Aufrufe',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'optional — leer für One-Legged-Aufrufe',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Signaturmethode',
  'workbench.editors.request.auth.oauth1PrivateKey': 'Privater Schlüssel',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} oder PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': 'Body-Hash einbeziehen',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'optional',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAlgorithm': 'Algorithmus',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': 'optional — anwendungsspezifische Daten',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': 'optional — Anwendungs-ID',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': 'optional — ID der delegierenden Anwendung',
  'workbench.editors.request.auth.hawkIncludePayloadHash': 'Payload-Hash einbeziehen',
  'workbench.editors.request.auth.jwtAddTo': 'JWT-Token hinzufügen zu',
  'workbench.editors.request.auth.jwtAlgorithm': 'Algorithmus',
  'workbench.editors.request.auth.jwtSecret': 'Secret',
  'workbench.editors.request.auth.jwtSecretPlaceholder': 'Secret',
  'workbench.editors.request.auth.jwtSecretBase64': 'Secret ist Base64-codiert',
  'workbench.editors.request.auth.jwtPrivateKey': 'Privater Schlüssel',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} oder PEM',
  'workbench.editors.request.auth.jwtPayload': 'Payload',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'JWT-Header',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': 'Algorithmusspezifische Header werden automatisch hinzugefügt.',
  'workbench.editors.request.auth.jwtHeaderPrefix': 'Präfix des Request-Headers',
  'workbench.editors.request.auth.jwtExpiresIn': 'Gültig für (Sekunden)',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': 'optional',
  'workbench.editors.request.auth.jwtExpiresInNote':
    'Wenn gesetzt, werden iat und exp beim Senden in die Payload gestempelt. In der Payload gesetzte Claims gewinnen.',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth beantwortet die Challenge des Servers mit einer zweiten Anfrage, die in der Desktop-App ' +
    'und der CLI läuft. Sendevorgänge von dieser Oberfläche gehen ohne sie hinaus — der Server antwortet ' +
    'mit 401.',
  'workbench.editors.request.auth.digestRetryNote':
    'Standardmäßig wird die 401-Challenge beantwortet und die Anfrage automatisch erneut gesendet. Möchtest du das deaktivieren?',
  'workbench.editors.request.auth.digestDisableRetry': 'Ja, erneutes Senden der Anfrage deaktivieren',
  'workbench.editors.request.auth.authAutoGeneratedNote':
    'Der Autorisierungs-Header wird beim Senden der Anfrage automatisch erzeugt.',
  'workbench.editors.request.auth.inheritNote':
    'Der Autorisierungs-Header wird beim Senden der Anfrage automatisch erzeugt.',
  'workbench.editors.request.auth.noneNote': 'Diese Anfrage verwendet keine Autorisierung.',
  'workbench.editors.request.auth.inheritDetail':
    'Diese Anfrage verwendet den Autorisierungshelfer ihrer übergeordneten Sammlung. Bearbeite den Tab ' +
    'Autorisierung der Sammlung, um ihn zu ändern.',
  'workbench.editors.request.auth.inheritedNone':
    'Keine Autorisierung — weder im Ordner noch in der Sammlung ist etwas festgelegt.',
  'workbench.editors.request.auth.sourceCollection': 'Sammlung „{name}“',
  'workbench.editors.request.auth.sourceFolder': 'Ordner „{name}“',
  'workbench.editors.request.auth.groupInherited': 'Geerbt',
  'workbench.editors.request.auth.refusalQualifier.inQuery': 'in der Abfrage',
  'workbench.editors.request.auth.refusalQualifier.inHeader': 'im Header',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': 'an einen DPoP-Schlüssel gebunden',
  'workbench.editors.request.auth.groupOwn': 'Diese Anfrage',
  'workbench.editors.request.auth.optionMissingEntry': 'Fehlender Eintrag',
  'workbench.editors.request.auth.danglingPick':
    'Der von dieser Anfrage gewählte Eintrag existiert nicht mehr — stattdessen gilt der nächstgelegene Standard.',
  'workbench.editors.request.auth.editInParent': 'Im übergeordneten Element bearbeiten',
  'workbench.editors.request.auth.resetToInheritedAuth': 'Auf geerbte Autorisierung zurücksetzen',
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
  'workbench.editors.request.auth.awsServicePlaceholder': 'automatisch aus einem AWS-Host \u2014 z. B. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'automatisch aus einem AWS-Host, sonst us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Client Token',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Access Token',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Client Secret',
  'workbench.editors.request.auth.edgeGridHeadersToSign': 'Zu signierende Header',
  'workbench.editors.request.auth.edgeGridMaxBodySize': 'Max. Body-Größe',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': 'z. B. akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': 'z. B. akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'Client Secret',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder':
    'optional \u2014 kommagetrennt, z. B. X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': 'Algorithmus',
  'workbench.editors.request.auth.asapKeyId': 'Key ID',
  'workbench.editors.request.auth.asapPrivateKey': 'Privater Schlüssel',
  'workbench.editors.request.auth.asapIssuer': 'Aussteller',
  'workbench.editors.request.auth.asapAudience': 'Audience',
  'workbench.editors.request.auth.asapSubject': 'Subject',
  'workbench.editors.request.auth.asapClaims': 'Zusätzliche Claims',
  'workbench.editors.request.auth.asapExpiresIn': 'Ablauf (Sekunden)',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': 'z. B. my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- \u2026 oder die data:application/pkcs8-Form',
  'workbench.editors.request.auth.asapIssuerPlaceholder': 'z. B. my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': 'z. B. api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': 'optional \u2014 leer sendet den Aussteller',
  'workbench.editors.request.auth.asapClaimsPlaceholder': 'optional \u2014 JSON, z. B. {"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': 'Algorithmus',
  'workbench.editors.request.auth.httpSigKeyId': 'Schlüssel-ID',
  'workbench.editors.request.auth.httpSigPrivateKey': 'Privater Schlüssel',
  'workbench.editors.request.auth.httpSigSecret': 'Gemeinsames Geheimnis',
  'workbench.editors.request.auth.httpSigSecretBase64': 'Geheimnis ist base64-kodiert',
  'workbench.editors.request.auth.httpSigComponents': 'Abgedeckte Komponenten',
  'workbench.editors.request.auth.httpSigContentDigest': 'Content Digest',
  'workbench.editors.request.auth.httpSigDigestNone': 'Keiner',
  'workbench.editors.request.auth.httpSigLabel': 'Label',
  'workbench.editors.request.auth.httpSigCreated': 'Zeitstempel created',
  'workbench.editors.request.auth.httpSigExpiresIn': 'Läuft ab nach (Sekunden)',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': 'Algorithmus-Parameter (alg)',
  'workbench.editors.request.auth.httpSigTag': 'Tag',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': 'z. B. my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': 'das mit dem Prüfer geteilte Geheimnis',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': 'optional — z. B. 300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': 'optional — ein Anwendungs-Tag',
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
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': 'Noch kein Token — nutze unten Neuen Zugriffstoken abrufen',
  'workbench.editors.request.oauth.headerPrefix': 'Header-Präfix',
  'workbench.editors.request.oauth.tokenBinding': 'Token-Bindung',
  'workbench.editors.request.oauth.tokenBindingNone': 'Keine (Bearer)',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': 'Nachweis-Algorithmus',
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
  'workbench.editors.request.oauth.noTokenNote':
    'Noch kein Token — führen Sie unten einen Flow aus, um eines zu erhalten. Für ein außerhalb ausgestelltes Token nutzen Sie stattdessen Bearer-Token-Auth.',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    'Die Anmeldung öffnet sich in Ihrem Standardbrowser — er hält Ihre Anbieter-Sitzung, Ihren Passwort-Manager und Ihre Passkeys, und Identitätsanbieter blockieren in Apps eingebettete Anmeldungen (RFC 8252).',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    'Der Anbieter schickt den Browser zurück an die Callback-URL auf dem Backend-Port der App — eine Portänderung in den Einstellungen ändert die zu registrierende URL.',
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
    'Wie sich der Client bei Token-POSTs ausweist — ID und Secret im Body oder als Basic-Header, oder ein JWT, signiert mit einem privaten Schlüssel (private_key_jwt) oder dem Secret (client_secret_jwt).',
  'workbench.editors.request.oauth.clientAuthBody': 'Client-Anmeldedaten im Body senden',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Als Basic-Auth-Header senden',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': 'Signiertes JWT senden (private_key_jwt)',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': 'HMAC-JWT senden (client_secret_jwt)',
  'workbench.editors.request.oauth.assertionIssuer': 'Aussteller',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': 'z. B. service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': 'Subjekt',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder':
    'optional — der Nutzer, in dessen Namen das Token handelt',
  'workbench.editors.request.oauth.assertionClaims': 'Zusätzliche Claims',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder': 'optional — JSON, z. B. {"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': 'Algorithmus',
  'workbench.editors.request.oauth.assertionKeyId': 'Schlüssel-ID',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': 'optional — der kid-Header, z. B. key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': 'Privater Schlüssel',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … (PEM oder die Form data:application/pkcs8)',
  'workbench.editors.request.oauth.assertionAudience': 'Audience',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': 'leer = die Access-Token-URL',
  'workbench.editors.request.oauth.assertionLifetime': 'Gültigkeit (Sekunden)',
  'workbench.editors.request.oauth.assertionHeaders': 'Zusätzliche Header',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': 'optional — JSON, z. B. {"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro': 'Hier kannst du deine OAuth2-Anfragen genauer anpassen.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Mehr über die Konfiguration erfahren',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh-Token-URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'Die meisten Anbieter verwenden die Zugriffstoken-URL auch zum Erneuern; gib nur dann eine eigene an, ' +
    'wenn der Anbieter einen eigenen Pfad bereitstellt.',
  'workbench.editors.request.oauth.sendInColumn': 'Senden in',
  'workbench.editors.request.oauth.sendInBody': 'Body',
  'workbench.editors.request.oauth.sendInHeader': 'Header',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
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
  'workbench.editors.request.oauth.deviceAuthUrl': 'Geräteautorisierungs-URL',
  'workbench.editors.request.oauth.deviceWaitingTitle': 'Warten auf Ihre Freigabe auf {host}',
  'workbench.editors.request.oauth.deviceWaitingDesc':
    'Öffnen Sie den Link auf einem beliebigen Gerät, geben Sie den Code ein und bestätigen Sie. Diese Seite aktualisiert sich von selbst.',
  'workbench.editors.request.oauth.deviceCode': 'Code',
  'workbench.editors.request.oauth.deviceOpen': 'Öffnen',
  'workbench.editors.request.oauth.deviceCancel': 'Abbrechen',
  'workbench.editors.request.oauth.deviceExpiresIn': 'Läuft ab in {duration}',
  'workbench.editors.request.oauth.deviceCheckEvery': 'Prüfung alle {seconds} s',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth: auf {host} mit dem Code {code} freigeben',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth: Geräteautorisierung freigegeben',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth: die Autorisierung wurde abgelehnt — {error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth: der Gerätecode ist abgelaufen — {error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'OAuth-Geräteautorisierung fehlgeschlagen: {error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth: Geräteautorisierung abgebrochen',
  'workbench.editors.request.oauth.toast.codeCopied': 'Code kopiert',
  'workbench.editors.request.oauth.issuerUrl': 'Issuer-URL',
  'workbench.editors.request.oauth.issuerUrlPlaceholder':
    'https://accounts.example.com — oder die /.well-known/…-Metadaten-URL',
  'workbench.editors.request.oauth.discover': 'Ermitteln',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth: Endpunkte ermittelt',
  'workbench.editors.request.oauth.toast.discoveryFailed': 'Ermittlung fehlgeschlagen: {error}',
  'workbench.editors.request.oauth.discoveryTitle': 'Ermittelt von {url}',
  'workbench.editors.request.oauth.discoveryFilled': 'Ausgefüllt: {rows}',
  'workbench.editors.request.oauth.discoveryFilledNone': 'Das Dokument nennt keinen Endpunkt — nichts ausgefüllt',
  'workbench.editors.request.oauth.discoveryListed': '{pick} steht in der Liste des Anbieters',
  'workbench.editors.request.oauth.discoveryUnlisted':
    '{pick} steht nicht in der Liste — der Anbieter nennt {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': 'Die Client-Authentifizierung {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': 'Der Grant {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'Der DPoP-Algorithmus {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': 'Der Assertion-Algorithmus {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    'Die Issuer-Kennung ist {issuer} — manche Anbieter erwarten sie als Audience der Assertion statt der Access-Token-URL',
  'workbench.editors.request.oauth.discoveryScopes':
    'Angebotene Scopes: {supported} — in der Zeile Scope vorgeschlagen',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'Diese Anfrage hat keinen Body',
  'workbench.editors.request.body.modeNoneInfo':
    'Die Anfrage wird ohne Nutzlast gesendet — keine Body-Bytes und kein Content-Type-Header.',
  'workbench.editors.request.body.modeFormDataInfo':
    'Sendet die Teile als eine multipart/form-data-Nutzlast — jede Zeile ist ein Textfeld oder eine Datei.',
  'workbench.editors.request.body.modeFormDataDescription':
    'Der Content-Type mit Boundary wird beim Senden erzeugt; ein von Hand gesetzter multipart-Content-Type ' +
    'wird ersetzt, damit die Boundary immer zur Nutzlast passt.',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    'Sendet die Felder als prozentkodierte Schlüssel=Wert-Paare mit einem ' +
    'application/x-www-form-urlencoded-Content-Type. Deaktivierte Zeilen bleiben im Editor, erreichen aber ' +
    'nie die Leitung.',
  'workbench.editors.request.body.modeRawInfo':
    'Sendet den Editor-Inhalt unverändert — die Bytes auf der Leitung sind genau das, was du getippt hast.',
  'workbench.editors.request.body.modeRawDescription':
    'Die Formatauswahl steuert Syntaxhervorhebung und den Standard-Content-Type (application/json, ' +
    'application/xml, text/plain, text/javascript, text/html); ein im Headers-Tab gesetzter Content-Type ' +
    'gewinnt.',
  'workbench.editors.request.body.modeGraphqlInfo':
    'Sendet Query und Variablen als eine application/json-Nutzlast — { query, variables } — gemäß dem ' +
    'GraphQL-HTTP-Transport.',
  'workbench.editors.request.body.modeGraphqlDescription':
    'Variablen müssen gültiges JSON sein; ein nicht parsbares Variablen-Feld wird aus dem gesendeten Body ' +
    'weggelassen und die Query geht allein.',
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
  'workbench.editors.request.scripts.preRequest': 'Vor der Anfrage',
  'workbench.editors.request.scripts.postResponse': 'Nach der Antwort',
  'workbench.editors.request.scripts.preInfoTitle': 'Script vor der Anfrage',
  'workbench.editors.request.scripts.preInfoSummary':
    'Läuft in einem isolierten iframe, bevor die Anfrage gesendet wird. Verändere die ausgehende Anfrage ' +
    'mit der oh-API:',
  'workbench.editors.request.scripts.postInfoTitle': 'Script nach der Antwort',
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
  'workbench.editors.request.scripts.runsAfter': 'Läuft nach {count} Skripten:',
  'workbench.editors.request.scripts.runsAfterOne': 'Läuft nach 1 Skript:',
  'workbench.editors.request.scripts.prePlaceholderContainer':
    'Schreibe Scripts, die vor dem Senden jeder HTTP-Anfrage laufen.',
  'workbench.editors.request.scripts.postPlaceholderContainer':
    'Schreibe Scripts, die am Ende jeder HTTP-Antwort laufen.',
  'workbench.editors.request.scripts.prePlaceholder': 'Nutze JavaScript, um diese Anfrage vor dem Senden zu verändern.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Nutze JavaScript, um diese Antwort nach dem Eintreffen zu testen und zu lesen.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
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
    'selbstsignierte und abgelaufene.',
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
  'workbench.editors.request.settings.tlsCipherSuitesExample':
    'z. B. TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 Hops (Standard)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Hop', other: '{count} Hops' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (Standard)',
  'workbench.editors.request.settings.resetToDefault': 'Auf Standard zurücksetzen',
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
  'workbench.editors.request.settings.resolveToAddressExample': 'z. B. 10.0.0.12 oder 2001:db8::1',
  'workbench.editors.request.settings.sni': 'SNI-Servername',
  'workbench.editors.request.settings.sniInfo':
    'Servername, der im TLS-Handshake anstelle des URL-Hosts gesendet wird – ein Gateway, das viele Hostnamen unter einer Adresse bedient, oder ein Zertifikat für einen Namen, den DNS nicht auflöst. Leer sendet den URL-Host.',
  'workbench.editors.request.settings.sniPlaceholder': 'Auto – der URL-Host',
  'workbench.editors.request.settings.sniExample': 'z. B. api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': 'Client-Zertifikat (mTLS)',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Präsentiert während des TLS-Handshakes ein Client-Zertifikat — Mutual TLS (mTLS) — für APIs hinter Mutual-TLS-Gateways, ' +
    'die den Aufrufer per Zertifikat authentifizieren. Wähle einen Zertifikatseintrag aus dem vault — die ' +
    'Anfrage speichert nur den Namen des Eintrags, und jedes Gerät präsentiert seinen eigenen ' +
    'vault-Eintrag dieses Namens; Zertifikat und Schlüssel verlassen den vault nie. Leer lassen, um ohne ' +
    'Client-Zertifikat zu verbinden.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Kein Client-Zertifikat',
  'workbench.editors.request.settings.clientCertificateEmpty':
    'Noch keine Client-Zertifikat-Einträge im vault dieses Geräts.',
  'workbench.editors.request.settings.vaultManageCertificates': 'Zertifikate im vault verwalten',
  'workbench.editors.request.settings.clientCertificateDangling':
    'Kein vault-Zertifikatseintrag namens „{name}“ auf diesem Gerät — Sendevorgänge schlagen fehl, bis der ' +
    'Eintrag existiert oder diese Einstellung geleert wird.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxySummary':
    'Wie dieses Senden das Netzwerk erreicht. Standardmäßig erbt es die Umgebung des ausführenden Geräts — ' +
    'System-Proxy-Einstellungen, PAC oder Proxy-Umgebungsvariablen — der per Richtlinie gesetzte Proxy ' +
    'einer Firmenmaschine funktioniert also einfach; Direkt nimmt nur diese Anfrage von jedem ' +
    'Umgebungs-Proxy aus, und Eigene URL leitet sie über einen eigenen Proxy.',
  'workbench.editors.request.settings.proxyDescription':
    'Die Antwort-Metadaten halten immer die tatsächlich genommene Route fest — welcher Proxy, und ob die ' +
    'Anfrage oder die Umgebung entschieden hat. HTTP(S)- und SOCKS5-Proxys werden unterstützt — eine ' +
    'socks5://-URL funktioniert als eigener Proxy und als Umgebungsantwort; nur die SOCKS4-Familie erhält ' +
    'einen klaren Fehler, der sie benennt.',
  'workbench.editors.request.settings.proxyModesHeading': 'Modi',
  'workbench.editors.request.settings.proxyModePlaceholder': 'Erben — die Umgebung entscheidet',
  'workbench.editors.request.settings.proxyModeDirect': 'Direkt — kein Proxy',
  'workbench.editors.request.settings.proxyModeCustom': 'Eigene URL',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    'Die Umgebung des ausführenden Geräts entscheidet pro URL — ein Proxy, wo die Maschine einen ' +
    'konfiguriert hat, sonst direkt. Ein geerbter Proxy tritt zurück bei Sendevorgängen, die HTTP/3 ' +
    'festlegen, ein lokales Socket anwählen oder zu einer festen Adresse auflösen.',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    'Nie ein Proxy für diese Anfrage, egal was die Umgebung der Maschine sagt.',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    'Tunnel über die eigene Proxy-URL dieser Anfrage — mit der Anfrage synchronisiert, dieselbe Route auf ' +
    'jedem Gerät.',
  'workbench.editors.request.settings.proxyUrl': 'Proxy-URL',
  'workbench.editors.request.settings.proxyUrlInfo':
    'Leitet diese Anfrage über diesen HTTP(S)-Proxy. Die Verbindung zum Ziel wird durch den Proxy ' +
    'getunnelt, ein https-Austausch bleibt also Ende-zu-Ende verschlüsselt und die Zertifikatsprüfung ' +
    'läuft weiter gegen das Ziel. Anmeldedaten gehören in die Einstellung „Proxy-Anmeldedaten“ unten, nie ' +
    'in diese URL.',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    'Der Modus „Eigene URL“ braucht eine Proxy-URL — gib eine ein oder wechsle den Modus zurück.',
  'workbench.editors.request.settings.proxyError':
    'Nur http://-, https://- oder socks5://-URLs mit Host und Port — keine Anmeldedaten in der URL.',
  'workbench.editors.request.settings.proxyUrlExample': 'z. B. http://127.0.0.1:8080 oder socks5://127.0.0.1:1080',
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
  'workbench.editors.request.settings.proxyCredentialsEmpty': 'Noch keine String-Einträge im vault dieses Geräts.',
  'workbench.editors.request.settings.vaultManageCredentials': 'Anmeldedaten im vault verwalten',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'Kein vault-String-Eintrag namens „{name}“ auf diesem Gerät — Sendevorgänge schlagen fehl, bis der ' +
    'Eintrag existiert oder diese Einstellung geleert wird.',
  // ── Sitzungsresilienz-Block (WebSocket / Socket.IO / MQTT) ──────────
  'workbench.editors.request.settings.autoReconnect': 'Automatisch neu verbinden',
  'workbench.editors.request.settings.autoReconnectInfo':
    'Öffnet die Sitzung erneut, wenn eine offene Verbindung abbricht — Socket getrennt, Server schließt, Leerlauf-Timeout — und wählt im Wiederverbindungsintervall neu, bis sie wieder offen ist oder du trennst. Ein fehlgeschlagener Erstverbindungsversuch wird nie wiederholt. Standardmäßig aus.',
  'workbench.editors.request.settings.reconnectPeriod': 'Wiederverbindungsintervall',
  'workbench.editors.request.settings.reconnectPeriodInfo':
    'Wartezeit zwischen zwei Wiederverbindungsversuchen. Leer nutzt den Standard von 5 s.',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5 s (Standard)',
  'workbench.editors.request.settings.reconnectMaxAttempts': 'Wiederverbindungsversuche',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    'Obergrenze aufeinanderfolgender Wiederverbindungsversuche nach einem Abbruch — eine gelungene Wiederverbindung setzt den Zähler zurück; eine erschöpfte Obergrenze beendet die Sitzung als Wiederverbindung aufgegeben. Leer versucht es weiter, bis der Server zurück ist oder du trennst.',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': 'Unbegrenzt (Standard)',
  'workbench.editors.request.settings.reconnectBackoff': 'Exponentielles Warten',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    'Verdoppelt die Wartezeit nach jedem fehlgeschlagenen Versuch — das Intervall, dann 2×, 4× … bis 60 s — mit leichtem Zufallsversatz, damit Clients nie im Gleichtakt neu wählen. Standardmäßig an; aus wartet jeder Versuch exakt das Intervall.',
  'workbench.editors.request.settings.idleTimeout': 'Leerlauf-Timeout',
  'workbench.editors.request.settings.idleTimeoutInfo':
    'Schließt die Verbindung als verloren, wenn so lange nichts ankommt — die Lebenszeichenprüfung, die ein Client nicht per Ping-Frame machen kann. Mit aktivem automatischem Neuverbinden wählt die Sitzung neu. Leer setzt keine Leerlauffrist.',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    'Schließt die Verbindung als verloren, wenn so lange nichts ankommt. Mit aktivem automatischem Neuverbinden wählt die Sitzung neu. Leer folgt dem Handshake des Servers — ein Ping ist alle pingInterval fällig und darf pingTimeout verspätet sein, die Regel des offiziellen Clients.',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': 'Aus (Standard)',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': 'Ping-Takt des Servers (Standard)',
  'workbench.editors.request.settings.heartbeatMessage': 'Heartbeat-Nachricht',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    'Ein Text-Frame, der im Heartbeat-Intervall gesendet wird, damit eine untätige Sitzung Load Balancer und Proxys überlebt — was immer dein Server erwartet. Kein WebSocket-Client kann einen Protokoll-Ping-Frame senden, daher ist das Keepalive eine Anwendungsnachricht; sie wird wie jeder gesendete Frame erfasst. Templates willkommen. Leer sendet keinen Heartbeat.',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': 'Kein Heartbeat',
  'workbench.editors.request.settings.heartbeatMessageExample': 'z. B. ping oder {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': 'Heartbeat-Intervall',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    'Wartezeit zwischen zwei Heartbeat-Nachrichten. Leer nutzt den Standard von 30 s — unter der 60-s-Leerlaufgrenze der meisten Load Balancer.',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30 s (Standard)',
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
  'workbench.editors.request.settings.unixSocketExample': 'z. B. /var/run/docker.sock',
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
  'workbench.editors.request.settings.maxMessageSize': 'Max. Nachrichtengröße',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    'Größte eingehende Nachricht, die die Sitzung annimmt. Eine Nachricht über dem Limit wird nie erfasst: Die Sitzung schließt mit Code 1009 (Message Too Big) und nennt beide Größen, und die automatische Wiederverbindung öffnet sie nicht erneut — der Client hat es verlangt. Leer lassen für kein Limit pro Anfrage; die Desktop-Laufzeit setzt Nachrichten bis 128 MB zusammen, der Browser setzt kein Limit.',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': 'Kein Limit (Standard)',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    'Folgt einer 3xx-Antwort auf den Handshake und wählt deren Location — die Form, in der ein Auth-Gateway Upgrades umleitet. Standardmäßig aus, die Regel des WebSocket-Standards selbst: Ein umgeleiteter Handshake schlägt fehl und nennt die Umleitung. Gilt, wenn die Sitzung in der Desktop-App oder auf dem Server läuft; Browser folgen nie.',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    'Wie vielen Handshake-Umleitungen ein Verbindungsaufbau folgen darf, bevor er mit einem Fehler scheitert, der das Limit nennt. Leer lassen für den Standardwert 20.',
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
  'workbench.editors.request.settings.managed.browserStore': 'Browser-Speicher',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Nicht gesendet',
  'workbench.editors.request.settings.managed.offered': 'Angeboten',
  'workbench.editors.request.settings.managed.none': 'Keine',
  'workbench.editors.request.settings.managed.never': 'Nie',
  'workbench.editors.request.settings.managed.websocketOnly': 'Nur WebSocket',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': 'Komprimierung',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    'permessage-deflate wird bei jedem Handshake angeboten und der Server entscheidet, ob Frames komprimiert werden; die Zeile „Verbunden“ zeigt, was ausgehandelt wurde. Das Angebot lässt sich nicht pro Anfrage zurückhalten.',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    'Nachrichten gehen unkomprimiert hinaus und es wird kein grpc-encoding ausgehandelt; ein komprimierter Frame vom Server wird als komprimiert angezeigt, nicht dekodiert.',
  'workbench.editors.request.settings.managed.transport': 'Transport',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    'Die Sitzung wählt den WebSocket-Transport direkt und überspringt den HTTP-Long-Polling-Handshake, mit dem der offizielle Client beginnt, bevor er upgradet.',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC läuft ausschließlich über HTTP/2: TLS-Kanäle handeln h2 über ALPN aus, Klartextkanäle sprechen h2 mit Prior Knowledge.',
  'workbench.editors.request.settings.managed.connectionReuse': 'Verbindungswiederverwendung',
  'workbench.editors.request.settings.managed.onePerCall': 'Eine pro Aufruf',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    'Jeder Aufruf öffnet seine eigene HTTP/2-Verbindung und schließt sie am Ende des Aufrufs; nichts wird gepoolt oder zwischen Aufrufen am Leben gehalten, ein Keepalive läuft also nur, solange ein Aufruf offen ist.',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    'Der Browser folgt einem umgeleiteten Handshake nie; eine 3xx-Antwort lässt die Verbindung scheitern. Führen Sie die Sitzung in der Desktop-App oder auf dem Server aus, um Umleitungen zu folgen.',
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
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    'Anfrage-Header zählen nur, was dieses Senden gesetzt hat; die Laufzeitumgebung fügt ihre eigenen ' +
    'hinzu (Host, Accept-Encoding, …).',
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
  'workbench.editors.request.response.meta.tlsProtocol': 'TLS-Protokoll',
  'workbench.editors.request.response.meta.tlsCipher': 'Cipher-Name',
  'workbench.editors.request.response.meta.tlsCertificate': 'Zertifikat-CN',
  'workbench.editors.request.response.meta.tlsIssuer': 'Aussteller-CN',
  'workbench.editors.request.response.meta.tlsValidUntil': 'Gültig bis',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': 'Zertifikat nicht geprüft ({code})',
  'workbench.editors.request.response.meta.trustPinned':
    'Zertifikat auf diesem Gerät angeheftet — erneut senden, um zu prüfen.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Lokale Adresse, TLS- und Zertifikatsdetails werden Erweiterungscode auf Chromium nicht offengelegt.',
  'workbench.editors.request.response.meta.tlsSelfSigned': 'Selbstsigniertes Zertifikat',
  'workbench.editors.request.response.meta.tlsUnverified': 'Zertifikat nicht geprüft',
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
  'workbench.editors.request.response.meta.authTitle': 'Autorisierung',
  'workbench.editors.request.response.meta.authSummaryRequest':
    'Gesendet mit der eigenen {type}-Konfiguration der Anfrage.',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type} — geerbt von {source}.',
  'workbench.editors.request.response.meta.authSummaryNone':
    'Ohne Autorisierung gesendet — oberhalb der Anfrage ist nichts festgelegt.',
  'workbench.editors.request.response.meta.authDangling':
    'Der von der Anfrage gewählte Eintrag existiert nicht mehr — stattdessen wurde der Standard angewendet.',
  'workbench.editors.request.response.meta.scriptsTag': 'Skripte · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': 'Skriptkette',
  'workbench.editors.request.response.meta.scriptsSummary':
    'Jede Ebene der Kette lief erfolgreich — die Skripte der Sammlung und des Ordners vor denen der Anfrage selbst, Pre-Request wie Post-Response. Aufgezeichnet aus dem, was der Lauf tatsächlich getan hat.',
  'workbench.editors.request.response.meta.scriptsSummaryFailed':
    'Eine Ebene der Kette ist fehlgeschlagen — die Zeilen unten nennen welche und warum.',
  'workbench.editors.request.response.meta.scriptsLevelRequest': 'Anfrage',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} ms',
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
  'workbench.editors.request.response.meta.proxyTag': 'Über Proxy',
  'workbench.editors.request.response.meta.proxyTitle': 'Proxy-Route',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    'Dieser Lauf ging durch den Tunnel des Proxys aus den eigenen Anfrage-Einstellungen — aufgezeichnet ' +
    'aus dem, was der Sendevorgang tatsächlich getan hat.',
  'workbench.editors.request.response.meta.proxySummarySystem':
    'Dieser Lauf ging durch den Tunnel des Proxys, den das System des ausführenden Geräts benennt — ' +
    'aufgezeichnet aus dem, was der Lauf tatsächlich getan hat, nie eine Live-Abfrage der Einstellungen.',
  'workbench.editors.request.response.meta.proxyRowUrl': 'Proxy',
  'workbench.editors.request.response.meta.proxyRowSource': 'Entschieden durch',
  'workbench.editors.request.response.meta.proxySourceRequest': 'Anfrage-Einstellungen',
  'workbench.editors.request.response.meta.proxySourceDevice': 'Proxy-Einstellungen des Geräts',
  'workbench.editors.request.response.meta.proxySourceEnv': 'Umgebungsvariablen',
  'workbench.editors.request.response.meta.proxySourceSystem': 'System-Proxy-Einstellungen',
  'workbench.editors.request.response.meta.proxySourceManual': 'Manuelle Proxy-Konfiguration',
  'workbench.editors.request.response.meta.proxySourcePac': 'PAC-Script',
  'workbench.editors.request.response.meta.proxyStandDownTag': 'Proxy umgangen',
  'workbench.editors.request.response.meta.proxyStandDownTitle': 'System-Proxy ist zurückgetreten',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    'Das System benennt einen Proxy, aber dieser Lauf zielt auf einen lokalen Socket, den ein Proxy-Tunnel ' +
    'nicht anwählen kann — er lief direkt weiter.',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    'Das System benennt einen Proxy, aber dieser Lauf pinnt seine eigene Adressauflösung, die ein Proxy ' +
    'überschreiben würde — er lief direkt weiter.',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    'Das System benennt einen Proxy, aber dieser Lauf ist auf HTTP/3 gepinnt, das seinen eigenen QUIC-Weg ' +
    'anwählt — er lief direkt weiter.',
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
    'Das Limit lässt sich in den API-Anfragen-Einstellungen anpassen.',
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
  'workbench.editors.spec.tab': 'Spec',
  'workbench.editors.spec.noSpecs': 'Noch keine {format}-Spezifikation in diesem Arbeitsbereich.',
  'workbench.editors.spec.goToSpecs': 'Zu den Spezifikationen',
  'workbench.editors.timelineViewer.format': 'Nachrichtenformat',
  'workbench.editors.timelineViewer.showMessage': 'Nachricht anzeigen',
  'workbench.editors.timelineViewer.showHexdump': 'Hexdump anzeigen',
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
  'workbench.editors.request.response.console.preRequest': 'Vor der Anfrage',
  'workbench.editors.request.response.console.postResponse': 'Nach der Antwort',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Anfrage wird gesendet…',
  'workbench.editors.request.response.empty.prompt': 'Sende die Anfrage, um hier die Antwort zu sehen.',
  'workbench.editors.request.response.error.title': 'Anfrage konnte nicht gesendet werden',
  'workbench.editors.request.response.error.openInTab': 'In neuem Tab öffnen',
  'workbench.editors.request.response.error.trust.title': 'Dem von {origin} vorgelegten Zertifikat vertrauen',
  'workbench.editors.request.response.error.trust.probing': 'Vom Server vorgelegtes Zertifikat wird gelesen…',
  'workbench.editors.request.response.error.trust.probeFailed':
    'Das Serverzertifikat konnte nicht gelesen werden: {message}',
  'workbench.editors.request.response.error.trust.retryProbe': 'Erneut versuchen',
  'workbench.editors.request.response.error.trust.failure': 'Fehler',
  'workbench.editors.request.response.error.trust.noAnchor':
    'Der Server legt sein Wurzelzertifikat nicht vor, daher lässt sich hier nichts anheften. Die ausstellende CA unter Einstellungen › API-Anfragen › TLS hinzufügen.',
  'workbench.editors.request.response.error.trust.trustOnDevice': 'Auf diesem Gerät vertrauen',
  'workbench.editors.request.response.error.trust.addToWorkspace': 'Zum Arbeitsbereich hinzufügen',
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
