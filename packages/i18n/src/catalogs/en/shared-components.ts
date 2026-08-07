/**
 * Shared component families — copy for components mounted by more than
 * one surface (workbench editors, panel quick-editors/value documents,
 * popup): the template-input family (`shared.templateInput.*` — the
 * `{{ref}}` field, suggestion popover, variable hover/create popovers,
 * selection menu, Monaco variable completions) and the value-editors
 * family (`shared.valueEditors.*` — JWT/encoded-value modals, compact
 * editor, pair grid, detected-value titles + edit tooltips).
 *
 * Technical plane stays raw inside keyed sentences: `{{ns.*}}` reference
 * syntax, variable names, generator/claim names (iss, exp — RFC 7519
 * vocabulary), algorithm names (HS256…), encoding names in glossary
 * duty (Base64, JWT, Cache-Control, HSTS…), key caps and glyphs
 * (↑↓ / ↵ / ▾ / ⌘S), `header.payload.signature` format examples, and
 * dynamic-generator descriptions (core registry corpus — deferred).
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': 'Edit value',
  'shared.templateInput.showValue': 'Show value',
  'shared.templateInput.hideValue': 'Hide value',
  'shared.templateInput.clearValue': 'Clear value',
  'shared.templateInput.unresolvedDot': 'Contains an unresolved variable',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': 'Create “{name}” variable',
  'shared.templateInput.createNamedInScope': 'Create “{name}” variable in {scope}',
  'shared.templateInput.noMatches': 'No matches',
  'shared.templateInput.footerNavigate': '↑↓ navigate',
  'shared.templateInput.footerSelect': '↵ select',
  'shared.templateInput.footerClose': 'esc close',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': 'Captured at runtime',
  'shared.templateInput.totpPreview': 'TOTP {digits}-digit · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP {digits}-digit · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(empty)',
  'shared.templateInput.staleBadge': 'stale',
  'shared.templateInput.needsRerunBadge': 'needs re-run',
  'shared.templateInput.disabledBadge': 'disabled',
  // Namespace-scaffold / reserved rows: core mints the English subtitle
  // for its own (locale-free) plane; the UI resolves these keys from the
  // row's kind + scope instead of rendering core's copy.
  'shared.templateInput.scaffold.vault': 'Add a secret',
  'shared.templateInput.scaffold.env': 'Add an environment variable',
  'shared.templateInput.scaffold.collection': 'Add a collection variable',
  'shared.templateInput.scaffold.workspace': 'Add a workspace variable',
  'shared.templateInput.scaffold.dynamic': 'Built-in generators — uuid, timestamp, …',
  'shared.templateInput.reservedFile': 'File references coming soon',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': 'Enter value',
  'shared.templateInput.foundIn': 'Found in:',
  'shared.templateInput.scopeFixedTooltip': 'Scope is fixed by the {prefix} prefix — edit the reference to change it.',
  'shared.templateInput.addToScope': 'Add to: {scope}',
  'shared.templateInput.addToPickScope': 'Add to: pick scope',
  'shared.templateInput.resolvedDefault': 'Resolved: default',
  'shared.templateInput.resolvedDefaultNoEnv': 'Resolved: default (no active env)',
  'shared.templateInput.noActiveEnvHint':
    'No environment selected — pick one in the env switcher to add an environment variable.',
  'shared.templateInput.noCollectionHint': 'No active collection — open a collection to add a collection variable.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': 'Environment · {name}',
  'shared.templateInput.scope.collectionNamed': 'Collection · {name}',
  'shared.templateInput.scope.workspace': 'Workspace',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · override',
  'shared.templateInput.scope.stepNamed': 'Step · {capture}',
  'shared.templateInput.scope.fileNamed': 'File · {name}',
  'shared.templateInput.scope.dynamic': 'Dynamic',
  'shared.templateInput.scope.unresolved': 'Unresolved',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': 'Environment',
  'shared.templateInput.createScope.collection': 'Collection',
  'shared.templateInput.createScope.workspace': 'Workspace',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'no active env',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': 'Empty reference',
  'shared.templateInput.unresolved.unknownNamespace': 'Unknown namespace',
  'shared.templateInput.unresolved.dynamic':
    'No built-in generator by that name. Pick one from the {{dynamic.…}} suggestion list.',
  'shared.templateInput.unresolved.step': 'Only resolves while a Live Workflow chain is running.',
  'shared.templateInput.unresolved.envNotSet': 'Not set in environment "{name}".',
  'shared.templateInput.unresolved.noActiveEnv': 'No active environment is selected.',
  'shared.templateInput.unresolved.live': 'No Live Variable by that name (or no cached value yet).',
  'shared.templateInput.unresolved.notDefined': 'Not defined in any scope.',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': 'Pick a scope from "Add to"',
  'shared.templateInput.save.totpInVaultEditor': 'TOTP secrets must be edited in the Vault editor',
  'shared.templateInput.save.vaultKindChanged': 'Vault entry kind changed under us',
  'shared.templateInput.save.notEditable': 'Not editable',
  'shared.templateInput.save.noActiveEnv': 'No active environment',
  'shared.templateInput.save.noCollection': 'No collection in context',
  'shared.templateInput.save.saved': 'Saved',
  'shared.templateInput.save.duplicateName': 'A variable with that name already exists in this scope.',
  'shared.templateInput.save.notFound': 'Variable not found — it may have been deleted.',
  'shared.templateInput.save.failed': 'Save failed',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': 'Set as variable',
  'shared.templateInput.setAsNewVariable': 'Set as new variable',
  'shared.templateInput.variableName': 'Variable name',
  'shared.templateInput.variableValue': 'Variable value',
  'shared.templateInput.valuePlaceholder': 'Value',
  'shared.templateInput.menu.cut': 'Cut',
  'shared.templateInput.menu.paste': 'Paste',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Vault secret',
  'shared.templateInput.completion.scope.env': 'Environment',
  'shared.templateInput.completion.scope.collection': 'Collection',
  'shared.templateInput.completion.scope.workspace': 'Workspace',
  'shared.templateInput.completion.scope.live': 'Source',
  'shared.templateInput.completion.scope.step': 'Source flow step capture',
  'shared.templateInput.completion.scope.file': 'File reference',
  'shared.templateInput.completion.scope.dynamic': 'Dynamic generator',
  'shared.templateInput.completion.staleSuffix': '(stale)',
  'shared.templateInput.completion.comingSoon': 'coming soon',
  'shared.templateInput.completion.capturedAtRuntime': 'captured at runtime',
  'shared.templateInput.completion.totpDetail': 'TOTP code ({digits} digits, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': 'Value hidden (sensitive scope).',
  'shared.templateInput.completion.valueHiddenStale': 'Value hidden (stale live variable).',
  'shared.templateInput.completion.valueDoc': '**Value:** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**Stale value:** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': 'Captured when the workflow runs.',
  'shared.templateInput.completion.totpDoc': '**TOTP code** — {algorithm}, {digits} digits, refreshes every {period}s.',
  'shared.templateInput.completion.totpDocIssuer':
    '**TOTP code** for **{issuer}** — {algorithm}, {digits} digits, refreshes every {period}s.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'Decoded',
  'shared.valueEditors.encodedPreview': 'Encoded preview',
  'shared.valueEditors.cannotEncode': 'Cannot encode — the edited value is not valid for this type',
  'shared.valueEditors.encodedCopied': 'Encoded value copied to clipboard',
  'shared.valueEditors.copyFailed': 'Failed to copy to clipboard',
  'shared.valueEditors.openAsDocument': 'Open as document',
  'shared.valueEditors.decode': 'Decode',
  'shared.valueEditors.decodeChipView': 'View decoded — {title}',
  'shared.valueEditors.decodeChipEdit': 'Decode and edit — {title}',
  'shared.valueEditors.editJwt': 'Edit JWT',
  'shared.valueEditors.viewJwt': 'View JWT',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'Decoded value',
  'shared.valueEditors.glance.openTab': 'Open in new tab',
  'shared.valueEditors.glance.openModal': 'Open as modal',
  'shared.valueEditors.glance.moreClaims': '+{count} more',
  'shared.valueEditors.glance.signatureElided': 'Signature not shown — open the document or modal for the full token.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': 'Name',
  'shared.valueEditors.grid.key': 'Key',
  'shared.valueEditors.grid.value': 'Value',
  'shared.valueEditors.grid.flag': 'flag',
  'shared.valueEditors.grid.ariaNamePairs': 'Name/Value pairs',
  'shared.valueEditors.grid.ariaKeyPairs': 'Key/Value pairs',
  'shared.valueEditors.grid.ariaRowName': 'Row {row} name',
  'shared.valueEditors.grid.ariaRowKey': 'Row {row} key',
  'shared.valueEditors.grid.ariaRowValue': 'Row {row} value',
  'shared.valueEditors.grid.moveRowUp': 'Move row {row} up',
  'shared.valueEditors.grid.moveRowDown': 'Move row {row} down',
  'shared.valueEditors.grid.deleteRow': 'Delete row {row}',
  'shared.valueEditors.grid.addRow': 'Add row',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'JWT Editor',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': 'Modified',
  'shared.valueEditors.jwt.decodeErrorTitle': 'Could not decode token',
  'shared.valueEditors.jwt.decoded': 'Decoded',
  'shared.valueEditors.jwt.encoded': 'Encoded',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Claims:',
  'shared.valueEditors.jwt.rawToken': 'Raw token',
  'shared.valueEditors.jwt.pasteOrEdit': 'Paste or edit the raw token',
  'shared.valueEditors.jwt.notDecodable': 'Not a decodable JWT',
  'shared.valueEditors.jwt.structure': 'Structure:',
  'shared.valueEditors.jwt.resignWithSecret': 'Re-sign with secret',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} from header',
  'shared.valueEditors.jwt.signingSecret': 'Signing secret',
  'shared.valueEditors.jwt.secretMemoryNote': 'Kept in memory only and discarded when the editor closes.',
  'shared.valueEditors.jwt.tokenExpired': 'Token expired',
  'shared.valueEditors.jwt.tokenNotExpired': 'Token not expired',
  'shared.valueEditors.jwt.expiredOn': 'Expired on {date}',
  'shared.valueEditors.jwt.expiresOn': 'Expires on {date}',
  'shared.valueEditors.jwt.resigned': 'Token re-signed with {algorithm}',
  'shared.valueEditors.jwt.resignedDescription':
    'Save writes the token signed with your secret — the preview above is exactly what gets saved.',
  'shared.valueEditors.jwt.cannotResign': 'Cannot re-sign this algorithm',
  'shared.valueEditors.jwt.cannotResignDescription':
    'Only HMAC algorithms (HS256, HS384, HS512) can be re-signed here. The original signature is carried over instead.',
  'shared.valueEditors.jwt.signError': 'Could not sign token',
  'shared.valueEditors.jwt.signatureInvalid': 'Signature no longer valid',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    'The original signature is kept as-is, so servers that verify it will reject the edited token. Enter a signing secret to re-sign it.',
  'shared.valueEditors.jwt.copied': 'JWT copied to clipboard',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'JWT payload',
  'shared.valueEditors.valueTitle.urlEncoded': 'URL-encoded value',
  'shared.valueEditors.valueTitle.base64': 'Base64 value',
  'shared.valueEditors.valueTitle.hex': 'Hex-encoded value',
  'shared.valueEditors.valueTitle.timestamp': 'Unix timestamp',
  'shared.valueEditors.valueTitle.json': 'JSON value',
  'shared.valueEditors.valueTitle.jsonString': 'Quoted string',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Cookie value',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'HTTP date',
  'shared.valueEditors.valueTitle.queryString': 'Query string',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Link header',
  'shared.valueEditors.valueTitle.authParams': 'Authorization parameters',
  'shared.valueEditors.valueTitle.acceptList': 'Accept list',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Vault secret',
  'shared.scopeColors.environment': 'Environment variable',
  'shared.scopeColors.collection': 'Collection variable',
  'shared.scopeColors.workspace': 'Workspace variable',
  'shared.scopeColors.live': 'Live variable (workflow-backed)',
  'shared.scopeColors.step': 'Workflow step capture',
  'shared.scopeColors.file': 'File reference',
  'shared.scopeColors.dynamic': 'Dynamic generator',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'Edit as JWT',
  'shared.valueEditors.editTooltip.urlEncoded': 'Edit URL-encoded value',
  'shared.valueEditors.editTooltip.base64': 'Edit Base64 value',
  'shared.valueEditors.editTooltip.hex': 'Edit hex-encoded value',
  'shared.valueEditors.editTooltip.timestamp': 'Edit timestamp',
  'shared.valueEditors.editTooltip.json': 'Edit as JSON',
  'shared.valueEditors.editTooltip.jsonString': 'Edit quoted string',
  'shared.valueEditors.editTooltip.dataUri': 'Edit data URI content',
  'shared.valueEditors.editTooltip.cookie': 'Edit cookie pairs',
  'shared.valueEditors.editTooltip.csp': 'Edit CSP directives',
  'shared.valueEditors.editTooltip.httpDate': 'Edit HTTP date',
  'shared.valueEditors.editTooltip.queryString': 'Edit query pairs',
  'shared.valueEditors.editTooltip.cacheControl': 'Edit cache directives',
  'shared.valueEditors.editTooltip.hsts': 'Edit HSTS directives',
  'shared.valueEditors.editTooltip.contentDisposition': 'Edit disposition parameters',
  'shared.valueEditors.editTooltip.link': 'Edit links',
  'shared.valueEditors.editTooltip.authParams': 'Edit auth parameters',
  'shared.valueEditors.editTooltip.acceptList': 'Edit accept list',

  // ── Default entity names (multi-surface: sidebar create actions +
  //    save-modal prefilled collection create). 'User Templates' is NOT
  //    here — it identity-compares against the background seed and
  //    stays raw everywhere. ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': 'New Rules Collection',
  'shared.defaults.newRequestsCollection': 'New Requests Collection',
  'shared.defaults.newEnvironment': 'New Environment',
  'shared.defaults.newSpec': 'New Specification',

  // ── Rule-type registry (multi-surface: workbench create menus +
  //    overviews + command palette + tool-window info, popup
  //    AddRulePalette). Labels and descriptions single-source every
  //    create/picker menu; type ids and code badges (HDR…) stay raw. ──
  'shared.ruleTypes.header.label': 'Modify Headers',
  'shared.ruleTypes.header.description': 'Add, override, or remove HTTP headers',
  'shared.ruleTypes.requestBody.label': 'Modify API Request Body',
  'shared.ruleTypes.requestBody.description': 'Override or transform API request body (fetch/XHR only)',
  'shared.ruleTypes.response.label': 'Modify API Response',
  'shared.ruleTypes.response.description': 'Mock or modify API response status, body, and headers (fetch/XHR only)',
  'shared.ruleTypes.queryParam.label': 'Modify Query Params',
  'shared.ruleTypes.queryParam.description': 'Add, override, or remove URL parameters',
  'shared.ruleTypes.inject.label': 'Inject Script/Stylesheet',
  'shared.ruleTypes.inject.description': 'Inject JavaScript or CSS into pages',
  'shared.ruleTypes.ws.label': 'Modify WebSocket Messages',
  'shared.ruleTypes.ws.description': 'Replace, inject, or drop WebSocket frames (page sockets only)',
  'shared.ruleTypes.sse.label': 'Modify Server-Sent Events',
  'shared.ruleTypes.sse.description': 'Replace, inject, or drop SSE events (page streams only)',
  'shared.ruleTypes.block.label': 'Block Requests',
  'shared.ruleTypes.block.description': 'Prevent requests from completing',
  'shared.ruleTypes.redirect.label': 'Redirect Requests',
  'shared.ruleTypes.redirect.description': 'Redirect to a different URL',
  'shared.ruleTypes.delay.label': 'Delay Requests',
  'shared.ruleTypes.delay.description': 'Add latency to network requests (fetch/XHR only)',
  'shared.ruleTypes.auth.label': 'Answer Auth Challenge',
  'shared.ruleTypes.auth.description': 'Provide credentials for an HTTP/proxy auth challenge (requires Debug mode)',

  // ── System rule-template registry (same surfaces as the rule types).
  //    Template keys, icons, conditions, and form values stay raw data;
  //    embedded code/URLs inside descriptions travel inside the value. ──
  'shared.ruleTemplates.blankRule': 'Blank Rule',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS & Security',
  'shared.ruleTemplates.folder.authentication': 'Authentication',
  'shared.ruleTemplates.folder.privacy': 'Privacy',
  'shared.ruleTemplates.folder.testing': 'Testing',
  'shared.ruleTemplates.folder.urlHandling': 'URL Handling',
  'shared.ruleTemplates.folder.tracking': 'Tracking',
  'shared.ruleTemplates.folder.debugging': 'Debugging',
  'shared.ruleTemplates.folder.appearance': 'Appearance',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'Status Codes',
  'shared.ruleTemplates.folder.dynamic': 'Dynamic',

  'shared.ruleTemplates.corsBypass.name': 'CORS Bypass',
  'shared.ruleTemplates.corsBypass.description':
    'Remove restrictive CORS headers to allow cross-origin requests during development',
  'shared.ruleTemplates.removeCsp.name': 'Remove CSP',
  'shared.ruleTemplates.removeCsp.description': 'Strip Content-Security-Policy headers for development',
  'shared.ruleTemplates.allowEmbedding.name': 'Allow Embedding',
  'shared.ruleTemplates.allowEmbedding.description': 'Remove X-Frame-Options to allow iframing',
  'shared.ruleTemplates.apiAuth.name': 'API Auth Injection',
  'shared.ruleTemplates.apiAuth.description': 'Auto-inject Authorization header into API calls',
  'shared.ruleTemplates.customUa.name': 'Custom User-Agent',
  'shared.ruleTemplates.customUa.description': 'Override the User-Agent header for specific domains',
  'shared.ruleTemplates.blockCookies.name': 'Block Cookies',
  'shared.ruleTemplates.blockCookies.description': 'Remove Cookie header from outgoing requests',
  'shared.ruleTemplates.testMerge.name': 'Test Merge (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    'Test the Merge operation by appending to a response header.\n1. Enable this rule\n2. Open httpbin.org in a ' +
    'new tab\n3. Run in console: fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",' +
    'r.headers.get("Content-Type"))})\n4. Content-Type should show "application/json, x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': 'Block Trackers',
  'shared.ruleTemplates.blockTrackers.description': 'Block analytics and tracking scripts',
  'shared.ruleTemplates.blockAds.name': 'Block Ads',
  'shared.ruleTemplates.blockAds.description': 'Block common ad network domains',
  'shared.ruleTemplates.redirectDomain.name': 'Redirect Domain',
  'shared.ruleTemplates.redirectDomain.description': 'Redirect all traffic from one domain to another',
  'shared.ruleTemplates.forceHttps.name': 'Force HTTPS',
  'shared.ruleTemplates.forceHttps.description':
    'Upgrade HTTP to HTTPS — uses regex capture group to preserve the full path',
  'shared.ruleTemplates.removeUtm.name': 'Remove UTM Params',
  'shared.ruleTemplates.removeUtm.description': 'Strip UTM tracking parameters from URLs',
  'shared.ruleTemplates.addDebug.name': 'Add Debug Flag',
  'shared.ruleTemplates.addDebug.description': 'Add a debug=true query parameter to API calls',
  'shared.ruleTemplates.darkMode.name': 'Dark Mode CSS',
  'shared.ruleTemplates.darkMode.description': 'Inject a basic dark mode stylesheet',
  'shared.ruleTemplates.consoleLogger.name': 'Console Logger',
  'shared.ruleTemplates.consoleLogger.description': 'Log all fetch requests to the console',
  'shared.ruleTemplates.slowApi.name': 'Slow API (2s)',
  'shared.ruleTemplates.slowApi.description': 'Add 2 second delay to API calls — test loading states',
  'shared.ruleTemplates.timeoutTest.name': 'Timeout Test (5s)',
  'shared.ruleTemplates.timeoutTest.description': 'Add 5 second delay — test timeout handling',
  'shared.ruleTemplates.restBodyOverride.name': 'REST Body Override',
  'shared.ruleTemplates.restBodyOverride.description': 'Replace the request body with a static JSON payload',
  'shared.ruleTemplates.graphqlOverride.name': 'GraphQL Override',
  'shared.ruleTemplates.graphqlOverride.description':
    'Override a GraphQL request body with a custom query and variables',
  'shared.ruleTemplates.mock200.name': 'Mock 200 JSON',
  'shared.ruleTemplates.mock200.description': 'Return a successful JSON response for a REST API endpoint',
  'shared.ruleTemplates.mock404.name': 'Mock 404',
  'shared.ruleTemplates.mock404.description': 'Return a 404 Not Found response',
  'shared.ruleTemplates.mock500.name': 'Mock Server Error',
  'shared.ruleTemplates.mock500.description': 'Return a 500 Internal Server Error — test error handling',
  'shared.ruleTemplates.mockGraphql.name': 'Mock GraphQL Response',
  'shared.ruleTemplates.mockGraphql.description': 'Return a custom response for a specific GraphQL operation',
  'shared.ruleTemplates.mockDynamic.name': 'Dynamic REST Response',
  'shared.ruleTemplates.mockDynamic.description':
    'Intercept the real REST API response and modify it with JavaScript — inject test data, remove fields, or ' +
    'transform the response shape',
  'shared.ruleTemplates.mockDynamicGraphql.name': 'Dynamic GraphQL Response',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    'Intercept a specific GraphQL operation response and modify it with JavaScript — reshape data, inject mock ' +
    'fields, or simulate errors',

  // ── Dock-layout chrome (shared shell: workbench + devtools panel).
  //    Slot labels feed the Move-to submenu, drop-zone overlays, and
  //    the restore rows on both surfaces. ────────────────────────────
  'shared.dock.slot.leftTop': 'Left Top',
  'shared.dock.slot.leftBottom': 'Left Bottom',
  'shared.dock.slot.rightTop': 'Right Top',
  'shared.dock.slot.rightBottom': 'Right Bottom',
  'shared.dock.slot.bottomLeft': 'Bottom Left',
  'shared.dock.slot.bottomRight': 'Bottom Right',
  'shared.dock.hide': 'Hide',
  'shared.dock.moveTo': 'Move to',
  'shared.dock.currentSlot': 'current slot',
  'shared.dock.showToolWindowNames': 'Show Tool Window Names',
  'shared.dock.hideThisDock': 'Hide this dock',
  'shared.dock.closeDock': 'Close dock',
  'shared.dock.panelOptions': 'Panel options',
  'shared.dock.hidePanel': 'Hide panel',

  // ── Docs panel chrome (shared reader: workbench + devtools panel).
  //    Registry titles/summaries resolve per-surface via the
  //    raw-or-key DocSection idiom; these are the reader's own
  //    labels. Key caps / chords (↑↓ ↵ esc ← →) stay raw. ─────────────
  'shared.docs.title': 'Docs',
  'shared.docs.contents': 'Contents',
  'shared.docs.ariaOpenToc': 'Open table of contents',
  'shared.docs.ariaCloseToc': 'Close table of contents',
  'shared.docs.filterPlaceholder': 'Filter sections',
  'shared.docs.noMatches': 'No matches',
  'shared.docs.hint.navigate': 'navigate',
  'shared.docs.hint.open': 'open',
  'shared.docs.hint.back': 'back',
  'shared.docs.hint.contents': 'contents',
  'shared.docs.previous': 'Previous',
  'shared.docs.next': 'Next',
  'shared.docs.previousTooltip': 'Previous: {title}',
  'shared.docs.nextTooltip': 'Next: {title}',

  // ── Docs section primitives (shared: workbench + devtools panel).
  //    Callout kind labels, the Example block's structural labels, the
  //    surface-context banner, and the in-section TOC header. The DNR
  //    engine tag, BrowserTag versions, and every SVG-internal label
  //    (incl. the surface-glyph <title>s) stay raw. ────────────────────
  'shared.docs.callout.note': 'Note',
  'shared.docs.callout.warning': 'Warning',
  'shared.docs.callout.tip': 'Tip',
  'shared.docs.callout.limitation': 'Limitation',
  'shared.docs.example.rule': 'Rule:',
  'shared.docs.example.before': 'Before:',
  'shared.docs.example.after': 'After:',
  'shared.docs.example.appliesTo': 'Applies to:',
  'shared.docs.example.wontApply': "Won't apply:",
  'shared.docs.example.suggestion': 'Suggestion:',
  'shared.docs.onThisPage': 'On this page',
  'shared.docs.copyCode': 'Copy code',
  'shared.docs.surfaces.header': "Where you'll see this",
  'shared.docs.surfaces.popup': 'Popup',
  'shared.docs.surfaces.sidePanel': 'Side panel',
  'shared.docs.surfaces.workbench': 'Workbench',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'Script-based',

  // ── Split-layout orientation (shared/split-layout) — overflow-menu
  //    entries for the two-pane split direction. ─────────────────────
  'shared.splitLayout.horizontal': 'Horizontal layout — side by side',
  'shared.splitLayout.vertical': 'Vertical layout — stacked',

  // ── Desktop teaser (shared/desktop-teaser) — placeholder body for
  //    capability-gated features on browser hosts: per-feature
  //    explainer + the download CTA. ──────────────────────────────────
  // Grouped-timeline row window — the per-group escape hatch when the
  // rows-per-group limit hides a group's older messages (gRPC + WS
  // message timelines share these).
  'shared.timelineGroup.showOlder': 'Show {count} older',
  // Compose-editor toolbar wrap toggle — shared by every request
  // editor's Monaco compose surface.
  'shared.codeEditor.wrap': 'Wrap',
  // The compose toolbars' "Editor" dropdown — live display knobs,
  // grouped by scope (the pane-local Wrap vs the global editor.*
  // settings the Settings page also edits).
  'shared.editorMenu.label': 'Editor',
  'shared.editorMenu.thisEditor': 'This editor',
  'shared.editorMenu.allEditors': 'All editors',
  'shared.editorMenu.lineNumbers': 'Line numbers',
  'shared.editorMenu.whitespace': 'Whitespace',
  'shared.editorMenu.lineEnds': 'Line endings',
  'shared.timelineGroup.showNewestOnly': 'Show only the newest {count}',
  // Peer-execute refusal notice — the host-aware reading of the wire's
  // two-tier opt-in refusal (the quoted phrases are the settings rows'
  // own labels, verbatim).
  'shared.peerExecute.localDisabled':
    'Sending from this device’s browsers is turned off in the desktop app. Enable "Allow this device’s browsers to send requests" under Settings → Backend.',
  'shared.peerExecute.remoteDisabled':
    'Sending from other devices is turned off on the connected host. Enable "Allow other connected devices to send requests" in its Settings → Backend on that machine.',
  'shared.peerExecute.enableCta': 'Enable in the desktop app',
  'shared.desktopTeaser.cta': 'Download the desktop app',
  'shared.desktopTeaser.openApp': 'Open in the desktop app',
  'shared.desktopTeaser.launchApp': 'Open the desktop app',
  'shared.desktopTeaser.otherPlatforms': 'Other platforms and channels',
  'shared.desktopTeaser.terminal.title': 'Integrated terminal',
  'shared.desktopTeaser.terminal.body':
    'Open a real terminal inside your workspace — your own shell, running locally right next to your rules and requests.',
  'shared.desktopTeaser.git.title': 'Git history',
  'shared.desktopTeaser.git.body': 'Browse your workspace’s commit timeline, with per-commit detail and file diffs.',
  'shared.desktopTeaser.proxy.title': 'Capture proxy',
  'shared.desktopTeaser.proxy.body':
    'Capture live HTTP(S) traffic with the built-in proxy and inspect every request as it happens.',
  'shared.desktopTeaser.mcp.title': 'AI · MCP Server',
  'shared.desktopTeaser.mcp.body': 'Connect AI assistants to your workspaces through the built-in MCP server.',
  'shared.desktopTeaser.liveNetwork.title': 'Live Network',
  'shared.desktopTeaser.liveNetwork.body':
    'Watch a browser tab’s traffic live in the desktop app, streamed from the extension — no DevTools needed.',
} as const satisfies Catalog;
