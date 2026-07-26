/**
 * Workbench settings — custom pane components — German. Extends the
 * de register contract (`de/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: `Back-end` / `Daemon` / `vault` / `Workflow` / `seed` /
 * `Org` (f.) as dev loanwords, networking vocabulary (loopback, LAN,
 * WAN, RFC1918, mDNS, CGNAT, ULA, APIPA, TLS, `ws://` / `wss://`),
 * IANA port constants (1024 / 49152 / 65535), IP literals and range
 * notes' technical tokens (fd00::/8, 100.64/10, Docker, Tailscale,
 * Bonjour / Avahi), `MCP` / `SSO` / `RBAC` / `CLI` / `oh` /
 * `streamable HTTP`, snippet filenames (claude_desktop_config.json),
 * the `oh-license.…` key prefix and the {chord} / {token} / {url}
 * holes, git command vocabulary (`git remote add`, `--no-verify`,
 * HEAD). Settings paths quote the de shell mints (`Einstellungen →
 * Back-end`); `Daemon-Verwaltung` matches the de daemon-admin title;
 * die Stufe / der Platz / das Verzeichnis / die kostenlose Stufe
 * reuse the daemon-admin + settings mints; die Voreinstellung and
 * das Kürzel reuse de/workbench-settings-defs-keyboard. MINTS:
 * pairing = koppeln family (`Kopplungscode`); token rotation =
 * rotieren (der Token raw); mint (token) = prägen; stash = der
 * Stash / stashen (git referent).
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.intro.whoLabel': 'Wer:',
  'workbench.settings.backendPane.intro.whoText': 'verarbeitet und speichert deine Daten.',
  'workbench.settings.backendPane.intro.whereLabel': 'Wo:',
  'workbench.settings.backendPane.intro.whereText': 'lokal oder entfernt.',
  'workbench.settings.backendPane.showDiagrams': 'Diagramme anzeigen',
  'workbench.settings.backendPane.learnMore': 'Mehr erfahren',
  'workbench.settings.backendPane.subsection.reliability.blurb':
    'Verhalten der automatischen Wiederverbindung über eine instabile Leitung. Gilt für jede Verbindung.',
  'workbench.settings.backendPane.subsection.notifications.blurb': 'Visuelle Hinweise, wenn eine Verbindung unten ist.',
  'workbench.settings.backendPane.tierZero.title.extension': 'Dieser Browser',
  'workbench.settings.backendPane.tierZero.title.desktop': 'Diese App',
  'workbench.settings.backendPane.tierZero.title.web': 'Diese App',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'Die Erweiterung selbst verarbeitet und speichert deine Daten — Arbeitsbereiche, Regeln und vault leben ' +
    'in diesem Browser. Immer an; keine Einrichtung.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    'Der Prozess der Desktop-App ist das Back-end. Andere lokale Clients verbinden sich zu ihm; deine Daten ' +
    'leben auf dieser Maschine. Immer an; keine Einrichtung.',
  'workbench.settings.backendPane.tierZero.copy.web':
    'Die App, die diese Seite ausgeliefert hat, ist das Back-end. Deine Daten leben auf diesem Host. Immer ' +
    'an; keine Einrichtung.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Immer an',
  'workbench.settings.backendPane.tierZero.adminTitle': 'Server-Verwaltung',
  'workbench.settings.backendPane.tierZero.adminDescription':
    'Das Benutzerverzeichnis und die Zugriffsrechte pro Arbeitsbereich verwalten.',
  'workbench.settings.backendPane.tierZero.adminOpen': 'Verwaltungskonsole öffnen',
  'workbench.settings.backendPane.scenario.desktop-app.title': 'Desktop-Anwendung',
  'workbench.settings.backendPane.scenario.desktop-app.hint': 'Die App von Open Headers auf dieser Maschine',
  'workbench.settings.backendPane.scenario.local-self-hosted.title': 'Lokal / LAN',
  'workbench.settings.backendPane.scenario.local-self-hosted.hint':
    'Ein Server auf dieser Maschine oder in deinem Netzwerk',
  'workbench.settings.backendPane.scenario.remote-self-hosted.title': 'Entfernt / WAN',
  'workbench.settings.backendPane.scenario.remote-self-hosted.hint':
    'Ein Server, den du auf deiner eigenen VM selbst hostest',
  'workbench.settings.backendPane.wizard.step.scenario': 'Szenario',
  'workbench.settings.backendPane.wizard.step.connect': 'Verbinden',
  'workbench.settings.backendPane.wizard.step.pair': 'Koppeln',
  'workbench.settings.backendPane.wizard.step.turnOn': 'Einschalten',
  'workbench.settings.backendPane.wizard.addTitle': 'Back-end hinzufügen',
  'workbench.settings.backendPane.wizard.editTitle': '{label} bearbeiten',
  'workbench.settings.backendPane.wizard.back': 'Zurück',
  'workbench.settings.backendPane.wizard.next': 'Weiter',
  'workbench.settings.backendPane.wizard.comingSoon': 'Bald verfügbar',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': 'Ohne Verbinden abschließen',
  'workbench.settings.backendPane.wizard.verifyConnect': 'Prüfen & verbinden',
  'workbench.settings.backendPane.wizard.scenarioIntro':
    'Was für ein Back-end ist das? Wähle eine Kachel, um zu sehen, was die Stufe dir gibt.',
  'workbench.settings.backendPane.wizard.scenarioAria': 'Back-end-Szenario',
  'workbench.settings.backendPane.wizard.soonBadge': 'Bald',
  'workbench.settings.backendPane.wizard.connectIntro':
    'Wo wählt sich dieser Client beim Back-end ein? Die Verbindung bleibt aus, bis der letzte Schritt sie ' +
    'geprüft hat.',
  'workbench.settings.backendPane.wizard.pairIntro':
    'Weise dieses Gerät beim Back-end aus — kopple mit dem Code, den es anzeigt, oder füge einen Token ein. ' +
    'Du kannst die Verbindung testen, bevor du sie einschaltest.',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    'Die automatische Kopplung mit der Desktop-App ist nicht zustande gekommen — sie läuft möglicherweise ' +
    'nicht, oder dieser Browser konnte nicht verifiziert werden. Kopple stattdessen mit dem Code oder Token.',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    'Bereit: {label} unter {url}, gekoppelt. Beim Einschalten werden zuerst Erreichbarkeit und ' +
    'Authentifizierung geprüft; bei Erfolg synchronisieren seine Arbeitsbereiche herunter und bleiben offline ' +
    'nutzbar.',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    'Bereit: {label} unter {url} — noch NICHT gekoppelt. Beim Einschalten werden zuerst Erreichbarkeit und ' +
    'Authentifizierung geprüft; bei Erfolg synchronisieren seine Arbeitsbereiche herunter und bleiben offline ' +
    'nutzbar.',
  'workbench.settings.backendPane.wizard.additionalBackend':
    'Dies ist ein zusätzliches Back-end. Seine Orgs erscheinen als neue Gruppen im Arbeitsbereich-Umschalter, ' +
    'das Status-Popover bekommt eine Zeile pro Back-end, und jede Org synchronisiert von genau einem Back-end ' +
    '— eine Org, die schon eine andere Verbindung liefert, tritt nicht doppelt bei.',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} ist verbunden. Die Verbindung zu bearbeiten heißt, eine stromführende Leitung zu bewegen, also ' +
    'wird zuerst getrennt — deine Einstellungen und die Kopplung bleiben erhalten, und das Wiedereinschalten ' +
    'prüft die neue Konfiguration, bevor irgendetwas verbindet.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Trennen und bearbeiten',
  'workbench.settings.backendPane.wizard.testConnection': 'Verbindung testen',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Verbindungen',
  'workbench.settings.backendPane.connections.blurbBrowser':
    'Back-ends, denen dieser Browser beigetreten ist. Ihre Arbeitsbereiche synchronisieren herunter und ' +
    'bleiben offline nutzbar.',
  'workbench.settings.backendPane.connections.blurbApp':
    'Back-ends, denen diese App beigetreten ist. Ihre Arbeitsbereiche synchronisieren herunter und bleiben ' +
    'offline nutzbar.',
  'workbench.settings.backendPane.connections.add': 'Back-end hinzufügen',
  'workbench.settings.backendPane.connections.emptyBrowser':
    'Keine Verbindungen — alles läuft in diesem Browser. Füge ein Back-end hinzu, um Arbeitsbereiche von der ' +
    'Desktop-App oder einem selbst gehosteten Server zu synchronisieren.',
  'workbench.settings.backendPane.connections.emptyApp':
    'Keine Verbindungen — alles läuft in dieser App. Füge ein Back-end hinzu, um Arbeitsbereiche von der ' +
    'Desktop-App oder einem selbst gehosteten Server zu synchronisieren.',
  'workbench.settings.backendPane.connections.status.connected': 'Verbunden',
  'workbench.settings.backendPane.connections.status.connecting': 'Verbinden…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Neu koppeln nötig',
  'workbench.settings.backendPane.connections.status.error': 'Verbindung unten',
  'workbench.settings.backendPane.connections.status.off': 'Aus',
  'workbench.settings.backendPane.connections.repair': 'Neu koppeln',
  'workbench.settings.backendPane.connections.autoConnect': 'Automatisch verbinden',
  'workbench.settings.backendPane.connections.editTooltipConnected': 'Bearbeiten (trennt zuerst)',
  'workbench.settings.backendPane.connections.editTooltip': 'Bearbeiten',
  'workbench.settings.backendPane.connections.editAria': '{label} bearbeiten',
  'workbench.settings.backendPane.connections.disconnectTooltip': 'Trennen (Einstellungen bleiben erhalten)',
  'workbench.settings.backendPane.connections.connectTooltip': 'Prüfen und verbinden',
  'workbench.settings.backendPane.connections.enabledAria': '{label} aktiviert',
  'workbench.settings.backendPane.connections.orgConflict':
    'Die Org „{org}“ liefert bereits {provider} — nicht beigetreten',
  'workbench.settings.backendPane.connections.removedBackend': 'ein entferntes Back-end',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': 'Verbinden mit {label}…',
  'workbench.settings.backendPane.enable.connected': 'Mit {label} verbunden.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    '{label} ist verbunden, aber seine Org ist nicht beigetreten — siehe die Verbindungszeile.',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': '{label} entfernen?',
  'workbench.settings.backendPane.remove.confirmBody':
    'Seine Adresse und Kopplung werden vergessen. Es wurde noch nichts von ihm synchronisiert.',
  'workbench.settings.backendPane.remove.aria': '{label} entfernen',
  'workbench.settings.backendPane.remove.removed': '{label} entfernt.',
  'workbench.settings.backendPane.remove.tooltip':
    'Dieses Back-end entfernen — du entscheidest, was mit seinen synchronisierten Arbeitsbereichen passiert',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Arbeitsbereich', other: '{count} Arbeitsbereiche' }),
  'workbench.settings.backendPane.remove.body.prefix': 'Dieses Back-end liefert',
  'workbench.settings.backendPane.remove.body.suffix':
    'mit {workspaces}, die auf dieses Gerät synchronisiert sind. Seine eigenen Daten werden nie berührt — ' +
    'entscheide, was mit den lokalen Kopien passiert.',
  'workbench.settings.backendPane.remove.outcomeAria': 'Ergebnis der Entfernung',
  'workbench.settings.backendPane.remove.recommendedBadge': 'Empfohlen',
  'workbench.settings.backendPane.remove.keep.title': 'Lokale Kopien behalten',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs} hören auf zu synchronisieren. Die {workspaces} bleiben als lokale Offline-Daten auf diesem Gerät.',
  'workbench.settings.backendPane.remove.discard.title': 'Lokale Kopien verwerfen',
  'workbench.settings.backendPane.remove.discard.description':
    'Jeder Arbeitsbereich wird zuerst in eine heruntergeladene Datei gesichert und dann von diesem Gerät ' +
    'gelöscht. Ein späterer Beitritt zum Back-end synchronisiert sie wieder herunter.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'vault-Secrets in die Backup-Dateien aufnehmen (Klartext — bewahre die Dateien sicher auf)',
  'workbench.settings.backendPane.remove.removeBackend': 'Back-end entfernen',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Sichern, dann entfernen',
  'workbench.settings.backendPane.remove.progress.removing': 'Back-end wird entfernt…',
  'workbench.settings.backendPane.remove.progress.preparing': 'Backups werden vorbereitet…',
  'workbench.settings.backendPane.remove.progress.backingUp': '„{name}“ wird gesichert…',
  'workbench.settings.backendPane.remove.progress.deleting': '„{name}“ wird gelöscht…',
  'workbench.settings.backendPane.remove.keepDone':
    '{label} entfernt. {orgs} haben aufgehört zu synchronisieren; {workspaces} bleiben auf diesem Gerät.',
  'workbench.settings.backendPane.remove.discardDone':
    '{label} entfernt. {workspaces} gesichert und gelöscht; {orgs} entbunden.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      one: `${String(label)} entfernt, aber {count} Arbeitsbereich blieb`,
      other: `${String(label)} entfernt, aber {count} Arbeitsbereiche blieben`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody':
    'Ließen sich nicht löschen: {names}. Sie bleiben als lokale Daten.',
  'workbench.settings.backendPane.remove.backupFailedTitle': 'Backup von „{name}“ fehlgeschlagen',
  'workbench.settings.backendPane.remove.backupFailedBody':
    'Der Export wurde nicht abgeschlossen. Es wurde nichts entfernt.',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'Mit einem Code koppeln',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'Einen Token einfügen',
  'workbench.settings.backendPane.pair.codeBlurb':
    'Gib den Code ein, den das Back-end angezeigt hat. Wir tauschen ihn gegen einen Auth-Token und verbinden ' +
    'diesen Browser.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    'Füge den Token ein, den das Back-end angezeigt hat — eine Rotation zeigt das neue Secret einmalig. Er ' +
    'wird als Zugangsdaten dieses Browsers gespeichert.',
  'workbench.settings.backendPane.pair.codePlaceholder': '6-stelliger Code',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': 'Gerätename (optional)',
  'workbench.settings.backendPane.pair.codeRequired': 'Gib den Kopplungscode ein, den das Back-end zeigt.',
  'workbench.settings.backendPane.pair.pasteTokenRequired': 'Füge den Token ein, den das Back-end angezeigt hat.',
  'workbench.settings.backendPane.pair.pairAction': 'Koppeln',
  'workbench.settings.backendPane.pair.saveToken': 'Token speichern',
  'workbench.settings.backendPane.pair.tokenSaved': 'Auth-Token gespeichert.',
  'workbench.settings.backendPane.pair.pairedSaved': 'Gekoppelt — Auth-Token gespeichert.',
  'workbench.settings.backendPane.pair.switchToToken': 'Du hast einen Token? Füge ihn stattdessen ein',
  'workbench.settings.backendPane.pair.switchToCode': 'Stattdessen einen Kopplungscode?',
  'workbench.settings.backendPane.pair.fail.unknown':
    'Dieser Code ist unbekannt oder abgelaufen. Bitte um einen frischen Code und versuche es erneut.',
  'workbench.settings.backendPane.pair.fail.expired':
    'Dieser Kopplungscode ist abgelaufen. Erzeuge auf dem Back-end einen neuen.',
  'workbench.settings.backendPane.pair.fail.consumed':
    'Dieser Code wurde bereits verwendet. Erzeuge auf dem Back-end einen neuen.',
  'workbench.settings.backendPane.pair.fail.unreachable':
    'Das Back-end unter {url} war nicht erreichbar. Läuft es auf dieser Adresse?',
  'workbench.settings.backendPane.pair.fail.generic': 'Kopplung fehlgeschlagen. Versuche es erneut.',
  'workbench.settings.backendPane.pair.nmRequired':
    'Manuelle Kopplung mit der Desktop-App ist deaktiviert — dieser Browser verbindet sich nur über verifizierte Kopplung. Siehe die Einstellung „Verifizierte Kopplung erzwingen".',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Name',
  'workbench.settings.backendPane.field.label.description':
    'So heißt dieses Back-end überall in der App. Standard ist seine Adresse.',
  'workbench.settings.backendPane.field.label.placeholder': 'Arbeits-VM',
  'workbench.settings.backendPane.field.label.aria': 'Back-end-Name',
  'workbench.settings.backendPane.field.url.label': 'Back-end-Adresse',
  'workbench.settings.backendPane.field.url.description':
    'Wo sich dieser Client beim Back-end einwählt. `ws://` für lokale / LAN-Hosts, `wss://` für entfernte.',
  'workbench.settings.backendPane.field.url.schemeAria': 'Schema',
  'workbench.settings.backendPane.field.url.addressAria': 'Adresse',
  'workbench.settings.backendPane.field.url.portAria': 'Port',
  'workbench.settings.backendPane.field.auth.label': 'Authentifizierung',
  'workbench.settings.backendPane.field.auth.description':
    'Wie sich dieses Gerät beim Back-end ausweist. Kopple mit einem Code oder füge direkt einen Token ein.',
  'workbench.settings.backendPane.field.auth.codeAria': 'Kopplungscode',
  'workbench.settings.backendPane.field.auth.tokenAria': 'Auth-Token',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'Token einfügen',
  'workbench.settings.backendPane.field.auth.paired': 'Gekoppelt — Zugriffstoken gespeichert',
  'workbench.settings.backendPane.field.auth.useToken': 'Stattdessen einen Auth-Token verwenden',
  'workbench.settings.backendPane.field.auth.useCode': 'Stattdessen mit einem Code koppeln',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'Gib einen Port ein.',
  'workbench.settings.backendPane.port.notInteger': 'Der Port muss eine ganze Zahl sein.',
  'workbench.settings.backendPane.port.privileged':
    'Ports unter 1024 sind privilegiert und brauchen erhöhte Rechte — wähle 1024 oder höher.',
  'workbench.settings.backendPane.port.aboveMax': 'Der Port muss 65535 oder niedriger sein.',
  'workbench.settings.backendPane.port.ephemeral':
    'Die Ports 49152–65535 sind der Bereich, den das Betriebssystem für ausgehende Verbindungen vergibt; ein ' +
    'Listener kann sich hier sporadisch nicht binden. Ein Port aus 1024–49151 ist zuverlässiger.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'LAN-Peers erlauben?',
  'workbench.settings.backendPane.lan.confirmOk': 'LAN-Peers erlauben',
  'workbench.settings.backendPane.lan.confirmCancel': 'Nur Loopback behalten',
  'workbench.settings.backendPane.lan.confirmBody':
    'Das Desktop-Back-end bindet dann jede lokale Netzwerkschnittstelle, sodass sich andere Geräte in deinem ' +
    'Netzwerk verbinden können. Jede Verbindung — LAN oder Loopback — muss einen gekoppelten Auth-Token ' +
    'vorlegen; es gibt keinen tokenfreien Weg. Geräte koppeln mit dem Code, den die App zeigt (oder fügen ' +
    'einen Token unter Einstellungen → Back-end → Auth-Token ein).',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.title': 'Offline-Ausweichreihenfolge',
  'workbench.settings.backendPane.fallback.blurb':
    'Geht das Back-end offline, frischt der erste erreichbare Host auf dieser Liste die Zugangsdaten eines ' +
    'exklusiven Workflows selbst auf. Hosts tragen sich automatisch ein; ziehe zum Umsortieren.',
  'workbench.settings.backendPane.fallback.empty':
    'Noch kein Host eingetragen. Ein Browser tritt dieser Liste bei, sobald er den seed eines exklusiven ' +
    'Live-Workflows in diesem Arbeitsbereich hält.',
  'workbench.settings.backendPane.fallback.saveFailed': 'Die neue Reihenfolge ließ sich nicht speichern',
  'workbench.settings.backendPane.fallback.removeFailed': 'Der Host ließ sich nicht entfernen',
  'workbench.settings.backendPane.fallback.dragAria': 'Zum Umsortieren ziehen',
  'workbench.settings.backendPane.fallback.selfTag': 'Dieser Browser',
  'workbench.settings.backendPane.fallback.pruneTitle': 'Diesen Host entfernen?',
  'workbench.settings.backendPane.fallback.pruneBody':
    'Er tritt automatisch wieder bei, wenn er noch den seed eines exklusiven Workflows hält.',

  // ── Backend pane: tier cards ────────────────────────────────────────
  // The tier registry (`backend-tier-data.ts`) renders inside a
  // fixed-geometry SVG card. Titles, capability bullets, and range-
  // category labels are keyed; IP ranges, URL patterns, and platform
  // proper nouns stay literal (technical plane). Networking vocabulary
  // inside keyed labels (loopback, RFC1918, mDNS, …) is
  // glossary-protected on translator handoff.
  'workbench.settings.backendPane.tier.cardAria': 'Stufenkarte {title}',
  'workbench.settings.backendPane.tier.badge.today': 'Heute',
  'workbench.settings.backendPane.tier.badge.roadmap': 'Roadmap',
  'workbench.settings.backendPane.tier.inheritsFrom': 'Erbt von {tier}',
  'workbench.settings.backendPane.tier.newInTier': '+ Neu in dieser Stufe',
  'workbench.settings.backendPane.tier.supports': 'Unterstützt',
  'workbench.settings.backendPane.tier.in-browser.title': 'Im Browser',
  'workbench.settings.backendPane.tier.in-browser.sub': 'Service Worker der Erweiterung',
  'workbench.settings.backendPane.tier.desktop-app.title': 'Desktop-App',
  'workbench.settings.backendPane.tier.desktop-app.sub': 'eingebetteter Server',
  'workbench.settings.backendPane.tier.local-self-hosted.title': 'Lokaler Server',
  'workbench.settings.backendPane.tier.local-self-hosted.sub': 'in deinem LAN',
  'workbench.settings.backendPane.tier.remote-self-hosted.title': 'Entfernter Server',
  'workbench.settings.backendPane.tier.remote-self-hosted.sub': 'im WAN',
  'workbench.settings.backendPane.tier.bullet.zeroSetup': 'keine Einrichtung',
  'workbench.settings.backendPane.tier.bullet.minimalSetup': 'minimale Einrichtung',
  'workbench.settings.backendPane.tier.bullet.standardSetup': 'übliche Einrichtung',
  'workbench.settings.backendPane.tier.bullet.singleDevice': 'ein Gerät',
  'workbench.settings.backendPane.tier.bullet.multipleDevices': 'mehrere Geräte',
  'workbench.settings.backendPane.tier.bullet.perBrowserInstance': 'Instanz pro Browser',
  'workbench.settings.backendPane.tier.bullet.perAppInstance': 'Instanz pro App',
  'workbench.settings.backendPane.tier.bullet.multiBrowserInstances': 'Instanzen über mehrere Browser',
  'workbench.settings.backendPane.tier.bullet.multiAppInstances': 'Instanzen über mehrere Apps',
  'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing': 'gleichzeitiges Bearbeiten über Oberflächen',
  'workbench.settings.backendPane.tier.bullet.multiWindowEditing': 'gleichzeitiges Bearbeiten über Fenster',
  'workbench.settings.backendPane.tier.bullet.localhostOnly': 'Nur Localhost',
  'workbench.settings.backendPane.tier.bullet.localhostSupported': 'Localhost unterstützt',
  'workbench.settings.backendPane.tier.bullet.lanReachable': 'im LAN erreichbar',
  'workbench.settings.backendPane.tier.bullet.wanReachable': 'über WAN/Internet erreichbar',
  'workbench.settings.backendPane.tier.bullet.nativeFilesystem': 'natives Dateisystem',
  'workbench.settings.backendPane.tier.bullet.yamlOnDisk': 'YAML auf der Platte',
  'workbench.settings.backendPane.tier.bullet.gitIntegration': 'git-Integration (lokal/remote)',
  'workbench.settings.backendPane.tier.bullet.clients': 'Browser-Erw. · Desktop-App · CLI',
  'workbench.settings.backendPane.tier.bullet.headlessByDefault': 'standardmäßig headless · Website als Opt-in',
  'workbench.settings.backendPane.tier.bullet.teamReady': 'teamfähig',
  'workbench.settings.backendPane.tier.bullet.ssoAuth': 'SSO-Auth',
  'workbench.settings.backendPane.tier.bullet.rbac': 'RBAC-Benutzerverwaltung',
  'workbench.settings.backendPane.tier.bullet.auditLogs': 'Audit-Logs & Berichte',
  'workbench.settings.backendPane.tier.note.soon': 'bald',
  'workbench.settings.backendPane.tier.group.allOs': 'Alle Betriebssysteme',
  'workbench.settings.backendPane.tier.group.embedded': 'Eingebettet',
  'workbench.settings.backendPane.tier.group.hyperscalers': 'Hyperscaler',
  'workbench.settings.backendPane.tier.group.euNative': 'EU-nativ',
  'workbench.settings.backendPane.tier.group.other': 'Sonstige',
  'workbench.settings.backendPane.tier.group.enterprise': 'Enterprise',
  'workbench.settings.backendPane.tier.platform.yourCloud': 'Deine Cloud',
  'workbench.settings.backendPane.tier.platform.onPrem': 'On-Premises',
  'workbench.settings.backendPane.tier.platform.homeServer': 'Heimserver',
  'workbench.settings.backendPane.tier.platform.oldLaptop': 'Altes Laptop',
  'workbench.settings.backendPane.tier.platform.miniPc': 'Mini-PC',
  'workbench.settings.backendPane.tier.reach.none': 'N/A',
  'workbench.settings.backendPane.tier.reach.localhost': 'Localhost',
  'workbench.settings.backendPane.tier.reach.lan': 'Localhost/LAN',
  'workbench.settings.backendPane.tier.reach.wan': 'Internet/WAN',
  'workbench.settings.backendPane.tier.cat.whyNoWire': 'Warum keine Leitung?',
  'workbench.settings.backendPane.tier.cat.sameBrowserSurfaces': 'Oberflächen im selben Browser',
  'workbench.settings.backendPane.tier.cat.perBrowserInstance': 'Instanz pro Browser',
  'workbench.settings.backendPane.tier.cat.ipv4Loopback': 'IPv4-Loopback',
  'workbench.settings.backendPane.tier.cat.ipv6Loopback': 'IPv6-Loopback',
  'workbench.settings.backendPane.tier.cat.defaultPort': 'Standard-Port',
  'workbench.settings.backendPane.tier.cat.localhostLoopback': 'Localhost / Loopback',
  'workbench.settings.backendPane.tier.cat.rfc1918': 'Privates IPv4 nach RFC1918',
  'workbench.settings.backendPane.tier.cat.ipv6Ula': 'IPv6 ULA',
  'workbench.settings.backendPane.tier.cat.cgnat': 'CGNAT / Overlay',
  'workbench.settings.backendPane.tier.cat.zeroConfig': 'Zero-Config- / No-DHCP-Ausweg',
  'workbench.settings.backendPane.tier.cat.mdns': 'mDNS-Hostnamen',
  'workbench.settings.backendPane.tier.cat.publicDns': 'Öffentlicher DNS-Hostname',
  'workbench.settings.backendPane.tier.cat.publicIpv4': 'Öffentliches IPv4',
  'workbench.settings.backendPane.tier.cat.publicIpv6': 'Öffentliches IPv6',
  'workbench.settings.backendPane.tier.cat.transport': 'Transport',
  'workbench.settings.backendPane.tier.rangeNote.backendIsSw':
    'kein Port zum Lauschen, keine IPC-Fläche für andere Geräte',
  'workbench.settings.backendPane.tier.rangeNote.runtimeMessaging':
    'Popup / Arbeitsbereich-Editor / DevTools / Seitenpanel sprechen prozessintern mit dem SW',
  'workbench.settings.backendPane.tier.rangeNote.storageLocal':
    'Chrome ≠ Firefox ≠ Edge — getrennte Daten pro Browser, kein geräte-, kein browserübergreifend',
  'workbench.settings.backendPane.tier.rangeNote.typicalLoopback': 'typischerweise 127.0.0.1',
  'workbench.settings.backendPane.tier.rangeNote.portOverride': 'überschreibbar unter Back-end → Verbindung',
  'workbench.settings.backendPane.tier.rangeNote.serverOwnBox':
    'IPv4 — Server auf deiner eigenen Maschine (Docker, Sidecar)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6': 'IPv6',
  'workbench.settings.backendPane.tier.rangeNote.ulaPractically': 'praktisch fd00::/8 — private IPv6-Zuteilung',
  'workbench.settings.backendPane.tier.rangeNote.overlayVendors': 'Tailscale usw.',
  'workbench.settings.backendPane.tier.rangeNote.ipv4LinkLocal': 'IPv4 link-local (APIPA)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6LinkLocal':
    'IPv6 link-local — jede Schnittstelle vergibt sich automatisch eine',
  'workbench.settings.backendPane.tier.rangeNote.bonjour': 'Bonjour / Avahi',
  'workbench.settings.backendPane.tier.rangeNote.tlsCert': 'empfohlen — TLS-Zertifikat',
  'workbench.settings.backendPane.tier.rangeNote.publicIpv4': 'alles außerhalb von RFC1918 / 100.64/10',
  'workbench.settings.backendPane.tier.rangeNote.globallyRoutable': 'global routbar',
  'workbench.settings.backendPane.tier.rangeNote.tlsRequired':
    'erforderlich — Clients verweigern ws:// zu einem Nicht-Loopback-Host',

  // ── Backend pane: scene-diagram aria labels ────────────────────────
  // The topology scenes themselves stay literal English (illustration
  // plane, S3 glyph precedent); only their accessible names localize.
  'workbench.settings.backendPane.detail.aria.in-browser': 'Back-end im Browser',
  'workbench.settings.backendPane.detail.aria.desktop-app': 'Back-end in der Desktop-App',
  'workbench.settings.backendPane.detail.aria.local-self-hosted': 'Lokales LAN-Server-Back-end',
  'workbench.settings.backendPane.detail.aria.remote-self-hosted': 'Entferntes selbst gehostetes Back-end',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'Kürzel suchen',
  'workbench.settings.keymapPane.noMatches': 'Keine Kürzel passen auf deine Suche.',
  'workbench.settings.keymapPane.recording': 'Drücke Tasten…',
  'workbench.settings.keymapPane.unbound': 'Nicht belegt',
  'workbench.settings.keymapPane.recordTip': 'Klicken, um ein neues Kürzel aufzunehmen',
  'workbench.settings.keymapPane.recordAria': 'Kürzel für {label} ändern',
  'workbench.settings.keymapPane.unbind': 'Kürzel entfernen',
  'workbench.settings.keymapPane.unbindAria': 'Kürzel für {label} entfernen',
  'workbench.settings.keymapPane.resetAria': 'Kürzel für {label} zurücksetzen',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Kürzel hat eine kollidierende Belegung',
      other: '{count} Kürzel haben kollidierende Belegungen',
    }),
  'workbench.settings.keymapPane.conflictShowOnly': 'Konflikte anzeigen',
  'workbench.settings.keymapPane.conflictShowAll': 'Alle Kürzel anzeigen',
  'workbench.settings.keymapPane.conflictBadgeAria': 'Kürzel-Konflikt',
  'workbench.settings.keymapPane.conflictTooltip': 'Ebenfalls belegt mit: {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': 'Reserviertes Kürzel',
  'workbench.settings.keymapPane.reservedBrowser':
    'Der Browser reserviert dieses Kürzel — er kann darauf reagieren, bevor es die App erreicht.',
  'workbench.settings.keymapPane.reservedSystem':
    'Das Betriebssystem reserviert dieses Kürzel — es kann darauf reagieren, bevor es die App erreicht.',
  'workbench.settings.keymapPane.lookupTip': 'Aktionen über ihr Kürzel finden',
  'workbench.settings.keymapPane.lookupAria': 'Aktion über Kürzel finden',
  'workbench.settings.keymapPane.lookupEmpty': 'Keine Aktion ist mit {chord} belegt.',
  'workbench.settings.keymapPane.conflictPrompt': '{chord} ist bereits belegt mit: {labels}',
  'workbench.settings.keymapPane.conflictReassign': 'Neu belegen',
  'workbench.settings.keymapPane.conflictKeepBoth': 'Beide behalten',
  'workbench.settings.keymapPane.presetAria': 'Keymap-Voreinstellung',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Voreinstellung wiederherstellen ({count} Anpassung)',
      other: 'Voreinstellung wiederherstellen ({count} Anpassungen)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip':
    'Jedes angepasste Kürzel auf die aktive Voreinstellung zurücksetzen.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': 'Gekoppelte Geräte',
  'workbench.settings.backendTokens.sectionBlurb':
    'Jedes Gerät, das sich mit diesem Back-end verbindet, authentifiziert sich mit einem Zugriffstoken. ' +
    'Verbundene Geräte sind hervorgehoben; rotiere einen Token, um ein frisches Secret auszustellen und das ' +
    'alte auszumustern.',
  'workbench.settings.backendTokens.labelPlaceholder': 'Beschriftung (optional) — z. B. „Handy von Alice“',
  'workbench.settings.backendTokens.bindUserPlaceholder': 'An Benutzer binden (optional)',
  'workbench.settings.backendTokens.generate': 'Token erzeugen',
  'workbench.settings.backendTokens.pairDevice': 'Gerät koppeln',
  'workbench.settings.backendTokens.explainer.intro': 'Beides fügt unten einen Token hinzu.',
  'workbench.settings.backendTokens.explainer.generateText':
    'zeigt dir das Secret, damit du es selbst kopierst und auf dem Gerät einfügst.',
  'workbench.settings.backendTokens.explainer.pairText':
    'zeigt einen kurzen Code, den das Gerät unter Einstellungen → Back-end → Mit einem Code koppeln eingibt ' +
    '(oder als Ausweg einen Link öffnet) — nutze das, wenn jemand anderes das Gerät einrichtet.',
  'workbench.settings.backendTokens.empty':
    'Noch keine Geräte. Erzeuge einen Token und füge ihn auf dem Gerät unter Einstellungen → Back-end ein, ' +
    'oder kopple ein Gerät und lass es dort den Code eingeben.',
  'workbench.settings.backendTokens.mintFailed': 'Token ließ sich nicht prägen: {message}',
  'workbench.settings.backendTokens.rotateFailed': 'Rotation fehlgeschlagen: {message}',
  'workbench.settings.backendTokens.revokeFailed': 'Widerruf fehlgeschlagen: {message}',
  'workbench.settings.backendTokens.revokedDevice': 'Token widerrufen. Jedes Gerät, das ihn nutzte, wurde getrennt.',
  'workbench.settings.backendTokens.revokedSession': 'Sitzung widerrufen. Der Benutzer wurde abgemeldet.',
  'workbench.settings.backendTokens.rotate': 'Rotieren',
  'workbench.settings.backendTokens.revoke': 'Widerrufen',
  'workbench.settings.backendTokens.rotateConfirmTitle': 'Diesen Token rotieren?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    'Ein frisches Secret wird geprägt und das aktuelle widerrufen. Das Gerät muss den neuen Token bekommen, ' +
    'bevor es sich wieder verbinden kann.',
  'workbench.settings.backendTokens.revokeConfirmTitle': 'Diesen Token widerrufen?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    'Jedes Gerät, das ihn gerade nutzt, wird sofort getrennt und kann sich nicht wieder verbinden.',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': 'Diese Sitzung widerrufen?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    'Der Benutzer wird sofort abgemeldet und getrennt. Er muss sich erneut über den Identitätsanbieter ' + 'anmelden.',
  'workbench.settings.backendTokens.revokedTag': 'Widerrufen {when}',
  'workbench.settings.backendTokens.connectedTag': 'Verbunden',
  'workbench.settings.backendTokens.expiredTag': 'Abgelaufen',
  'workbench.settings.backendTokens.unlabeled': '(ohne Beschriftung)',
  'workbench.settings.backendTokens.unbound': '(ungebunden)',
  'workbench.settings.backendTokens.meta.device': 'Id {id} · erstellt {created} · zuletzt genutzt {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'Benutzer {user}',
  'workbench.settings.backendTokens.meta.session':
    'angemeldet {signedIn} · läuft ab {expires} · zuletzt gesehen {lastSeen} · Id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'SSO-Sitzungen',
  'workbench.settings.backendTokens.ssoBlurb':
    'Jede SSO-Anmeldung prägt eine Sitzung, die von selbst abläuft. Widerrufe eine, um den Benutzer sofort ' +
    'abzumelden — er muss sich erneut über den Identitätsanbieter anmelden.',
  'workbench.settings.backendTokens.secretTitle': 'Kopiere diesen Token jetzt',
  'workbench.settings.backendTokens.secretTitleRotated': 'Kopiere den rotierten Token jetzt',
  'workbench.settings.backendTokens.secretBody':
    'Das Back-end speichert nur einen Hash dieses Wertes. Sobald dieser Dialog schließt, lässt sich das Secret ' +
    'nicht wiederherstellen — wenn du es verlierst, widerrufe den Token und präge einen neuen.',
  'workbench.settings.backendTokens.secretBodyRotated':
    'Der vorherige Token ist jetzt widerrufen — gib dieses neue Secret an das Gerät, damit es sich wieder ' +
    'verbinden kann. Das Back-end speichert nur einen Hash dieses Wertes. Sobald dieser Dialog schließt, lässt ' +
    'sich das Secret nicht wiederherstellen — wenn du es verlierst, widerrufe den Token und präge einen neuen.',
  'workbench.settings.backendTokens.secretSaved': 'Ich habe es gesichert',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': 'Fertig',
  'workbench.settings.backendTokens.pairModal.allocating': 'Code wird zugeteilt…',
  'workbench.settings.backendTokens.pairModal.startFailed': 'Kopplung konnte nicht starten',
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'Kopplung abgelaufen',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    'Das 5-Minuten-Fenster verstrich ohne Bestätigung. Schließe diesen Dialog und klicke erneut auf Gerät ' +
    'koppeln, um neu zu beginnen.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'Gekoppelt',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    'Das Gerät hat den Code bestätigt. Ein frischer Zugriffstoken wurde ausgestellt und auf dem Gerät ' +
    'gespeichert; es erscheint in der Liste unten. Kann sich das Gerät nicht verbinden, widerrufe den ' +
    'Eintrag und kopple erneut.',
  'workbench.settings.backendTokens.pairModal.intro.part1': 'Öffne auf dem anderen Gerät',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': 'Einstellungen → Back-end',
  'workbench.settings.backendTokens.pairModal.intro.part2': ', richte seine',
  'workbench.settings.backendTokens.pairModal.intro.address': 'Back-end-Adresse',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'auf diese App, klicke dann auf',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'und gib ein:',
  'workbench.settings.backendTokens.pairModal.codeLabel': 'Kopplungscode',
  'workbench.settings.backendTokens.pairModal.expiresIn': 'läuft ab in {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'Back-end-Adresse dieser App',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': 'Keine Option',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    'auf dem Gerät? Öffne dort stattdessen einen dieser Links — er liefert eine Seite, die einen Token zum ' +
    'manuellen Einfügen übergibt.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'Kommandozeilen-Zugriff',
  'workbench.settings.cliAccess.sectionBlurb':
    'Ein Klick verbindet das Kommandozeilen-Tool oh auf dieser Maschine mit der App — ein Zugriffstoken wird ' +
    'erstellt und für es gespeichert, ohne Kopieren.',
  'workbench.settings.cliAccess.statusUnconfigured': 'Die CLI auf dieser Maschine ist noch nicht verbunden.',
  'workbench.settings.cliAccess.statusConfigured': 'CLI verbunden als {label}.',
  'workbench.settings.cliAccess.statusStale':
    'Der gespeicherte CLI-Token ist nicht mehr gültig — richte den Zugriff erneut ein, um wieder zu verbinden.',
  'workbench.settings.cliAccess.statusExternal':
    'Die CLI ist derzeit mit einem anderen Back-end verbunden ({url}). Den Zugriff hier einzurichten richtet ' +
    'sie stattdessen auf diese App.',
  'workbench.settings.cliAccess.statusMalformed': 'Die CLI-Konfigurationsdatei lässt sich nicht lesen: {message}',
  'workbench.settings.cliAccess.pathNote': 'Gespeichert in {path}',
  'workbench.settings.cliAccess.setUp': 'CLI-Zugriff einrichten',
  'workbench.settings.cliAccess.rotate': 'CLI-Zugriff rotieren',
  'workbench.settings.cliAccess.connectHere': 'Mit dieser App verbinden',
  'workbench.settings.cliAccess.provisioned':
    'CLI-Zugriff eingerichtet — oh funktioniert jetzt in jedem Terminal auf dieser Maschine.',
  'workbench.settings.cliAccess.rotated': 'CLI-Token rotiert — der vorherige Token ist widerrufen.',
  'workbench.settings.cliAccess.provisionFailed': 'CLI-Einrichtung fehlgeschlagen: {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.serverOff':
    'Der MCP-Server ist aus — Clients können sich erst verbinden, wenn du ihn aktivierst.',
  'workbench.settings.mcpPane.connect.title': 'Client verbinden',
  'workbench.settings.mcpPane.connect.blurb':
    'Wähle deinen Client, ersetze {token} durch einen oben erzeugten Token und passe den App-Pfad an, falls ' +
    'du woanders installiert hast. Die App muss laufen, damit sich Clients verbinden können.',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle':
    'claude_desktop_config.json — in die bestehende Datei einmischen',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'Einmal in einem Terminal ausführen',
  'workbench.settings.mcpPane.snippet.cliTitle':
    'Einmal in einem Terminal ausführen — spätere oh-Läufe brauchen keine Flags',
  'workbench.settings.mcpPane.snippet.httpTitle': 'Für Clients, die direkt streamable HTTP sprechen',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'MCP-Server aktivieren',
  'workbench.settings.mcpConsent.body':
    'Agent-Clients und die oh-TUI kommunizieren mit dieser App über den MCP-Server, der derzeit aus ist.',
  'workbench.settings.mcpConsent.info.title': 'MCP-Server',
  'workbench.settings.mcpConsent.info.summary':
    'MCP-Clients erreichen diese App über den /mcp-Endpunkt des Back-ends (Model Context Protocol über ' +
    'Streaming-HTTP). Die Einstellung mcp.enabled schaltet diesen Endpunkt — solange sie aus ist, liefert er ' +
    '404. Clients authentifizieren sich mit denselben Zugriffstokens wie jede andere Verbindung.',
  'workbench.settings.mcpConsent.ok': 'Aktivieren',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': 'Die installierte Datei ist kein Lizenzschlüssel.',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'Die installierte Lizenz passt auf kein Schema, das diese Version unterstützt.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'Die installierte Lizenz ist mit einem Schlüssel signiert, dem dieser Build nicht vertraut.',
  'workbench.settings.licensePane.invalid.bad-signature':
    'Die installierte Lizenz hat die Signaturprüfung nicht bestanden — der Text wurde nach dem Signieren ' +
    'verändert.',
  'workbench.settings.licensePane.installed': 'Lizenz installiert',
  'workbench.settings.licensePane.removed': 'Lizenz entfernt — zurück auf der kostenlosen Stufe',
  'workbench.settings.licensePane.removeFailed': 'Lizenz ließ sich nicht entfernen: {message}',
  'workbench.settings.licensePane.freeTier.title': 'Kostenlose Stufe',
  'workbench.settings.licensePane.freeTier.body':
    'Alles, was Open Headers heute bietet, ist enthalten — die kostenlose Stufe erlaubt bis zu {limit} ' +
    'aktive Nutzer pro Server. Installiere einen Lizenzschlüssel, um die Platzgrenze anzuheben.',
  'workbench.settings.licensePane.invalidAlert.title': 'Die installierte Lizenz ist nicht nutzbar',
  'workbench.settings.licensePane.invalidAlert.body':
    'Die App läuft auf der kostenlosen Stufe weiter (bis zu {limit} aktive Nutzer). Füge unten einen ' +
    'frischen Schlüssel ein oder kontaktiere den Support.',
  'workbench.settings.licensePane.grace.title': 'Lizenz abgelaufen — Kulanzfrist aktiv',
  'workbench.settings.licensePane.grace.body':
    'Diese Lizenz lief am {expiredOn} ab. Verlängere vor dem {graceEndsOn} — danach fällt das Anlegen oder ' +
    'Reaktivieren von Nutzern auf die kostenlose Grenze von {limit} zurück. Bestehende Nutzer melden sich ' +
    'weiter an, und Daten sind nie betroffen.',
  'workbench.settings.licensePane.expired.title': 'Lizenz und Kulanzfrist sind beendet',
  'workbench.settings.licensePane.expired.body':
    'Das Anlegen und Reaktivieren von Nutzern folgt jetzt der kostenlosen Grenze von {limit} aktiven ' +
    'Nutzern. Bestehende Nutzer melden sich weiter an, bestehende Arbeitsbereiche funktionieren weiter, und ' +
    'Daten sind nie betroffen. Installiere einen verlängerten Schlüssel, um die lizenzierte Platzzahl ' +
    'wiederherzustellen.',
  'workbench.settings.licensePane.detail.licensedTo': 'Lizenziert für',
  'workbench.settings.licensePane.detail.contact': 'Kontakt',
  'workbench.settings.licensePane.detail.seats': 'Plätze',
  'workbench.settings.licensePane.detail.validUntil': 'Gültig bis',
  'workbench.settings.licensePane.detail.licenseId': 'Lizenz-Id',
  'workbench.settings.licensePane.tag.active': 'Aktiv',
  'workbench.settings.licensePane.tag.offline': 'Offline-Lizenz',
  'workbench.settings.licensePane.removeConfirm.title': 'Diese Lizenz entfernen?',
  'workbench.settings.licensePane.removeConfirm.body':
    'Die App fällt auf die kostenlose Stufe zurück (bis zu {limit} aktive Nutzer). Daten sind nicht betroffen.',
  'workbench.settings.licensePane.removeConfirm.ok': 'Entfernen',
  'workbench.settings.licensePane.removeButton': 'Lizenz entfernen',
  'workbench.settings.licensePane.replaceTitle': 'Lizenz ersetzen',
  'workbench.settings.licensePane.installTitle': 'Lizenz installieren',
  'workbench.settings.licensePane.pastePlaceholder': 'Füge deinen Lizenzschlüssel ein (oh-license.…)',
  'workbench.settings.licensePane.installButton': 'Installieren',
  'workbench.settings.licensePane.loadFromFile': 'Aus Datei laden…',

  // ── Proxy trust pane body (PROXY_SECURITY.md §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'Das Entschlüsseln von HTTPS-Traffic braucht eine auf dieser Maschine erzeugte Zertifizierungsstelle. ' +
    'Nichts wird installiert, bis du hier das Vertrauen einrichtest, und alles hier Installierte lässt sich ' +
    'hier auch entfernen.',
  'workbench.settings.proxyTrustPane.refresh': 'Erneut prüfen',
  'workbench.settings.proxyTrustPane.loadFailed': 'Der Vertrauenszustand ließ sich nicht lesen: {message}',
  'workbench.settings.proxyTrustPane.ca.title': 'Zertifizierungsstelle',
  'workbench.settings.proxyTrustPane.ca.none':
    'Noch existiert keine Zertifizierungsstelle. Sie wird beim ersten Einrichten des Vertrauens auf dieser ' +
    'Maschine erzeugt — sie wird nie mit der App ausgeliefert, und ihr privater Schlüssel verlässt diesen ' +
    'Computer nie.',
  'workbench.settings.proxyTrustPane.ca.subject': 'Subject',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'SHA-256-Fingerabdruck',
  'workbench.settings.proxyTrustPane.ca.validity': 'Gültig',
  'workbench.settings.proxyTrustPane.ca.validityRange': '{from} bis {until}',
  'workbench.settings.proxyTrustPane.ca.deleteButton': 'Zertifizierungsstelle löschen',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': 'Die Zertifizierungsstelle löschen?',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    'Das Schlüsselpaar wird von dieser Maschine gelöscht. Ein erneutes Einrichten des Vertrauens erzeugt ' +
    'eine frische Stelle.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': 'Löschen',
  'workbench.settings.proxyTrustPane.ca.deleted': 'Zertifizierungsstelle gelöscht',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': 'Die Zertifizierungsstelle ließ sich nicht löschen: {message}',
  'workbench.settings.proxyTrustPane.stores.title': 'Vertrauensspeicher',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'Anmelde-Schlüsselbund',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'System-Schlüsselbund',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Firefox-Profil',
  'workbench.settings.proxyTrustPane.stores.state.trusted': 'Vertraut',
  'workbench.settings.proxyTrustPane.stores.state.absent': 'Nicht installiert',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': 'Vorhanden, nicht vertraut',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': 'Anderes Zertifikat',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': 'Nicht lesbar',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'Über System-Speicher abgedeckt',
  'workbench.settings.proxyTrustPane.stores.state.optedOut': 'In Firefox deaktiviert',
  'workbench.settings.proxyTrustPane.stores.empty': 'Auf dieser Maschine sind keine Vertrauensspeicher sichtbar.',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': 'Ein Vertrauensspeicher enthält ein anderes Zertifikat',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    'Ein Zertifikat mit dem Namen unserer Stelle ist installiert, aber sein Fingerabdruck ist nicht die ' +
    'Stelle dieser Maschine. Diese App hat es nicht installiert und nutzt es nie — prüfe den Speicher, in ' +
    'dem es liegt.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} aufgezeichnete Installation',
      other: '{count} aufgezeichnete Installationen',
    }),
  'workbench.settings.proxyTrustPane.installButton': 'Vertrauen einrichten…',
  'workbench.settings.proxyTrustPane.wizard.title': 'Die Proxy-Zertifizierungsstelle installieren',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'Was installiert wird',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'Ein auf dieser Maschine erzeugtes Stammzertifikat, einzigartig für diese Installation. Sein privater ' +
    'Schlüssel ist im Ruhezustand verschlüsselt und wird nirgendwohin gesendet.',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': 'Was es ermöglicht',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'Vertrauensspeicher, die es enthalten, akzeptieren die Zertifikate des Erfassungs-Proxys, sodass er ' +
    'HTTPS entschlüsseln kann — nur für Hosts, die du ausdrücklich einbeziehst. Alles andere läuft ' +
    'unberührt durch.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': 'Wie es entfernt wird',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'Jede Änderung wird aufgezeichnet, und ein Klick auf dieser Seite macht genau diese Änderungen ' +
    'rückgängig. Das Deinstallieren der App tut dasselbe.',
  'workbench.settings.proxyTrustPane.wizard.explain.next': 'Vertrauensspeicher wählen',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb':
    'Wähle, wo installiert wird. Nichts ändert sich, bis du bestätigst.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    'Apps, die als du laufen — keine Admin-Genehmigung nötig.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    'Jeder Benutzer dieser Maschine — fragt nach Admin-Genehmigung.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    'Systemweites Vertrauen ist in diesem Build noch nicht verfügbar — es braucht den Helfer von OpenHeaders. ' +
    'Verwende vorerst den Anmelde-Schlüsselbund.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox führt einen eigenen Vertrauensspeicher — installiert in jedes gefundene Profil.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone':
    'Auf dieser Maschine wurden keine Firefox-Profile gefunden.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'Firefox-Profile wurden gefunden, aber certutil (NSS-Tools) ist nicht installiert — ihre Vertrauensspeicher können von dieser Maschine aus nicht verwaltet werden.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox vertraut dem System-Speicher automatisch (Firefox 120+) — die Schlüsselbunde oben decken ihn ab.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'In {count} Speicher installieren',
      other: 'In {count} Speicher installieren',
    }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk':
    'Das Vertrauen ist in jedem gewählten Speicher installiert.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    'Einige Speicher blieben unverändert. Nichts wiederholt sich von selbst — behebe die Ursache und richte ' +
    'das Vertrauen erneut ein, oder entferne das Vertrauen zum Zurückrollen.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'Installiert und vertraut',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    'Die Admin-Genehmigung wurde abgelehnt — der Speicher blieb unverändert.',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    'Das Zertifikat wurde hinzugefügt, konnte aber nicht als vertraut markiert werden. Verwende „Vertrauen ' +
    'entfernen“, um es zu bereinigen.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': 'Fehlgeschlagen: {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': 'Vertrauenseinrichtung fehlgeschlagen: {message}',
  'workbench.settings.proxyTrustPane.wizard.done': 'Fertig',
  'workbench.settings.proxyTrustPane.removeButton': 'Vertrauen entfernen',
  'workbench.settings.proxyTrustPane.removeConfirm.title':
    'Das Zertifikat aus jedem aufgezeichneten Speicher entfernen?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    'Jede aufgezeichnete Installation wird rückgängig gemacht und als sauber verifiziert, bevor ihr Eintrag ' +
    'fällt. Die Zertifizierungsstelle selbst bleibt für eine spätere Neuinstallation erhalten.',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': 'Entfernen',
  'workbench.settings.proxyTrustPane.removed':
    'Vertrauen entfernt — jeder aufgezeichnete Speicher ist als sauber verifiziert.',
  'workbench.settings.proxyTrustPane.removePartial':
    'Einige Speicher ließen sich nicht als sauber verifizieren. Ihre Einträge bleiben — führe die ' +
    'Entfernung erneut aus, sobald die Ursache behoben ist.',
  'workbench.settings.proxyTrustPane.removeFailed': 'Entfernung fehlgeschlagen: {message}',
  'workbench.settings.proxyTrustPane.helper.title': 'Privilegierter Helfer',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'System-Schlüsselbund-Vertrauen läuft über einen signierten Helfer, der bei macOS als Hintergrundelement registriert ist. Er bewegt nur die Zertifikat-Bytes — jede Vertrauensentscheidung läuft weiterhin über den macOS-Admin-Dialog.',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    'In diesem Build nicht enthalten — nur paketierte macOS-Builds.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': 'Registrierung',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'Server',
  'workbench.settings.proxyTrustPane.helper.state.enabled': 'Registriert',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': 'Wartet auf Genehmigung',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': 'Nicht registriert',
  'workbench.settings.proxyTrustPane.helper.state.notFound':
    'Nicht gefunden — installiere die App zuerst unter „Programme“',
  'workbench.settings.proxyTrustPane.helper.state.unknown': 'Unbekannt',
  'workbench.settings.proxyTrustPane.helper.probe.ok': 'Antwortet',
  'workbench.settings.proxyTrustPane.helper.probe.down': 'Antwortet nicht',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS wartet auf eine Genehmigung: aktiviere OpenHeaders unter Anmeldeobjekte › „Im Hintergrund erlauben“ und prüfe dann erneut.',
  'workbench.settings.proxyTrustPane.helper.registerButton': 'Registrieren',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': 'Registrierung aufheben',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'Anmeldeobjekte öffnen',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'Helfer-Aktion fehlgeschlagen: {message}',

  // ── Backend-details scene pills ────────────────────────────────────
  // Architecture component names (sync-engine · rule-engine · oracle ·
  // vault) are glossary vocabulary and ride raw inside the pills; only
  // the connective text keys here.
  'workbench.settings.backendDetails.backEndTitle': 'Back-end = {engine}',
  'workbench.settings.backendDetails.servedOn': 'ausgeliefert über {via}',
  'workbench.settings.backendDetails.apiClientsTitle': 'API-Clients = {count}',
  'workbench.settings.backendDetails.frontEndTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Front-end = {count} gehostete Oberfläche',
      other: 'Front-end = {count} gehostete Oberflächen',
    }),
  'workbench.settings.backendDetails.optIn': '(Opt-in)',

  // ── Backend-details device-frame labels ────────────────────────────
  // The scene diagrams' device-container labels are user-facing scene
  // vocabulary and key here. Inner window corners ("Browser" / "CLI"),
  // the CI/CD YAML mock, prompt glyphs, and engine/where pill args stay
  // raw as diagram internals. Browser window titles (Chrome / Firefox /
  // Edge) are glossary proper nouns; the in-browser combined title keys
  // with the brand vocabulary raw inside the value.
  'workbench.settings.backendDetails.device.laptop': 'Laptop',
  'workbench.settings.backendDetails.device.desktop': 'Desktop',
  'workbench.settings.backendDetails.device.workstation': 'Workstation',
  'workbench.settings.backendDetails.device.localServer': 'Lokaler Server',
  'workbench.settings.backendDetails.device.remoteServer': 'Entfernter Server',
  'workbench.settings.backendDetails.device.yourDevice': 'Dein Gerät',
  'workbench.settings.backendDetails.inBrowserTitle': 'Open Headers — Chrome / Edge / Firefox',

  // ── Git pane (workspace-tree binding card, GIT_PLAN.md §9) ─────────
  'workbench.settings.gitPane.notBound.title': 'Kein Ordner gebunden',
  'workbench.settings.gitPane.notBound.body':
    'Binde diesen Arbeitsbereich an einen Ordner, um einen lebenden YAML-Baum jeder Regel, Anfrage und ' +
    'Umgebung zu führen — bereit für Backups, Diffs, Handänderungen und (bald) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Absoluter Ordnerpfad',
  'workbench.settings.gitPane.chooseFolder': 'Ordner wählen…',
  'workbench.settings.gitPane.bindButton': 'Ordner binden',
  'workbench.settings.gitPane.bound': 'Ordner gebunden.',
  'workbench.settings.gitPane.boundInitialized': 'Ordner als neuer Arbeitsbereich-Baum initialisiert.',
  'workbench.settings.gitPane.boundTitle': 'Gebundener Ordner',
  'workbench.settings.gitPane.boundBody':
    'Änderungen materialisieren fortlaufend in diesen Ordner; Änderungen an den Dateien landen zurück in der ' + 'App.',
  'workbench.settings.gitPane.unbindButton': 'Lösen',
  'workbench.settings.gitPane.unbindConfirm.title': 'Diesen Ordner lösen?',
  'workbench.settings.gitPane.unbindConfirm.body':
    'Der Ordner bleibt ein gültiger Arbeitsbereich-Baum auf der Platte; die App hört nur auf, ihn zu lesen ' +
    'und zu schreiben.',
  'workbench.settings.gitPane.unbindConfirm.ok': 'Lösen',
  'workbench.settings.gitPane.unbound': 'Ordner gelöst.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Datei ließ sich nicht lesen und bleibt unangetastet',
      other: '{count} Dateien ließen sich nicht lesen und bleiben unangetastet',
    }),
  'workbench.settings.gitPane.refusal.locked':
    'Dieser Ordner ist bereits an eine andere laufende Engine gebunden (Prozess {pid}).',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'Dieser Ordner enthält einen Arbeitsbereich, der auf diesem Host bereits über eine andere Quelle ' + 'existiert.',
  'workbench.settings.gitPane.refusal.identityMismatch':
    'Dieser Ordner gehört zu einem anderen Arbeitsbereich ({uid}).',
  'workbench.settings.gitPane.refusal.invalidManifest':
    'Die workspace.yaml des Ordners ließ sich nicht lesen: {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'Dieser Arbeitsbereich ist bereits an einen Ordner gebunden.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'Kein aktiver Arbeitsbereich zum Binden.',
  'workbench.settings.gitPane.git.title': 'Git',
  'workbench.settings.gitPane.git.missing.title': 'Git ist nicht installiert',
  'workbench.settings.gitPane.git.missing.body':
    'Installiere git, um die Historie dieses Ordners zu committen. Alles andere funktioniert auch ohne ' + 'weiter.',
  'workbench.settings.gitPane.git.belowFloor.body':
    'Das installierte git ({version}) ist zu alt für diese Funktion. Aktualisiere git, um Commits zu ' + 'aktivieren.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} nicht committete Änderung',
      other: '{count} nicht committete Änderungen',
    }),
  'workbench.settings.gitPane.git.clean': 'Arbeitsbaum sauber',
  'workbench.settings.gitPane.git.indexBusy':
    'Auto-Commit pausiert, solange dein eigener git-Index vorgemerkte Änderungen hat.',
  'workbench.settings.gitPane.git.messagePlaceholder': 'Commit-Nachricht',
  'workbench.settings.gitPane.git.commitButton': 'Committen',
  'workbench.settings.gitPane.git.committed': '{sha} committet.',
  'workbench.settings.gitPane.git.nothingToCommit': 'Nichts zu committen — der Baum entspricht dem letzten Commit.',
  'workbench.settings.gitPane.git.commitFailed': 'Commit fehlgeschlagen: {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': 'Auto-Commit',
  'workbench.settings.gitPane.git.cadenceOff': 'Aus — manuell committen',
  'workbench.settings.gitPane.git.cadenceAuto': 'Nach ruhigen Änderungen',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'Wenn der Fokus die App verlässt',
  'workbench.settings.gitPane.git.cadenceEvery': 'Alle {minutes} Minuten',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'git-Hooks umgehen (--no-verify)',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'Engine-Commits überspringen deine pre-commit- und commit-msg-Hooks, solange dies an ist.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}: synchron',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}: {ahead} voraus, {behind} zurück',
  'workbench.settings.gitPane.git.noUpstream':
    'Kein Remote konfiguriert — füge eines mit git remote add hinzu und pushe mit git push -u, um Pull zu ' +
    'aktivieren.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': '{sha} gemergt.',
  'workbench.settings.gitPane.git.upToDate': 'Bereits aktuell.',
  'workbench.settings.gitPane.git.pullFailed': 'Pull fehlgeschlagen: {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': '{sha} gepusht.',
  'workbench.settings.gitPane.git.nothingToPush': 'Nichts zu pushen — bereits synchron.',
  'workbench.settings.gitPane.git.pushFailed': 'Push fehlgeschlagen: {detail}',
  'workbench.settings.gitPane.git.pushRejected': 'Das Remote hat neue Commits — pulle zuerst und pushe dann erneut.',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'Kein Push-Zugriff',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'Dieses Remote ist für dich schreibgeschützt. Deine Commits bleiben lokal; du kannst sie als neuen ' +
    'Branch veröffentlichen und bei deinem git-Host einen Merge-Request eröffnen.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'neuer-branch-name',
  'workbench.settings.gitPane.git.exportBranchButton': 'Als neuen Branch pushen',
  'workbench.settings.gitPane.git.exportedBranch': 'Branch {branch} gepusht.',
  'workbench.settings.gitPane.git.autoPushLabel': 'Nach jedem Commit pushen',
  'workbench.settings.gitPane.git.branch.title': 'Branches',
  'workbench.settings.gitPane.git.branch.current': 'Auf Branch {branch}',
  'workbench.settings.gitPane.git.branch.detached':
    'Detached HEAD — lege einen Branch an, um diese Historie zu behalten.',
  'workbench.settings.gitPane.git.branch.switchLabel': 'Wechseln zu',
  'workbench.settings.gitPane.git.branch.switched': 'Zu {branch} gewechselt.',
  'workbench.settings.gitPane.git.branch.switchFailed': 'Wechsel fehlgeschlagen: {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': 'Du hast nicht committete Änderungen',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Committe, stashe oder verwirf {count} nicht committete Änderung, bevor du zu {branch} wechselst.',
        other: 'Committe, stashe oder verwirf {count} nicht committete Änderungen, bevor du zu {branch} wechselst.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'Committen und wechseln',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'Stashen und wechseln',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': 'Änderungen verwerfen',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': 'Nicht committete Änderungen verwerfen?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    'Jede nicht committete Änderung wird gelöscht, neue Dateien eingeschlossen. Das lässt sich nicht ' +
    'rückgängig machen.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': 'Verwerfen',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'neuer-branch-name',
  'workbench.settings.gitPane.git.branch.createButton': 'Anlegen & wechseln',
  'workbench.settings.gitPane.git.branch.created': 'Branch {branch} angelegt.',
  'workbench.settings.gitPane.git.branch.createFailed': 'Branch ließ sich nicht anlegen: {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': 'In den aktuellen mergen',
  'workbench.settings.gitPane.git.branch.mergeButton': 'Mergen',
  'workbench.settings.gitPane.git.branch.merged': '{sha} gemergt.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': 'Bereits aktuell.',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'Merge fehlgeschlagen: {detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'Die Remote-Historie wurde umgeschrieben',
  'workbench.settings.gitPane.git.forcePush.body':
    'Der Remote-Branch enthält die zuletzt synchronisierte Historie ({sha}) nicht mehr. Wähle, wie es ' +
    'weitergeht — nichts ändert sich, bis du entscheidest.',
  'workbench.settings.gitPane.git.forcePush.abandon': 'Lokale Änderungen aufgeben',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': 'Lokale Änderungen aufgeben?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    'Lokale Commits seit der letzten Synchronisierung werden verworfen, und die umgeschriebene ' +
    'Remote-Historie wird der Arbeitsbereich-Zustand.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': 'Aufgeben',
  'workbench.settings.gitPane.git.forcePush.rescue': 'Auf einem Rettungs-Branch bewahren',
  'workbench.settings.gitPane.git.forcePush.reapply': 'Obendrauf neu anwenden',
  'workbench.settings.gitPane.git.forcePush.resolved': 'Umgeschriebene Historie übernommen ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': 'Lokale Historie auf {branch} bewahrt.',
  'workbench.settings.gitPane.git.forcePush.failed': 'Ließ sich nicht auflösen: {detail}',
  'workbench.settings.gitPane.git.history.title': 'Verlauf',
  'workbench.settings.gitPane.git.history.show': 'Verlauf anzeigen',
  'workbench.settings.gitPane.git.history.hide': 'Ausblenden',
  'workbench.settings.gitPane.git.history.empty': 'Noch keine Commits.',
  'workbench.settings.gitPane.git.history.loadFailed': 'Verlauf konnte nicht gelesen werden: {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': 'Co-Autoren: {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': 'Verlauf — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'Noch keine Commits, die diese Datei berühren.',
} as const satisfies Catalog;
