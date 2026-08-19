/**
 * Daemon-admin family — German. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.com/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and der Daemon as the product loanword
 * (register mint). Seat vocabulary reuses `de/web.ts` verbatim
 * (der Platz, der Einzelplatz, `Einzelplatz-Schlüssel (oh-license.…)`).
 * Mints: pool = der Pool (m., raw); solo/team tier = Solo-Stufe /
 * Team-Stufe (die Stufe = tier).
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'Server-Verwaltung',
  'workbench.serverAdmin.intro':
    'Verzeichnisbenutzer melden sich mit einem gebundenen Token oder per SSO an und sehen genau die hier ' +
    'gewährten Arbeitsbereiche. Die Deaktivierung widerruft die Tokens des Benutzers und trennt ihn sofort.',
  'workbench.serverAdmin.deniedDescription': 'Die Verwaltung dieses Servers erfordert die Capability daemon.admin.',
  'workbench.serverAdmin.cancel': 'Abbrechen',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.notes.sectionTitle': 'Versionshinweise',
  'workbench.serverAdmin.notes.sectionHint': 'Was im Server-Build enthalten ist, das diese Konsole verwaltet.',
  'workbench.serverAdmin.notes.versionLine': 'Server {version}',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'Benutzer',
  'workbench.serverAdmin.users.sectionHint':
    'Lass einen Benutzer zu und gewähre ihm unten Rollen pro Arbeitsbereich. Die E-Mail verbindet ' +
    'SSO-Anmeldungen mit dem Eintrag.',
  'workbench.serverAdmin.users.nameRequired': 'Ein Name ist erforderlich',
  'workbench.serverAdmin.users.displayNamePlaceholder': 'Anzeigename',
  'workbench.serverAdmin.users.emailPlaceholder': 'E-Mail (optional — erforderlich für SSO)',
  'workbench.serverAdmin.users.seatKeyPlaceholder': 'Einzelplatz-Schlüssel (oh-license.…)',
  'workbench.serverAdmin.users.addUser': 'Benutzer hinzufügen',
  'workbench.serverAdmin.users.seatLimit':
    'Dieser Server ist an seinem Platzlimit. Erweitere deine Team-Lizenz um Plätze, oder füge oben den ' +
    'eigenen Einzelplatz-Schlüssel der neuen Person ein — er lässt sie zu, ohne einen Platz aus dem Pool zu ' +
    'verbrauchen.',
  'workbench.serverAdmin.users.seatsSoldAt': 'Einzelplätze gibt es unter',
  'workbench.serverAdmin.users.emptyDirectory':
    'Noch keine Verzeichnisbenutzer — der Server läuft in seiner Solo-Stufe. Füge einen Benutzer hinzu, um ' +
    'die Team-Stufe zu öffnen.',
  'workbench.serverAdmin.users.deactivatedOn': 'Deaktiviert am {date}',
  'workbench.serverAdmin.users.addedOn': 'hinzugefügt am {date}',
  'workbench.serverAdmin.users.loadFailed': 'Benutzerverzeichnis konnte nicht geladen werden: {message}',
  'workbench.serverAdmin.users.addFailed': 'Benutzer konnte nicht hinzugefügt werden: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': 'Einzelplatz',
  'workbench.serverAdmin.seat.healthyTooltip':
    'Zugelassen über den eigenen Einzelplatz ({id}) — zählt nicht gegen den Pool dieses Servers.',
  'workbench.serverAdmin.seat.lapsedTooltip':
    'Der Einzelplatz ({id}) ist {status}. Die Person bleibt angemeldet — ein Ablauf wirft nie hinaus — aber ' +
    'der Platz verlängert sich nicht mehr.',
  'workbench.serverAdmin.seat.absorbTitle': 'Diesen Platz in den Pool übernehmen?',
  'workbench.serverAdmin.seat.absorbDescription':
    'Der Benutzer wird ein regulärer Platz im Pool, und seine Einzellizenz verlängert sich hier nicht mehr. ' +
    'Das lässt sich nicht rückgängig machen.',
  'workbench.serverAdmin.seat.absorbOk': 'Übernehmen',
  'workbench.serverAdmin.seat.absorbCta': 'In den Pool übernehmen',
  'workbench.serverAdmin.seat.absorbed': 'Platz in den Pool übernommen.',
  'workbench.serverAdmin.seat.absorbFailed': 'Platz konnte nicht übernommen werden: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': 'Diesen Benutzer deaktivieren?',
  'workbench.serverAdmin.deactivate.description':
    'Seine Tokens werden widerrufen und aktive Verbindungen geschlossen. Zum erneuten Zulassen später ' +
    'dieselbe E-Mail neu hinzufügen.',
  'workbench.serverAdmin.deactivate.cta': 'Deaktivieren',
  'workbench.serverAdmin.deactivate.done':
    'Benutzer deaktiviert. Seine Tokens wurden widerrufen und aktive Verbindungen geschlossen.',
  'workbench.serverAdmin.deactivate.failed': 'Deaktivieren fehlgeschlagen: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': 'Betrachter',
  'workbench.serverAdmin.grants.roleEditor': 'Bearbeiter',
  'workbench.serverAdmin.grants.roleOwner': 'Eigentümer',
  'workbench.serverAdmin.grants.none': 'Noch kein Zugriff auf Arbeitsbereiche.',
  'workbench.serverAdmin.grants.idpTooltip':
    'Gewährt durch die Zuordnung des Identitätsanbieters. Ein Widerruf hält nur, bis die nächste ' +
    'SSO-Anmeldung sie erneut anwendet.',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'Arbeitsbereich',
  'workbench.serverAdmin.grants.grantCta': 'Gewähren',
  'workbench.serverAdmin.grants.everyWorkspace': 'Auf jedem Arbeitsbereich gewährt.',
  'workbench.serverAdmin.grants.grantFailed': 'Gewähren fehlgeschlagen: {message}',
  'workbench.serverAdmin.grants.revokeFailed': 'Widerruf fehlgeschlagen: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'Passwort festlegen — {name}',
  'workbench.serverAdmin.password.resetTitle': 'Passwort zurücksetzen — {name}',
  'workbench.serverAdmin.password.explainer':
    'Der Benutzer meldet sich mit seiner E-Mail und diesem Passwort am Web-Zugang des Servers an. Teile es ' +
    'der Person direkt mit — es wird auf dem Server gehasht und lässt sich nicht wieder auslesen.',
  'workbench.serverAdmin.password.placeholder': 'Neues Passwort (mindestens 8 Zeichen)',
  'workbench.serverAdmin.password.setCta': 'Passwort festlegen',
  'workbench.serverAdmin.password.resetCta': 'Passwort zurücksetzen',
  'workbench.serverAdmin.password.removeCta': 'Passwort entfernen',
  'workbench.serverAdmin.password.setDone': 'Passwort festgelegt.',
  'workbench.serverAdmin.password.removedDone': 'Passwort entfernt.',
  'workbench.serverAdmin.password.updateFailed': 'Passwort konnte nicht aktualisiert werden: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Git-E-Mail festlegen — {name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Git-E-Mail ändern — {name}',
  'workbench.serverAdmin.gitEmail.explainer':
    'Commits, die die Arbeit dieses Benutzers tragen, werden mit dieser Adresse verfasst und verweisen so auf ' +
    'sein Git-Hosting-Profil. Ohne eine wird die Verzeichnis-E-Mail verwendet, danach eine noreply-Adresse.',
  'workbench.serverAdmin.gitEmail.placeholder': 'E-Mail des Commit-Autors',
  'workbench.serverAdmin.gitEmail.setCta': 'Git-E-Mail festlegen',
  'workbench.serverAdmin.gitEmail.changeCta': 'Git-E-Mail ändern',
  'workbench.serverAdmin.gitEmail.removeCta': 'Überschreibung entfernen',
  'workbench.serverAdmin.gitEmail.setDone': 'Git-E-Mail festgelegt.',
  'workbench.serverAdmin.gitEmail.removedDone': 'Git-E-Mail-Überschreibung entfernt.',
  'workbench.serverAdmin.gitEmail.updateFailed': 'Git-E-Mail konnte nicht aktualisiert werden: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    'Binde einen Arbeitsbereich des Servers an ein Repository und steuere Commit, Pull, Push und Branches aus der ' +
    'Ferne. Die Pfade liegen im Dateisystem des Servers selbst.',
  'workbench.serverAdmin.git.workspaceLabel': 'Arbeitsbereich',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'Berichte',
  'workbench.serverAdmin.audit.sectionHint':
    'Jede Berechtigungsentscheidung dieses Servers und jede Gerätezulassung als filterbares Audit-Protokoll. ' +
    'Der Export beachtet die aktiven Filter.',
  'workbench.serverAdmin.audit.capAdmission': 'Zulassung (Verbindung)',
  'workbench.serverAdmin.audit.capAdminPlane': 'Verwaltungsebene',
  'workbench.serverAdmin.audit.capSsoGrant': 'SSO-Gewährung (Zuordnung)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'SSO-Widerruf (Zuordnung)',
  'workbench.serverAdmin.audit.capWorkspaceRead': 'Arbeitsbereich lesen',
  'workbench.serverAdmin.audit.capWorkspaceWrite': 'Arbeitsbereich schreiben',
  'workbench.serverAdmin.audit.capWorkspaceList': 'Arbeitsbereiche auflisten',
  'workbench.serverAdmin.audit.rangeLastHour': 'Letzte Stunde',
  'workbench.serverAdmin.audit.rangeLast24Hours': 'Letzte 24 Stunden',
  'workbench.serverAdmin.audit.rangeLast7Days': 'Letzte 7 Tage',
  'workbench.serverAdmin.audit.rangeLast30Days': 'Letzte 30 Tage',
  'workbench.serverAdmin.audit.colTime': 'Zeit',
  'workbench.serverAdmin.audit.colEvent': 'Ereignis',
  'workbench.serverAdmin.audit.colCapability': 'Capability',
  'workbench.serverAdmin.audit.colWorkspace': 'Arbeitsbereich',
  'workbench.serverAdmin.audit.colActor': 'Akteur',
  'workbench.serverAdmin.audit.eventAdmission': 'Zulassung',
  'workbench.serverAdmin.audit.eventAdmissionRefused': 'Zulassung verweigert',
  'workbench.serverAdmin.audit.eventSsoGrant': 'SSO-Gewährung',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'SSO-Widerruf',
  'workbench.serverAdmin.audit.eventAllow': 'Erlaubt',
  'workbench.serverAdmin.audit.eventDeny': 'Verweigert',
  'workbench.serverAdmin.audit.filterActor': 'Akteur',
  'workbench.serverAdmin.audit.filterCapability': 'Capability',
  'workbench.serverAdmin.audit.filterDecision': 'Entscheidung',
  'workbench.serverAdmin.audit.filterWorkspace': 'Arbeitsbereich',
  'workbench.serverAdmin.audit.filterAnyTime': 'Beliebiger Zeitraum',
  'workbench.serverAdmin.audit.decisionAllow': 'Erlaubt',
  'workbench.serverAdmin.audit.decisionDeny': 'Verweigert',
  'workbench.serverAdmin.audit.refresh': 'Aktualisieren',
  'workbench.serverAdmin.audit.exportJsonl': 'JSONL exportieren',
  'workbench.serverAdmin.audit.emptyText': 'Keine Audit-Zeilen passen.',
  'workbench.serverAdmin.audit.loadMore': 'Mehr laden',
} as const satisfies Catalog;
