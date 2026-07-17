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
} as const satisfies Catalog;
