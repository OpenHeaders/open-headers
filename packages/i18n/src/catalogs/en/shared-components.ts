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
} as const satisfies Catalog;
