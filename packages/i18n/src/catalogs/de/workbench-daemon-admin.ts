/**
 * Daemon-admin family — German. Mirrors
 * `catalogs/en/workbench-daemon-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.io/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and der Daemon as the product loanword
 * (register mint). Seat vocabulary reuses `de/web.ts` verbatim
 * (der Platz, der Einzelplatz, `Einzelplatz-Schlüssel (oh-license.…)`).
 * Mints: pool = der Pool (m., raw); solo/team tier = Solo-Stufe /
 * Team-Stufe (die Stufe = tier).
 */

import type { Catalog } from '../../types';

export const workbenchDaemonAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.daemonAdmin.title': 'Team-Server-Verwaltung',
  'workbench.daemonAdmin.intro':
    'Verzeichnisbenutzer melden sich mit einem gebundenen Token oder per SSO an und sehen genau die hier ' +
    'gewährten Arbeitsbereiche. Die Deaktivierung widerruft die Tokens des Benutzers und trennt ihn sofort.',
  'workbench.daemonAdmin.deniedDescription':
    'Die Verwaltung dieses Team Servers erfordert die Capability daemon.admin.',
  'workbench.daemonAdmin.cancel': 'Abbrechen',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.daemonAdmin.users.sectionTitle': 'Benutzer',
  'workbench.daemonAdmin.users.sectionHint':
    'Lass einen Benutzer zu und gewähre ihm unten Rollen pro Arbeitsbereich. Die E-Mail verbindet ' +
    'SSO-Anmeldungen mit dem Eintrag.',
  'workbench.daemonAdmin.users.nameRequired': 'Ein Name ist erforderlich',
  'workbench.daemonAdmin.users.displayNamePlaceholder': 'Anzeigename',
  'workbench.daemonAdmin.users.emailPlaceholder': 'E-Mail (optional — erforderlich für SSO)',
  'workbench.daemonAdmin.users.seatKeyPlaceholder': 'Einzelplatz-Schlüssel (oh-license.…)',
  'workbench.daemonAdmin.users.addUser': 'Benutzer hinzufügen',
  'workbench.daemonAdmin.users.seatLimit':
    'Dieser Team Server ist an seinem Platzlimit. Erweitere deine Team-Lizenz um Plätze, oder füge oben den ' +
    'eigenen Einzelplatz-Schlüssel der neuen Person ein — er lässt sie zu, ohne einen Platz aus dem Pool zu ' +
    'verbrauchen.',
  'workbench.daemonAdmin.users.seatsSoldAt': 'Einzelplätze gibt es unter',
  'workbench.daemonAdmin.users.emptyDirectory':
    'Noch keine Verzeichnisbenutzer — der Team Server läuft in seiner Solo-Stufe. Füge einen Benutzer hinzu, um ' +
    'die Team-Stufe zu öffnen.',
  'workbench.daemonAdmin.users.deactivatedOn': 'Deaktiviert am {date}',
  'workbench.daemonAdmin.users.addedOn': 'hinzugefügt am {date}',
  'workbench.daemonAdmin.users.loadFailed': 'Benutzerverzeichnis konnte nicht geladen werden: {message}',
  'workbench.daemonAdmin.users.addFailed': 'Benutzer konnte nicht hinzugefügt werden: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.daemonAdmin.seat.tag': 'Einzelplatz',
  'workbench.daemonAdmin.seat.healthyTooltip':
    'Zugelassen über den eigenen Einzelplatz ({id}) — zählt nicht gegen den Pool dieses Team Servers.',
  'workbench.daemonAdmin.seat.lapsedTooltip':
    'Der Einzelplatz ({id}) ist {status}. Die Person bleibt angemeldet — ein Ablauf wirft nie hinaus — aber ' +
    'der Platz verlängert sich nicht mehr.',
  'workbench.daemonAdmin.seat.absorbTitle': 'Diesen Platz in den Pool übernehmen?',
  'workbench.daemonAdmin.seat.absorbDescription':
    'Der Benutzer wird ein regulärer Platz im Pool, und seine Einzellizenz verlängert sich hier nicht mehr. ' +
    'Das lässt sich nicht rückgängig machen.',
  'workbench.daemonAdmin.seat.absorbOk': 'Übernehmen',
  'workbench.daemonAdmin.seat.absorbCta': 'In den Pool übernehmen',
  'workbench.daemonAdmin.seat.absorbed': 'Platz in den Pool übernommen.',
  'workbench.daemonAdmin.seat.absorbFailed': 'Platz konnte nicht übernommen werden: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.daemonAdmin.deactivate.title': 'Diesen Benutzer deaktivieren?',
  'workbench.daemonAdmin.deactivate.description':
    'Seine Tokens werden widerrufen und aktive Verbindungen geschlossen. Zum erneuten Zulassen später ' +
    'dieselbe E-Mail neu hinzufügen.',
  'workbench.daemonAdmin.deactivate.cta': 'Deaktivieren',
  'workbench.daemonAdmin.deactivate.done':
    'Benutzer deaktiviert. Seine Tokens wurden widerrufen und aktive Verbindungen geschlossen.',
  'workbench.daemonAdmin.deactivate.failed': 'Deaktivieren fehlgeschlagen: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.daemonAdmin.grants.roleViewer': 'Betrachter',
  'workbench.daemonAdmin.grants.roleEditor': 'Bearbeiter',
  'workbench.daemonAdmin.grants.roleOwner': 'Eigentümer',
  'workbench.daemonAdmin.grants.none': 'Noch kein Zugriff auf Arbeitsbereiche.',
  'workbench.daemonAdmin.grants.idpTooltip':
    'Gewährt durch die Zuordnung des Identitätsanbieters. Ein Widerruf hält nur, bis die nächste ' +
    'SSO-Anmeldung sie erneut anwendet.',
  'workbench.daemonAdmin.grants.workspacePlaceholder': 'Arbeitsbereich',
  'workbench.daemonAdmin.grants.grantCta': 'Gewähren',
  'workbench.daemonAdmin.grants.everyWorkspace': 'Auf jedem Arbeitsbereich gewährt.',
  'workbench.daemonAdmin.grants.grantFailed': 'Gewähren fehlgeschlagen: {message}',
  'workbench.daemonAdmin.grants.revokeFailed': 'Widerruf fehlgeschlagen: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.daemonAdmin.password.setTitle': 'Passwort festlegen — {name}',
  'workbench.daemonAdmin.password.resetTitle': 'Passwort zurücksetzen — {name}',
  'workbench.daemonAdmin.password.explainer':
    'Der Benutzer meldet sich mit seiner E-Mail und diesem Passwort am Web-Zugang des Team Servers an. Teile es ' +
    'der Person direkt mit — es wird auf dem Team Server gehasht und lässt sich nicht wieder auslesen.',
  'workbench.daemonAdmin.password.placeholder': 'Neues Passwort (mindestens 8 Zeichen)',
  'workbench.daemonAdmin.password.setCta': 'Passwort festlegen',
  'workbench.daemonAdmin.password.resetCta': 'Passwort zurücksetzen',
  'workbench.daemonAdmin.password.removeCta': 'Passwort entfernen',
  'workbench.daemonAdmin.password.setDone': 'Passwort festgelegt.',
  'workbench.daemonAdmin.password.removedDone': 'Passwort entfernt.',
  'workbench.daemonAdmin.password.updateFailed': 'Passwort konnte nicht aktualisiert werden: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.daemonAdmin.gitEmail.setTitle': 'Git-E-Mail festlegen — {name}',
  'workbench.daemonAdmin.gitEmail.changeTitle': 'Git-E-Mail ändern — {name}',
  'workbench.daemonAdmin.gitEmail.explainer':
    'Commits, die die Arbeit dieses Benutzers tragen, werden mit dieser Adresse verfasst und verweisen so auf ' +
    'sein Git-Hosting-Profil. Ohne eine wird die Verzeichnis-E-Mail verwendet, danach eine noreply-Adresse.',
  'workbench.daemonAdmin.gitEmail.placeholder': 'E-Mail des Commit-Autors',
  'workbench.daemonAdmin.gitEmail.setCta': 'Git-E-Mail festlegen',
  'workbench.daemonAdmin.gitEmail.changeCta': 'Git-E-Mail ändern',
  'workbench.daemonAdmin.gitEmail.removeCta': 'Überschreibung entfernen',
  'workbench.daemonAdmin.gitEmail.setDone': 'Git-E-Mail festgelegt.',
  'workbench.daemonAdmin.gitEmail.removedDone': 'Git-E-Mail-Überschreibung entfernt.',
  'workbench.daemonAdmin.gitEmail.updateFailed': 'Git-E-Mail konnte nicht aktualisiert werden: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.daemonAdmin.git.sectionTitle': 'Git',
  'workbench.daemonAdmin.git.sectionHint':
    'Binde einen Arbeitsbereich des Team Servers an ein Repository und steuere Commit, Pull, Push und Branches aus der ' +
    'Ferne. Die Pfade liegen im Dateisystem des Team Servers selbst.',
  'workbench.daemonAdmin.git.workspaceLabel': 'Arbeitsbereich',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.daemonAdmin.audit.sectionTitle': 'Berichte',
  'workbench.daemonAdmin.audit.sectionHint':
    'Jede Berechtigungsentscheidung dieses Team Servers und jede Gerätezulassung als filterbares Audit-Protokoll. ' +
    'Der Export beachtet die aktiven Filter.',
  'workbench.daemonAdmin.audit.capAdmission': 'Zulassung (Verbindung)',
  'workbench.daemonAdmin.audit.capAdminPlane': 'Verwaltungsebene',
  'workbench.daemonAdmin.audit.capSsoGrant': 'SSO-Gewährung (Zuordnung)',
  'workbench.daemonAdmin.audit.capSsoRevoke': 'SSO-Widerruf (Zuordnung)',
  'workbench.daemonAdmin.audit.capWorkspaceRead': 'Arbeitsbereich lesen',
  'workbench.daemonAdmin.audit.capWorkspaceWrite': 'Arbeitsbereich schreiben',
  'workbench.daemonAdmin.audit.capWorkspaceList': 'Arbeitsbereiche auflisten',
  'workbench.daemonAdmin.audit.rangeLastHour': 'Letzte Stunde',
  'workbench.daemonAdmin.audit.rangeLast24Hours': 'Letzte 24 Stunden',
  'workbench.daemonAdmin.audit.rangeLast7Days': 'Letzte 7 Tage',
  'workbench.daemonAdmin.audit.rangeLast30Days': 'Letzte 30 Tage',
  'workbench.daemonAdmin.audit.colTime': 'Zeit',
  'workbench.daemonAdmin.audit.colEvent': 'Ereignis',
  'workbench.daemonAdmin.audit.colCapability': 'Capability',
  'workbench.daemonAdmin.audit.colWorkspace': 'Arbeitsbereich',
  'workbench.daemonAdmin.audit.colActor': 'Akteur',
  'workbench.daemonAdmin.audit.eventAdmission': 'Zulassung',
  'workbench.daemonAdmin.audit.eventAdmissionRefused': 'Zulassung verweigert',
  'workbench.daemonAdmin.audit.eventSsoGrant': 'SSO-Gewährung',
  'workbench.daemonAdmin.audit.eventSsoRevoke': 'SSO-Widerruf',
  'workbench.daemonAdmin.audit.eventAllow': 'Erlaubt',
  'workbench.daemonAdmin.audit.eventDeny': 'Verweigert',
  'workbench.daemonAdmin.audit.filterActor': 'Akteur',
  'workbench.daemonAdmin.audit.filterCapability': 'Capability',
  'workbench.daemonAdmin.audit.filterDecision': 'Entscheidung',
  'workbench.daemonAdmin.audit.filterWorkspace': 'Arbeitsbereich',
  'workbench.daemonAdmin.audit.filterAnyTime': 'Beliebiger Zeitraum',
  'workbench.daemonAdmin.audit.decisionAllow': 'Erlaubt',
  'workbench.daemonAdmin.audit.decisionDeny': 'Verweigert',
  'workbench.daemonAdmin.audit.refresh': 'Aktualisieren',
  'workbench.daemonAdmin.audit.exportJsonl': 'JSONL exportieren',
  'workbench.daemonAdmin.audit.emptyText': 'Keine Audit-Zeilen passen.',
  'workbench.daemonAdmin.audit.loadMore': 'Mehr laden',
} as const satisfies Catalog;
