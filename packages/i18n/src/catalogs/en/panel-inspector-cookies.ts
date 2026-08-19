/**
 * DevTools panel — the inspector Cookies tab: role vocabulary,
 * cookie insight corpora, and the cookie-edit round-trip pair
 * (SameSite labels / On-Off projection / constraint sentences —
 * rendered AND parsed from the same keys; never convert one side
 * alone). Cookie table column headers and Set-Cookie attribute names
 * stay raw (parity grids / wire vocabulary).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail). Raw by design: cookie names and
  // values, Set-Cookie attribute names as titles and field labels
  // (Name / Value / Domain / Path / Expires / SameSite / HttpOnly /
  // Secure / Host-only — S10 response-panel precedent), the table
  // column headers (parity-shaped grid headers), SameSite values and
  // the `COOKIE_SAME_SITE_LABELS` display vocabulary (conflict-merge
  // round-trip parses it back), `S H L` glyph letters, `__Host-` /
  // `__Secure-` prefixes, JWT / JSON / b64 / %-encoded format nouns,
  // 'Session' + relative expiry phrases in `cookie-format.ts` (rides
  // with the Phase I format-ago plane), filter grammar tokens, byte
  // figures, and the ⚠ / ! / ▾ / → glyphs beside keyed values. ───────
  'panel.inspector.cookies.filterPlaceholder':
    'Filter — text, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Filter cookies',
  'panel.inspector.cookies.empty': 'No cookies sent or received.',

  // Table column headers. Set-Cookie attribute tokens (Domain / Path /
  // Expires / SameSite / HttpOnly / Secure) are glossary vocabulary and
  // stay raw where they label a column alone. Section headers localize
  // via the existing section.responseCookies/requestCookies keys — the
  // `label` prop stays the raw identifier.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': '{count} sent · {bytes} B',
  'panel.inspector.cookies.footprint.set': '{count} set · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} will be dropped',
  'panel.inspector.cookies.footprint.filteredOut': '{count} filtered out',
  'panel.inspector.cookies.footprint.flagged': '{count} flagged',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Override Cookies',
  'panel.inspector.cookies.cta.overrideCookiesTitle': 'Create a rule that changes the cookies on matching requests',
  'panel.inspector.cookies.cta.requestCookies': 'Request cookies…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'Replace the Cookie header sent on this request',
  'panel.inspector.cookies.cta.responseCookies': 'Response cookies…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Replace a Set-Cookie header coming back from the server',
  'panel.inspector.cookies.cta.noCookies': 'Don’t send any cookies…',
  'panel.inspector.cookies.cta.noCookiesTitle': 'Drop the Cookie header entirely, so the server sees no cookies',
  'panel.inspector.cookies.cta.addCookie': 'Add cookie',
  'panel.inspector.cookies.cta.addCookieTitle': 'Add a cookie to the browser jar (including HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Override Cookies',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Rule',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    'Creates a rule that rewrites the Cookie / Set-Cookie headers on matching requests while it fires. The browser cookie jar is untouched.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Choices',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Request cookies',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'Replace the Cookie header the browser sends.',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Response cookies',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Replace a Set-Cookie header coming back from the server.',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'Don’t send any cookies',
  'panel.inspector.cookies.ctaInfo.noneDesc':
    'Drop the Cookie header entirely — the server sees a cookie-less request.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Add Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Browser jar',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Writes a real cookie into the browser jar — the same store the browser shows under Application → Cookies.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'It persists beyond this request and the browser attaches it wherever its domain, path and flags match — no rule involved. This is also the way to create HttpOnly cookies, which page scripts can’t set. The value accepts {{variable}} references, resolved once when you save — the jar keeps that snapshot even if the variable changes later; use Override Cookies when the value should track the variable.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie “{name}” saved',
  'panel.inspector.cookies.toast.saveFailed': 'Couldn’t save cookie “{name}”',
  'panel.inspector.cookies.toast.saveFailedWithError': 'Couldn’t save cookie “{name}” — {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie “{name}” deleted',
  'panel.inspector.cookies.toast.deleteFailed': 'Couldn’t delete cookie “{name}”',
  'panel.inspector.cookies.toast.mergeApplied': 'Merge applied to the form — Save writes it to the browser',
  'panel.inspector.cookies.confirmDelete.title': 'Delete cookie “{name}”?',
  'panel.inspector.cookies.confirmDelete.content':
    'This removes it from the browser cookie jar. The page will stop sending it.',
  'panel.inspector.cookies.confirmDelete.ok': 'Delete',

  // More filters ▾ / View ▾ — this tab's own menus (separate referents
  // from the headers tab's). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.cookies.moreFilters.label': 'More filters',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Problems only',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': '3rd-party only',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Rule-modified only',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Show filtered-out request cookies',
  'panel.inspector.cookies.view.label': 'View',
  'panel.inspector.cookies.view.sort': 'Sort',
  'panel.inspector.cookies.view.sortOriginal': 'Original',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Size',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Relative',
  'panel.inspector.cookies.view.expiresAbsolute': 'Absolute',
  'panel.inspector.cookies.view.decodeValues': 'Decode URL-encoded values',
  'panel.inspector.cookies.view.groupByRole': 'Group by role (auth / pref / tracking)',
  'panel.inspector.cookies.view.showTags': 'Show tags',
  'panel.inspector.cookies.view.showSuggestions': 'Show suggestions',

  // Section chrome. Column headers stay raw in the table; the visible
  // count sentence keys.
  'panel.inspector.cookies.section.responseCookies': 'Response Cookies',
  'panel.inspector.cookies.section.requestCookies': 'Request Cookies',
  'panel.inspector.cookies.section.countOf': '{visible} of {total}',

  // Role vocabulary — product classifier copy (fire-evidence badge
  // precedent: product vocabulary keys, it is not browser parity).
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': 'Auth & session',
  'panel.inspector.cookies.role.sectionFunctional': 'Functional',
  'panel.inspector.cookies.role.sectionPref': 'Preferences',
  'panel.inspector.cookies.role.sectionTracking': 'Analytics & tracking',
  'panel.inspector.cookies.role.nounAuth': 'auth / session',
  'panel.inspector.cookies.role.nounTracking': 'analytics / tracking',
  'panel.inspector.cookies.role.nounPref': 'preference / consent',
  'panel.inspector.cookies.role.nounOther': 'cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — {noun} cookie.',
  'panel.inspector.cookies.role.tooltipAuth': 'Looks like an auth / session cookie (heuristic).',
  'panel.inspector.cookies.role.tooltipTracking': 'Looks like an analytics / tracking cookie (heuristic).',
  'panel.inspector.cookies.role.tooltipPref': 'A user-preference cookie.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'partitioned',
  'panel.inspector.cookies.chips.partitionedTitle': 'Isolated to top-level site: {key}',
  'panel.inspector.cookies.chips.thirdParty': '3rd-party',
  'panel.inspector.cookies.chips.justSet': 'just set',
  'panel.inspector.cookies.chips.justSetTitle': 'Set by this response.',
  'panel.inspector.cookies.chips.dropped': 'dropped',
  'panel.inspector.cookies.chips.droppedTitle': 'The browser will reject this Set-Cookie.',
  'panel.inspector.cookies.chips.filteredOut': 'filtered out',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'Not sent on this request.',
  'panel.inspector.cookies.chips.problemTitle': 'See suggestion above.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — sent only over HTTPS.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Missing Secure — SameSite=None requires Secure; browser will reject this cookie.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix': 'Missing Secure — __Host- / __Secure- prefix requires Secure.',
  'panel.inspector.cookies.glyphs.secureOff': 'No Secure attribute.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — not readable from JavaScript.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Readable from JavaScript (no HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict — only sent on same-site navigations.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — sent on cross-site top-level GETs.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None without Secure — browser will reject.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — sent on every cross-site request.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite unspecified.',

  // Row actions + status dots + name/value tooltips. Prefix hints
  // append after the raw cookie name + blank line; the modified header
  // name (Cookie / Set-Cookie) rides the rule-dot title as a raw hole.
  'panel.inspector.cookies.row.copyValue': 'Copy value',
  'panel.inspector.cookies.row.copied': 'Copied',
  'panel.inspector.cookies.row.override': 'Override',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Create a rule to override this Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Create a rule to override this Cookie value',
  'panel.inspector.cookies.row.editCookieTitle': 'Edit this cookie in the browser jar',
  'panel.inspector.cookies.row.editCookieAria': 'Edit cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Delete this cookie from the browser jar',
  'panel.inspector.cookies.row.deleteCookieAria': 'Delete cookie',
  'panel.inspector.cookies.row.ruleDotTitle': 'A rule modifies the {header} header on this request',
  'panel.inspector.cookies.row.ruleDotAria': 'Rule applies',
  'panel.inspector.cookies.row.editedDotTitle': 'Edited from this panel',
  'panel.inspector.cookies.row.editedDotAria': 'Edited',
  'panel.inspector.cookies.row.hostPrefixHint':
    'The __Host- prefix locks this cookie to one host: the browser enforces Secure, Path=/, and no Domain attribute. Set-Cookie lines that violate any of those are rejected.',
  'panel.inspector.cookies.row.securePrefixHint':
    'The __Secure- prefix forces this cookie to be Secure (HTTPS-only). Set-Cookie lines missing Secure are rejected.',
  'panel.inspector.cookies.row.editedValueTitle': 'Edited — request carried: {value}',
  'panel.inspector.cookies.row.valueNoteResponse': 'This response set: {value} — the jar value has changed since.',
  'panel.inspector.cookies.row.valueNoteRequest': 'This request sent: {value} — the jar value has changed since.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Status',
  'panel.inspector.cookies.statusRail.summary': 'A square marks cookies that are not in their raw browser state.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Square colors',
  'panel.inspector.cookies.statusRail.blue': 'blue',
  'panel.inspector.cookies.statusRail.blueDesc':
    'A rule that fired on this request modifies this direction’s Cookie / Set-Cookie header.',
  'panel.inspector.cookies.statusRail.grey': 'grey',
  'panel.inspector.cookies.statusRail.greyDesc': 'Added or edited from this panel during this session.',

  // Add / edit popover. Title reuses the toolbar CTA (names-its-
  // control). The SameSite labels, On/Off flag words and the Session
  // expires word are ROUND-TRIP vocabulary: the conflict projection
  // renders them and the merge dialog parses them back, so display and
  // parse read the same keys (cookie-edit.ts is t-first on both sides).
  'panel.inspector.cookies.edit.editTitle': 'Edit cookie',
  'panel.inspector.cookies.edit.valueChanged': 'value changed',
  'panel.inspector.cookies.edit.goneNote':
    'This cookie was deleted in the browser while the form was open — Save writes it back.',
  'panel.inspector.cookies.edit.openInTab': 'Open in new tab',
  'panel.inspector.cookies.edit.openDirtyTitle':
    'Save or cancel your edits first — the document opens from the browser jar',
  'panel.inspector.cookies.edit.openTitle': 'Open this cookie as a document tab',
  'panel.inspector.cookies.edit.save': 'Save',
  'panel.inspector.cookies.edit.unresolved': 'Doesn’t resolve — create the variable or fix the reference.',
  'panel.inspector.cookies.edit.writes': 'Writes: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'cookie name',
  'panel.inspector.cookies.edit.valuePlaceholder': 'value or {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'On date',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'On',
  'panel.inspector.cookies.edit.flagOff': 'Off',
  // Pre-write constraint sentences — the __Host- / __Secure- prefixes
  // and path “/” ride raw inside; the SameSite label feeds through a
  // hole so the sentence can never drift from the select option.
  'panel.inspector.cookies.edit.constraint.hostSecure': '__Host- cookies must have the Secure flag on.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    '__Host- cookies can’t carry a Domain attribute — turn “Host only” on.',
  'panel.inspector.cookies.edit.constraint.hostPath': '__Host- cookies must use path “/”.',
  'panel.inspector.cookies.edit.constraint.securePrefix': '__Secure- cookies must have the Secure flag on.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite “{label}” requires the Secure flag.',
  // Merge parse-back errors — rendered inline in the merge modal. The
  // quoted field names are the JSON projection's raw keys; the quoted
  // vocabulary words feed through holes from the keys above.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'The merged result isn’t valid JSON — fix the syntax and complete the merge again.',
  'panel.inspector.cookies.edit.merge.notObject': 'The merged result must be a JSON object with the cookie’s fields.',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" must be present as a string.',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" must be "{on}" or "{off}".',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" must be one of {labels}.',
  'panel.inspector.cookies.edit.merge.expiresInvalid': '"expires" must be "{session}" or a date like 2026-07-09T14:30.',

  // Edit-form field (i) corpus — titles are the raw attribute names;
  // the shared template note keys once and composes with ' '.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Example Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Cookie field',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Cookie flag',
  'panel.inspector.cookies.fieldInfo.templateNote':
    'Accepts {{variable}} references, resolved once when you save — the jar stores the resolved text.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'The cookie identifier. Browsers key on (name, domain, path) — same name with a different scope is a separate cookie.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'Prefixes are enforced by the browser: __Host- requires Secure, Path=/ and no Domain; __Secure- requires Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'The cookie payload — what the browser sends back in the Cookie header.',
  'panel.inspector.cookies.fieldInfo.value.description':
    'The value is a snapshot: if the variable changes later the jar keeps this text — use an Override Cookies rule when the value should track the variable.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Which hosts receive the cookie.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'A plain domain like openheaders.com includes its subdomains (the browser stores it with a leading dot) unless Host-only is on, which pins the cookie to exactly this host.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'URL path prefix the cookie rides on — /api means only requests under /api carry it.',
  'panel.inspector.cookies.fieldInfo.path.description': 'Defaults to /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'When the browser deletes the cookie.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Session cookies live until the browser session ends; On date sets an absolute expiry (stored as the Expires attribute).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'When cross-site requests may carry the cookie.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Values',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Same-site requests only.',
  'panel.inspector.cookies.fieldInfo.samesite.lax': 'Same-site plus top-level cross-site navigations (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none': 'Sent cross-site too — the browser requires Secure with it.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': 'Browser default (treated as Lax in Chrome).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Hides the cookie from page JavaScript — document.cookie can’t read or overwrite it.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Only servers (Set-Cookie) and this editor can create HttpOnly cookies; page scripts can’t. The standard hardening for session tokens.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'The cookie travels only over HTTPS — plain http requests never carry it.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Required for SameSite=None and for the __Host- / __Secure- name prefixes.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Pins the cookie to exactly the Domain host — subdomains don’t receive it.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Off, the cookie is stored domain-wide (leading-dot form) and flows to subdomains. The browser’s own cookies are host-only when the server omitted the Domain attribute.',

  // Column (i) corpus — column-name titles stay raw; the Sec cell's
  // long title keys whole (glyph letters ride inside).
  'panel.inspector.cookies.columnInfo.name.summary':
    'The cookie identifier. Browsers key on (name, domain, path) — two cookies with the same name but different scope are distinct.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Chips on the right surface things that are not in any column. They appear next to the name; hover a row to reveal the Override action over the value.',
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Role (heuristic)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    'Looks like an auth / session cookie — name matches sess / session / auth / sid / token / csrf / xsrf, or the cookie is HttpOnly with a long random value.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    'Looks like an analytics / tracking cookie — name matches a known tracker (_ga, _gid, _fbp, NID, IDE, MUID, _hjid, …), or the cookie is third-party with no other classification.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'A user-preference cookie — tz, lang, locale, theme, color-mode, currency, cpu-bucket, font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Lifecycle',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    'Set-Cookie landed on this response and the browser accepted it.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie landed but the browser will reject it — failed a rule like SameSite=None without Secure, __Host- prefix violation, __Secure- prefix without Secure, or Partitioned without Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'The jar holds this cookie but it was not sent on this request (path mismatch, Secure on http, expired, SameSite restriction, …). Only appears when "Show filtered-out request cookies" is on.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Context',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    "The cookie's domain is cross-site to the page's top-frame origin.",
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'CHIPS-style isolation — the cookie is keyed to the top-level site as well as its own scope. Hover for the partition key.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'This cookie triggered an insight (the warning cards at the top of the tab). See the callout to know why.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Prefixes (visible in the name)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'Host-locked — browser enforces Secure, Path=/, no Domain. Violations are rejected.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'HTTPS-only — browser enforces Secure. Violations are rejected.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'The cookie payload. Click a row to expand a panel with parsed views when the value carries structure.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Auto-detected formats',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'Three base64url segments — header and payload are decoded; exp / iat / nbf claims show as relative times.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc': 'Pretty-printed in the expander (works after URL-decoding too).',
  'panel.inspector.cookies.columnInfo.value.b64Desc': 'Plain base64 — decoded body shown when printable.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Percent-encoded text — toggle "Decode URL-encoded values" in View to show decoded inline.',
  'panel.inspector.cookies.columnInfo.scope.summary':
    'Where the browser will attach this cookie — the combined Domain + Path.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'A leading dot on the domain (e.g. `.openheaders.com`) means subdomains are included. A trailing path like `/api` means the cookie is only sent on requests under that path.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'When the browser will stop sending this cookie. Color tracks urgency.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Reading the color',
  'panel.inspector.cookies.columnInfo.expires.red': 'red',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'Already expired, or expires in under an hour.',
  'panel.inspector.cookies.columnInfo.expires.yellow': 'yellow',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Expires within 24 hours.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'plain',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': 'Future — more than a day away.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'No Expires / Max-Age — the browser drops it when the session ends.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Format',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Relative (default)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '"in 7mo", "30s ago" — relative to now. Hover for the absolute date.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Absolute',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'UTC date. Toggle in View → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Serialized cookie size in bytes — `name=value` length, used for the per-request payload total.',
  'panel.inspector.cookies.columnInfo.size.description':
    'Most servers and intermediaries cap the combined Cookie header at 4 KB. Oversized payloads can cause 4xx / 5xx responses without a clear error.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Security (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Three glyphs collapse the Secure / HttpOnly / SameSite attributes into one cell. Color carries the meaning.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Glyphs',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — sent only over HTTPS.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — not readable from JavaScript.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'SameSite restriction (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Color',
  'panel.inspector.cookies.columnInfo.sec.green': 'green',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'On / strict — locked down.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'yellow',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — sent on top-level cross-site GETs.',
  'panel.inspector.cookies.columnInfo.sec.red': 'red',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Missing where required (SameSite=None without Secure, __Host- without Secure, …) — browser will reject.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'gray',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Off / unspecified.',

  // Cookie insights (t-fed `computeCookieInsights`). Names, origins,
  // byte figures and attribute vocabulary ride as raw holes / inline.
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie set with SameSite=None but missing Secure',
      other: '{count} cookies set with SameSite=None but missing Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Modern browsers reject SameSite=None cookies that are not also Secure — they will not be stored.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Add Secure attribute',
  'panel.inspector.cookies.insights.hostPrefix.title': '__Host- prefix violated on {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    '__Host- cookies must be Secure, Path=/, and have no Domain attribute. Browsers reject them otherwise.',
  'panel.inspector.cookies.insights.securePrefix.title': '__Secure- prefix violated on {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    '__Secure- cookies must carry the Secure attribute. Browsers reject them otherwise.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Partitioned cookie missing Secure',
      other: '{count} Partitioned cookies missing Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Partitioned cookies must be Secure.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookies set over plain HTTP',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'These cookies can be observed and replayed by anyone on the path. Use HTTPS + the Secure attribute.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} expired cookie still being sent',
      other: '{count} expired cookies still being sent',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'These cookies have an expiry in the past but the request carried them — the jar will drop them shortly.',
  'panel.inspector.cookies.insights.oversized.title': 'Cookie header is {bytes}B (over the 4KB common limit)',
  'panel.inspector.cookies.insights.oversized.detail':
    'Servers and intermediaries cap header size; oversized Cookie payloads can cause 4xx / 5xx without a clear error.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} third-party cookie set',
      other: '{count} third-party cookies set',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: '{count} third-party cookie set by',
      other: '{count} third-party cookies set by',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Modern browsers may block these in cross-site contexts unless they opt into CHIPS via the Partitioned attribute.',
} as const satisfies Catalog;
