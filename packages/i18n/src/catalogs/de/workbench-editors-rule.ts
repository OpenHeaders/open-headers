/**
 * Workbench editors — the rule editor, German. Extends the de register
 * contract (`de/shared.ts`). The quick editor reuses the
 * `workbench.editors.rule.fields.*` keys directly (S35 field-key reuse
 * law) — field labels here stay consistent with
 * `de/panel-quick-editor.ts` (op nouns Anfügen / Überschreiben /
 * Zusammenführen / Entfernen, `Alle entfernen`, the `Mock` /
 * `Änderung` tags). Rule-type kickers reuse the shipped
 * `workbench.shell.ruleTypeName.*` feminine -Regel compounds. MINTS:
 * template = die Vorlage (user template = Benutzervorlage); message
 * ops = Ersetzen / Injizieren / Verwerfen (verworfen = dropped, de
 * law); condition ops quote `Hinzufügen / Überschreiben`; first-party
 * = Erstanbieter, third-party = Drittanbieter; debug reach =
 * Reichweite (three-word law — Geltungsbereich stays variable scope).
 * Raw by design: gates AND/OR/NOT, DNR schema vocabulary
 * (`requestDomains`, `url-filter`, `firstParty`, slot ids),
 * `{{ns.NAME}}` reference syntax in placeholders, quoted browser UI
 * phrasing, scheme prefixes, HTTP method lists, `main-frame` /
 * `monkey-patch` loanwords, der Frame (wire frames), the Mock tag.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Gespeichert',
  'workbench.editors.header.onTop': 'Kopfbereich oben',
  'workbench.editors.header.atBottom': 'Kopfbereich unten',
  'workbench.editors.header.moreActions': 'Weitere Aktionen',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'Regel-Editor',
  'workbench.editors.rule.templates.title': 'Vorlagen',
  'workbench.editors.rule.templates.infoSummary': 'Starte von einer Voreinstellung statt von einem leeren Formular.',
  'workbench.editors.rule.templates.infoDescription':
    'Systemvorlagen kommen mit der App; Benutzervorlagen sind die, die du selbst über ⋮ → Als Benutzervorlage ' +
    'speichern sicherst. Eine Vorlage anzuwenden füllt nur die Felder vor — passe vor dem Speichern alles an.',
  'workbench.editors.rule.templates.blank': 'Leer',
  'workbench.editors.rule.templates.system': 'System',
  'workbench.editors.rule.templates.user': 'Benutzer',
  'workbench.editors.rule.templates.emptyTitle': 'Noch keine Benutzervorlagen',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'Benutzervorlagen sind deine eigenen wiederverwendbaren Voreinstellungen für diesen Regeltyp. ' +
    'Konfiguriere die Regel wie gewünscht und wähle dann',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → Als Benutzervorlage speichern',
  'workbench.editors.rule.templates.emptyAfterMenu':
    'im Kopfbereich — sie taucht dann hier für jede neue Regel dieses Typs auf.',
  'workbench.editors.rule.saveAsTemplate': 'Als Benutzervorlage speichern',
  'workbench.editors.rule.enabled': 'Aktiviert',
  'workbench.editors.rule.disabled': 'Deaktiviert',
  'workbench.editors.rule.toast.unknownType': 'Unbekannter Regeltyp',
  'workbench.editors.rule.toast.deletedOtherTab': 'Die Regel wurde aus einem anderen Tab gelöscht',
  'workbench.editors.rule.toast.updateFailed': 'Die Regel ließ sich nicht aktualisieren',
  'workbench.editors.rule.toast.updateFailedDetail': 'Die Regel ließ sich nicht aktualisieren: {message}',
  'workbench.editors.rule.toast.publishFailed': 'Regel gespeichert, aber die Veröffentlichung schlug fehl',
  'workbench.editors.rule.toast.updated': 'Regel aktualisiert',
  'workbench.editors.rule.toast.published': 'Regel veröffentlicht',
  'workbench.editors.rule.toast.formatSkipped': 'Formatieren beim Speichern übersprungen: {reason}',
  'workbench.editors.rule.toast.noCollection': 'Keine Sammlung gefunden',
  'workbench.editors.rule.toast.restoreFailed': 'Die Regel ließ sich nicht wiederherstellen',
  'workbench.editors.rule.toast.restored': 'Regel wiederhergestellt',
  'workbench.editors.rule.deleted.message': 'Diese Regel wurde von einer anderen Oberfläche gelöscht.',
  'workbench.editors.rule.deleted.description':
    'Wiederherstellen erzeugt eine frische Kopie mit neuer Id (der ursprüngliche Tombstone ist permanent — ' +
    'siehe Spezifikation der Sync-Engine, §7.2).',
  'workbench.editors.rule.deleted.restore': 'Wiederherstellen',
  'workbench.editors.rule.conditionsPane.title': 'Bedingungen',
  'workbench.editors.rule.conditionsPane.infoSummary':
    'Die Bedingungen entscheiden, auf welche Anfragen diese Regel angewendet wird.',
  'workbench.editors.rule.conditionsPane.infoAndBefore': 'Zeilen kombinieren sich mit',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '— jede Zeile muss passen.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': 'Werte innerhalb einer Zeile kombinieren sich mit',
  'workbench.editors.rule.conditionsPane.infoOrAfter': '(das OR-Badge markiert Zeilen, die mehrere Werte akzeptieren).',
  'workbench.editors.rule.conditionsPane.infoAddOne': 'Füge mindestens eine Bedingung hinzu.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'URL-Abgleich',
  'workbench.editors.rule.condition.group.domainFiltering': 'Domain-Filterung',
  'workbench.editors.rule.condition.group.requestFiltering': 'Anfrage-Filterung',
  'workbench.editors.rule.condition.group.headerMatching': 'Header-Abgleich',
  'workbench.editors.rule.condition.type.urlFilter': 'URL-Muster',
  'workbench.editors.rule.condition.type.urlRegex': 'URL-Regex',
  'workbench.editors.rule.condition.type.requestDomains': 'Anfrage-Domains',
  'workbench.editors.rule.condition.type.excludeRequestDomains': 'Domains ausschließen',
  'workbench.editors.rule.condition.type.initiatorDomains': 'Initiator-Domains',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': 'Initiator ausschl.',
  'workbench.editors.rule.condition.type.requestMethods': 'Methoden',
  'workbench.editors.rule.condition.type.excludeRequestMethods': 'Methoden ausschl.',
  'workbench.editors.rule.condition.type.resourceTypes': 'Ressourcentypen',
  'workbench.editors.rule.condition.type.excludeResourceTypes': 'Ressourcen ausschl.',
  'workbench.editors.rule.condition.type.domainType': 'Domain-Typ',
  'workbench.editors.rule.condition.type.responseHeader': 'Antwort-Header',
  'workbench.editors.rule.condition.type.excludeResponseHeader': 'Antw.-Header ausschl.',
  'workbench.editors.rule.condition.suffix.notSupported': ' — von Chrome DNR nicht unterstützt',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ' — bereits in Verwendung',
  'workbench.editors.rule.condition.firstParty': 'Erstanbieter',
  'workbench.editors.rule.condition.thirdParty': 'Drittanbieter',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': 'Keine Bedingungen — die Regel wird auf keine Anfrage passen',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    'Zeilen kombinieren sich mit AND — jede Zeile muss passen, damit die Regel auslöst. Jede Zeile zielt auf ' +
    'ein anderes DNR-Feld, deshalb ist das AND über die Zeilen exakt. Um mehrere Werte innerhalb eines Feldes ' +
    'mit OR zu verknüpfen, liste sie in einer Zeile auf (siehe das OR-Badge der Zeile).',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    'Dies ist eine Ausschluss-Bedingung — die Regel löst nur aus, wenn KEINER der aufgelisteten Werte passt.',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    'Mehrere Werte in dieser Zeile passen, wenn IRGENDEIN Wert passt (OR). Die Zeilen darunter kombinieren ' +
    'sich mit AND.',
  'workbench.editors.rule.condition.oneValueTag': '1 Wert',
  'workbench.editors.rule.condition.oneValueTooltip':
    'Diese Bedingung nimmt einen einzelnen Wert — Kommatrennung hat keine Wirkung. Die Zeilen darunter ' +
    'kombinieren sich mit AND.',
  'workbench.editors.rule.condition.headerNamePlaceholder': 'Header-Name gleich...',
  'workbench.editors.rule.condition.headerValuePlaceholder': 'Header-Wert gleich...',
  'workbench.editors.rule.condition.selectMethods': 'Methoden wählen',
  'workbench.editors.rule.condition.selectTypes': 'Typen wählen',
  'workbench.editors.rule.condition.selectType': 'Typ wählen',
  'workbench.editors.rule.condition.valuePlaceholder': 'Wert',
  'workbench.editors.rule.condition.add': 'Bedingung hinzufügen',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    'Nur die letzte {type}-Zeile wird angewendet — der Wert dieser Zeile erreicht Chrome nicht. Entferne ' +
    'diese Zeile oder verschiebe ihre Werte in die Zeile, die gewinnt.',
  'workbench.editors.rule.issue.mutexConflict':
    '{type} und {winningType} teilen sich einen DNR-Slot — nur der letzte wird angewendet. Wähle einen.',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'Dieser Bedingungstyp wird von Chrome DNR noch nicht unterstützt — die Regel wird trotzdem gespeichert, ' +
    'aber diese Zeile schickt nichts auf die Leitung.',
  'workbench.editors.rule.issue.emptyUrlFilter': 'Das URL-Muster darf nicht leer sein.',
  'workbench.editors.rule.issue.emptyUrlRegex': 'Die URL-Regex darf nicht leer sein.',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'Das URL-Muster darf keine Leerzeichen enthalten — Chrome lehnt Regeln mit Leerzeichen in url-filter ab.',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'Das URL-Muster enthält Nicht-ASCII-Zeichen — Chrome lehnt sie ab. Verwende punycode (xn--…) für ' +
    'IDN-Hostnamen.',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    'Das sieht nach einer Regex aus — in URL-Muster werden Zeichen wie `(`, `[`, `+`, `?`, `\\d` wörtlich ' +
    'abgeglichen. Wechsle zu URL-Regex, wenn du Regex-Syntax brauchst.',
  'workbench.editors.rule.issue.regexLookbehind':
    'Die Regex-Engine von Chrome (RE2) unterstützt keine Lookbehind-Assertions ((?<=…), (?<!…)). Die Regel ' +
    'lädt möglicherweise nicht.',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Die Regex-Engine von Chrome (RE2) unterstützt keine benannten Gruppen im Python-Stil ((?P<name>…)). Die ' +
    'Regel lädt möglicherweise nicht.',
  'workbench.editors.rule.issue.invalidUrlRegex': 'Ungültige Regex: {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '„{value}“ ist keine gültige HTTP-Methode. Erlaubt: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, ' +
    'CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType':
    '„{value}“ ist kein gültiger Ressourcentyp. Wähle einen aus dem Dropdown.',
  'workbench.editors.rule.issue.invalidDomainType':
    '„{value}“ ist kein gültiger Domain-Typ. Verwende „firstParty“ oder „thirdParty“.',
  'workbench.editors.rule.issue.headerNameRequired': 'Der Header-Name ist erforderlich.',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    'Leerzeichen im Wert — trenne Hostnamen mit einem Komma. requestDomains nimmt einen nackten Hostnamen ' +
    'pro Eintrag.',
  'workbench.editors.rule.issue.domain.scheme':
    'Lass das Schema weg — das requestDomains von Chrome nimmt nur Hostnamen, keine URLs.',
  'workbench.editors.rule.issue.domain.wildcard':
    'Lass den Platzhalter weg — requestDomains deckt alle Subdomains automatisch ab, „*.foo.com“ ist also ' +
    'einfach „foo.com“.',
  'workbench.editors.rule.issue.domain.port':
    'Lass den Port weg — requestDomains gleicht nur nach Hostname ab; die Regel deckt automatisch jeden Port ' + 'ab.',
  'workbench.editors.rule.issue.domain.uppercase':
    'Schreibe den Hostnamen klein — Chrome akzeptiert in requestDomains nur kleingeschriebenes ASCII.',
  'workbench.editors.rule.issue.domain.nonAscii':
    'Der Hostname enthält Zeichen, die Chrome in requestDomains ablehnt (wahrscheinlich ein Nicht-ASCII- / ' +
    'IDN-Eintrag). Verwende die punycode-Form (xn--…).',
  'workbench.editors.rule.issue.domain.empty': 'Leerer Hostname — entferne diese Zeile.',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} betroffener Eintrag',
      other: '{count} betroffene Einträge',
    }),
  'workbench.editors.rule.issue.domain.cleanUp': 'Aufräumen',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': 'Das Umleitungsziel darf keine Leerzeichen enthalten.',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'Das Umleitungsziel muss eine vollständige URL (http://, https://, chrome-extension://) oder ein mit / ' +
    'beginnender Pfad sein.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    'Die Quell-URL muss http://, https:// oder chrome-extension:// verwenden.',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': 'Die Quell-URL ist keine gültige URL.',
  'workbench.editors.rule.actionIssue.invalidStatusCode':
    'Der Statuscode muss eine Ganzzahl zwischen 100 und 599 sein.',
  'workbench.editors.rule.actionIssue.invalidParamName':
    'Der Parametername darf weder `&`, `=`, `#`, `?` noch Leerzeichen enthalten.',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'Die main-frame-Verzögerung ist auf 30000ms gedeckelt; höhere Werte werden auf der Leitung gekappt.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'Der XHR/fetch-monkey-patch deckelt Verzögerungen bei 5000ms, um den HTTP-Verbindungspool nicht ' +
    'auszuhungern. main-frame-Umleitungen respektieren bis zu 30000ms.',
  'workbench.editors.rule.actionIssue.invalidContentType':
    'Der Inhaltstyp sollte wie „type/subtype“ aussehen (z. B. application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'Der GraphQL-Filterschlüssel ist erforderlich.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'Der Wert des Nachrichtenfilters ist erforderlich, wenn ein Filter konfiguriert ist.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex':
    'Der Nachrichtenfilter ist kein gültiger regulärer Ausdruck.',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    'Injizieren nach einer passenden Nachricht erfordert einen Nachrichtenfilter.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} nicht aufgelöste Variable in dieser Regel',
      other: '{count} nicht aufgelöste Variablen in dieser Regel',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': 'nicht aufgelöst',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'nicht im Geltungsbereich',
  'workbench.editors.rule.resolution.reason.unknownNamespace': 'unbekannter Namensraum',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': 'Schritt-Referenz außerhalb des Geltungsbereichs',
  'workbench.editors.rule.resolution.reason.empty': 'leer',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': 'ungültiger Wert',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': 'Autorisierung erforderlich',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'Secret nicht gefunden',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'Manager nicht verfügbar',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    'kein zwischengespeicherter Lauf für die Umgebung „{envName}“ — öffne den Workflow und klicke unter ' +
    'dieser Umgebung auf Aktualisieren, um ihn zu befüllen',
  'workbench.editors.rule.resolution.hint.disabledLv':
    'die Live-Variable ist deaktiviert — aktiviere sie im Editor für Live-Variablen',
  'workbench.editors.rule.resolution.hint.draftLv':
    'die Live-Variable ist ein Entwurf — öffne sie und klicke auf Speichern, um sie zu veröffentlichen',
  'workbench.editors.rule.resolution.noEnvironment': 'Keine Umgebung',
  'workbench.editors.rule.resolution.activeEnvFallback': 'aktive Umgebung',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'Aktionen',
  'workbench.editors.rule.fields.addAction': 'Aktion hinzufügen',
  'workbench.editors.rule.fields.reset': 'Zurücksetzen',
  'workbench.editors.rule.fields.optionalTag': '(optional)',
  'workbench.editors.rule.fields.opAddReplace': 'Hinzufügen / Überschreiben',
  'workbench.editors.rule.fields.opAppend': 'Anfügen',
  'workbench.editors.rule.fields.opRemove': 'Entfernen',
  'workbench.editors.rule.fields.opMerge': 'Zusammenführen',
  'workbench.editors.rule.fields.opReplaceOnly': 'Nur überschreiben',
  'workbench.editors.rule.fields.opRemoveAll': 'Alle entfernen',
  'workbench.editors.rule.fields.operatorEquals': 'Gleich',
  'workbench.editors.rule.fields.operatorContains': 'Enthält',
  'workbench.editors.rule.fields.restApi': 'REST-API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL-API',
  'workbench.editors.rule.fields.staticData': 'Statische Daten',
  'workbench.editors.rule.fields.dynamicJs': 'Dynamisch (JavaScript)',
  'workbench.editors.rule.fields.formatAwareBody.formatted': 'Formatiert',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Roh',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    'Die formatierte Ansicht ist nur für JSON-förmige Bodys verfügbar.',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': 'Formatierte Ansicht',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'Body',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    'Formatiert und Roh sind zwei Ansichten desselben Body-Textes — der Leitungstext ist das, was die Regel ' +
    'ausliefert.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': 'Beispiel — ein Wert, zwei Ansichten',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'Modi',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    'Eine Leseansicht — nur der Leerraum unterscheidet sich. Änderungen werden zurück ins ursprüngliche ' +
    'Leitungsformat codiert, und Speichern schreibt diesen Leitungstext; Speichern ohne Änderung schreibt ' +
    'exakt die Originalbytes.',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc':
    'Der Leitungstext selbst — exakt das, was die Regel ausliefert.',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'GraphQL-Operation (Filter auf die Anfrage-Payload)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'Schlüssel, z. B. operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': 'Wert, z. B. getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': 'Header-Regel',
  'workbench.editors.rule.fields.header.infoSummary': 'Schreibt Anfrage- und Antwort-Header auf passendem Traffic um.',
  'workbench.editors.rule.fields.header.infoDescription':
    'Ungültige Kombinationen (z. B. Anfügen auf einem eigenen Header) markieren die Regel als Entwurf. ' +
    'Entwürfe werden gespeichert, aber nicht ausgeführt.',
  'workbench.editors.rule.fields.header.requestTab': 'Anfrage-Header',
  'workbench.editors.rule.fields.header.requestTabSummary':
    'Header-Aktionen, die auf die ausgehende Anfrage angewendet werden, bevor sie den Browser verlässt.',
  'workbench.editors.rule.fields.header.responseTab': 'Antwort-Header',
  'workbench.editors.rule.fields.header.responseTabSummary':
    'Header-Aktionen, die auf die Antwort angewendet werden, bevor die Seite sie sieht.',
  'workbench.editors.rule.fields.header.responseTabDescription':
    'Der Network-Tab der DevTools des Browsers selbst zeigt immer die ursprünglichen Server-Header, dort ' +
    'sind diese Änderungen also unsichtbar, obwohl sie angewendet werden. Das DevTools-Fenster von Open ' +
    'Headers hat diese Einschränkung nicht — es zeigt die Header genau so, wie sie an die Seite ausgeliefert ' +
    'werden.',
  'workbench.editors.rule.fields.header.emptyRequest':
    'Keine Aktionen — diese Regel lässt die Anfrage-Header unverändert',
  'workbench.editors.rule.fields.header.emptyResponse':
    'Keine Aktionen — diese Regel lässt die Antwort-Header unverändert',
  'workbench.editors.rule.fields.header.namePlaceholder': 'Header-Name',
  'workbench.editors.rule.fields.header.valuePlaceholder': 'Header-Wert',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': 'Anzufügender Wert',
  'workbench.editors.rule.fields.header.existingValue': 'bestehender Wert',
  'workbench.editors.rule.fields.header.switchTo': 'Wechseln zu {operation}',
  'workbench.editors.rule.fields.header.dragToReorder': 'Zum Umsortieren ziehen',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'Blockier-Regel',
  'workbench.editors.rule.fields.block.infoSummary':
    'Blockieren bricht passende Anfragen ab, bevor sie den Browser verlassen.',
  'workbench.editors.rule.fields.block.infoDescription':
    'Es muss keine Aktion konfiguriert werden — das Blockieren selbst ist die Aktion; die Bedingungen ' +
    'entscheiden, was blockiert wird.',
  'workbench.editors.rule.fields.block.title': 'Anfragen blockieren',
  'workbench.editors.rule.fields.block.body':
    'Anfragen, die auf die Bedingungen unten passen, werden blockiert. Der Browser zeigt der Seite einen ' +
    'Netzwerkfehler.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'Umleitungs-Regel',
  'workbench.editors.rule.fields.redirect.infoSummary':
    'Schickt passende Anfragen an eine andere URL, bevor sie das Netzwerk erreichen.',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'Mit einer URL-Regex-Bedingung setzen \\1, \\2 … die erfassten Gruppen in die Ziel-URL ein.',
  'workbench.editors.rule.fields.redirect.redirectsTo': 'Leitet um zu',
  'workbench.editors.rule.fields.redirect.anotherUrl': 'Andere URL',
  'workbench.editors.rule.fields.redirect.localFile': 'Lokale Datei',
  'workbench.editors.rule.fields.redirect.desktopOnly': 'In der Desktop-App verfügbar',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    'z. B. https://openheaders.com/redirected — verwende \\1, \\2 mit URL-Regex-Bedingungen',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'Query-Parameter-Regel',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    'Fügt Query-Parameter auf passenden Anfrage-URLs hinzu, überschreibt oder entfernt sie.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    'Alle entfernen streicht den gesamten Query-String; Einträge mit Hinzufügen / Überschreiben in derselben ' +
    'Regel werden dann zur neuen Query. Einträge mit Nur überschreiben und Entfernen haben nichts mehr, ' +
    'worauf sie wirken könnten, und werden neben Alle entfernen ignoriert.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    'Alle entfernen streicht den gesamten Query-String, Einträge mit Nur überschreiben und Entfernen haben ' +
    'also nichts, worauf sie wirken könnten, und werden ignoriert. Einträge mit Hinzufügen / Überschreiben ' +
    'gelten weiterhin — sie werden zur neuen Query.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'Entfernt alle Query-Parameter aus der URL',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'Parametername',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'Parameterwert',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': 'Injektions-Regel',
  'workbench.editors.rule.fields.inject.infoSummary':
    'Injiziert ein Script oder ein Stylesheet in passende Seiten, während sie laden.',
  'workbench.editors.rule.fields.inject.language': 'Sprache:',
  'workbench.editors.rule.fields.inject.codeSource': 'Code-Quelle:',
  'workbench.editors.rule.fields.inject.insert': 'Einfügen:',
  'workbench.editors.rule.fields.inject.sourceCode': 'Code',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'Nach dem Laden der Seite',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'So früh wie möglich',
  'workbench.editors.rule.fields.inject.source': 'Quelle',
  'workbench.editors.rule.fields.inject.code': 'Code',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': 'Quell-URL eingeben (relativ oder absolut)',
  'workbench.editors.rule.fields.inject.bypassCsp':
    'Content-Security-Policy umgehen, damit injizierte Scripts immer ausgeführt werden',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    'Deckt derzeit nur die Header-CSP ab — eine <meta>-CSP kann dieses Script weiterhin blockieren. Um beide ' +
    'zu umgehen, aktiviere „Allow user scripts“ für diese Erweiterung in den Erweiterungseinstellungen deines ' +
    'Browsers.',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': 'Verzögerungs-Regel',
  'workbench.editors.rule.fields.delay.infoSummary':
    'Hält passende Anfragen für die konfigurierte Zeit zurück, bevor sie weiterlaufen dürfen.',
  'workbench.editors.rule.fields.delay.capsAlert':
    'Dokument- und iframe-Navigationen werden über eine lokale Warteseite um bis zu 30 000 ms verzögert. ' +
    'JS-initiiertes XHR/Fetch ist auf 5 000 ms gedeckelt, um den HTTP-Verbindungspool nicht auszuhungern. ' +
    'Unterressourcen (CSS, JS, Bilder) werden nicht verzögert.',
  'workbench.editors.rule.fields.delay.label': 'Verzögerung',
  'workbench.editors.rule.fields.delay.maxNote': 'Max. 30 000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'Anfrage-Body-Regel',
  'workbench.editors.rule.fields.requestBody.infoSummary':
    'Ersetzt den Body passender Anfragen, bevor sie gesendet werden.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    'Statische Daten tauscht eine feste Payload ein; Dynamisch führt JavaScript gegen den Original-Body aus.',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'Fängt fetch()- und XMLHttpRequest-Aufrufe von REST- oder GraphQL-API-Anfragen ab.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'Ressourcentyp wählen',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'Anfrage-Body',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': 'Deine Funktion erhält',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'und soll den veränderten Body zurückgeben. Gib einen String oder ein Objekt zurück (automatisch zu JSON ' +
    'serialisiert).',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'Antwort-Regel',
  'workbench.editors.rule.fields.response.infoSummary':
    'Liefert für passende Anfragen eine Ersatzantwort statt dessen, was der Server zurückgab.',
  'workbench.editors.rule.fields.response.infoDescription':
    'Statische Daten liefert eine feste Payload; Dynamisch führt JavaScript gegen die Originalantwort aus.',
  'workbench.editors.rule.fields.response.sourceLabel': 'Antwortquelle',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'Wirkt auf fetch()- und XMLHttpRequest-Antworten von REST- oder GraphQL-API-Anfragen.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock liefert deinen Body, ohne den Server aufzurufen; Änderung sendet die echte Anfrage und bearbeitet ' +
    'die Antwort, bevor die Seite sie sieht.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock — keine Anfrage gesendet',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 Änderung — die Antwort des Servers bearbeiten',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    'Die echte Anfrage wird gesendet; deine Änderungen werden auf die Antwort angewendet, bevor die Seite sie ' +
    'sieht.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'Die Anfrage verlässt den Browser nie — die Seite erhält deine Antwort direkt.',
  'workbench.editors.rule.fields.response.resourceType': 'Ressourcentyp',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'Auf welche API-Payload-Form die Regel zielt — REST oder GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL schaltet weiter unten einen Operationsfilter frei, sodass die Regel auf eine einzelne Operation ' +
    'innerhalb eines geteilten Endpunkts passen kann.',
  'workbench.editors.rule.fields.response.statusCode': 'Statuscode',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary':
    'Der HTTP-Status, der mit deiner Antwort ausgeliefert wird.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    'Wähle einen Code zum Ausliefern, oder behalte beim Aufruf des Servers den Original-Code aus der ' +
    'Server-Antwort.',
  'workbench.editors.rule.fields.response.keepOriginalStatus': 'Ursprünglichen Statuscode behalten',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    'Der mit dem Body ausgelieferte Content-Type-Header — steuert, wie der Browser ihn parst.',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    'Tippe einen beliebigen Wert; die Vorschläge sind eine Erleichterung. Beim Aufruf des Servers ' +
    'überschreibt er den Content-Type der echten Antwort nur, wenn er gesetzt ist.',
  'workbench.editors.rule.fields.response.headersLabel': 'Antwort-Header',
  'workbench.editors.rule.fields.response.headersInfoSummary':
    'Zusätzliche Header, die neben Content-Type ausgeliefert werden.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    'Beim Aufruf des Servers werden sie über die Header der echten Antwort gemischt; beim Mocken werden sie ' +
    'zu den Headern der Antwort. Leere Zeilen fallen beim Speichern weg.',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': 'Header-Name (z. B. X-Custom)',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': 'Header-Wert',
  'workbench.editors.rule.fields.response.addHeader': 'Header hinzufügen',
  'workbench.editors.rule.fields.response.bodyLabel': 'Antwort-Body',
  'workbench.editors.rule.fields.response.bodyInfoSummary':
    'Die Payload, die der Seite für passende Anfragen ausgeliefert wird.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    'Statische Daten liefert einen festen Body; Dynamisch (JavaScript) baut oder transformiert ihn zum ' +
    'Zeitpunkt der Anfrage.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': 'Die echte Anfrage wird zuerst gesendet. Deine',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    'Funktion erhält die Antwort und den Anfragekontext und gibt dann die veränderte Antwort zurück. Gib ' +
    'einen String oder ein Objekt zurück (automatisch zu JSON serialisiert).',
  'workbench.editors.rule.fields.response.dynMockBefore': 'Es wird keine Anfrage gesendet. Deine',
  'workbench.editors.rule.fields.response.dynMockMid': 'Funktion erhält',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'und gibt den Antwort-Body zurück. Gib einen String oder ein Objekt zurück (automatisch zu JSON ' +
    'serialisiert).',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'WebSocket-Regel',
  'workbench.editors.rule.fields.message.sseKicker': 'SSE-Regel',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    'Verändert, injiziert oder verwirft WebSocket-Frames auf passenden Verbindungen, bevor die Seite oder ' +
    'die Leitung sie sieht.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    'Verändert, injiziert oder verwirft Server-Sent Events auf passenden Streams, bevor Listener sie sehen.',
  'workbench.editors.rule.fields.message.wsIntro':
    'Fängt von der Seite erstellte WebSocket-Verbindungen ab, deren Socket-URL auf die Bedingungen passt. ' +
    'Frames werden in der Seite verändert, injiziert oder verworfen, bevor sie den Seitencode (eingehend) ' +
    'oder die Leitung (ausgehend) erreichen.',
  'workbench.editors.rule.fields.message.sseIntro':
    'Fängt von der Seite erstellte EventSource-Streams ab, deren URL auf die Bedingungen passt. Ereignisse ' +
    'werden in der Seite verändert, injiziert oder verworfen, bevor Listener sie sehen.',
  'workbench.editors.rule.fields.message.operation': 'Operation',
  'workbench.editors.rule.fields.message.opReplace': 'Ersetzen',
  'workbench.editors.rule.fields.message.opInject': 'Injizieren',
  'workbench.editors.rule.fields.message.opDrop': 'Verwerfen',
  'workbench.editors.rule.fields.message.direction': 'Richtung',
  'workbench.editors.rule.fields.message.incoming': 'Eingehend (Server → Seite)',
  'workbench.editors.rule.fields.message.outgoing': 'Ausgehend (Seite → Server)',
  'workbench.editors.rule.fields.message.eventName': 'Ereignisname',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': 'Leer = normale message-Ereignisse',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': 'Gleicht das Feld',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'des Streams ab',
  'workbench.editors.rule.fields.message.frameFilter': 'Frame-Filter',
  'workbench.editors.rule.fields.message.dataFilter': 'Datenfilter',
  'workbench.editors.rule.fields.message.everyFrame': 'Jeder Frame',
  'workbench.editors.rule.fields.message.everyEvent': 'Jedes Ereignis',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs':
    'Filter passen nur auf Text-Frames — Binär-Frames laufen durch, wenn ein Filter gesetzt ist.',
  'workbench.editors.rule.fields.message.filterNoteSse': 'Filter passen nur auf Text-Ereignisse.',
  'workbench.editors.rule.fields.message.injectWhen': 'Injizieren, wenn',
  'workbench.editors.rule.fields.message.connectionOpens': 'Die Verbindung öffnet sich',
  'workbench.editors.rule.fields.message.streamOpens': 'Der Stream öffnet sich',
  'workbench.editors.rule.fields.message.matchingFrameArrives': 'Ein passender Frame ankommt',
  'workbench.editors.rule.fields.message.matchingEventArrives': 'Ein passendes Ereignis ankommt',
  'workbench.editors.rule.fields.message.injectedFrame': 'Injizierter Frame',
  'workbench.editors.rule.fields.message.injectedEvent': 'Injiziertes Ereignis',
  'workbench.editors.rule.fields.message.replacementFrame': 'Ersatz-Frame',
  'workbench.editors.rule.fields.message.replacementEvent': 'Ersatz-Ereignis',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': 'Authentifizierungs-Regel',
  'workbench.editors.rule.fields.auth.infoSummary':
    'Beantwortet HTTP- oder Proxy-Authentifizierungsaufforderungen auf passenden Anfragen mit diesen ' +
    'Zugangsdaten.',
  'workbench.editors.rule.fields.auth.infoDescription':
    'Beide Felder lösen {{templates}} auf, das echte Secret kann also im vault leben ({{vault.*}}) statt im ' +
    'Klartext auf der Regel. Wirkt nur auf Tabs in der Reichweite des Debug-Modus.',
  'workbench.editors.rule.fields.auth.introBefore':
    'Beantwortet eine Authentifizierungsaufforderung des Servers (401) oder eines Proxys (407) auf passenden ' +
    'Anfragen. Referenziere ein Secret aus dem vault — z. B.',
  'workbench.editors.rule.fields.auth.introAfter': '— damit die Zugangsdaten nicht in der Regel gespeichert sind.',
  'workbench.editors.rule.fields.auth.username': 'Benutzername',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': 'z. B. dev-user oder {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'Passwort',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': 'z. B. {{vault.STAGING_PW}}',
} as const satisfies Catalog;
