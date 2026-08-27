/**
 * Trusted-certificates family — the TrustedRootsEditor singleton tab
 * (`workbench/components/trusted-roots/`): the row table, the
 * paste → summary → Add flow and its refusals, the remove confirm.
 *
 * Raw by design inside keyed sentences: PEM / CA / PKI / TLS / SHA-256
 * vocabulary (glossary duty), {count} chain lengths, {message} parser
 * text.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': 'Trusted certificates',
  'workbench.trustedRoots.description':
    'Certificate authorities every TLS connection in this workspace trusts, in addition to the built-in roots. Public material — synced with the workspace, never a secret.',
  'workbench.trustedRoots.count': 'CERTIFICATES ({count})',
  'workbench.trustedRoots.empty': 'No trusted certificates yet',
  'workbench.trustedRoots.emptyHint':
    'Add your private CA root to reach servers and brokers behind your own PKI without turning verification off.',
  'workbench.trustedRoots.add': 'Add certificate',
  'workbench.trustedRoots.header.name': 'Name',
  'workbench.trustedRoots.header.subject': 'Subject',
  'workbench.trustedRoots.header.fingerprint': 'SHA-256 fingerprint',
  'workbench.trustedRoots.header.expires': 'Expires',
  'workbench.trustedRoots.row.chain': 'Chain of {count}',
  'workbench.trustedRoots.row.expired': 'Expired',
  'workbench.trustedRoots.row.copyFingerprint': 'Copy fingerprint',
  'workbench.trustedRoots.row.copied': 'Copied',
  'workbench.trustedRoots.row.remove': 'Remove',
  'workbench.trustedRoots.row.rename': 'Rename',
  'workbench.trustedRoots.add.pemLabel': 'Certificate (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'Paste a PEM certificate or chain',
  'workbench.trustedRoots.add.nameLabel': 'Name',
  'workbench.trustedRoots.add.namePlaceholder': 'Internal Root CA',
  'workbench.trustedRoots.add.summary.subject': 'Subject',
  'workbench.trustedRoots.add.summary.issuer': 'Issuer',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': 'Valid from',
  'workbench.trustedRoots.add.summary.validUntil': 'Valid until',
  'workbench.trustedRoots.add.summary.chain': 'Chain',
  'workbench.trustedRoots.add.parsing': 'Reading certificate…',
  'workbench.trustedRoots.add.invalid': 'Not a certificate: {message}',
  'workbench.trustedRoots.add.notCa':
    'This is a server certificate, not a certificate authority. Add the root or intermediate that issued it instead.',
  'workbench.trustedRoots.add.confirm': 'Add',
  'workbench.trustedRoots.add.cancel': 'Cancel',
  'workbench.trustedRoots.saveFailed': 'Failed to save trusted certificates',
  'workbench.trustedRoots.saveFailedDetail': 'Failed to save trusted certificates: {message}',
  'workbench.trustedRoots.settings.label': 'Trusted certificates',
  'workbench.trustedRoots.settings.count': '{count} from this workspace',
  'workbench.trustedRoots.settings.none': 'None from this workspace',
  'workbench.trustedRoots.settings.manage': 'Manage trusted certificates',
  'workbench.trustedRoots.settings.empty': 'No trusted certificates in this workspace yet.',
  'workbench.trustedRoots.settings.browserStore': 'Browser store',
  'workbench.trustedRoots.settings.help':
    'Certificate authorities this workspace trusts in addition to the built-in roots — applied to every TLS connection the app’s runtime dials, one root per row. Add a private CA here instead of turning verification off.',
  'workbench.trustedRoots.settings.deviceCount': '{count} on this device',
  'workbench.trustedRoots.settings.groupWorkspace': 'This workspace',
  'workbench.trustedRoots.settings.groupDevice': 'This device',
  'workbench.trustedRoots.device.count': 'PINNED ON THIS DEVICE ({count})',
  'workbench.trustedRoots.device.empty': 'No certificates pinned on this device',
  'workbench.trustedRoots.device.emptyHint':
    'Pins are usually added from a failed send — trust the certificate the server presented, on this machine only. Paste one here to pin it by hand.',
  'workbench.trustedRoots.settings.browserNote':
    'The browser verifies with its own trust store; certificates added to this workspace apply only when the app’s runtime sends.',
  'workbench.trustedRoots.systemTrust.count':
    '{count} certificates from this machine’s trust store apply to every TLS connection the app’s runtime dials',
  'workbench.trustedRoots.systemTrust.off': 'Only the built-in roots and the certificates above are trusted',
  'workbench.trustedRoots.systemTrust.unsupported':
    'This runtime cannot read the system trust store — Node 22.15 or later is required',
  'workbench.trustedRoots.systemTrust.browser': 'The browser verifies with its own trust store',
} as const satisfies Catalog;
