/**
 * Import/export family — the workbench's modal farm under
 * `workbench/components/workspace-export/` (export modal, import hub,
 * workspace-import preview shell + its status chips / vault blocks /
 * target picker / advanced toggles) and the stage-2 import modals under
 * `workbench/components/import/`.
 *
 * Raw by design inside keyed sentences: brand + format proper nouns
 * (Postman / Insomnia / Bruno / HAR / OpenAPI per the glossary), file
 * extensions and filenames rendered as `<Text code>` chips
 * (`.bru`, `.openheaders.yaml`), export ids / fingerprints / entity
 * names ({id} / {name} holes carry data), and the ` · ` separator
 * glyphs between summary fragments.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'Export',
  'workbench.importExport.export.cancel': 'Cancel',
  'workbench.importExport.export.download': 'Download',
  'workbench.importExport.export.sourceLabel': 'Source:',
  'workbench.importExport.export.scopeLabel': 'Scope:',
  'workbench.importExport.export.filenameLabel': 'Filename:',
  'workbench.importExport.export.scopeWholeWorkspace': 'Whole workspace',
  'workbench.importExport.export.vaultSecrets': 'Vault secrets',
  'workbench.importExport.export.vaultOmit': 'Omit (default)',
  'workbench.importExport.export.vaultEncrypted': 'Encrypted (passphrase)',
  'workbench.importExport.export.vaultPlaintext': 'Plaintext (advanced)',
  'workbench.importExport.export.passphrasePlaceholder': 'Passphrase',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'Confirm passphrase',
  'workbench.importExport.export.hintPlaceholder': 'Optional hint (visible to recipient — never the passphrase itself)',
  'workbench.importExport.export.strengthEmpty': 'enter a passphrase',
  'workbench.importExport.export.strengthWeak': 'weak',
  'workbench.importExport.export.strengthFair': 'fair',
  'workbench.importExport.export.strengthGood': 'good',
  'workbench.importExport.export.strengthStrong': 'strong',
  'workbench.importExport.export.strengthNote':
    'Passphrase strength: {label}. Share the passphrase out-of-band (Signal, password manager, voice). Anyone with the passphrase can read every secret in this export.',
  'workbench.importExport.export.plaintextTitle': 'Plaintext secrets are readable by anyone who sees this file',
  'workbench.importExport.export.plaintextUseOnly':
    'Use only when sharing with a system you fully trust (e.g. backup to your own encrypted drive).',
  'workbench.importExport.export.switchToEncrypted': 'Switch to encrypted (recommended)',
  'workbench.importExport.export.acknowledgeRisks': 'I understand the risks',
  'workbench.importExport.export.fingerprintsTitle': 'Encrypted — share these fingerprints with the recipient',
  'workbench.importExport.export.ciphertextFingerprint': 'Ciphertext fingerprint:',
  'workbench.importExport.export.keyFingerprint': 'Key fingerprint:',
  'workbench.importExport.export.fingerprintMatchNote':
    "After the recipient enters the passphrase, they'll see the same key fingerprint if it matches yours.",
  'workbench.importExport.export.advanced': 'Advanced',
  'workbench.importExport.export.strictLiteralLabel': 'Strict literal — export only what I selected',
  'workbench.importExport.export.strictLiteralHelp':
    "By default, picking a collection or folder pulls in every descendant plus parent containers so the import stands on its own. With strict literal on, only the picked uids ship — the recipient sees missing-deps for anything you didn't include.",
  'workbench.importExport.export.oauthNote':
    'OAuth client secrets are always omitted regardless of vault mode. The recipient enters their own at first auth.',
  'workbench.importExport.export.exportFailed': 'Export failed',
  'workbench.importExport.export.exportedShareFingerprints': 'Exported {filename} — share fingerprints with recipient',
  'workbench.importExport.export.exported': 'Exported {filename}',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'IMPORT',
  'workbench.importExport.hub.closeAria': 'Close import',
  'workbench.importExport.hub.readingFile': 'Reading file…',
  'workbench.importExport.hub.pastePlaceholder': 'Paste a curl command or URL',
  'workbench.importExport.hub.continueAria': 'Continue import',
  'workbench.importExport.hub.notRecognized':
    'Not recognized yet — paste a curl command, a URL, a HAR, a Postman / Insomnia / Bruno export, an OpenAPI document, or a workspace export.',
  'workbench.importExport.hub.dropAria': 'Drop an importable file or folder here',
  'workbench.importExport.hub.dropTitle': 'Drop a file or folder to import',
  'workbench.importExport.hub.kindHar': 'HAR capture',
  'workbench.importExport.hub.kindPostman': 'Postman collection or backup',
  'workbench.importExport.hub.kindInsomnia': 'Insomnia export',
  'workbench.importExport.hub.kindBrunoSuffix': 'file or collection folder',
  'workbench.importExport.hub.kindOpenapi': 'OpenAPI 3.x document',
  'workbench.importExport.hub.kindWorkspaceSuffix': 'workspace export',
  'workbench.importExport.hub.autoDetected': 'The format is recognized automatically.',
  'workbench.importExport.hub.browseFiles': 'Browse files…',
  'workbench.importExport.hub.browseFolder': 'Browse folder…',
  'workbench.importExport.hub.switchingFrom': 'Switching from',
  'workbench.importExport.hub.switchingOr': 'or',
  'workbench.importExport.hub.migrateCta': 'Migrate from another tool',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles': 'No Bruno files in that folder — expected .bru files or a bruno.json.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} file could not be read and was skipped.',
      other: '{count} files could not be read and were skipped.',
    }),
  'workbench.importExport.modals.readFailed': "Couldn't read {name}: {message}",
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `${plural(locale, Number(count), { one: 'Imported {count} entity', other: 'Imported {count} entities' })} from "${label}"`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': 'IMPORT WORKSPACE EXPORT',
  'workbench.importExport.preview.closeAria': 'Close import preview',
  'workbench.importExport.preview.cancel': 'Cancel',
  'workbench.importExport.preview.emptyFile': 'Drop a .openheaders.yaml file to preview it.',
  'workbench.importExport.preview.emptyClipboard': 'Paste a workspace export to preview it.',
  'workbench.importExport.preview.preparing': 'Preparing import…',
  'workbench.importExport.preview.footerExportInfo': 'Export {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'Pick a file to preview',
  'workbench.importExport.preview.footerNoData': 'No data',
  'workbench.importExport.preview.importInto': 'Import into:',
  'workbench.importExport.preview.staleTitle': 'Workspace changed since this preview opened',
  'workbench.importExport.preview.staleDescription': 'Reopen Import Preview to refresh the diff, then retry.',
  'workbench.importExport.preview.advanced': 'Advanced',
  'workbench.importExport.preview.advancedCount': 'Advanced ({count})',
  'workbench.importExport.preview.previewFailed': 'Preview failed',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `Import — ${plural(locale, Number(count), { one: '{count} item', other: '{count} items' })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'Import into',
  'workbench.importExport.target.current': 'Current',
  'workbench.importExport.target.new': 'New',
  'workbench.importExport.target.pickExisting': 'Pick existing',
  'workbench.importExport.target.noActiveWorkspace': 'No active workspace',
  'workbench.importExport.target.selectWorkspace': 'Select a workspace',
  'workbench.importExport.target.landsOnOrg': 'Lands on {name} and syncs to its devices',
  'workbench.importExport.target.staysLocal': 'Stays on this device',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': 'Advanced',
  'workbench.importExport.advanced.closeAria': 'Close advanced panel',
  'workbench.importExport.advanced.backupRestoreLabel': 'This is mine — prefer update by uid',
  'workbench.importExport.advanced.backupRestoreHelp':
    'Switches uid-matched collisions from “add as new” to “replace existing”. Skipped for entities edited locally since the export was made.',
  'workbench.importExport.advanced.trustExportLabel': 'Trust this export — keep enabled flags',
  'workbench.importExport.advanced.trustExportHelp':
    'Imported rules / live workflows / live variables land disabled by default. Enable this only when you trust the sender.',
  'workbench.importExport.advanced.stripScriptsLabel': 'Strip request scripts on import',
  'workbench.importExport.advanced.stripScriptsHelp':
    'Removes pre-request and post-response scripts from every imported request. Recommended when the sender is unfamiliar.',
  'workbench.importExport.advanced.omitOAuthLabel': 'Omit OAuth configs',
  'workbench.importExport.advanced.omitOAuthHelp':
    'By default, OAuth2 configs ride with the request (token endpoint, client id, scopes — never client secret or tokens). With this on, every OAuth2 request lands with auth set to none.',
  'workbench.importExport.advanced.keepOrderLabel': 'Keep target collection order on update',
  'workbench.importExport.advanced.keepOrderHelp':
    "By default, an updated collection takes the export's child order. With this on, your existing target ordering is preserved.",
  'workbench.importExport.advanced.workspaceSettingsLabel': 'Include workspace-level settings',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    'Reserved for a future allowlist of workspace-semantic settings. The current allowlist is empty — nothing ships through this toggle in v1.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'Refuse on workspace.uid collision',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    'By default, importing into a new workspace silently regenerates the workspace uid on collision. With this on, an existing workspace with the same uid blocks the import.',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': 'Dismiss',
  'workbench.importExport.chips.plaintextLabel': 'Plaintext secrets',
  'workbench.importExport.chips.plaintextTitle': 'This export contains plaintext vault secrets.',
  'workbench.importExport.chips.plaintextBody':
    'Anyone with this file can read every secret it carries. Consider re-issuing as encrypted before forwarding.',
  'workbench.importExport.chips.skippedLabel': '{count} skipped',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} entity couldn't be parsed and will be skipped.",
      other: "{count} entities couldn't be parsed and will be skipped.",
    }),
  'workbench.importExport.chips.andMore': '…and {count} more',
  'workbench.importExport.chips.dedupSameLabel': 'Already imported here',
  'workbench.importExport.chips.dedupSameTitle': 'You imported this export ({id}) here on {date}.',
  'workbench.importExport.chips.dedupSameBody': 'Re-importing it will apply your current per-entity strategy choices.',
  'workbench.importExport.chips.dedupOtherLabel': 'Imported elsewhere',
  'workbench.importExport.chips.dedupOtherTitle': 'You also imported export {id} into "{name}".',
  'workbench.importExport.chips.dedupOtherBody': 'That workspace is unaffected by this import.',
  'workbench.importExport.chips.dedupUidLabel': 'Source already exists',
  'workbench.importExport.chips.dedupUidTitle': 'A workspace from this source already exists ("{name}").',
  'workbench.importExport.chips.dedupUidBody': 'Switch the target above to refresh it, or import as a new copy.',
  'workbench.importExport.chips.staleLabel': 'Data changed',
  'workbench.importExport.chips.staleTitle': 'The target workspace was modified by another tab.',
  'workbench.importExport.chips.staleBody':
    'The collision tree below has been refreshed — review and click Import again.',
  'workbench.importExport.chips.previewErrorLabel': 'Preview failed',
  'workbench.importExport.chips.previewErrorTitle': "Couldn't compute collision diff.",
  'workbench.importExport.chips.unresolvedLabel': '{count} unresolved',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} unresolved reference.',
      other: '{count} unresolved references.',
    }),
  'workbench.importExport.chips.unresolvedBody':
    "These names don't resolve in the export or the target. Imports will land as broken bindings — rebind once the missing entity appears.",
  'workbench.importExport.chips.referencedBy': 'referenced by {count}',
  'workbench.importExport.chips.summaryThen': 'Then:',
  'workbench.importExport.chips.summaryNow': 'Now:',
  'workbench.importExport.chips.summaryNew': '{count} new',
  'workbench.importExport.chips.summaryKept': '{count} kept',
  'workbench.importExport.chips.summaryRemoved': '{count} removed',
  'workbench.importExport.chips.showBreakdown': 'Show per-section breakdown',
  'workbench.importExport.chips.hideBreakdown': 'Hide breakdown',
  'workbench.importExport.chips.sectionNew': '(+{count} new)',
  'workbench.importExport.chips.sectionRemoved': '({count} removed)',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Encrypted vault — {count} secret',
      other: 'Encrypted vault — {count} secrets',
    }),
  'workbench.importExport.vault.hintFromSender': 'Hint from sender:',
  'workbench.importExport.vault.enterPassphrase':
    'Enter the passphrase to decrypt these secrets locally. Skipping decryption proceeds with the rest of the import — secrets are simply omitted.',
  'workbench.importExport.vault.passphrasePlaceholder': 'Passphrase',
  'workbench.importExport.vault.decrypt': 'Decrypt vault',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault decrypted — {count} secret ready to import',
      other: 'Vault decrypted — {count} secrets ready to import',
    }),
  'workbench.importExport.vault.keyFingerprint': 'Key fingerprint:',
  'workbench.importExport.vault.compareWithSender': '(compare with sender)',
  'workbench.importExport.vault.ciphertextFingerprint': 'Ciphertext fingerprint:',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} secret couldn't be decoded — will be omitted from the import",
      other: "{count} secrets couldn't be decoded — will be omitted from the import",
    }),
  'workbench.importExport.vault.andMore': '…and {count} more',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'Cancel',
  'workbench.importExport.import.importCta': 'Import',
  'workbench.importExport.import.importCtaCount': 'Import ({count})',
  'workbench.importExport.import.importShortcutTooltip': 'Import ({shortcut})',
  'workbench.importExport.import.importTo': 'IMPORT TO',
  'workbench.importExport.import.hintNavigate': 'navigate',
  'workbench.importExport.import.hintSelect': 'select',
  'workbench.importExport.import.hintImport': 'import',
  'workbench.importExport.import.hintClose': 'close',
  'workbench.importExport.import.cantReadFile': "Couldn't read this file",
  'workbench.importExport.import.failedCreateCollection': 'Failed to create collection',
  'workbench.importExport.import.importFailed': 'Import failed: {message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} transform', other: '{count} transforms' }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} drop', other: '{count} drops' }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Imported {count} request', other: 'Imported {count} requests' }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'IMPORT FROM HAR',
  'workbench.importExport.har.tooltipChooseFile': 'Choose a .har file first',
  'workbench.importExport.har.tooltipSelectEntry': 'Select at least one entry',
  'workbench.importExport.har.footerSelected': '{selected} of {total} selected',
  'workbench.importExport.har.footerChooseFile': 'Choose a .har file',
  'workbench.importExport.har.introPrefix': 'Import a',
  'workbench.importExport.har.introSuffix':
    'file (HTTP Archive) exported from DevTools or a proxy. Each entry becomes a destination request in the chosen collection. Cookies and multipart uploads are dropped with tracking annotations; auth headers are promoted to first-class auth types.',
  'workbench.importExport.har.filterPlaceholder': 'Filter by URL / method / name',
  'workbench.importExport.har.selectAll': 'Select all',
  'workbench.importExport.har.selectNone': 'None',
  'workbench.importExport.har.readFailed': 'Failed to read HAR: {message}',
  'workbench.importExport.har.dropTitle': 'Drop a .har file here, or click to pick one',
  'workbench.importExport.har.dropHint': 'Exported from DevTools Network → right-click → Save all as HAR',
  'workbench.importExport.har.noImportableEntries': 'The file has no importable entries.',
  'workbench.importExport.har.noFilterMatch': 'No entries match the filter.',
  'workbench.importExport.har.showingFirst': 'Showing first {shown} of {total}. Use the filter to narrow down.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transform applied to the source',
      other: '{count} transforms applied to the source',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} drop recorded', other: '{count} drops recorded' }),
  'workbench.importExport.har.transformsTooltip':
    'Transforms rewrite source fields into normalized equivalents — e.g. promoting Authorization headers into first-class auth types.',
  'workbench.importExport.har.dropsTooltip':
    "Drops are source fields that don't map to the model (cookies, multipart uploads, etc.). Each has a tracking annotation in the full report.",
  'workbench.importExport.har.reportHover':
    'Hover for details · full list in the import-report export (Settings → Data)',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'IMPORT FROM CURL',
  'workbench.importExport.curl.tooltipPasteFirst': 'Paste a curl command first',
  'workbench.importExport.curl.tooltipEnterName': 'Enter a name',
  'workbench.importExport.curl.introPrefix': 'Paste a',
  'workbench.importExport.curl.introSuffix': 'command — e.g. "Copy as cURL" from browser DevTools or API docs.',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': "Couldn't parse this command",
  'workbench.importExport.curl.parseFallback': 'Could not parse — check the command and try again.',
  'workbench.importExport.curl.nameLabel': 'NAME',
  'workbench.importExport.curl.namePlaceholder': 'How this request appears in the sidebar',
  'workbench.importExport.curl.failedCreateRequest': 'Failed to create request',
  'workbench.importExport.curl.importedName': 'Imported "{name}"',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} header', other: '{count} headers' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} query param', other: '{count} query params' }),
  'workbench.importExport.curl.noBody': 'no body',
  'workbench.importExport.curl.bodyType': '{type} body',
  'workbench.importExport.curl.noAuth': 'no auth',
  'workbench.importExport.curl.authType': '{type} auth',
  'workbench.importExport.curl.droppedWord': 'dropped',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'IMPORT FROM POSTMAN',
  'workbench.importExport.postman.intro':
    'Import a Postman Collection v2.1 JSON. Folder structure, collection variables, request docs and settings, per-request auth (basic / bearer / api-key / OAuth 2.0), and request scripts (translated to the oh.* API where possible) are preserved. AWS sigv4 and file uploads are tracked as drops. Optionally attach a Postman environment file to land a matching Environment.',
  'workbench.importExport.postman.tooltipChooseFile': 'Choose a collection file first',
  'workbench.importExport.postman.tooltipEnterName': 'Enter a collection name',
  'workbench.importExport.postman.collectionNameLabel': 'COLLECTION NAME',
  'workbench.importExport.postman.collectionNamePlaceholder': 'Name for the new Collection',
  'workbench.importExport.postman.readFileFailed': 'Failed to read file: {message}',
  'workbench.importExport.postman.readEnvFailed': 'Failed to read environment: {message}',
  'workbench.importExport.postman.parsedCollection': 'PARSED COLLECTION',
  'workbench.importExport.postman.requestsLabel': 'Requests:',
  'workbench.importExport.postman.foldersLabel': 'Folders:',
  'workbench.importExport.postman.collectionVarsLabel': 'Collection vars:',
  'workbench.importExport.postman.folderTree': 'Folder tree',
  'workbench.importExport.postman.optionalEnvFile': 'OPTIONAL · ENVIRONMENT FILE',
  'workbench.importExport.postman.environmentLabel': 'Environment: {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var', other: '{count} vars' }),
  'workbench.importExport.postman.secretCount': '{count} secret',
  'workbench.importExport.postman.remove': 'Remove',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} env variable dropped (disabled entries)',
      other: '{count} env variables dropped (disabled entries)',
    }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Drop a Postman Collection v2.1 JSON here, or click to pick one',
  'workbench.importExport.postman.dropEnvTitle': 'Drop a Postman Environment JSON here (optional)',
  'workbench.importExport.postman.dropCollectionHint':
    'Exported from Postman → Collection → ⋯ → Export (Collection v2.1)',
  'workbench.importExport.postman.dropEnvHint': 'Exported from Postman → Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} folder', other: '{count} folders' }),
  'workbench.importExport.postman.oneEnvironment': '1 environment',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'IMPORT FROM POSTMAN BACKUP',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Import a Postman backup data dump. Collections, environments, globals, and header presets are recognized; header presets land as unpublished header rules. Scripts, OAuth 2.0, AWS sigv4, and file uploads are tracked as drops.',
  'workbench.importExport.sectioned.titleInsomnia': 'IMPORT FROM INSOMNIA',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Import an Insomnia export (v4 JSON or v5 YAML). Workspaces become collections with their folder trees; environments flatten (sub-environments merge over their base) and {{ _.var }} references rewrite to {{var}}; embedded API specs are kept as editable specifications linked to their generated collections.',
  'workbench.importExport.sectioned.titleBruno': 'IMPORT FROM BRUNO',
  'workbench.importExport.sectioned.blurbBruno':
    'Import a Bruno .bru request or a whole collection folder. Method, headers, params, body, and basic/bearer/api-key auth are preserved; a folder brings its folder tree, ordering, and environments; scripts, tests, and docs blocks are tracked as drops.',
  'workbench.importExport.sectioned.titleOpenapi': 'IMPORT FROM OPENAPI',
  'workbench.importExport.sectioned.blurbOpenapi':
    'Import an OpenAPI 3.x document (JSON or YAML). Operations become requests under {{baseUrl}}, tags become folders, parameters and request bodies are preserved (schema-only bodies get a placeholder scaffold), and security schemes map to auth — fill in the {{clientId}}/{{clientSecret}} placeholders after importing. The document can also live on as an editable specification linked to the generated collection.',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'Nothing parsed yet',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'Every collection needs a name',
  'workbench.importExport.sectioned.cantReadImport': "Couldn't read this import",
  'workbench.importExport.sectioned.readInputFailed': 'Failed to read input: {message}',
  'workbench.importExport.sectioned.importAs': 'IMPORT AS',
  'workbench.importExport.sectioned.specWithCollection': 'Specification with a Collection',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'The document lives on as an editable spec, linked to the generated collection.',
  'workbench.importExport.sectioned.collectionOnly': 'Collection',
  'workbench.importExport.sectioned.collectionOnlyHelp': 'Convert only — the document itself is not kept.',
  'workbench.importExport.sectioned.specificationsSection': 'SPECIFICATIONS · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'COLLECTIONS · {count}',
  'workbench.importExport.sectioned.environmentsSection': 'ENVIRONMENTS · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': 'HEADER PRESETS · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'Collection name',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var', other: '{count} vars' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} header', other: '{count} headers' }),
  'workbench.importExport.sectioned.presetsNote':
    'Each preset lands as an unpublished header rule — add conditions and publish it when ready; nothing touches live traffic until then.',
  'workbench.importExport.sectioned.nothingImportable': 'Nothing importable in this file',
  'workbench.importExport.sectioned.nothingImportableDesc':
    'The file parsed, but every section was empty or dropped — see the import notes below.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} request', other: '{count} requests' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} specification', other: '{count} specifications' }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} environment', other: '{count} environments' }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} header rule (unpublished)',
      other: '{count} header rules (unpublished)',
    }),
  'workbench.importExport.sectioned.importedLead': 'Imported {parts}',
  'workbench.importExport.sectioned.emptyFinish': 'Import finished — nothing to bring over',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': 'Migrate from another tool',
  'workbench.importExport.migrate.scanCta': 'Scan this computer',
  'workbench.importExport.migrate.pullCta': 'Import from Postman account',
  'workbench.importExport.migrate.scanNote':
    'Scanning checks a fixed list of application folders and reads only tool data files (backups and local stores). It never opens credential, cookie, or session files, and nothing leaves this computer. Importing anything is a separate, explicit step.',
  'workbench.importExport.migrate.scanFailed':
    'The scan could not run — try again, or use the import hub with an exported file.',
  'workbench.importExport.migrate.backupReadFailed': 'The backup file could not be read.',
  'workbench.importExport.migrate.localReadFailed': 'The local data could not be read.',
  'workbench.importExport.migrate.detected': 'Detected',
  'workbench.importExport.migrate.notFound': 'Not found',
  'workbench.importExport.migrate.cancel': 'Cancel',
  'workbench.importExport.migrate.fromAccount': 'Import from your Postman account',
  'workbench.importExport.migrate.localDataPrefix':
    'Have local Insomnia, Thunder Client, or Bruno data? Export it from the tool and drop the file in the',
  'workbench.importExport.migrate.importHub': 'import hub',
  'workbench.importExport.migrate.localDataSuffix': '— or scan this computer with the Open Headers desktop app.',
  'workbench.importExport.migrate.desktopConnected':
    'Your desktop app is connected — choose “Migrate from another tool” there; progress mirrors here and the imported workspaces sync over.',
  'workbench.importExport.migrate.desktopNeeded':
    'The scan needs the desktop app; once it runs there, the imported workspaces sync to this browser.',
  'workbench.importExport.migrate.closeConfirmTitle': 'Close the import?',
  'workbench.importExport.migrate.closeListingContent':
    'Your workspaces are still being listed — large accounts can take a minute. Closing abandons the listing.',
  'workbench.importExport.migrate.closeListingOk': 'Keep waiting',
  'workbench.importExport.migrate.closeSelectingContent':
    'Your workspace selection will be discarded. Nothing has been imported yet.',
  'workbench.importExport.migrate.closeSelectingOk': 'Keep selecting',
  'workbench.importExport.migrate.closeAnyway': 'Close anyway',
  'workbench.importExport.migrate.discardAndClose': 'Discard and close',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — translate to match Postman's UI language
  // where it localizes; otherwise keep the English labels.
  'workbench.importExport.pull.keyIntro':
    'Paste a Postman API key to list your workspaces and pick which ones to import.',
  'workbench.importExport.pull.keyAria': 'Postman API key',
  'workbench.importExport.pull.listCta': 'List workspaces',
  'workbench.importExport.pull.listFailed': 'The workspaces could not be listed.',
  'workbench.importExport.pull.startFailed': 'The import could not start.',
  'workbench.importExport.pull.quipContacting': 'Contacting your Postman account',
  'workbench.importExport.pull.quipCounting': 'Counting collections',
  'workbench.importExport.pull.quipWeighing': 'Weighing environments',
  'workbench.importExport.pull.quipWrangling': 'Wrangling workspaces',
  'workbench.importExport.pull.quipAlphabetizing': 'Alphabetizing folders',
  'workbench.importExport.pull.quipSniffing': 'Sniffing out requests',
  'workbench.importExport.pull.quipUntangling': 'Untangling variables',
  'workbench.importExport.pull.quipStacking': 'Stacking headers',
  'workbench.importExport.pull.pickIntro':
    'Each selected Postman workspace lands in its own workspace, keeping its exact name, with an end-of-run report.',
  'workbench.importExport.pull.noWorkspaces': 'No workspaces found on this account.',
  'workbench.importExport.pull.workspaceCounts': '{collections} collections · {environments} environments',
  'workbench.importExport.pull.importCta': 'Import selected',
  'workbench.importExport.pull.back': 'Back',
  'workbench.importExport.pull.steps.menuA': 'In the Postman app or https://postman.co',
  'workbench.importExport.pull.steps.menuB': 'Settings menu → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Left sidebar → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': 'Put a random name → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'Copy the key → Paste it above',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'Vendor',
  'workbench.importExport.detection.dataFoundCol': 'Data found',
  'workbench.importExport.detection.contentsCol': 'Contents',
  'workbench.importExport.detection.backupFrom': 'Backup from {date}',
  'workbench.importExport.detection.localData': 'Local data',
  'workbench.importExport.detection.importCta': 'Import…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'Or export it (Preferences → Data → Export), then drop the file in the',
  'workbench.importExport.detection.backupContents':
    '{collections} collections · {environments} environments · {headerPresets} header presets · {globals} globals',
  'workbench.importExport.detection.localContents':
    '{collections} collections · {environments} environments · {requests} requests',
  'workbench.importExport.detection.emptyScanned': 'No importable data stores were found on this computer.',
  'workbench.importExport.detection.emptyNotScanned':
    'Nothing scanned yet — “Scan this computer” lists importable data here.',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} store file was skipped —',
      other: '{count} store files were skipped —',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Postman import report',
  'workbench.importExport.report.noReport': 'No import report found for this workspace.',
  'workbench.importExport.report.cleanImport': 'Everything imported cleanly — no drops or transforms.',
  'workbench.importExport.report.copyOk': 'Report copied as JSON',
  'workbench.importExport.report.copyAnonymizedOk': 'Anonymized report copied as JSON',
  'workbench.importExport.report.copyFailed': 'The report could not be copied.',
  'workbench.importExport.report.copyReport': 'Copy report',
  'workbench.importExport.report.download': 'Download',
  'workbench.importExport.report.anonymizeTooltip':
    'For sharing publicly (e.g. a GitHub issue): workspace names become “Workspace N” and rewritten values are redacted. Paths, reasons, and counts stay so the report is still debuggable.',
  'workbench.importExport.report.anonymize': 'Anonymize',
  'workbench.importExport.report.close': 'Close',
  'workbench.importExport.report.openWorkspace': 'Open workspace',
  'workbench.importExport.report.countsLine':
    '{collections} collections · {environments} environments · {requests} requests',
  'workbench.importExport.report.savedExamplesPart': '{count} saved examples',
  'workbench.importExport.report.globalVariablesPart': '{count} global variables',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} note', other: '{count} notes' }),
  'workbench.importExport.report.summaryImported': 'Imported',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'collection', other: 'collections' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'environment', other: 'environments' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'request', other: 'requests' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'saved example', other: 'saved examples' }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'global variable', other: 'global variables' }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} workspace', other: '{count} workspaces' }),
  'workbench.importExport.report.withOpen': '(with',
  'workbench.importExport.report.and': 'and',
  'workbench.importExport.report.into': 'into',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': 'previously',
  'workbench.importExport.reimport.previouslyImported': '(previously imported {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} new issue since last import',
      other: '{count} new issues since last import',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} previously-unsupported entry is now handled',
      other: '{count} previously-unsupported entries are now handled',
    }),
  'workbench.importExport.reimport.countsChanged': 'Counts changed since last import',
  'workbench.importExport.reimport.minorChanges': 'Minor changes vs last import',
  'workbench.importExport.reimport.newDrops': 'New drops ({count})',
  'workbench.importExport.reimport.dropsResolved': 'Drops resolved ({count})',
  'workbench.importExport.reimport.newTransforms': 'New transforms ({count})',
  'workbench.importExport.reimport.transformsResolved': 'Transforms no longer needed ({count})',
} as const satisfies Catalog;
