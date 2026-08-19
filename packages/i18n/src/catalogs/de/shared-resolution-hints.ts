/**
 * Resolution-hint family — German. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key; the en side is
 * byte-faithful to core's `buildHint` — never edit it from here.
 * `{{…}}` reference syntax, namespace ids, `requestDomains` / sha256 /
 * punycode vocabulary stay raw. Mints: scope = Geltungsbereich (m.);
 * namespace = Namespace raw (m.); secret = Secret raw (n.); fallback =
 * Fallback raw (m.); bare hostnames = einfache Hostnamen;
 * sanitization = Bereinigung (f.); Umgebung (f.) = environment;
 * Sammlung (f.) = collection; Live-Variablen / Live-Workflow keep the
 * Live product prefix raw.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': 'Die Referenz ist leer. Verwende {{name}} oder {{namespace.name}}.',
  'shared.resolutionHint.unknownNamespace':
    'Unbekannter Namespace. Gültige Namespaces: env, vault, collection, workspace, file, live, step, dynamic.',
  'shared.resolutionHint.unset.envActive':
    'Setze diese Variable in Umgebungen → aktive Umgebung (oder in der Standardumgebung als Fallback).',
  'shared.resolutionHint.unset.envNoActive':
    'Es ist keine aktive Umgebung ausgewählt. Wähle eine in Umgebungen aus oder lege eine Standardumgebung fest.',
  'shared.resolutionHint.unset.vault': 'Setze dieses Secret im Vault.',
  'shared.resolutionHint.unset.collection': 'Setze diese Variable in der aktuellen Sammlung.',
  'shared.resolutionHint.unset.workspace': 'Setze diese Variable in den Arbeitsbereich-Variablen.',
  'shared.resolutionHint.unset.file':
    'Lade diese Datei in Einstellungen → Dateien hoch (oder referenziere sie über ihren sha256-Hash).',
  'shared.resolutionHint.unset.live':
    'Keine Live-Variable mit diesem Namen. Lege eine in Live-Variablen an oder warte, bis die erste ' +
    'Aktualisierung sie befüllt.',
  'shared.resolutionHint.unset.step':
    'Schritt-Id oder Capture-Name in diesem Workflow-Lauf nicht gefunden. Prüfe die Konfiguration der ' +
    'Workflow-Schritte.',
  'shared.resolutionHint.unset.dynamic':
    'Kein integrierter Generator mit diesem Namen. Wähle einen aus der Vorschlagsliste ({{dynamic.uuid}}, ' +
    '{{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': 'In diesem Geltungsbereich nicht gesetzt.',
  'shared.resolutionHint.stepOutOfContext':
    'Schritt-Referenzen ({{step.<stepId>.<captureName>}}) sind nur innerhalb eines Live-Workflow-Schritts gültig.',
  'shared.resolutionHint.unresolved':
    'Weder in vault noch Umgebung, Sammlung oder Arbeitsbereich gefunden. Definiere sie in einem dieser ' +
    'Geltungsbereiche.',
  'shared.resolutionHint.secretAuthorizationRequired':
    'Der Secret-Manager mit diesem Eintrag benötigt eine Autorisierung. Entsperre den Manager oder ' +
    'genehmige den Zugriff, und versuche es dann erneut.',
  'shared.resolutionHint.secretNotFound':
    'Der Secret-Manager konnte unter dieser Referenz kein Secret finden. Prüfe die Referenzfelder im ' +
    'vault-Eintrag.',
  'shared.resolutionHint.secretUnavailable':
    'Der Secret-Manager für diesen Eintrag ist auf diesem Gerät nicht verfügbar. Installiere oder ' +
    'konfiguriere ihn, und versuche es dann erneut.',
  'shared.resolutionHint.invalidDomain.whitespace':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — enthält Leerzeichen (trenne ' +
    'Hostnamen mit Kommas). Verwende einfache Hostnamen, durch Kommas getrennt.',
  'shared.resolutionHint.invalidDomain.scheme':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — enthält ein Schema — entferne das ' +
    'Protokollpräfix. Verwende einfache Hostnamen, durch Kommas getrennt.',
  'shared.resolutionHint.invalidDomain.wildcard':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — enthält einen Platzhalter — ' +
    'requestDomains erfasst Subdomains automatisch. Verwende einfache Hostnamen, durch Kommas getrennt.',
  'shared.resolutionHint.invalidDomain.port':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — enthält einen Port — requestDomains ' +
    'vergleicht nur den Hostnamen. Verwende einfache Hostnamen, durch Kommas getrennt.',
  'shared.resolutionHint.invalidDomain.uppercase':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — enthält Großbuchstaben — ' +
    'requestDomains ist ASCII in Kleinbuchstaben. Verwende einfache Hostnamen, durch Kommas getrennt.',
  'shared.resolutionHint.invalidDomain.nonAscii':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — enthält Zeichen, die Chrome ablehnt ' +
    '(verwende punycode für IDN-Namen). Verwende einfache Hostnamen, durch Kommas getrennt.',
  'shared.resolutionHint.invalidDomain.empty':
    'Die Variable ergibt einen Wert, den Chrome an dieser Stelle ablehnt — ist nach der Bereinigung leer. ' +
    'Verwende einfache Hostnamen, durch Kommas getrennt.',
} as const satisfies Catalog;
