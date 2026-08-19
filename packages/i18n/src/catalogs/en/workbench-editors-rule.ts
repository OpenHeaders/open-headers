/**
 * Workbench editors — the rule editor: rule fields, conditions,
 * actions, and per-rule-type copy. Compact panel mirrors (quick
 * editor) reuse these `workbench.editors.rule.fields.*` keys directly
 * under the S35 field-key reuse law.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Saved',
  'workbench.editors.header.onTop': 'Header on Top',
  'workbench.editors.header.atBottom': 'Header at Bottom',
  'workbench.editors.header.moreActions': 'More actions',

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
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': 'authorization required',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'secret not found',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'manager unavailable',
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
  'workbench.editors.rule.fields.formatAwareBody.formatted': 'Formatted',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Raw',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    'Formatted view is available for JSON-shaped bodies only.',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': 'Formatted view',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'Body',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    'Formatted and Raw are two views of the same body text — the wire text is what the rule serves.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': 'Example — one value, two views',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'Modes',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    'A reading view — only whitespace differs. Edits are re-encoded into the original wire format, and Save writes that wire text; a no-edit Save writes the exact original bytes.',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc': 'The wire text itself — exactly what the rule serves.',
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
    'e.g. https://openheaders.com/redirected — use \\1, \\2 with URL Regex conditions',

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
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': 'e.g. dev-user or {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'Password',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': 'e.g. {{vault.STAGING_PW}}',
} as const satisfies Catalog;
