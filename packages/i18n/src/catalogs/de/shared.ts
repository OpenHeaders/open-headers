/**
 * Shared namespace — German. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules. Register contract for the
 * de catalogs (pattern-setter): informal `du` imperative (`kopiere`,
 * `aktualisiere`), sentence-case labels with German noun capitalization
 * kept mid-label, „deutsche Anführungszeichen“ when quoting, figure
 * grouping stays the epic's plain space (`30 000 ms`), `{percent} %`
 * with a space before the sign, `e.g.` → `z. B.`. Loanwords ride raw,
 * noun-capitalized per German orthography: der Token, das Popup, der
 * Handshake, das Back-end (en fragment spelling kept), der Header
 * (HTTP referent — universal German dev vocabulary), das Cookie, der
 * Tab, das Update. Workspace = Arbeitsbereich (m.); request = Anfrage
 * (f.); response = Antwort (f.); rule = Regel (f.); pair = koppeln;
 * Switch = Wechseln; Settings = Einstellungen.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Speichern',
  'shared.action.cancel': 'Abbrechen',
  'shared.action.close': 'Schließen',
  'shared.action.copy': 'Kopieren',
  'shared.action.remove': 'Entfernen',
  'shared.toast.copiedToClipboard': 'In die Zwischenablage kopiert',
  'shared.toast.copyFailed': 'Zugriff auf die Zwischenablage verweigert — kopiere den Wert manuell',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Regel', other: '{count} Regeln' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': 'Etwas ist schiefgelaufen',
  'shared.errorBoundary.subtitle': 'Beim Laden des Popups ist ein Fehler aufgetreten. Schließe es und öffne es erneut.',
  'shared.errorBoundary.reload': 'Neu laden',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': 'Verbindung OK',
  'shared.probe.reachableDescription': '{label} ist erreichbar.',
  'shared.probe.notReachable': 'Nicht erreichbar',
  'shared.probe.title.authRequired': 'Erreichbar, aber Authentifizierung erforderlich',
  'shared.probe.title.workspaceUnknown': 'Erreichbar, aber der Arbeitsbereich ist nicht freigegeben',
  'shared.probe.title.versionMismatch': 'Erreichbar, aber die Versionen stimmen nicht überein',
  'shared.probe.title.notReady': 'Erreichbar, aber nicht bereit',
  'shared.probe.fail.invalidUrl': 'Ungültige URL.',
  'shared.probe.fail.invalidUrlDetail': 'Ungültige URL. {detail}',
  'shared.probe.fail.timeout': 'Zeitüberschreitung beim Warten auf eine Antwort — läuft das Back-end?',
  'shared.probe.fail.closedBeforeWelcome':
    'Verbindung vor dem Handshake geschlossen — wahrscheinlich läuft das Back-end nicht auf diesem Port.',
  'shared.probe.fail.openFailed': 'WebSocket konnte nicht geöffnet werden.',
  'shared.probe.fail.openFailedDetail': 'WebSocket konnte nicht geöffnet werden: {detail}.',
  'shared.probe.fail.protocolMismatch':
    'Erreichbar, aber die Protokollversionen sind inkompatibel — aktualisiere beide Apps.',
  'shared.probe.fail.workspaceUnknown':
    'Erreichbar — das Back-end läuft, gibt diesen Arbeitsbereich aber noch nicht frei. Wechseln koppelt die beiden.',
  'shared.probe.fail.protocolTooOld':
    'Erreichbar — aber diese App ist älter als das Back-end. Aktualisiere diese Seite.',
  'shared.probe.fail.protocolTooNew':
    'Erreichbar — aber das Back-end ist älter als diese App. Aktualisiere das Back-end.',
  'shared.probe.fail.authRequired':
    'Erreichbar — aber dieses Gerät ist noch nicht authentifiziert. Kopple mit einem Code oder füge oben einen Token ' +
    'ein und drücke dann Wechseln.',
  'shared.probe.fail.rejected': 'Abgelehnt: {reason}',
  'shared.probe.fail.rejectedUnknown': 'Abgelehnt: unbekannter Grund',
  'shared.probe.fail.malformedWelcome':
    'Ein Server hat geantwortet, spricht aber nicht das Protokoll von Open Headers.',
  'shared.probe.fail.generic': 'Verbindungstest fehlgeschlagen.',
} as const satisfies Catalog;
