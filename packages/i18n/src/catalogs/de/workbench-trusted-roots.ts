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
  'workbench.trustedRoots.title': 'Vertrauenswürdige Zertifikate',
  'workbench.trustedRoots.description':
    'Zertifizierungsstellen, denen jede TLS-Verbindung dieses Workspace zusätzlich zu den eingebauten Wurzeln vertraut. Öffentliches Material — mit dem Workspace synchronisiert, nie ein Geheimnis.',
  'workbench.trustedRoots.count': 'ZERTIFIKATE ({count})',
  'workbench.trustedRoots.empty': 'Noch keine vertrauenswürdigen Zertifikate',
  'workbench.trustedRoots.emptyHint':
    'Füge die Wurzel deiner privaten CA hinzu, um Server und Broker hinter deiner eigenen PKI zu erreichen, ohne die Prüfung abzuschalten.',
  'workbench.trustedRoots.add': 'Zertifikat hinzufügen',
  'workbench.trustedRoots.header.name': 'Name',
  'workbench.trustedRoots.header.subject': 'Subjekt',
  'workbench.trustedRoots.header.fingerprint': 'SHA-256-Fingerabdruck',
  'workbench.trustedRoots.header.expires': 'Läuft ab',
  'workbench.trustedRoots.row.chain': 'Kette aus {count}',
  'workbench.trustedRoots.row.expired': 'Abgelaufen',
  'workbench.trustedRoots.row.copyFingerprint': 'Fingerabdruck kopieren',
  'workbench.trustedRoots.row.copied': 'Kopiert',
  'workbench.trustedRoots.row.remove': 'Entfernen',
  'workbench.trustedRoots.row.removeTitle': 'Dieses Zertifikat entfernen?',
  'workbench.trustedRoots.row.removeDescription':
    'Verbindungen, die darauf angewiesen waren, scheitern ab der nächsten Anfrage an der Prüfung.',
  'workbench.trustedRoots.add.pemLabel': 'Zertifikat (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'PEM-Zertifikat oder -Kette einfügen',
  'workbench.trustedRoots.add.nameLabel': 'Name',
  'workbench.trustedRoots.add.namePlaceholder': 'Interne Root-CA',
  'workbench.trustedRoots.add.summary.subject': 'Subjekt',
  'workbench.trustedRoots.add.summary.issuer': 'Aussteller',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': 'Gültig ab',
  'workbench.trustedRoots.add.summary.validUntil': 'Gültig bis',
  'workbench.trustedRoots.add.summary.chain': 'Kette',
  'workbench.trustedRoots.add.parsing': 'Zertifikat wird gelesen…',
  'workbench.trustedRoots.add.invalid': 'Kein Zertifikat: {message}',
  'workbench.trustedRoots.add.notCa':
    'Das ist ein Serverzertifikat, keine Zertifizierungsstelle. Füge stattdessen die Wurzel oder das Zwischenzertifikat hinzu, das es ausgestellt hat.',
  'workbench.trustedRoots.add.confirm': 'Hinzufügen',
  'workbench.trustedRoots.add.cancel': 'Abbrechen',
  'workbench.trustedRoots.added': 'Zertifikat hinzugefügt',
  'workbench.trustedRoots.addFailed': 'Zertifikat konnte nicht hinzugefügt werden',
  'workbench.trustedRoots.removed': 'Zertifikat entfernt',
  'workbench.trustedRoots.removeFailed': 'Zertifikat konnte nicht entfernt werden',
} as const satisfies Catalog;
