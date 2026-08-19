/**
 * DevTools panel — inspector Cookies tab — German. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by design:
 * cookie names/values, Set-Cookie attribute names as titles and field
 * labels (Name / Value / Domain / Path / Expires / SameSite /
 * HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary, `__Host-` /
 * `__Secure-` prefixes, format nouns, byte figures, and the literal
 * `Session`. Mints: the jar = das Cookie-Glas (short: das Glas);
 * browser rejection = verwerfen (panel-network S70 precedent);
 * violated = verletzt; flag = das Flag raw (n., Secure-Flag); On/Off
 * projection = Ein/Aus (round-trip, both sides); cross-site =
 * websiteübergreifend (Chrome de vocabulary); third-party =
 * Drittanbieter; set (a cookie) = setzen; expiry = ablaufen/Ablauf;
 * insight/suggestion = Vorschlag; cookie scope prose = Geltungsbereich
 * (the Scope column header stays raw); Origin raw (f.); DevTools path
 * quotes Chrome's own de UI (Anwendung → Cookies). Prefix prose leads
 * with „Cookies mit dem Präfix __Host-“ — never a hyphen compound onto
 * the raw token.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ──────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    'Filter — Text, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Cookies filtern',
  'panel.inspector.cookies.empty': 'Keine Cookies gesendet oder empfangen.',

  // Table column headers — parity-shaped grid headers stay raw.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': '{count} gesendet · {bytes} B',
  'panel.inspector.cookies.footprint.set': '{count} gesetzt · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} werden verworfen',
  'panel.inspector.cookies.footprint.filteredOut': '{count} ausgefiltert',
  'panel.inspector.cookies.footprint.flagged': '{count} markiert',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Cookies überschreiben',
  'panel.inspector.cookies.cta.overrideCookiesTitle': 'Eine Regel anlegen, die die Cookies getroffener Anfragen ändert',
  'panel.inspector.cookies.cta.requestCookies': 'Anfrage-Cookies…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'Den auf dieser Anfrage gesendeten Cookie-Header ersetzen',
  'panel.inspector.cookies.cta.responseCookies': 'Antwort-Cookies…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Einen vom Server zurückkommenden Set-Cookie-Header ersetzen',
  'panel.inspector.cookies.cta.noCookies': 'Keine Cookies senden…',
  'panel.inspector.cookies.cta.noCookiesTitle':
    'Den Cookie-Header ganz entfernen, damit der Server keine Cookies sieht',
  'panel.inspector.cookies.cta.addCookie': 'Cookie hinzufügen',
  'panel.inspector.cookies.cta.addCookieTitle':
    'Ein Cookie zum Cookie-Glas des Browsers hinzufügen (einschließlich HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Cookies überschreiben',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Regel',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    'Legt eine Regel an, die die Header Cookie / Set-Cookie getroffener Anfragen umschreibt, solange sie ' +
    'auslöst. Das Cookie-Glas des Browsers bleibt unberührt.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Auswahl',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Anfrage-Cookies',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'Den Cookie-Header ersetzen, den der Browser sendet.',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Antwort-Cookies',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Einen vom Server zurückkommenden Set-Cookie-Header ersetzen.',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'Keine Cookies senden',
  'panel.inspector.cookies.ctaInfo.noneDesc':
    'Den Cookie-Header ganz entfernen — der Server sieht eine Anfrage ohne Cookies.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Cookie hinzufügen',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Cookie-Glas',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Schreibt ein echtes Cookie in das Cookie-Glas des Browsers — derselbe Speicher, den der Browser unter ' +
    'Anwendung → Cookies zeigt.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'Es überdauert diese Anfrage, und der Browser hängt es überall dort an, wo Domain, Pfad und Flags passen — ' +
    'ganz ohne Regel. So entstehen auch HttpOnly-Cookies, die Seitenskripte nicht setzen können. Der Wert ' +
    'akzeptiert {{variable}}-Referenzen, einmal beim Speichern aufgelöst — das Glas behält diesen ' +
    'Schnappschuss, auch wenn sich die Variable später ändert; verwende Cookies überschreiben, wenn der Wert ' +
    'der Variablen folgen soll.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie „{name}“ gespeichert',
  'panel.inspector.cookies.toast.saveFailed': 'Cookie „{name}“ konnte nicht gespeichert werden',
  'panel.inspector.cookies.toast.saveFailedWithError': 'Cookie „{name}“ konnte nicht gespeichert werden — {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie „{name}“ gelöscht',
  'panel.inspector.cookies.toast.deleteFailed': 'Cookie „{name}“ konnte nicht gelöscht werden',
  'panel.inspector.cookies.toast.mergeApplied':
    'Zusammenführung auf das Formular angewendet — Speichern schreibt sie in den Browser',
  'panel.inspector.cookies.confirmDelete.title': 'Cookie „{name}“ löschen?',
  'panel.inspector.cookies.confirmDelete.content':
    'Das entfernt es aus dem Cookie-Glas des Browsers. Die Seite wird es nicht mehr senden.',
  'panel.inspector.cookies.confirmDelete.ok': 'Löschen',

  // More filters ▾ / View ▾ — this tab's own menus.
  'panel.inspector.cookies.moreFilters.label': 'Weitere Filter',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Nur Probleme',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': 'Nur Drittanbieter',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Nur von Regeln verändert',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Ausgefilterte Anfrage-Cookies anzeigen',
  'panel.inspector.cookies.view.label': 'Ansicht',
  'panel.inspector.cookies.view.sort': 'Sortierung',
  'panel.inspector.cookies.view.sortOriginal': 'Original',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Size',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Relativ',
  'panel.inspector.cookies.view.expiresAbsolute': 'Absolut',
  'panel.inspector.cookies.view.decodeValues': 'URL-codierte Werte decodieren',
  'panel.inspector.cookies.view.groupByRole': 'Nach Rolle gruppieren (auth / pref / tracking)',
  'panel.inspector.cookies.view.showTags': 'Tags anzeigen',
  'panel.inspector.cookies.view.showSuggestions': 'Vorschläge anzeigen',

  // Section chrome.
  'panel.inspector.cookies.section.responseCookies': 'Antwort-Cookies',
  'panel.inspector.cookies.section.requestCookies': 'Anfrage-Cookies',
  'panel.inspector.cookies.section.countOf': '{visible} von {total}',

  // Role vocabulary — product classifier copy.
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': 'Auth & Sitzung',
  'panel.inspector.cookies.role.sectionFunctional': 'Funktional',
  'panel.inspector.cookies.role.sectionPref': 'Präferenzen',
  'panel.inspector.cookies.role.sectionTracking': 'Analyse & Tracking',
  'panel.inspector.cookies.role.nounAuth': 'Auth / Sitzung',
  'panel.inspector.cookies.role.nounTracking': 'Analyse / Tracking',
  'panel.inspector.cookies.role.nounPref': 'Präferenz / Einwilligung',
  'panel.inspector.cookies.role.nounOther': 'Cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — Cookie für {noun}.',
  'panel.inspector.cookies.role.tooltipAuth': 'Sieht nach einem Cookie für Auth / Sitzung aus (Heuristik).',
  'panel.inspector.cookies.role.tooltipTracking': 'Sieht nach einem Cookie für Analyse / Tracking aus (Heuristik).',
  'panel.inspector.cookies.role.tooltipPref': 'Ein Cookie für Benutzerpräferenzen.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'partitioniert',
  'panel.inspector.cookies.chips.partitionedTitle': 'Isoliert auf die Top-Level-Site: {key}',
  'panel.inspector.cookies.chips.thirdParty': 'Drittanbieter',
  'panel.inspector.cookies.chips.justSet': 'gerade gesetzt',
  'panel.inspector.cookies.chips.justSetTitle': 'Von dieser Antwort gesetzt.',
  'panel.inspector.cookies.chips.dropped': 'verworfen',
  'panel.inspector.cookies.chips.droppedTitle': 'Der Browser wird dieses Set-Cookie verwerfen.',
  'panel.inspector.cookies.chips.filteredOut': 'ausgefiltert',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'Auf dieser Anfrage nicht gesendet.',
  'panel.inspector.cookies.chips.problemTitle': 'Siehe den Vorschlag oben.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — nur über HTTPS gesendet.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Secure fehlt — SameSite=None verlangt Secure; der Browser wird dieses Cookie verwerfen.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix':
    'Secure fehlt — das Präfix __Host- / __Secure- verlangt Secure.',
  'panel.inspector.cookies.glyphs.secureOff': 'Kein Secure-Attribut.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — nicht aus JavaScript lesbar.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Aus JavaScript lesbar (kein HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict':
    'SameSite=Strict — nur bei Navigationen innerhalb derselben Website gesendet.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — bei websiteübergreifenden Top-Level-GETs gesendet.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None ohne Secure — der Browser wird es verwerfen.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — bei jeder websiteübergreifenden Anfrage gesendet.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite nicht angegeben.',

  // Row actions + status dots + name/value tooltips.
  'panel.inspector.cookies.row.copyValue': 'Wert kopieren',
  'panel.inspector.cookies.row.copied': 'Kopiert',
  'panel.inspector.cookies.row.override': 'Überschreiben',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Eine Regel anlegen, um dieses Set-Cookie zu überschreiben',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Eine Regel anlegen, um diesen Cookie-Wert zu überschreiben',
  'panel.inspector.cookies.row.editCookieTitle': 'Dieses Cookie im Cookie-Glas des Browsers bearbeiten',
  'panel.inspector.cookies.row.editCookieAria': 'Cookie bearbeiten',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Dieses Cookie aus dem Cookie-Glas des Browsers löschen',
  'panel.inspector.cookies.row.deleteCookieAria': 'Cookie löschen',
  'panel.inspector.cookies.row.ruleDotTitle': 'Eine Regel verändert den {header}-Header auf dieser Anfrage',
  'panel.inspector.cookies.row.ruleDotAria': 'Regel greift',
  'panel.inspector.cookies.row.editedDotTitle': 'Über dieses Panel bearbeitet',
  'panel.inspector.cookies.row.editedDotAria': 'Bearbeitet',
  'panel.inspector.cookies.row.hostPrefixHint':
    'Das Präfix __Host- bindet dieses Cookie an genau einen Host: Der Browser erzwingt Secure, Path=/ und kein ' +
    'Domain-Attribut. Set-Cookie-Zeilen, die eine dieser Vorgaben verletzen, werden verworfen.',
  'panel.inspector.cookies.row.securePrefixHint':
    'Das Präfix __Secure- erzwingt, dass dieses Cookie Secure ist (nur HTTPS). Set-Cookie-Zeilen ohne Secure ' +
    'werden verworfen.',
  'panel.inspector.cookies.row.editedValueTitle': 'Bearbeitet — die Anfrage trug: {value}',
  'panel.inspector.cookies.row.valueNoteResponse':
    'Diese Antwort setzte: {value} — der Wert im Glas hat sich seitdem geändert.',
  'panel.inspector.cookies.row.valueNoteRequest':
    'Diese Anfrage sendete: {value} — der Wert im Glas hat sich seitdem geändert.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Status',
  'panel.inspector.cookies.statusRail.summary':
    'Ein Quadrat markiert Cookies, die nicht in ihrem rohen Browser-Zustand sind.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Quadratfarben',
  'panel.inspector.cookies.statusRail.blue': 'blau',
  'panel.inspector.cookies.statusRail.blueDesc':
    'Eine auf dieser Anfrage ausgelöste Regel verändert den Header Cookie / Set-Cookie dieser Richtung.',
  'panel.inspector.cookies.statusRail.grey': 'grau',
  'panel.inspector.cookies.statusRail.greyDesc': 'In dieser Sitzung über dieses Panel hinzugefügt oder bearbeitet.',

  // Add / edit popover. The SameSite labels stay raw (round-trip
  // vocabulary); the Ein/Aus projection words translate on BOTH sides
  // (rendered and parsed from these same keys).
  'panel.inspector.cookies.edit.editTitle': 'Cookie bearbeiten',
  'panel.inspector.cookies.edit.valueChanged': 'Wert geändert',
  'panel.inspector.cookies.edit.goneNote':
    'Dieses Cookie wurde im Browser gelöscht, während das Formular offen war — Speichern schreibt es zurück.',
  'panel.inspector.cookies.edit.openInTab': 'In neuem Tab öffnen',
  'panel.inspector.cookies.edit.openDirtyTitle':
    'Speichere oder verwirf deine Änderungen zuerst — das Dokument öffnet sich aus dem Cookie-Glas des Browsers',
  'panel.inspector.cookies.edit.openTitle': 'Dieses Cookie als Dokument-Tab öffnen',
  'panel.inspector.cookies.edit.save': 'Speichern',
  'panel.inspector.cookies.edit.unresolved': 'Löst sich nicht auf — lege die Variable an oder korrigiere die Referenz.',
  'panel.inspector.cookies.edit.writes': 'Schreibt: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'Cookie-Name',
  'panel.inspector.cookies.edit.valuePlaceholder': 'Wert oder {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'Am Datum',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'Ein',
  'panel.inspector.cookies.edit.flagOff': 'Aus',
  // Pre-write constraint sentences.
  'panel.inspector.cookies.edit.constraint.hostSecure':
    'Cookies mit dem Präfix __Host- müssen das Secure-Flag gesetzt haben.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    'Cookies mit dem Präfix __Host- dürfen kein Domain-Attribut tragen — schalte „Host-only“ ein.',
  'panel.inspector.cookies.edit.constraint.hostPath': 'Cookies mit dem Präfix __Host- müssen den Pfad „/“ verwenden.',
  'panel.inspector.cookies.edit.constraint.securePrefix':
    'Cookies mit dem Präfix __Secure- müssen das Secure-Flag gesetzt haben.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite „{label}“ erfordert das Secure-Flag.',
  // Merge parse-back errors.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'Das zusammengeführte Ergebnis ist kein gültiges JSON — korrigiere die Syntax und schließe die ' +
    'Zusammenführung erneut ab.',
  'panel.inspector.cookies.edit.merge.notObject':
    'Das zusammengeführte Ergebnis muss ein JSON-Objekt mit den Feldern des Cookies sein.',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" muss als String vorhanden sein.',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" muss "{on}" oder "{off}" sein.',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" muss einer der Werte {labels} sein.',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    '"expires" muss "{session}" oder ein Datum wie 2026-07-09T14:30 sein.',

  // Edit-form field (i) corpus — titles are the raw attribute names.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Beispiel für Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Cookie-Feld',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Cookie-Flag',
  'panel.inspector.cookies.fieldInfo.templateNote':
    'Akzeptiert {{variable}}-Referenzen, einmal beim Speichern aufgelöst — das Glas speichert den aufgelösten Text.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'Der Bezeichner des Cookies. Browser schlüsseln nach (name, domain, path) — derselbe Name mit anderem ' +
    'Geltungsbereich ist ein eigenes Cookie.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'Der Browser erzwingt die Präfixe: __Host- verlangt Secure, Path=/ und kein Domain; __Secure- verlangt Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'Die Payload des Cookies — das, was der Browser im Cookie-Header zurückschickt.',
  'panel.inspector.cookies.fieldInfo.value.description':
    'Der Wert ist ein Schnappschuss: Ändert sich die Variable später, behält das Glas diesen Text — verwende ' +
    'eine „Cookies überschreiben“-Regel, wenn der Wert der Variablen folgen soll.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Welche Hosts das Cookie erhalten.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'Eine einfache Domain wie openheaders.com schließt ihre Subdomains ein (der Browser speichert sie mit ' +
    'führendem Punkt), außer Host-only ist eingeschaltet, was das Cookie exakt auf diesen Host festlegt.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'URL-Pfadpräfix, auf dem das Cookie mitfährt — /api bedeutet, dass nur Anfragen unter /api es tragen.',
  'panel.inspector.cookies.fieldInfo.path.description': 'Standard: /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'Wann der Browser das Cookie löscht.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Session-Cookies leben, bis die Browser-Sitzung endet; Am Datum setzt einen absoluten Ablauf (gespeichert ' +
    'als Expires-Attribut).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'Wann websiteübergreifende Anfragen das Cookie tragen dürfen.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Werte',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Nur Anfragen derselben Website.',
  'panel.inspector.cookies.fieldInfo.samesite.lax':
    'Dieselbe Website plus websiteübergreifende Top-Level-Navigationen (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none':
    'Auch websiteübergreifend gesendet — der Browser verlangt dazu Secure.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': 'Browser-Standard (in Chrome wie Lax behandelt).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Verbirgt das Cookie vor dem JavaScript der Seite — document.cookie kann es weder lesen noch überschreiben.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Nur Server (Set-Cookie) und dieser Editor können HttpOnly-Cookies anlegen; Seitenskripte nicht. Die ' +
    'Standard-Härtung für Sitzungs-Tokens.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'Das Cookie reist nur über HTTPS — einfache http-Anfragen tragen es nie.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Erforderlich für SameSite=None und für die Namenspräfixe __Host- / __Secure-.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Legt das Cookie exakt auf den Domain-Host fest — Subdomains erhalten es nicht.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Ausgeschaltet wird das Cookie domainweit gespeichert (Form mit führendem Punkt) und fließt zu den ' +
    'Subdomains. Die eigenen Cookies des Browsers sind host-only, wenn der Server das Domain-Attribut ' +
    'weggelassen hat.',

  // Column (i) corpus — column-name titles stay raw.
  'panel.inspector.cookies.columnInfo.name.summary':
    'Der Bezeichner des Cookies. Browser schlüsseln nach (name, domain, path) — zwei Cookies mit demselben ' +
    'Namen, aber anderem Geltungsbereich sind verschieden.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Die Chips rechts zeigen Fakten, die in keiner Spalte stehen. Sie erscheinen neben dem Namen; fahre über ' +
    'eine Zeile, um die Aktion Überschreiben über dem Wert einzublenden.',
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Rolle (Heuristik)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    'Sieht nach einem Cookie für Auth / Sitzung aus — der Name passt auf sess / session / auth / sid / token / ' +
    'csrf / xsrf, oder das Cookie ist HttpOnly mit einem langen Zufallswert.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    'Sieht nach einem Cookie für Analyse / Tracking aus — der Name passt auf einen bekannten Tracker (_ga, ' +
    '_gid, _fbp, NID, IDE, MUID, _hjid, …), oder das Cookie stammt von Drittanbietern ohne andere Einordnung.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'Ein Cookie für Benutzerpräferenzen — tz, lang, locale, theme, color-mode, currency, cpu-bucket, ' + 'font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Lebenszyklus',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    'Set-Cookie kam mit dieser Antwort an, und der Browser hat es angenommen.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie kam an, aber der Browser wird es verwerfen — gescheitert an einer Vorgabe wie SameSite=None ' +
    'ohne Secure, einem Verstoß gegen das Präfix __Host-, __Secure- ohne Secure oder Partitioned ohne Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'Das Glas enthält dieses Cookie, aber auf dieser Anfrage wurde es nicht gesendet (Pfad passt nicht, Secure ' +
    'über http, abgelaufen, SameSite-Beschränkung, …). Erscheint nur, wenn „Ausgefilterte Anfrage-Cookies ' +
    'anzeigen“ eingeschaltet ist.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Kontext',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    'Die Domain des Cookies liegt websiteübergreifend zur Top-Frame-Origin der Seite.',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'Isolation im CHIPS-Stil — das Cookie wird zusätzlich zu seinem eigenen Geltungsbereich nach der ' +
    'Top-Level-Site geschlüsselt. Fahre darüber für den Partitionsschlüssel.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'Dieses Cookie hat einen Vorschlag ausgelöst (die Warnkarten oben im Tab). Der Kasten erklärt, warum.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Präfixe (im Namen sichtbar)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'An den Host gebunden — der Browser erzwingt Secure, Path=/ und kein Domain. Verstöße werden verworfen.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'Nur HTTPS — der Browser erzwingt Secure. Verstöße werden verworfen.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'Die Payload des Cookies. Klicke auf eine Zeile, um ein Panel mit geparsten Ansichten aufzuklappen, wenn ' +
    'der Wert Struktur trägt.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Automatisch erkannte Formate',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'Drei base64url-Segmente — Header und Payload werden decodiert; die Claims exp / iat / nbf erscheinen als ' +
    'relative Zeiten.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc':
    'Im aufgeklappten Panel formatiert (funktioniert auch nach URL-Decodierung).',
  'panel.inspector.cookies.columnInfo.value.b64Desc':
    'Einfaches Base64 — der decodierte Inhalt wird angezeigt, wenn er druckbar ist.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Prozent-codierter Text — schalte „URL-codierte Werte decodieren“ in Ansicht ein, um das Decodierte inline ' +
    'zu zeigen.',
  'panel.inspector.cookies.columnInfo.scope.summary':
    'Wo der Browser dieses Cookie anhängen wird — die Kombination aus Domain + Path.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'Ein führender Punkt in der Domain (z. B. `.openheaders.com`) bedeutet, dass Subdomains eingeschlossen ' +
    'sind. Ein nachgestellter Pfad wie `/api` bedeutet, dass das Cookie nur bei Anfragen unter diesem Pfad ' +
    'gesendet wird.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'Wann der Browser aufhört, dieses Cookie zu senden. Die Farbe zeigt die Dringlichkeit.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Die Farbe lesen',
  'panel.inspector.cookies.columnInfo.expires.red': 'rot',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'Bereits abgelaufen oder läuft in weniger als einer Stunde ab.',
  'panel.inspector.cookies.columnInfo.expires.yellow': 'gelb',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Läuft innerhalb von 24 Stunden ab.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'neutral',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': 'Zukunft — mehr als einen Tag entfernt.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Kein Expires / Max-Age — der Browser verwirft es, wenn die Sitzung endet.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Format',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Relativ (Standard)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '„in 7mo“, „30s ago“ — relativ zu jetzt. Fahre darüber für das absolute Datum.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Absolut',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'UTC-Datum. Umschalten unter Ansicht → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Serialisierte Cookie-Größe in Bytes — die Länge von `name=value`, verwendet für die Payload-Summe pro ' +
    'Anfrage.',
  'panel.inspector.cookies.columnInfo.size.description':
    'Die meisten Server und Zwischenstationen begrenzen den kombinierten Cookie-Header auf 4 KB. Übergroße ' +
    'Payloads können 4xx / 5xx ohne klare Fehlermeldung verursachen.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Sicherheit (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Drei Zeichen verdichten die Attribute Secure / HttpOnly / SameSite in eine Zelle. Die Farbe trägt die ' +
    'Bedeutung.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Zeichen',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — nur über HTTPS gesendet.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — nicht aus JavaScript lesbar.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'SameSite-Beschränkung (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Farbe',
  'panel.inspector.cookies.columnInfo.sec.green': 'grün',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'Ein / strikt — abgeriegelt.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'gelb',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — bei websiteübergreifenden Top-Level-GETs gesendet.',
  'panel.inspector.cookies.columnInfo.sec.red': 'rot',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Fehlt, wo es verlangt wird (SameSite=None ohne Secure, __Host- ohne Secure, …) — der Browser wird es ' +
    'verwerfen.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'grau',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Aus / nicht angegeben.',

  // Cookie insights (t-fed `computeCookieInsights`).
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Cookie mit SameSite=None gesetzt, aber ohne Secure',
      other: '{count} Cookies mit SameSite=None gesetzt, aber ohne Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Moderne Browser verwerfen Cookies mit SameSite=None, die nicht auch Secure sind — sie werden nicht ' +
    'gespeichert.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Secure-Attribut hinzufügen',
  'panel.inspector.cookies.insights.hostPrefix.title': 'Präfix __Host- verletzt bei {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    'Cookies mit dem Präfix __Host- müssen Secure sein, Path=/ verwenden und kein Domain-Attribut tragen. ' +
    'Andernfalls verwerfen Browser sie.',
  'panel.inspector.cookies.insights.securePrefix.title': 'Präfix __Secure- verletzt bei {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    'Cookies mit dem Präfix __Secure- müssen das Secure-Attribut tragen. Andernfalls verwerfen Browser sie.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Cookie mit Partitioned, aber ohne Secure',
      other: '{count} Cookies mit Partitioned, aber ohne Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Cookies mit Partitioned müssen Secure sein.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookies über einfaches HTTP gesetzt',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'Jeder auf dem Weg kann diese Cookies beobachten und wieder abspielen. Verwende HTTPS + das ' + 'Secure-Attribut.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} abgelaufenes Cookie wird noch gesendet',
      other: '{count} abgelaufene Cookies werden noch gesendet',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'Diese Cookies haben einen Ablauf in der Vergangenheit, aber die Anfrage trug sie — das Glas wird sie in ' +
    'Kürze verwerfen.',
  'panel.inspector.cookies.insights.oversized.title':
    'Der Cookie-Header umfasst {bytes}B (über dem üblichen Limit von 4KB)',
  'panel.inspector.cookies.insights.oversized.detail':
    'Server und Zwischenstationen begrenzen die Header-Größe; übergroße Cookie-Payloads können 4xx / 5xx ohne ' +
    'klare Fehlermeldung verursachen.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Drittanbieter-Cookie gesetzt',
      other: '{count} Drittanbieter-Cookies gesetzt',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: '{count} Drittanbieter-Cookie gesetzt von',
      other: '{count} Drittanbieter-Cookies gesetzt von',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Moderne Browser können diese in websiteübergreifenden Kontexten blockieren, sofern sie nicht über das ' +
    'Attribut Partitioned in CHIPS einwilligen.',
} as const satisfies Catalog;
