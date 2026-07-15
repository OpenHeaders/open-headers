/**
 * Workbench editors station (Phase C) — the rule editor family
 * (RuleEditor shell, ConditionEditor + condition-type registry, the
 * condition/action issue banners, the resolution banner, the twelve
 * rule-fields modules) and the request editor family: request side
 * (RequestEditor shell + URL bar + tab registry, the seven tab bodies,
 * the shared editable-grid chrome), response side (ResponsePanel +
 * meta strip + the six views + empty/error states), and the
 * response-example editor that mirrors it. Grows per editors-station
 * slice.
 *
 * Namespaces: rule copy under `workbench.editors.rule.*`, request copy
 * under `workbench.editors.request.*` (response-panel copy under
 * `workbench.editors.request.response.*`), response-example copy under
 * `workbench.editors.responseExample.*`. The editable-grid chrome is a
 * shared component (request editor + response-example editor), so it
 * carries its own `workbench.editors.grid.*` namespace — a component
 * namespace per the pane-shared rule, NOT a cross-editor vocabulary
 * promotion (no `workbench.editors.fields.*` exists; the two editor
 * families share no field vocab). The script-editor satellites
 * (snippets/packages menus, save-to-package, ScriptsTab menu actions)
 * are workbench-only and live under `workbench.editors.scriptEditor.*`;
 * the template-input and value-editors families mount on panel + popup
 * surfaces too, so their copy lives in `shared-components.ts`
 * (`shared.templateInput.*` / `shared.valueEditors.*`), not here.
 *
 * Conventions carried from the settings station:
 *   - Registry text converts to keys outright (S5) — `condition-types.ts`
 *     carries `labelKey`/`groupKey`; placeholders stay literal pattern
 *     examples.
 *   - Core validators stay copy-free at the UI boundary: banners map
 *     `issue.kind` → key here; core keeps its English `message` for the
 *     SW observability log. Kinds delegating to `headers.ts` copy
 *     (header name/value/operation) fall back to the raw message until
 *     that shared plane converts.
 *   - Technical plane stays raw inside keyed sentences: condition type
 *     ids ({type}), HTTP methods, DNR field names (requestDomains,
 *     url-filter), code identifiers (modifyResponse(), {{vault.*}}),
 *     regex fragments, header names.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditors = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Saved',
  'workbench.editors.header.onTop': 'Header on Top',
  'workbench.editors.header.atBottom': 'Header at Bottom',
  'workbench.editors.header.moreActions': 'More actions',
  'workbench.editors.sectionInfo.moreInformation': 'More information',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'Rule Editor',
  'workbench.editors.rule.templates.title': 'Templates',
  'workbench.editors.rule.templates.infoSummary': 'Start from a preset instead of a blank form.',
  'workbench.editors.rule.templates.infoDescription':
    'System templates ship with the app; user templates are ones you save yourself via ⋮ → Save as User Template. Applying a template only pre-fills the fields — adjust anything before saving.',
  'workbench.editors.rule.templates.blank': 'Blank',
  'workbench.editors.rule.templates.system': 'System',
  'workbench.editors.rule.templates.user': 'User',
  'workbench.editors.rule.templates.emptyTitle': 'No user templates yet',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'User templates are your own reusable presets for this rule type. Configure the rule the way you want, then choose',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → Save as User Template',
  'workbench.editors.rule.templates.emptyAfterMenu':
    'in the header — it will show up here for every new rule of this type.',
  'workbench.editors.rule.saveAsTemplate': 'Save as User Template',
  'workbench.editors.rule.enabled': 'Enabled',
  'workbench.editors.rule.disabled': 'Disabled',
  'workbench.editors.rule.toast.unknownType': 'Unknown rule type',
  'workbench.editors.rule.toast.deletedOtherTab': 'Rule was deleted from another tab',
  'workbench.editors.rule.toast.updateFailed': 'Failed to update rule',
  'workbench.editors.rule.toast.updateFailedDetail': 'Failed to update rule: {message}',
  'workbench.editors.rule.toast.publishFailed': 'Rule saved but publication failed',
  'workbench.editors.rule.toast.updated': 'Rule updated',
  'workbench.editors.rule.toast.published': 'Rule published',
  'workbench.editors.rule.toast.formatSkipped': 'Format on save skipped: {reason}',
  'workbench.editors.rule.toast.noCollection': 'No collection found',
  'workbench.editors.rule.toast.restoreFailed': 'Failed to restore rule',
  'workbench.editors.rule.toast.restored': 'Rule restored',
  'workbench.editors.rule.deleted.message': 'This rule was deleted from another surface.',
  'workbench.editors.rule.deleted.description':
    'Restore creates a fresh copy with a new id (the original tombstone is permanent — see sync engine spec §7.2).',
  'workbench.editors.rule.deleted.restore': 'Restore',
  'workbench.editors.rule.conditionsPane.title': 'Conditions',
  'workbench.editors.rule.conditionsPane.infoSummary': 'Conditions decide which requests this rule applies to.',
  'workbench.editors.rule.conditionsPane.infoAndBefore': 'Rows combine with',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '— every row must match.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': 'Values inside one row combine with',
  'workbench.editors.rule.conditionsPane.infoOrAfter': '(the OR badge marks rows that accept multiple values).',
  'workbench.editors.rule.conditionsPane.infoAddOne': 'Add at least one condition.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'URL Matching',
  'workbench.editors.rule.condition.group.domainFiltering': 'Domain Filtering',
  'workbench.editors.rule.condition.group.requestFiltering': 'Request Filtering',
  'workbench.editors.rule.condition.group.headerMatching': 'Header Matching',
  'workbench.editors.rule.condition.type.urlFilter': 'URL Pattern',
  'workbench.editors.rule.condition.type.urlRegex': 'URL Regex',
  'workbench.editors.rule.condition.type.requestDomains': 'Request Domains',
  'workbench.editors.rule.condition.type.excludeRequestDomains': 'Exclude Domains',
  'workbench.editors.rule.condition.type.initiatorDomains': 'Initiator Domains',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': 'Excl. Initiator',
  'workbench.editors.rule.condition.type.requestMethods': 'Methods',
  'workbench.editors.rule.condition.type.excludeRequestMethods': 'Excl. Methods',
  'workbench.editors.rule.condition.type.resourceTypes': 'Resource Types',
  'workbench.editors.rule.condition.type.excludeResourceTypes': 'Excl. Resources',
  'workbench.editors.rule.condition.type.domainType': 'Domain Type',
  'workbench.editors.rule.condition.type.responseHeader': 'Response Header',
  'workbench.editors.rule.condition.type.excludeResponseHeader': 'Excl. Resp Header',
  'workbench.editors.rule.condition.suffix.notSupported': ' — not supported by Chrome DNR',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ' — already used',
  'workbench.editors.rule.condition.firstParty': 'First-party',
  'workbench.editors.rule.condition.thirdParty': 'Third-party',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': 'No conditions — rule will not match any requests',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    "Rows combine with AND — every row must match for the rule to fire. Each row targets a different DNR field, so AND across rows is exact. To OR multiple values within one field, list them inside one row (see the row's OR badge).",
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    'This is an exclusion condition — the rule fires only when NONE of the listed values match.',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    'Multiple values in this row match if ANY value matches (OR). Rows below combine with AND.',
  'workbench.editors.rule.condition.oneValueTag': '1 value',
  'workbench.editors.rule.condition.oneValueTooltip':
    'This condition takes a single value — comma-separating has no effect. Rows below combine with AND.',
  'workbench.editors.rule.condition.headerNamePlaceholder': 'Header name equals...',
  'workbench.editors.rule.condition.headerValuePlaceholder': 'Header value equals...',
  'workbench.editors.rule.condition.selectMethods': 'Select methods',
  'workbench.editors.rule.condition.selectTypes': 'Select types',
  'workbench.editors.rule.condition.selectType': 'Select type',
  'workbench.editors.rule.condition.valuePlaceholder': 'value',
  'workbench.editors.rule.condition.add': 'Add condition',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    "Only the last {type} row applies — this row's value won't reach Chrome. Remove this row, or move its values into the row that wins.",
  'workbench.editors.rule.issue.mutexConflict':
    '{type} and {winningType} share a DNR slot — only the last one applies. Pick one.',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'This condition type is not supported by Chrome DNR yet — the rule still saves but this row ships nothing on the wire.',
  'workbench.editors.rule.issue.emptyUrlFilter': 'URL pattern cannot be empty.',
  'workbench.editors.rule.issue.emptyUrlRegex': 'URL regex cannot be empty.',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'URL pattern cannot contain whitespace — Chrome rejects rules with spaces in url-filter.',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'URL pattern contains non-ASCII characters — Chrome rejects them. Use punycode (xn--…) for IDN hostnames.',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    'This looks like a regex — in URL Pattern, characters like `(`, `[`, `+`, `?`, `\\d` are matched literally. Switch to URL Regex if you need regex syntax.',
  'workbench.editors.rule.issue.regexLookbehind':
    "Chrome's regex engine (RE2) does not support lookbehind assertions ((?<=…), (?<!…)). The rule may fail to load.",
  'workbench.editors.rule.issue.regexNamedGroup':
    "Chrome's regex engine (RE2) does not support Python-style named groups ((?P<name>…)). The rule may fail to load.",
  'workbench.editors.rule.issue.invalidUrlRegex': 'Invalid regex: {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '"{value}" is not a valid HTTP method. Allowed: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType': '"{value}" is not a valid resource type. Pick from the dropdown.',
  'workbench.editors.rule.issue.invalidDomainType':
    '"{value}" is not a valid domain type. Use "firstParty" or "thirdParty".',
  'workbench.editors.rule.issue.headerNameRequired': 'Header name is required.',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    'Whitespace inside the value — separate hostnames with a comma. requestDomains takes one bare hostname per entry.',
  'workbench.editors.rule.issue.domain.scheme':
    "Drop the scheme — Chrome's requestDomains takes hostnames only, not URLs.",
  'workbench.editors.rule.issue.domain.wildcard':
    "Drop the wildcard — requestDomains matches all subdomains automatically, so '*.foo.com' is just 'foo.com'.",
  'workbench.editors.rule.issue.domain.port':
    'Drop the port — requestDomains matches by hostname only; the rule covers every port automatically.',
  'workbench.editors.rule.issue.domain.uppercase':
    'Lowercase the hostname — Chrome only accepts lowercase ASCII in requestDomains.',
  'workbench.editors.rule.issue.domain.nonAscii':
    'Hostname contains characters Chrome rejects in requestDomains (likely a non-ASCII / IDN entry). Use the punycode (xn--…) form.',
  'workbench.editors.rule.issue.domain.empty': 'Empty hostname — remove this row.',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} affected entry', other: '{count} affected entries' }),
  'workbench.editors.rule.issue.domain.cleanUp': 'Clean up',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': 'Redirect target cannot contain whitespace.',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'Redirect target must be a full URL (http://, https://, chrome-extension://) or a path starting with /.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    'Source URL must use http://, https://, or chrome-extension://.',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': 'Source URL is not a valid URL.',
  'workbench.editors.rule.actionIssue.invalidStatusCode': 'Status code must be an integer 100-599.',
  'workbench.editors.rule.actionIssue.invalidParamName': 'Param name cannot contain `&`, `=`, `#`, `?`, or whitespace.',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'Main-frame delay is capped at 30000ms; values above are clamped on the wire.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'XHR/fetch monkey-patch caps delays at 5000ms to avoid HTTP connection-pool starvation. Main-frame redirects honor up to 30000ms.',
  'workbench.editors.rule.actionIssue.invalidContentType':
    'Content type should look like "type/subtype" (e.g. application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'GraphQL filter key is required.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'Message filter value is required when a filter is configured.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex': 'Message filter is not a valid regular expression.',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    'Injecting after a matching message requires a message filter.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} unresolved variable in this rule',
      other: '{count} unresolved variables in this rule',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': 'unresolved',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'not in scope',
  'workbench.editors.rule.resolution.reason.unknownNamespace': 'unknown namespace',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': 'step ref out of scope',
  'workbench.editors.rule.resolution.reason.empty': 'empty',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': 'invalid value',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    'no cached run for env "{envName}" — open the workflow and click Refresh under this env to populate',
  'workbench.editors.rule.resolution.hint.disabledLv':
    'live variable is disabled — enable it in the Live Variables editor',
  'workbench.editors.rule.resolution.hint.draftLv': 'live variable is a draft — open it and click Save to publish',
  'workbench.editors.rule.resolution.noEnvironment': 'No environment',
  'workbench.editors.rule.resolution.activeEnvFallback': 'active env',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'Actions',
  'workbench.editors.rule.fields.addAction': 'Add action',
  'workbench.editors.rule.fields.reset': 'Reset',
  'workbench.editors.rule.fields.optionalTag': '(optional)',
  'workbench.editors.rule.fields.opAddReplace': 'Add / Replace',
  'workbench.editors.rule.fields.opAppend': 'Append',
  'workbench.editors.rule.fields.opRemove': 'Remove',
  'workbench.editors.rule.fields.opMerge': 'Merge',
  'workbench.editors.rule.fields.opReplaceOnly': 'Replace Only',
  'workbench.editors.rule.fields.opRemoveAll': 'Remove All',
  'workbench.editors.rule.fields.operatorEquals': 'Equals',
  'workbench.editors.rule.fields.operatorContains': 'Contains',
  'workbench.editors.rule.fields.restApi': 'REST API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL API',
  'workbench.editors.rule.fields.staticData': 'Static Data',
  'workbench.editors.rule.fields.dynamicJs': 'Dynamic (JavaScript)',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'GraphQL Operation (Request Payload Filter)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'Key e.g. operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': 'value e.g. getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': 'Header Rule',
  'workbench.editors.rule.fields.header.infoSummary': 'Rewrites request and response headers on matching traffic.',
  'workbench.editors.rule.fields.header.infoDescription':
    'Invalid combinations (e.g. Append on a custom header) mark the rule as a draft. Drafts are saved but not executed.',
  'workbench.editors.rule.fields.header.requestTab': 'Request Headers',
  'workbench.editors.rule.fields.header.requestTabSummary':
    'Header actions applied to the outgoing request before it leaves the browser.',
  'workbench.editors.rule.fields.header.responseTab': 'Response Headers',
  'workbench.editors.rule.fields.header.responseTabSummary':
    'Header actions applied to the response before the page sees it.',
  'workbench.editors.rule.fields.header.responseTabDescription':
    'The browser’s own DevTools Network tab always shows the original server headers, so these changes are invisible there even though they are applied. The Open Headers DevTools window has no such limitation — it shows the headers exactly as served to the page.',
  'workbench.editors.rule.fields.header.emptyRequest': 'No actions — this rule leaves request headers unchanged',
  'workbench.editors.rule.fields.header.emptyResponse': 'No actions — this rule leaves response headers unchanged',
  'workbench.editors.rule.fields.header.namePlaceholder': 'Header Name',
  'workbench.editors.rule.fields.header.valuePlaceholder': 'Header Value',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': 'Value to append',
  'workbench.editors.rule.fields.header.existingValue': 'existing value',
  'workbench.editors.rule.fields.header.switchTo': 'Switch to {operation}',
  'workbench.editors.rule.fields.header.dragToReorder': 'Drag to reorder',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'Block Rule',
  'workbench.editors.rule.fields.block.infoSummary':
    'Blocking cancels matching requests before they leave the browser.',
  'workbench.editors.rule.fields.block.infoDescription':
    'No action configuration is needed — the block itself is the action; conditions decide what gets blocked.',
  'workbench.editors.rule.fields.block.title': 'Block requests',
  'workbench.editors.rule.fields.block.body':
    'Requests matching the conditions below will be blocked. The browser will show a network error to the page.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'Redirect Rule',
  'workbench.editors.rule.fields.redirect.infoSummary':
    'Sends matching requests to a different URL before they reach the network.',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'With a URL Regex condition, \\1, \\2 … substitute the captured groups into the target URL.',
  'workbench.editors.rule.fields.redirect.redirectsTo': 'Redirects to',
  'workbench.editors.rule.fields.redirect.anotherUrl': 'Another URL',
  'workbench.editors.rule.fields.redirect.localFile': 'Local file',
  'workbench.editors.rule.fields.redirect.desktopOnly': 'Available in desktop app',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    'e.g. https://openheaders.io/redirected — use \\1, \\2 with URL Regex conditions',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'Query Param Rule',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    'Adds, replaces, or removes query parameters on matching request URLs.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    'Remove All strips the entire query string; Add / Replace entries in the same rule then become the new query. Replace Only and Remove entries have nothing left to act on and are ignored alongside Remove All.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    'Remove All strips the entire query string, so Replace Only and Remove entries have nothing to act on and are ignored. Add / Replace entries still apply — they become the new query.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'Removes all query parameters from the URL',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'Param Name',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'Param Value',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': 'Inject Rule',
  'workbench.editors.rule.fields.inject.infoSummary':
    'Injects a script or stylesheet into matching pages as they load.',
  'workbench.editors.rule.fields.inject.language': 'Language:',
  'workbench.editors.rule.fields.inject.codeSource': 'Code Source:',
  'workbench.editors.rule.fields.inject.insert': 'Insert:',
  'workbench.editors.rule.fields.inject.sourceCode': 'Code',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'After Page Load',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'As Soon As Possible',
  'workbench.editors.rule.fields.inject.source': 'Source',
  'workbench.editors.rule.fields.inject.code': 'Code',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': 'Enter Source URL (relative or absolute)',
  'workbench.editors.rule.fields.inject.bypassCsp': 'Bypass Content-Security-Policy so injected scripts always execute',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    'Covers header CSP only right now — a <meta> CSP can still block this script. To bypass both, enable "Allow user scripts" for this extension in your browser\'s extension settings.',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': 'Delay Rule',
  'workbench.editors.rule.fields.delay.infoSummary':
    'Holds matching requests for the configured time before letting them continue.',
  'workbench.editors.rule.fields.delay.capsAlert':
    'Document and iframe navigations are delayed up to 30,000ms via a local waiting page. JS-initiated XHR/Fetch is capped at 5,000ms to avoid HTTP connection pool starvation. Sub-resources (CSS, JS, images) are not delayed.',
  'workbench.editors.rule.fields.delay.label': 'Delay',
  'workbench.editors.rule.fields.delay.maxNote': 'Max 30,000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'Request Body Rule',
  'workbench.editors.rule.fields.requestBody.infoSummary':
    'Replaces the body of matching requests before they are sent.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    'Static data swaps in a fixed payload; Dynamic runs JavaScript against the original body.',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'Intercepts fetch() and XMLHttpRequest calls for REST or GraphQL API requests.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'Select Resource Type',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'Request Body',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': 'Your function receives',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'and should return the modified body. Return a string or an object (auto-serialized to JSON).',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'Response Rule',
  'workbench.editors.rule.fields.response.infoSummary':
    'Serves a substitute response for matching requests instead of what the server returned.',
  'workbench.editors.rule.fields.response.infoDescription':
    'Static data serves a fixed payload; Dynamic runs JavaScript against the original response.',
  'workbench.editors.rule.fields.response.sourceLabel': 'Response source',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'Acts on fetch() and XMLHttpRequest responses for REST or GraphQL API requests.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock serves your body without calling the server; Modify sends the real request and edits the reply before the page sees it.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock — no request sent',
  'workbench.editors.rule.fields.response.sourceNetwork': "🌐 Modify — edit the server's reply",
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    'The real request is sent; your changes are applied to the reply before the page sees it.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'The request never leaves the browser — the page gets your response directly.',
  'workbench.editors.rule.fields.response.resourceType': 'Resource Type',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'Which API payload shape the rule targets — REST or GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL unlocks an operation filter below, so the rule can match a single operation inside a shared endpoint.',
  'workbench.editors.rule.fields.response.statusCode': 'Status Code',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': 'The HTTP status served with your response.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    "Pick a code to serve, or keep the original one from the server's reply when calling the server.",
  'workbench.editors.rule.fields.response.keepOriginalStatus': 'Keep original status code',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    'The Content-Type header served with the body — controls how the browser parses it.',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    "Type any value; the suggestions are a convenience. When calling the server, it overrides the real reply's Content-Type only when set.",
  'workbench.editors.rule.fields.response.headersLabel': 'Response Headers',
  'workbench.editors.rule.fields.response.headersInfoSummary': 'Extra headers served alongside Content-Type.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    "When calling the server these merge over the real reply's headers; when mocking they become the reply's headers. Empty rows are dropped on save.",
  'workbench.editors.rule.fields.response.headerNamePlaceholder': 'Header name (e.g. X-Custom)',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': 'Header value',
  'workbench.editors.rule.fields.response.addHeader': 'Add header',
  'workbench.editors.rule.fields.response.bodyLabel': 'Response Body',
  'workbench.editors.rule.fields.response.bodyInfoSummary': 'The payload served to the page for matching requests.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    'Static Data serves a fixed body; Dynamic (JavaScript) builds or transforms it at request time.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': 'The real request is made first. Your',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    'function receives the response and request context, then returns the modified response. Return a string or an object (auto-serialized to JSON).',
  'workbench.editors.rule.fields.response.dynMockBefore': 'No request is sent. Your',
  'workbench.editors.rule.fields.response.dynMockMid': 'function receives',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'and returns the response body. Return a string or an object (auto-serialized to JSON).',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'WebSocket Rule',
  'workbench.editors.rule.fields.message.sseKicker': 'SSE Rule',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    'Modifies, injects, or drops WebSocket frames on matching connections before the page or the wire sees them.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    'Modifies, injects, or drops server-sent events on matching streams before listeners see them.',
  'workbench.editors.rule.fields.message.wsIntro':
    'Intercepts page-created WebSocket connections whose socket URL matches the conditions. Frames are modified, injected, or dropped in the page before they reach page code (incoming) or the wire (outgoing).',
  'workbench.editors.rule.fields.message.sseIntro':
    'Intercepts page-created EventSource streams whose URL matches the conditions. Events are modified, injected, or dropped in the page before listeners see them.',
  'workbench.editors.rule.fields.message.operation': 'Operation',
  'workbench.editors.rule.fields.message.opReplace': 'Replace',
  'workbench.editors.rule.fields.message.opInject': 'Inject',
  'workbench.editors.rule.fields.message.opDrop': 'Drop',
  'workbench.editors.rule.fields.message.direction': 'Direction',
  'workbench.editors.rule.fields.message.incoming': 'Incoming (server → page)',
  'workbench.editors.rule.fields.message.outgoing': 'Outgoing (page → server)',
  'workbench.editors.rule.fields.message.eventName': 'Event name',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': 'Empty = default message events',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': "Matches the stream's",
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'field',
  'workbench.editors.rule.fields.message.frameFilter': 'Frame filter',
  'workbench.editors.rule.fields.message.dataFilter': 'Data filter',
  'workbench.editors.rule.fields.message.everyFrame': 'Every frame',
  'workbench.editors.rule.fields.message.everyEvent': 'Every event',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs':
    'Filters match text frames only — binary frames pass through when a filter is set.',
  'workbench.editors.rule.fields.message.filterNoteSse': 'Filters match text events only.',
  'workbench.editors.rule.fields.message.injectWhen': 'Inject when',
  'workbench.editors.rule.fields.message.connectionOpens': 'Connection opens',
  'workbench.editors.rule.fields.message.streamOpens': 'Stream opens',
  'workbench.editors.rule.fields.message.matchingFrameArrives': 'A matching frame arrives',
  'workbench.editors.rule.fields.message.matchingEventArrives': 'A matching event arrives',
  'workbench.editors.rule.fields.message.injectedFrame': 'Injected frame',
  'workbench.editors.rule.fields.message.injectedEvent': 'Injected event',
  'workbench.editors.rule.fields.message.replacementFrame': 'Replacement frame',
  'workbench.editors.rule.fields.message.replacementEvent': 'Replacement event',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': 'Auth Rule',
  'workbench.editors.rule.fields.auth.infoSummary':
    'Answers HTTP or proxy authentication challenges on matching requests with these credentials.',
  'workbench.editors.rule.fields.auth.infoDescription':
    'Both fields resolve {{templates}}, so the real secret can live in the vault ({{vault.*}}) instead of plaintext on the rule. Takes effect only on tabs in Debug-mode scope.',
  'workbench.editors.rule.fields.auth.introBefore':
    'Answers a server (401) or proxy (407) authentication challenge on matching requests. Reference a vault secret — e.g.',
  'workbench.editors.rule.fields.auth.introAfter': "— so the credential isn't stored in the rule.",
  'workbench.editors.rule.fields.auth.username': 'Username',
  'workbench.editors.rule.fields.auth.password': 'Password',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Key',
  'workbench.editors.grid.value': 'Value',
  'workbench.editors.grid.description': 'Description',
  'workbench.editors.grid.showColumns': 'Show columns',
  'workbench.editors.grid.tableOptions': 'Table options',
  'workbench.editors.grid.bulk': 'Bulk',
  'workbench.editors.grid.keyValue': 'Key-Value',
  'workbench.editors.grid.selectAllAria': 'Enable or disable all rows',
  'workbench.editors.grid.selectAllTitle': 'Enable / disable all',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Resize {column} column',
  'workbench.editors.grid.overriddenBy': 'Duplicate — overridden by the {header} row you added.',
  'workbench.editors.grid.suggestionValueAria': '{key} value',

  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Request not found.',
  'workbench.editors.request.loading': 'Loading request…',
  'workbench.editors.request.toast.deletedOtherTab': 'Request was deleted from another tab',
  'workbench.editors.request.toast.updateFailed': 'Failed to update request',
  'workbench.editors.request.toast.updateFailedDetail': 'Failed to update request: {message}',
  'workbench.editors.request.toast.savedExample': 'Saved example "{name}"',
  'workbench.editors.request.toast.saveExampleFailed': 'Failed to save example',
  'workbench.editors.request.toast.saveExampleFailedDetail': 'Failed to save example: {message}',
  'workbench.editors.request.send.label': 'Send',
  'workbench.editors.request.send.sending': 'Sending…',
  'workbench.editors.request.send.unresolvedTooltip':
    'Request has unresolved variables. Define them in vault, environment, collection, workspace, or a live workflow before sending.',
  'workbench.editors.request.send.remoteDispatchHint': 'Runs on {host} — the connected back-end',
  'workbench.editors.request.schemeHint':
    'Your URL has no scheme. It will be sent as https:// — click the URL bar and press Tab or Enter to lock it in.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Authorization',
  'workbench.editors.request.tab.headers': 'Headers',
  'workbench.editors.request.tab.body': 'Body',
  'workbench.editors.request.tab.scripts': 'Scripts',
  'workbench.editors.request.tab.settings': 'Settings',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Enter URL or paste text',
  'workbench.editors.request.method.customGroup': 'Custom',
  'workbench.editors.request.method.usePrefix': 'Use',
  'workbench.editors.request.method.forbiddenSuffix': "can't be sent from a browser.",
  'workbench.editors.request.method.invalidHint': 'Methods use letters, digits, and hyphens (max 32).',
  'workbench.editors.request.method.removeCustomAria': 'Remove custom method {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Go to authorization',
  'workbench.editors.request.goToBody': 'Go to body',
  'workbench.editors.request.goToSettings': 'Go to settings',
  'workbench.editors.request.headers.keyPlaceholder': 'Header',
  'workbench.editors.request.headers.hideAuto': 'Hide auto-generated headers',
  'workbench.editors.request.headers.hiddenCount': '{count} hidden',
  'workbench.editors.request.headers.autoInfo':
    'These headers will be automatically added and sent with the request. Click the info icon on a row for per-header detail.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Duplicate — replaced on send by the {header} header generated from the Authorization tab.',
  'workbench.editors.request.headers.calculated': '<calculated when request is sent>',
  'workbench.editors.request.headers.browserUserAgent': '<browser user agent>',
  'workbench.editors.request.headers.hint.cacheControl':
    '"Cache-Control: no-cache" is added as a precautionary measure to prevent the server from returning stale responses when you make repeated requests. You can remove this header in the request settings or enter a new one with a different value.',
  'workbench.editors.request.headers.hint.contentType':
    'The runtime computes Content-Type from the body encoding (form-data → multipart/form-data with a boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; raw JSON → application/json; etc.). Set your own header to override.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length is computed from the serialized body byte size before the request is sent. The browser refuses to honour a user-set Content-Length that does not match the actual body length.',
  'workbench.editors.request.headers.hint.host':
    'The browser derives Host from the target URL and refuses to let userland code override it.',
  'workbench.editors.request.headers.hint.userAgent':
    'The User-Agent identifies the client. Requests go out with the browser’s own User-Agent; add your own User-Agent row below to override it.',
  'workbench.editors.request.headers.hint.accept':
    'Accept tells the server which media types the client can parse. `*/*` lets the server pick; override with a narrower set (e.g. `application/json`) to constrain responses.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Compression algorithms the browser supports. Set by the browser and negotiated per-connection; not overridable from userland.',
  'workbench.editors.request.headers.hint.connection':
    'HTTP/1.1 connection reuse. The browser manages the connection pool and does not let userland code override this header.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <credentials>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<value>',
  'workbench.editors.request.authPreview.accessTokenValue': '<access token>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <access token>',
  'workbench.editors.request.authPreview.basicHint':
    'Generated from the Authorization tab (Basic Auth). Username and password are base64-encoded into this header when the request is sent.',
  'workbench.editors.request.authPreview.bearerHint':
    'Generated from the Authorization tab (Bearer Token). The token is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    'Generated from the Authorization tab (API Key). The value is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    'Generated from the Authorization tab (API Key). The value is added to this query param when the request is sent.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    'Generated from the Authorization tab (OAuth 2.0). The access token is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    'Generated from the Authorization tab (OAuth 2.0). The access token is appended to the request URL when the request is sent.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <signature>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<request timestamp>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    'Generated from the Authorization tab (AWS Signature v4). The request is signed with your credentials when it is sent.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    'Generated from the Authorization tab (AWS Signature v4). The signing timestamp is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <challenge response>',
  'workbench.editors.request.authPreview.digestHint':
    'Generated from the Authorization tab (Digest Auth). The value is computed from the server’s challenge when the request is sent, then the request is resent with it.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <signed parameters>',
  'workbench.editors.request.authPreview.oauth1Hint':
    'Generated from the Authorization tab (OAuth 1.0). The request is signed with your credentials when it is sent.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    'Generated from the Authorization tab (OAuth 1.0). The oauth_* parameters are added to the URL query when the request is sent.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Auth Type',
  'workbench.editors.request.auth.type.inherit': 'Inherit auth from parent',
  'workbench.editors.request.auth.type.none': 'No Auth',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Access Token',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'optional — empty for one-legged calls',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'optional — empty for one-legged calls',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Signature Method',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'optional',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth answers the server’s challenge with a second request, which runs on the desktop app and CLI. Sends from this surface go out without it — the server replies 401.',
  'workbench.editors.request.auth.inheritNote':
    'The authorization data will be automatically configured based on the parent collection.',
  'workbench.editors.request.auth.noneNote': 'This request does not use any authorization.',
  'workbench.editors.request.auth.inheritDetail':
    "This request is using the authorization helper from its parent collection. Edit the collection's Authorization tab to change it.",
  'workbench.editors.request.auth.resizeRailAria': 'Resize auth-type rail',
  'workbench.editors.request.auth.username': 'Username',
  'workbench.editors.request.auth.password': 'Password',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': 'Key',
  'workbench.editors.request.auth.value': 'Value',
  'workbench.editors.request.auth.addTo': 'Add to',
  'workbench.editors.request.auth.addToHeader': 'Header',
  'workbench.editors.request.auth.addToQuery': 'Query Params',
  'workbench.editors.request.auth.usernamePlaceholder': 'username',
  'workbench.editors.request.auth.passwordPlaceholder': 'password',
  'workbench.editors.request.auth.tokenPlaceholder': 'bearer token',
  'workbench.editors.request.auth.valuePlaceholder': 'api key value',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': 'Service Name',
  'workbench.editors.request.auth.awsRegion': 'Region',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'e.g. AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'secret access key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'optional — temporary (STS) credentials only',
  'workbench.editors.request.auth.awsServicePlaceholder': 'e.g. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'e.g. us-east-1',
  'workbench.editors.request.auth.sendAsLabel': 'Add authorization data to',
  'workbench.editors.request.auth.sendAsHeaders': 'Request Headers',
  'workbench.editors.request.auth.sendAsUrl': 'Request URL',
  'workbench.editors.request.auth.presetLabel': 'Provider preset',
  'workbench.editors.request.auth.presetInfo':
    'Picking a provider pre-fills its authorization/token endpoints, default scopes, and recommended flow. Pick Custom to configure everything manually.',
  'workbench.editors.request.auth.presetCustom': 'Custom (no preset)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'Sending the access token in the URL is deprecated',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 kept the URI query-parameter method available but warns against it: tokens leak into server logs, HTTP `Referer` headers, browser history, and intermediary caches. Prefer the default',
  'workbench.editors.request.oauth.queryWarningAfter': 'header unless the provider requires the query form.',
  'workbench.editors.request.oauth.currentToken': 'Current Token',
  'workbench.editors.request.oauth.configureNewToken': 'Configure New Token',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': 'No token yet — use Get new access token below',
  'workbench.editors.request.oauth.headerPrefix': 'Header Prefix',
  'workbench.editors.request.oauth.autoRefresh': 'Auto-refresh Token',
  'workbench.editors.request.oauth.autoRefreshDesc':
    'Your expired token will be auto-refreshed before sending a request.',
  'workbench.editors.request.oauth.status': 'Status',
  'workbench.editors.request.oauth.statusExpired':
    'Expired — next send will auto-refresh when a refresh_token is stored.',
  'workbench.editors.request.oauth.statusValid': 'Valid · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Refresh now',
  'workbench.editors.request.oauth.disconnect': 'Disconnect',
  'workbench.editors.request.oauth.tokenName': 'Token Name',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Free-form label, surfaced in the credentials list when a workspace has several tokens against the same provider.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Enter a token name…',
  'workbench.editors.request.oauth.grantType': 'Grant type',
  'workbench.editors.request.oauth.callbackUrl': 'Callback URL',
  'workbench.editors.request.oauth.detecting': 'Detecting…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'Register this URL at your OAuth provider. It looks different from the',
  'workbench.editors.request.oauth.callbackTipBeforeHost': 'URL in your address bar because Chrome exposes a dedicated',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'redirect host for',
  'workbench.editors.request.oauth.callbackTipAfterApi':
    '. The extension ID is the same; only the host + scheme differ.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Authorize using browser',
  'workbench.editors.request.oauth.authUrl': 'Auth URL',
  'workbench.editors.request.oauth.accessTokenUrl': 'Access Token URL',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Automatically generated if left blank',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': 'Automatically generated per authorize request',
  'workbench.editors.request.oauth.clientAuthentication': 'Client Authentication',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Where client_id / client_secret ride on token POSTs. Providers vary — Auth0 / Keycloak typically require the Basic header form.',
  'workbench.editors.request.oauth.clientAuthBody': 'Send client credentials in body',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Send as Basic Auth header',
  'workbench.editors.request.oauth.advanced': 'Advanced',
  'workbench.editors.request.oauth.advancedIntro':
    'You can add more specific customizations to your OAuth2 requests here.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Learn more about configuration',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh Token URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'Most providers reuse the Access Token URL for refresh; supply an override only when the provider exposes a distinct path.',
  'workbench.editors.request.oauth.authRequest': 'Auth Request',
  'workbench.editors.request.oauth.tokenRequest': 'Token Request',
  'workbench.editors.request.oauth.refreshRequest': 'Refresh Request',
  'workbench.editors.request.oauth.getNewToken': 'Get new access token',
  'workbench.editors.request.oauth.clearCookies': 'Clear cookies',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Tokens are stored per workspace under',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. Delete the workspace to purge.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: token received',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: authorization complete',
  'workbench.editors.request.oauth.toast.failed': 'OAuth failed: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: access token refreshed',
  'workbench.editors.request.oauth.toast.refreshFailed': 'Refresh failed: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: disconnected',
  'workbench.editors.request.oauth.toast.callbackCopied': 'Callback URL copied',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'Copy not supported — select the URL manually',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'This request does not have a body',
  'workbench.editors.request.body.beautify': 'Beautify',
  'workbench.editors.request.body.format': 'Format',
  'workbench.editors.request.body.formatAria': 'Format body',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'GraphQL query',
  'workbench.editors.request.body.queryInfoSummary':
    'Sent as a plain POST with a JSON body of { query, variables }. Schema introspection and query autocomplete are not available yet.',
  'workbench.editors.request.body.variablesTitle': 'GraphQL Variables',
  'workbench.editors.request.body.variablesInfoTitle': 'GraphQL variables',
  'workbench.editors.request.body.variablesInfoSummary':
    'Define variables in JSON format to reference from the query (e.g. $id).',
  'workbench.editors.request.body.kindText': 'Text',
  'workbench.editors.request.body.kindFile': 'File',
  'workbench.editors.request.body.newFile': 'New file from local machine',
  'workbench.editors.request.body.uploadedFiles': 'Uploaded files',
  'workbench.editors.request.body.allAttached': 'All uploaded files already attached',
  'workbench.editors.request.body.selectFiles': 'Select files',
  'workbench.editors.request.body.loadingFiles': 'Loading files…',
  'workbench.editors.request.body.addFile': '+ Add file',
  'workbench.editors.request.body.uploadRequired': 'Upload required',
  'workbench.editors.request.body.deleteFileAria': 'Delete {filename} from workspace',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Write',
  'workbench.editors.request.docs.preview': 'Preview',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'Document this request — why it exists, when to run it, expected auth scope. Markdown supported: headings, lists, tables, code blocks, links. {{variable}} references render as chips in the preview.',
  'workbench.editors.request.docs.placeholder':
    'What does this request do?\nWhy it exists, when to run it, expected auth scope.',
  'workbench.editors.request.docs.empty': 'Nothing documented yet — switch to Write to add notes.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Pre-request',
  'workbench.editors.request.scripts.postResponse': 'Post-response',
  'workbench.editors.request.scripts.preInfoTitle': 'Pre-request script',
  'workbench.editors.request.scripts.preInfoSummary':
    'Runs in a sandboxed iframe before the request is sent. Mutate the outgoing request with the oh API:',
  'workbench.editors.request.scripts.postInfoTitle': 'Post-response script',
  'workbench.editors.request.scripts.postInfoSummary':
    'Runs in a sandboxed iframe after the response arrives. Assertion results land in the Response panel:',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'add or replace a header',
  'workbench.editors.request.scripts.apiSetQueryParam': 'add or replace a query parameter',
  'workbench.editors.request.scripts.apiSetUrl': 'rewrite the target URL',
  'workbench.editors.request.scripts.apiSetBody': 'replace the request body',
  'workbench.editors.request.scripts.apiRequire': 'load a script package from the Package Library',
  'workbench.editors.request.scripts.apiTest': 'register an assertion',
  'workbench.editors.request.scripts.prePlaceholder': 'Use JavaScript to modify this request before it is sent.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Use JavaScript to test and read this response after it arrives.',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.titleCollection': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.titleFolder': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.descriptionCollection':
    'These scripts run for every request in this collection — the pre-request script before each send, the post-response script after each response. They run first: collection scripts, then folder scripts, then the request’s own scripts.',
  'workbench.editors.ancestorScripts.descriptionFolder':
    'These scripts run for every request in this folder — the pre-request script before each send, the post-response script after each response. They run after the collection’s scripts and before the request’s own scripts.',
  'workbench.editors.ancestorScripts.notFoundCollection': 'Request collection not found.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Folder not found.',
  'workbench.editors.ancestorScripts.saveFailed': 'Could not save scripts.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'Could not save scripts: {message}',
  'workbench.editors.ancestorScripts.deletedElsewhere': 'This item was deleted in another window.',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.titleCollection': 'Authorization — {name}',
  'workbench.editors.ancestorAuth.titleFolder': 'Authorization — {name}',
  'workbench.editors.ancestorAuth.descriptionCollection':
    'Requests set to Inherit use this authorization. A folder\u2019s own authorization takes precedence, and a request\u2019s explicit authorization always wins. Inherit here means nothing is configured at this level.',
  'workbench.editors.ancestorAuth.descriptionFolder':
    'Requests set to Inherit use this authorization ahead of the collection\u2019s. A request\u2019s explicit authorization always wins. Inherit here means nothing is configured at this level \u2014 requests fall through to the collection.',
  'workbench.editors.ancestorAuth.notFoundCollection': 'Request collection not found.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Folder not found.',
  'workbench.editors.ancestorAuth.saveFailed': 'Could not save authorization.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'Could not save authorization: {message}',
  'workbench.editors.ancestorAuth.deletedElsewhere': 'This item was deleted in another window.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.enabled': 'Enabled',
  'workbench.editors.request.settings.disabled': 'Disabled',
  'workbench.editors.request.settings.followRedirects': 'Automatically follow redirects',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Follow HTTP 3xx responses to their target. Switch off to stop at the redirect itself — the response shows as an opaque redirect with no headers or body, useful to confirm that a redirect happens at all.',
  'workbench.editors.request.settings.maxRedirects': 'Maximum redirects',
  'workbench.editors.request.settings.maxRedirectsInfo':
    'How many redirects a send may follow before failing with an error naming the limit. Leave empty for the default of 20. Set 0 to fail on any redirect at all.',
  'workbench.editors.request.settings.followOriginalMethod': 'Follow original HTTP method',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    'Keep the original method and body when a 301, 302, or 303 redirect would normally switch the request to GET. 307 and 308 redirects always keep the method either way.',
  'workbench.editors.request.settings.followAuthHeader': 'Follow Authorization header',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    "Keep the Authorization header when a redirect crosses to a different origin. Normally it is dropped on a cross-origin hop so credentials never travel to a host the request didn't address.",
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'Credentials travel to whatever host the redirect chain lands on. A response whose chain actually crossed origins is marked.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Send browser cookies',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    "Attach the browser's existing cookies for the target site to this request. Off is the safe default: the request is sent with no cookies, so results don't depend on your logged-in browser state.",
  'workbench.editors.request.settings.sslVerification': 'SSL certificate verification',
  'workbench.editors.request.settings.sslVerificationInfo':
    "Verify the server's TLS certificate against the runtime's trusted CA store. A host with a self-signed, expired, or otherwise untrusted certificate fails with a TLS certificate error — switch verification off to reach it anyway, e.g. a development server with a self-signed certificate.",
  'workbench.editors.request.settings.sslVerificationWarning':
    'Sends skip the server identity check — any certificate is accepted, including self-signed and expired ones. The response is marked as unverified.',
  'workbench.editors.request.settings.tlsMin': 'TLS version minimum',
  'workbench.editors.request.settings.tlsMinInfo':
    'Lowest TLS protocol version a send may negotiate. Leave empty for the runtime default of TLS 1.2. Choosing 1.0 or 1.1 lowers the floor below the default to reach legacy servers — a response sent with a lowered floor is marked.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (default)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Sends may negotiate TLS below 1.2 — protocol versions with known weaknesses. The response is marked.',
  'workbench.editors.request.settings.tlsMax': 'TLS version maximum',
  'workbench.editors.request.settings.tlsMaxInfo':
    "Highest TLS protocol version a send may negotiate. Leave empty for the runtime default of TLS 1.3. Lower it to check how a server behaves on an older protocol — the minimum may need lowering too, or the two won't overlap.",
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (default)',
  'workbench.editors.request.settings.tlsCipherSuites': 'TLS cipher suites',
  'workbench.editors.request.settings.tlsCipherSuitesInfo':
    "Cipher suites offered during the TLS handshake, as a colon-separated OpenSSL-format list — TLS 1.3 suite names and older suite names both go in the one list. Leave empty to offer the runtime's default suites. The server picks the suite from what is offered, in its own preference order.",
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Runtime default suites',
  'workbench.editors.request.settings.tlsCipherSuitesError': 'Colon-separated OpenSSL suite names only — no spaces.',
  'workbench.editors.request.settings.allowHttp2': 'Allow HTTP/2',
  'workbench.editors.request.settings.allowHttp2Info':
    'Offer HTTP/2 alongside HTTP/1.1 when connecting over https — the server picks the protocol from the offer, so a server without HTTP/2 support still answers over HTTP/1.1. Plain http:// requests always use HTTP/1.1. Off, requests are sent over HTTP/1.1 only.',
  'workbench.editors.request.settings.resolveToAddress': 'Resolve to address',
  'workbench.editors.request.settings.resolveToAddressInfo':
    "Send this request to a specific server address instead of whatever DNS answers — the URL's hostname is still used for TLS and the Host header, so with verification on the certificate must still match it. Useful to test one specific backend behind a load balancer. The URL keeps its own port, and a redirect to another host also lands on this address. Leave empty to resolve through DNS as usual.",
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'System DNS',
  'workbench.editors.request.settings.resolveToAddressError': 'IPv4 or IPv6 address only — no hostname, no port.',
  'workbench.editors.request.settings.clientCertificate': 'Client certificate',
  'workbench.editors.request.settings.clientCertificateInfo':
    "Present a client certificate during the TLS handshake, for APIs behind mutual-TLS gateways that authenticate the caller by certificate. Pick a certificate entry from the vault — the request saves only the entry's name, and each device presents its own vault entry of that name; the certificate and key never leave the vault. Leave empty to connect without a client certificate.",
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'No client certificate',
  'workbench.editors.request.settings.clientCertificateDangling':
    'No vault certificate entry named "{name}" on this device — sends will fail until the entry exists or this setting is cleared.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxyInfo':
    "Route this request through an HTTP(S) proxy instead of connecting directly. The connection to the target tunnels through the proxy, so an https exchange stays end-to-end encrypted and certificate verification still runs against the target. SOCKS proxies are not supported. Credentials go in the 'Proxy credentials' setting below, never in this URL. Leave empty for a direct connection.",
  'workbench.editors.request.settings.proxyPlaceholder': 'No proxy — direct connection',
  'workbench.editors.request.settings.proxyError':
    'http:// or https:// URL with host and port only — no credentials in the URL, no SOCKS.',
  'workbench.editors.request.settings.proxyResolveConflict':
    'Also sets resolve-to-address, but a proxy resolves the hostname itself — sends will fail until one of the two is cleared.',
  'workbench.editors.request.settings.proxyCredentials': 'Proxy credentials',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    "Authenticate against the proxy with credentials from the vault, as user:password in a string entry. The request saves only the entry's name, and each device resolves it against its own local vault — the credentials never leave the vault and are sent only to the proxy, never to the target. Leave empty for a proxy that needs no authentication.",
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'No authentication',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'No vault string entry named "{name}" on this device — sends will fail until the entry exists or this setting is cleared.',
  'workbench.editors.request.settings.unixSocket': 'Unix socket',
  'workbench.editors.request.settings.unixSocketInfo':
    "Dial this local socket — an absolute Unix socket path, or a Windows named pipe like \\\\.\\pipe\\name — instead of opening a TCP connection, e.g. a Docker daemon or a local development service listening on a socket. The URL's host no longer decides where the connection goes, but the Host header, TLS server name, and certificate verification still use it, and a redirect to another host also dials this same socket. Leave empty for a normal TCP connection.",
  'workbench.editors.request.settings.unixSocketPlaceholder': 'No socket — TCP connection',
  'workbench.editors.request.settings.unixSocketError':
    'Absolute Unix socket path (/…) or Windows named pipe (\\\\.\\pipe\\…) only.',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'Also sets a proxy, but a proxy tunnel can’t dial a local socket — sends will fail until one of the two is cleared.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'Also sets resolve-to-address, but a socket dial resolves no hostname — sends will fail until one of the two is cleared.',
  'workbench.editors.request.settings.cookieJar': 'Use cookie jar',
  'workbench.editors.request.settings.cookieJarInfo':
    "Store this request's Set-Cookie responses in the app's own cookie jar and attach matching cookies automatically — so a login request followed by an authenticated call works without copying cookie values by hand. The jar lives in memory per workspace, is used only by requests with this setting on, never syncs, and is cleared when the app quits. A Cookie header you set yourself always wins. Off is the default: no cookies are attached and Set-Cookie responses are discarded.",
  'workbench.editors.request.settings.timeout': 'Request timeout',
  'workbench.editors.request.settings.timeoutInfo':
    "Maximum time the whole request may take — connecting, waiting for the response, and reading the body. When the limit elapses the send is aborted and fails with a timeout error naming it. Leave empty for no per-request limit; only the network stack's own timeouts apply.",
  'workbench.editors.request.settings.timeoutPlaceholder': 'No limit',
  'workbench.editors.request.settings.responseSizeLimit': 'Response size limit',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'Maximum response body size read off the wire; anything past it is cut off and the response is marked as truncated. Leave empty for the default limit of 2,048 KB (2 MB). Raise it up to 10,240 KB (10 MB) for larger payloads, or lower it to test how a truncated response looks.',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.managed.browserKicker': 'Browser-managed',
  'workbench.editors.request.settings.managed.nodeKicker': 'Runtime-managed',
  'workbench.editors.request.settings.managed.browserIntro':
    'Fixed by the browser for every request sent from an extension — shown so you know what is not negotiable.',
  'workbench.editors.request.settings.managed.nodeIntro':
    'Fixed by the app’s network runtime for every request — shown so you know what is not negotiable.',
  'workbench.editors.request.settings.managed.hideBrowser': 'Hide browser-managed settings',
  'workbench.editors.request.settings.managed.hideNode': 'Hide runtime-managed settings',
  'workbench.editors.request.settings.managed.countBrowser': '{count} browser-managed',
  'workbench.editors.request.settings.managed.countNode': '{count} runtime-managed',
  'workbench.editors.request.settings.managed.on': 'On',
  'workbench.editors.request.settings.managed.off': 'Off',
  'workbench.editors.request.settings.managed.auto': 'Auto',
  'workbench.editors.request.settings.managed.policy': 'Policy',
  'workbench.editors.request.settings.managed.browser': 'Browser',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Not sent',
  'workbench.editors.request.settings.managed.httpVersion': 'HTTP version',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'The browser negotiates HTTP/1.1, HTTP/2, or HTTP/3 per connection; the fetch API does not expose a version selector.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Certificates are verified by browser policy. A request to a host with an invalid certificate fails; verification cannot be disabled per request.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'On a 301/302/303 redirect the browser switches non-GET methods to GET per the fetch spec. 307/308 always preserve the method.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'The browser strips the Authorization header when a redirect crosses to a different origin; this safety behavior is not overridable.',
  'workbench.editors.request.settings.managed.refererRedirect': 'Remove Referer header on redirect',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'Referer handling across redirects follows the browser referrer policy for the extension context.',
  'workbench.editors.request.settings.managed.strictParser': 'Strict HTTP parser',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'The browser network stack always rejects malformed response headers; there is no lenient mode.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'The runtime’s HTTP parser rejects malformed response headers; there is no lenient mode.',
  'workbench.editors.request.settings.managed.encodeUrl': 'Encode URL automatically',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'The URL path and query are percent-encoded by the URL parser before the request goes on the wire. Type already-encoded sequences to keep them verbatim.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Server cipher suite order',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'TLS cipher negotiation is owned by the browser; neither suite list nor order is configurable.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'The fetch API caps the redirect chain at about 20 hops. A per-request cap is not implementable: manual redirect mode returns an opaque response with no headers to follow.',
  'workbench.editors.request.settings.managed.tlsVersions': 'TLS/SSL protocol versions',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Enabled TLS protocol versions are fixed by the browser; per-request selection is not exposed.',
  'workbench.editors.request.settings.managed.referer': 'Referer header',
  'workbench.editors.request.settings.managed.refererDesc':
    'The runtime has no page context, so no Referer goes on the wire unless you add one as a header yourself.',
  'workbench.editors.request.settings.managed.scripts': 'Pre-request / post-response scripts',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'Don’t run here',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'The host answering this surface’s sends has no script runtime, so pre-request and post-response scripts are skipped and the response carries no script results.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Safe mode',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'This surface’s sends execute on the connected back-end, which runs pre-request and post-response scripts in its sandboxed Safe runtime: the oh.* script API only — no filesystem, no process access, no module loader. Forwarded sends never run in Developer mode, and each run records the mode it executed under on the response.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Script execution',
  'workbench.editors.request.settings.scriptModeInfo':
    'How pre-request and post-response scripts in this workspace run on this device. Safe mode executes them in the app’s sandboxed script runtime: the oh.* script API only — no filesystem, no process access, no module loader. Developer mode executes them in a full Node.js runtime with require and system access. The choice applies to every request in the workspace, stays on this device, and never syncs — each run records the mode it executed under on the response.',
  'workbench.editors.request.settings.scriptModeSafe': 'Safe mode',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Developer mode',
  'workbench.editors.request.settings.scriptModeWarning':
    'Developer mode runs this workspace’s scripts with full system access — filesystem, processes, and network. Enable it only if you trust everyone who can edit this workspace’s scripts. Workflow steps and requests forwarded by other devices keep running in Safe mode.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Script execution: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Recommended',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'Scripts run in the app’s sandboxed script runtime — the oh.* script API only, with no filesystem or process access and no module loader.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'Scripts run in a full Node.js runtime — require, filesystem, processes, and network access.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'Use only if you trust everyone who can edit this workspace’s scripts',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'Applies to every request in this workspace, on this device only — the choice never syncs.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie in this workspace’s jar',
      other: '{count} cookies in this workspace’s jar',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Cookie jar contents',
  'workbench.editors.request.settings.jar.infoSummary':
    'Cookies currently held by this workspace’s in-memory jar — stored by jar-enabled sends, attached to jar-enabled sends that match, and gone when the app quits. Values are session credentials and stay inside the app’s network runtime; only name, scope, and expiry are shown.',
  'workbench.editors.request.settings.jar.storedHeading': 'Stored cookies',
  'workbench.editors.request.settings.jar.clear': 'Clear',
  'workbench.editors.request.settings.jar.delete': 'Delete {name}',
  'workbench.editors.request.settings.jar.expires': 'expires {date}',
  'workbench.editors.request.settings.jar.session': 'session',
  'workbench.editors.request.settings.jar.httpsOnly': 'https only',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Response',
  'workbench.editors.request.response.clear': 'Clear',
  'workbench.editors.request.response.saveResponse': 'Save Response',
  'workbench.editors.request.response.createWorkflow': 'Create workflow',
  'workbench.editors.request.response.createWorkflowNew': 'Create new workflow',
  'workbench.editors.request.response.createWorkflowAttach': 'Attach to existing workflow',
  'workbench.editors.request.response.createWorkflowNeedsSave': 'Save the request and use it in a workflow',
  'workbench.editors.request.response.copyBody': 'Copy body',
  'workbench.editors.request.response.saveBodyToFile': 'Save body to file',
  'workbench.editors.request.response.saveBodyToFileTruncated': 'Save body to file (truncated — saves what was kept)',
  'workbench.editors.request.response.clearResponse': 'Clear response',
  'workbench.editors.request.response.moreActionsAria': 'More response actions',
  'workbench.editors.request.response.copied': 'Copied',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Body',
  'workbench.editors.request.response.tab.headers': 'Headers ({count})',
  'workbench.editors.request.response.tab.cookies': 'Cookies ({count})',
  'workbench.editors.request.response.tab.assertions': 'Assertions',
  'workbench.editors.request.response.tab.assertionsFailed': 'Assertions ({count} failed)',
  'workbench.editors.request.response.tab.assertionsPassed': 'Assertions ({count} passed)',
  'workbench.editors.request.response.tab.console': 'Console ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Response meta',
  'workbench.editors.request.response.meta.timingTitle': 'Timing',
  'workbench.editors.request.response.meta.timingSummary': 'Measured around the fetch call: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    'The platform recorded no resource-timing entry for this request, so no phase breakdown is available.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'Network total {duration}. The server did not expose timing detail to this cross-origin request (no Timing-Allow-Origin header), so the DNS / connect / TTFB / download phases are hidden.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Redirects',
  'workbench.editors.request.response.meta.phase.stalled': 'Stalled',
  'workbench.editors.request.response.meta.phase.dns': 'DNS lookup',
  'workbench.editors.request.response.meta.phase.connect': 'TCP connect',
  'workbench.editors.request.response.meta.phase.tls': 'TLS handshake',
  'workbench.editors.request.response.meta.phase.waiting': 'Waiting (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Content download',
  'workbench.editors.request.response.meta.totalNetwork': 'Total (network)',
  'workbench.editors.request.response.meta.sizeTitle': 'Size',
  'workbench.editors.request.response.meta.sizeSummary': 'Bytes in each direction of this exchange.',
  'workbench.editors.request.response.meta.responseSize': 'Response Size',
  'workbench.editors.request.response.meta.requestSize': 'Request Size',
  'workbench.editors.request.response.meta.rowHeaders': 'Headers',
  'workbench.editors.request.response.meta.rowBody': 'Body',
  'workbench.editors.request.response.meta.rowCompressed': 'Compressed',
  'workbench.editors.request.response.meta.rowTransferred': 'Transferred',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    'Header bytes as visible — HTTP/2+ compresses them on the wire.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Request headers count only what this send set; the browser adds its own (Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Body truncated at the {cap} response size limit; the full size is counted.',
  'workbench.editors.request.response.meta.noteTruncated': 'Body view truncated; the full size is counted.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'Request body size is approximate — the multipart boundary is browser-generated.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Wire sizes (compressed, transferred) hidden: the server sent no Timing-Allow-Origin.',
  'workbench.editors.request.response.meta.networkTitle': 'Network',
  'workbench.editors.request.response.meta.networkSummary': 'Connection-level facts for this exchange.',
  'workbench.editors.request.response.meta.httpVersion': 'HTTP Version',
  'workbench.editors.request.response.meta.remoteAddress': 'Remote Address',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'HTTP version hidden: the app’s network runtime does not report the negotiated protocol.',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'HTTP version hidden: the platform recorded no timing entry for this request.',
  'workbench.editors.request.response.meta.noteNoIp':
    'Remote address unavailable: the wire capture saw nothing for this fetch.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Local address, TLS and certificate details are not exposed to extension code on Chromium.',
  'workbench.editors.request.response.meta.tagUnverifiedTls': 'Unverified TLS',
  'workbench.editors.request.response.meta.unverifiedTlsTitle': 'SSL verification disabled',
  'workbench.editors.request.response.meta.unverifiedTlsSummary':
    'This request was sent with certificate verification switched off in its Settings. The connection was encrypted, but the server’s identity was not checked — any certificate was accepted, including self-signed and expired ones.',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'TLS floor lowered',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'This request was sent with its minimum TLS version set below 1.2 in its Settings, so the connection was allowed to negotiate TLS 1.0 or 1.1 — protocol versions with known weaknesses that runtimes disable by default.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization forwarded',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'A redirect took this request to a different origin, and its Settings keep the Authorization header across origins — so the credentials were re-sent to the new host. Normally the header is dropped when a redirect leaves the original origin.',
  'workbench.editors.request.response.meta.executedOnTag': 'Sent from {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Executed on the connected back-end',
  'workbench.editors.request.response.meta.executedOnSummary':
    'This request was sent by "{name}" — the back-end this surface is connected to — not from this device. The target server saw that machine’s IP address and network location, so geo- or IP-based behavior reflects where the back-end runs. Recorded on this run by the host that executed it.',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'This request used the workspace’s in-memory cookie jar: matching stored cookies were attached automatically, and Set-Cookie responses were kept for later jar-enabled sends.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'Attached to the first request',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Nothing — no stored cookie matched, or a Cookie header set on the request won.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Stored from Set-Cookie responses',
  'workbench.editors.request.response.meta.jarStoredNone': 'Nothing — no response set a cookie.',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'Response truncated at {cap} (original {size}).',
  'workbench.editors.request.response.body.increaseLimit': 'Increase limit',
  'workbench.editors.request.response.body.limitHint': 'The limit is adjustable in Settings → API Requests.',
  'workbench.editors.request.response.body.viewPickerAria': 'Body view',
  'workbench.editors.request.response.body.preview': 'Preview',
  'workbench.editors.request.response.body.wrapLines': 'Wrap lines',
  'workbench.editors.request.response.body.unwrapLines': 'Unwrap lines',
  'workbench.editors.request.response.body.renderAnsi': 'Render ANSI colors',
  'workbench.editors.request.response.body.plainAnsi': 'Show plain text',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Filter body (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Filter body (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Filter body (metric families)',
  'workbench.editors.request.response.body.filterAria': 'Filter body',
  'workbench.editors.request.response.body.invalidJsonPath': 'Invalid JSONPath expression.',
  'workbench.editors.request.response.body.invalidXPath': 'Invalid XPath expression, or the document does not parse.',
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Invalid metric selector.',
  'workbench.editors.request.response.body.noMatches': 'No matches for this path.',
  'workbench.editors.request.response.body.showingLastMatch': 'Showing the last match.',
  'workbench.editors.request.response.body.hexCapNotice': 'Hex view shows the first {shown} of {total}.',
  'workbench.editors.request.response.body.previewIframeTitle': 'Response preview',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'PDF preview',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Response image',
  'workbench.editors.request.response.body.imagePreviewFailed':
    'The image data does not decode — see the Hex view for the raw bytes.',
  'workbench.editors.request.response.body.mediaPreviewAria': 'Media preview',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'The media data does not decode — see the Hex view for the raw bytes.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Request body not sent — the browser cannot attach a body to GET or HEAD requests.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Duplicate JSON keys — the last value is shown: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Truncated body — Preview and filter show only the values captured completely.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Name',
  'workbench.editors.request.response.headers.value': 'Value',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Filter headers',
  'workbench.editors.request.response.headers.copyAll': 'Copy all headers',
  'workbench.editors.request.response.headers.copyAria': 'Copy {name}',
  'workbench.editors.request.response.headers.copyTitle': 'Copy header',
  'workbench.editors.request.response.headers.empty': 'No headers',
  'workbench.editors.request.response.headers.noMatch': 'No headers match “{query}”',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Name',
  'workbench.editors.request.response.cookies.value': 'Value',
  'workbench.editors.request.response.cookies.copyAria': 'Copy Set-Cookie for {name}',
  'workbench.editors.request.response.cookies.copyTitle': 'Copy Set-Cookie line',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'This request ran with credentials included, so the browser may have stored these cookies (subject to each cookie’s own attributes) and will send them on future credentialed requests.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'The server sent these cookies, but this request ran with credentials omitted (the default), so the browser discarded them — nothing was stored.',
  'workbench.editors.request.response.cookies.noteJarOff':
    'These cookies were not stored — this request ran without the cookie jar (the default), or the jar accepted none of them.',
  'workbench.editors.request.response.cookies.noteJarStored':
    'This request ran with the cookie jar on, which stored {names} in the workspace’s in-memory jar for future jar-enabled requests.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'This request ran with the cookie jar on, which stored {names} in the workspace’s in-memory jar for future jar-enabled requests. Some were set on intermediate redirect hops, so their Set-Cookie lines are not listed here — only the final response’s headers are.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'PASS',
  'workbench.editors.request.response.assertions.fail': 'FAIL',
  'workbench.editors.request.response.console.preRequest': 'Pre-request',
  'workbench.editors.request.response.console.postResponse': 'Post-response',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Sending request…',
  'workbench.editors.request.response.empty.prompt': 'Send the request to see the response here.',
  'workbench.editors.request.response.error.title': 'Could not send request',
  'workbench.editors.request.response.error.openInTab': 'Open in new tab',
  'workbench.editors.request.response.error.certSteps.summary':
    'Local dev servers usually run with a self-signed certificate, which you need to accept.',
  'workbench.editors.request.response.error.certSteps.step1': 'Open the URL in a new tab',
  'workbench.editors.request.response.error.certSteps.step2': 'Accept the certificate warning',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': 'Advanced → Proceed (unsafe)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': 'Advanced… → Accept the Risk and Continue',
  'workbench.editors.request.response.error.certSteps.step3': 'Send the request again',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': 'Loading example…',
  'workbench.editors.responseExample.notFound': 'Example not found.',
  'workbench.editors.responseExample.toast.deletedOtherTab': 'Example was deleted from another tab',
  'workbench.editors.responseExample.toast.saveFailed': 'Failed to save example',
  'workbench.editors.responseExample.toast.saveFailedDetail': 'Failed to save example: {message}',
  'workbench.editors.responseExample.openAsRequest': 'Open as Request',
  'workbench.editors.responseExample.openAsRequestTooltip':
    "Creates a new request draft seeded from this example's request",
  'workbench.editors.responseExample.editStatus': 'Edit status code',
  'workbench.editors.responseExample.statusPlaceholder': 'Enter response code',
  'workbench.editors.responseExample.capturedTooltip': 'Captured {date}',
  'workbench.editors.responseExample.moreActionsAria': 'More response actions',
  'workbench.editors.responseExample.tab.body': 'Body',
  'workbench.editors.responseExample.tab.headers': 'Headers ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Body language',
  'workbench.editors.responseExample.format': 'Format',
  'workbench.editors.responseExample.formatBody': 'Format body',
  'workbench.editors.responseExample.noFormatter': 'No formatter for {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Snippets',
  'workbench.editors.scriptEditor.packages': 'Packages',
  'workbench.editors.scriptEditor.searchSnippets': 'Search snippets',
  'workbench.editors.scriptEditor.searchPackages': 'Search packages',
  'workbench.editors.scriptEditor.noSnippetFound': 'No snippet found',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'No packages in this workspace yet',
  'workbench.editors.scriptEditor.noPackageFound': 'No package found',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Open Package Library →',
  'workbench.editors.scriptEditor.saveToPackage': 'Save to Package Library',
  'workbench.editors.scriptEditor.newPackage': 'New Package',
  'workbench.editors.scriptEditor.newPackageName': 'New package name',
  'workbench.editors.scriptEditor.back': 'Back',
  'workbench.editors.scriptEditor.create': 'Create',
  'workbench.editors.scriptEditor.orAppend': 'Or append to an existing package:',
  'workbench.editors.scriptEditor.noPackagesYet': 'No packages yet',
  'workbench.editors.scriptEditor.savedTo': 'Saved to “{name}”',
  'workbench.editors.scriptEditor.packageCreated': 'Package “{name}” created',
  'workbench.editors.scriptEditor.duplicatePackage': 'A package named “{name}” already exists in this workspace.',
  'workbench.editors.scriptEditor.packageNotFound': 'Package not found — it may have been deleted.',
  'workbench.editors.scriptEditor.saveFailed': 'Save failed',
  'workbench.editors.scriptEditor.menuFind': 'Find',
  'workbench.editors.scriptEditor.find': 'Find',
  'workbench.editors.scriptEditor.replace': 'Replace',
  'workbench.editors.scriptEditor.beautify': 'Beautify',
  'workbench.editors.scriptEditor.group.request': 'Request',
  'workbench.editors.scriptEditor.group.workflows': 'Workflows',
  'workbench.editors.scriptEditor.group.packages': 'Packages',
  'workbench.editors.scriptEditor.group.variables': 'Variables',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Send an HTTP request',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Send an HTTP request with a JSON body',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Get a variable',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Set a variable',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Get a vault secret',
  'workbench.editors.scriptEditor.snippet.usePackage': 'Use a package',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Set a header',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Remove a header',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Set a query parameter',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Remove a query parameter',
  'workbench.editors.scriptEditor.snippet.setUrl': 'Set the URL',
  'workbench.editors.scriptEditor.snippet.setMethod': 'Set the method',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Set a JSON body',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Status code is 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Response body contains a string',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Response body equals a string',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'Response body JSON value check',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Response header check',
  'workbench.editors.scriptEditor.snippet.responseTime': 'Response time is below 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Save a response value to a variable',
} as const satisfies Catalog;
