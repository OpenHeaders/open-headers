/**
 * Workbench settings — the setting-definition corpus for the app-side
 * categories — German. Extends the de register contract
 * (`de/shared.ts`). Mirrors `catalogs/en/workbench-settings-defs.ts`
 * key for key. Brand and platform vocabulary (Chrome / Firefox /
 * Edge, font names, window titles) rides raw per the S48
 * settings-station decisions; `declarativeNetRequest`, `url-filter`,
 * `Cache-Control: no-cache`, `{{ns.X}}` references, INVALID_ARGUMENT
 * and IP/port literals are wire tokens. The workspaceLayout section
 * quotes the de devpanel-defs twins verbatim (Blocksatz, Gestapelt,
 * Dynamisch, …); merge strategies quote the de import-export mints
 * („als neu hinzufügen“ / „Bestehendes ersetzen“); `Diese Seite`
 * quotes the de popup tab name; Debug-Modus / Reichweite follow the
 * de debug vocabulary. MINTS: die Kulisse bleibt aus — none beyond
 * the shared register; theme variant names (Warm / Rose / Sepia /
 * Dim / Midnight / Forest / Arctic) ride raw as palette proper
 * names.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.nmAutoJoin.label': 'Automatisch mit der Desktop-App koppeln',
  'workbench.settings.def.backend.nmAutoJoin.description':
    'Wenn die Desktop-App von Open Headers auf diesem Computer läuft, wird ohne Kopplungscode verbunden — die ' +
    'Desktop-App verifiziert diesen Browser über das Betriebssystem, bevor sie Zugriff gewährt. Deaktiviere ' +
    'die Option, um nur per expliziter Geste zu koppeln.',
  'workbench.settings.def.backend.nmAutoJoinProbe.label': 'Im Hintergrund nach der Desktop-App suchen',
  'workbench.settings.def.backend.nmAutoJoinProbe.description':
    'Ohne verbundene Desktop-App wird etwa alle zwei Minuten geprüft, ob eine installiert wurde, damit sich eine ' +
    'frische Installation von selbst verbindet. Deaktiviere die Option, um nur beim Start der Erweiterung zu prüfen.',
  'workbench.settings.def.backend.requireNmIdentity.label': 'Verifizierte Kopplung mit der Desktop-App erzwingen',
  'workbench.settings.def.backend.requireNmIdentity.description':
    'Lehnt Kopplungscodes und eingefügte Token für die Desktop-App auf diesem Computer ab — nur der vom Betriebssystem verifizierte Austausch kann ihr Zugriff gewähren. Entfernte Back-ends sind nicht betroffen. Wird üblicherweise durch eine Organisationsrichtlinie gesetzt.',
  'workbench.settings.def.backend.allowDesktopWatch.label': 'Desktop-App darf diesen Browser einsehen',
  'workbench.settings.def.backend.allowDesktopWatch.description':
    'Erlaubt einer gekoppelten Desktop-App auf diesem Computer, den Netzwerkverkehr, den Speicher und die Konsole ' +
    'dieses Browsers in ihrem Traffic-Panel zu beobachten. Deaktiviert bleiben Regeln und Synchronisierung aktiv, ' +
    'während die Live-Ansichten des Desktops höflich abgelehnt werden.',
  'workbench.settings.def.backend.bindAddress.label': 'Mit Geräten in deinem Netzwerk synchronisieren',
  'workbench.settings.def.backend.bindAddress.description':
    'Erlaubt anderen Computern und Browsern im selben Netzwerk, sich mit dieser App zu verbinden und ihre ' +
    'Arbeitsbereiche zu teilen. Standardmäßig aus — nur dieser Computer erreicht sie.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'Nur Loopback (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description':
    'Nur diese Maschine kann sich verbinden. Standard.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'Alle Schnittstellen (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    'Andere Geräte im lokalen Netzwerk können sich verbinden. Erfordert den Auth-Token aus U3.2.',
  'workbench.settings.def.backend.bindPort.label': 'Back-end-Port',
  'workbench.settings.def.backend.bindPort.description':
    'Der Port, den diese App bindet, damit sich Browser und andere Geräte verbinden können. Ändere ihn nur, ' +
    'wenn etwas anderes den Standard schon belegt. Clients müssen auf denselben Port zeigen.',
  'workbench.settings.def.backend.serveWebApp.label': 'Die Web-App ausliefern',
  'workbench.settings.def.backend.serveWebApp.description':
    'Liefert den Arbeitsbereich-Editor als Webseite auf dem Back-end-Port aus, sodass ihn ein Browser-Tab ' +
    'direkt aus dieser App öffnen kann — ohne Erweiterung. Wer den Port erreicht, sieht die Anmeldesperre; ' +
    'für den Datenzugriff bleibt ein gekoppelter Token erforderlich.',
  'workbench.settings.def.backend.allowLocalPeerExecute.label':
    'Browsern dieses Geräts das Senden von Anfragen erlauben',
  'workbench.settings.def.backend.allowLocalPeerExecute.description':
    'Lässt gekoppelte Browser auf DIESER Maschine API-Anfragen über diese App senden — die Erweiterung ' +
    'nutzt sie als Anfrage-Engine, ihr Workbench-Senden läuft also hier. Standardmäßig an: Die Kopplung ist ' +
    'die Zustimmung. Jedes Senden erfordert weiterhin Schreibzugriff auf den Arbeitsbereich.',
  'workbench.settings.def.backend.allowRemotePeerExecute.label':
    'Anderen verbundenen Geräten das Senden von Anfragen erlauben',
  'workbench.settings.def.backend.allowRemotePeerExecute.description':
    'Lässt gekoppelte Geräte auf ANDEREN Maschinen API-Anfragen über diese App senden — ihr ' +
    'Workbench-Senden läuft auf dieser Maschine, mit deren Netzwerkzugang und Adresse. Standardmäßig aus: ' +
    'eine Betreiber-Entscheidung, niemals durch die Kopplung impliziert. Jedes Senden erfordert weiterhin ' +
    'Schreibzugriff auf den Arbeitsbereich.',
  'workbench.settings.def.backend.reconnectDelayMs.label': 'Anfängliche Wiederverbindungs-Verzögerung',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    'Wie lange (ms) nach einer Trennung bis zum ersten Wiederverbindungsversuch gewartet wird.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': 'Maximale Wiederverbindungs-Verzögerung',
  'workbench.settings.def.backend.maxReconnectDelayMs.description':
    'Obergrenze (ms) für das exponentielle Backoff zwischen Wiederverbindungsversuchen.',
  'workbench.settings.def.backend.pingIntervalMs.label': 'Keep-alive-Intervall',
  'workbench.settings.def.backend.pingIntervalMs.description':
    'Wie oft (ms) ein Ping gesendet wird, damit der WebSocket hinter strikten Proxys offen bleibt.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': 'Badge bei getrennter Verbindung',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    'Zeigt ein rotes Badge auf dem Toolbar-Icon, wenn die Verbindung zum Back-end unten ist.',
  'workbench.settings.def.backend.showDiagrams.label': 'Back-end-Diagramme anzeigen',
  'workbench.settings.def.backend.showDiagrams.description':
    'Zeigt die illustrierten Stufen- und Datenfluss-Tafeln in den Back-end-Einstellungen.',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': 'MCP-Server aktivieren',
  'workbench.settings.def.mcp.enabled.description':
    'Beantwortet MCP-Clients auf dem Back-end-Port dieser App. Solange aus, existiert der Endpunkt nicht. An ' +
    'können Agents mit einem Zugriffstoken deine Arbeitsbereiche lesen.',
  'workbench.settings.def.mcp.allowObserve.label': 'Traffic-Beobachtung erlauben',
  'workbench.settings.def.mcp.allowObserve.description':
    'Agents können den Live-Traffic der Quellen lesen, die du im Traffic-Panel erfasst. Nicht erfasste Quellen ' +
    'bleiben unsichtbar; Auth-Header, Cookies und tokenförmige Werte werden durch stabile Marker ersetzt.',
  'workbench.settings.def.mcp.allowWrite.label': 'Schreib-Tools erlauben',
  'workbench.settings.def.mcp.allowWrite.description':
    'Agents können Regeln, Anfragen, Umgebungen, Variablen und Workflows anlegen, bearbeiten und löschen. ' +
    'Jede Änderung landet im Aktivitäts-Feed und lässt sich zurücknehmen.',
  'workbench.settings.def.mcp.allowExecute.label': 'Ausführungs-Tools erlauben',
  'workbench.settings.def.mcp.allowExecute.description':
    'Agents können gespeicherte Anfragen senden und Workflows ausführen — echter Netzwerkverkehr verlässt in ' +
    'ihrem Auftrag diese Maschine.',
  'workbench.settings.def.mcp.allowSecrets.label': 'Secret-Offenlegung erlauben',
  'workbench.settings.def.mcp.allowSecrets.description':
    'Agents können vault-Secret-Werte im Klartext lesen. Solange aus, bleibt jedes Secret maskiert.',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': 'Sprache',
  'workbench.settings.def.general.language.description':
    'Anzeigesprache der Oberfläche. Gilt sofort für jede offene Oberfläche — kein Neuladen. Technisches ' +
    'Vokabular (Header-Namen, HTTP-Methoden, Protokollbegriffe) bleibt in jeder Sprache Englisch.',
  'workbench.settings.def.general.language.option.auto.label': 'System folgen',
  'workbench.settings.def.general.language.option.auto.description':
    'Der Sprache deines Browsers oder Betriebssystems entsprechen',
  'workbench.settings.def.general.language.option.pseudo.description':
    'Akzentuiertes, gedehntes Englisch zum Aufspüren unübersetzter oder abgeschnittener Texte',
  'workbench.settings.def.general.confirmOnDelete.label': 'Vor dem Löschen bestätigen',
  'workbench.settings.def.general.confirmOnDelete.description':
    'Zeigt einen Bestätigungsdialog, bevor Regeln, Ordner oder Sammlungen gelöscht werden.',
  'workbench.settings.def.general.showEmptyStateHints.label': 'Hinweise in leeren Ansichten anzeigen',
  'workbench.settings.def.general.showEmptyStateHints.description':
    'Rendert Anleitungen und Tipps in leeren Panels und Onboarding-Bereichen.',
  'workbench.settings.def.terminal.profiles.label': 'Profile',
  'workbench.settings.def.terminal.profiles.description':
    'Shells, mit denen das Terminal einen Tab öffnen kann. Einfache neue Tabs nutzen den Standard; der Pfeil ' +
    'neben + in der Tab-Zeile wählt ein bestimmtes Profil.',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': 'Schließen bei laufendem Prozess bestätigen',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    'Fragt nach, bevor ein Terminal-Tab geschlossen wird, dessen Shell noch einen laufenden Prozess hat. ' +
    'Untätige Shells schließen immer still.',
  'workbench.settings.def.terminal.startDirectory.label': 'Startverzeichnis',
  'workbench.settings.def.terminal.startDirectory.description':
    'Verzeichnis, in dem neue Terminal-Tabs starten. Ein Profil mit eigenem Verzeichnis hat Vorrang; leer ' +
    'bedeutet dein Benutzerverzeichnis. Gilt für den nächsten geöffneten Tab.',
  'workbench.settings.def.terminal.defaultTabName.label': 'Standard-Tab-Name',
  'workbench.settings.def.terminal.defaultTabName.description':
    'Name für Terminal-Tabs, die ohne Profil geöffnet und nicht umbenannt wurden. Leer verwendet „Local“. ' +
    'Mehrere Tabs mit demselben Namen bleiben nummeriert.',
  'workbench.settings.def.terminal.fontFamilyPreset.label': 'Schriftart',
  'workbench.settings.def.terminal.fontFamilyPreset.description':
    'Schrift für den Terminaltext. Die Voreinstellungen liegen der App bei oder nutzen Schriften, die jedes ' +
    'Betriebssystem mitbringt.',
  'workbench.settings.def.terminal.fontSize.label': 'Schriftgröße',
  'workbench.settings.def.terminal.fontSize.description': 'Größe des Terminaltexts in Pixeln.',
  'workbench.settings.def.terminal.lineHeight.label': 'Zeilenhöhe',
  'workbench.settings.def.terminal.lineHeight.description':
    'Zeilenabstand als Vielfaches der Schriftgröße. 1 ist der natürliche Abstand der Schrift.',
  'workbench.settings.def.terminal.cursorStyle.label': 'Cursorform',
  'workbench.settings.def.terminal.cursorStyle.description': 'Wie der Terminal-Cursor gezeichnet wird.',
  'workbench.settings.def.terminal.cursorStyle.option.block.label': 'Block',
  'workbench.settings.def.terminal.cursorStyle.option.underline.label': 'Unterstrich',
  'workbench.settings.def.terminal.cursorStyle.option.bar.label': 'Senkrechter Strich',
  'workbench.settings.def.terminal.cursorBlink.label': 'Cursor blinken lassen',
  'workbench.settings.def.terminal.cursorBlink.description': 'Lässt den Terminal-Cursor blinken.',
  'workbench.settings.def.terminal.minimumContrastRatio.label': 'Minimales Kontrastverhältnis',
  'workbench.settings.def.terminal.minimumContrastRatio.description':
    'Passt Textfarben an, bis sie diesen Kontrast zum Hintergrund erreichen. 1 lässt die Farben unverändert; ' +
    '4,5 erfüllt WCAG AA; 21 erzwingt maximalen Kontrast.',
  'workbench.settings.def.terminal.scrollback.label': 'Scrollback-Puffer',
  'workbench.settings.def.terminal.scrollback.description':
    'Wie viele Zeilen das Terminal oberhalb des sichtbaren Bildschirms behält. Höhere Werte verbrauchen mehr ' +
    'Speicher pro Tab.',
  'workbench.settings.def.terminal.macOptionIsMeta.label': 'Option als Meta-Taste verwenden',
  'workbench.settings.def.terminal.macOptionIsMeta.description':
    'Behandelt die Option-Taste unter macOS als Meta, damit Kürzel wie Option+B die Zeilenbearbeitung der ' +
    'Shell erreichen, statt Sonderzeichen einzugeben.',
  'workbench.settings.def.terminal.copyOnSelect.label': 'Beim Auswählen kopieren',
  'workbench.settings.def.terminal.copyOnSelect.description':
    'Kopiert ausgewählten Terminaltext sofort bei der Auswahl in die Zwischenablage.',
  'workbench.settings.def.terminal.hyperlinks.label': 'Links hervorheben',
  'workbench.settings.def.terminal.hyperlinks.description':
    'Erkennt URLs in der Terminalausgabe und öffnet sie per Klick im Browser.',
  'workbench.settings.def.terminal.audibleBell.label': 'Akustisches Signal',
  'workbench.settings.def.terminal.audibleBell.description':
    'Spielt einen kurzen Piepton, wenn ein Programm die Terminalglocke auslöst.',
  'workbench.settings.def.terminal.closeTabOnExit.label': 'Tab beim Beenden der Shell schließen',
  'workbench.settings.def.terminal.closeTabOnExit.description':
    'Schließt den Terminal-Tab, sobald seine Shell endet. Ausgeschaltet bleibt der Tab mit einer ' +
    'Neustart-Schaltfläche geöffnet.',
  'workbench.settings.def.general.restoreTabsOnStartup.label': 'Tabs beim Start wiederherstellen',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    'Öffnet die Editor-Tabs wieder, die am Ende der vorherigen Sitzung offen waren.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': 'Umgebungswechsel bei Sammlungen',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    'Wie sich die aktive Umgebung ändert, während du dich zwischen Sammlungen und den Entitäten darin ' +
    '(Regeln, Anfragen, Ordnern) bewegst. Gilt für Regel-Sammlungen wie für API-Anfrage-Sammlungen. ' +
    'Sammlungen können eine Standard-Umgebung tragen und eine kurze Liste empfohlener Umgebungen anheften; ' +
    'diese Einstellung steuert, ob diese Standards automatisch übernehmen.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': 'Gewählte Umgebung behalten',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    'Was du ausgewählt hast (auch keine Umgebung), bleibt ausgewählt, während du zwischen Sammlungen und ' +
    'ihren Unterordnern, Regeln oder Anfragen navigierst. Der Standard einer Sammlung gilt nur, wenn keine ' +
    'Umgebung ausgewählt ist.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label': 'Sammlungs-Standards anwenden',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    'Der Standard einer Sammlung übernimmt, solange du in ihr bist (oder in einem Unterordner, einer Regel ' +
    'oder Anfrage darin). Deine letzte manuelle Wahl ist die Basis-Umgebung — sie kehrt zurück, sobald du ' +
    'eine Sammlung verlässt oder eine ohne Standard betrittst. Kein Gedächtnis pro Sammlung.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': 'Jeder Sammlung folgen',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    'Das Öffnen einer Sammlung (oder eines Unterordners, einer Regel oder Anfrage darin) mit ' +
    'Standard-Umgebung wechselt zu diesem Standard. Deine Auswahl innerhalb einer Sammlung wird für diese ' +
    'Sammlung gemerkt. Sammlungen ohne Standard wechseln nicht automatisch.',
  'workbench.settings.def.general.settingsOpenMode.label': 'Öffnungsmodus der Einstellungen',
  'workbench.settings.def.general.settingsOpenMode.description':
    'Wie sich die Einstellungsseite öffnet, wenn sie aus Toolbar, Popup oder Befehlspalette gestartet wird.',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'Modal',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description':
    'Overlay zentriert über der aktuellen Seite',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'Modal (maximiert)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    'Overlay, das den Großteil des Viewports füllt',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': 'Editor-Tab',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    'Als vollwertiger Editor-Tab im Arbeitsbereich öffnen',
  'workbench.settings.def.general.settingsShowCategoryLabels.label':
    'Kategorienamen in der Einstellungs-Seitenleiste anzeigen',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    'Rendert Textbeschriftungen neben den Kategorie-Icons in der Einstellungs-Seitenleiste. Rechtsklick auf ' +
    'die Seitenleiste schaltet um. Deaktivieren für eine kompakte Leiste nur mit Icons.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'Farb-Theme',
  'workbench.settings.def.appearance.theme.description': 'Steuert das gesamte Farb-Theme der App.',
  'workbench.settings.def.appearance.theme.option.light.label': 'Hell',
  'workbench.settings.def.appearance.theme.option.dark.label': 'Dunkel',
  'workbench.settings.def.appearance.theme.option.auto.label': 'System folgen',
  'workbench.settings.def.appearance.theme.option.auto.description': 'Deinem Betriebssystem entsprechen',
  'workbench.settings.def.appearance.lightVariant.label': 'Variante des hellen Themes',
  'workbench.settings.def.appearance.lightVariant.description': 'Palette, wenn das aufgelöste Farb-Theme hell ist.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'Standard',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    'Ausgewogenes, neutrales helles Theme für den Alltag.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'Hoher Kontrast',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    'Maximale Lesbarkeit — rein weiße Flächen, fast schwarzer Text, AAA-Kontrast.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    'Papierartige Flächen mit warmen Neutraltönen und Bernstein-Akzent — augenschonender bei langen ' + 'Sitzungen.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Kühl',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'Schieferblau getöntes helles Theme — klare Flächen mit Stahlblau-Akzent.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'Sanft errötete Flächen mit Magenta-Akzent — milde Wärme ohne den Bernsteinton von Warm.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    'Gesättigte Pergament-Palette mit tiefbraunem Text — die am stärksten getönte helle Variante, ideal für ' +
    'langes Lesen.',
  'workbench.settings.def.appearance.darkVariant.label': 'Variante des dunklen Themes',
  'workbench.settings.def.appearance.darkVariant.description': 'Palette, wenn das aufgelöste Farb-Theme dunkel ist.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'Standard',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    'Ausgewogenes, neutrales dunkles Theme für den Alltag.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'Hoher Kontrast',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    'Maximale Lesbarkeit — echt schwarze Flächen, heller Text, AAA-Kontrast.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    'Weiche schieferblaue Flächen mit weniger Blendung — augenschonender in dunkler Umgebung.',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    'Tiefe Marineflächen mit leuchtend blauem Akzent — satter und gesättigter als Dim.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'Grün getönte dunkle Flächen mit Smaragd-Akzent — ruhige, pflanzliche Palette.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    'Kühles blaugraues dunkles Theme mit frostigem Cyan-Akzent — flacher und weniger gesättigt als Dim oder ' +
    'Midnight.',
  'workbench.settings.def.appearance.uiScale.label': 'UI-Skalierung',
  'workbench.settings.def.appearance.uiScale.description':
    'Skaliert das gesamte Chrome — Buttons, Text, Abstände, Bedienelemente — ohne die Schriftgröße des ' +
    'Editors zu ändern.',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': 'Winzig (70 %)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    'Dichtestes Layout — nützlich zusammen mit der UI-Schrift Press Start 2P, die ungewöhnlich hoch und ' +
    'breit rendert.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'Kompakt (80 %)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    'Engeres Chrome, das trotzdem bequeme Klickziele behält.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': 'Klein (90 %)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    'Etwas enger als der Standard — mehr passt auf den Bildschirm.',
  'workbench.settings.def.appearance.uiScale.option.1.label': 'Normal (100 %)',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'Standardgröße des Chromes.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': 'Groß (110 %)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': 'Leicht vergrößert für leichteres Lesen.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': 'Sehr groß (125 %)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description':
    'Maximale Chrome-Skalierung — am besten für Barrierefreiheit.',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'UI-Schriftfamilie',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    'Kuratierte Sans-Serif-Stapel für das App-Chrome. Standard ist Inter auf Windows / Linux für ' +
    'plattformübergreifende Einheitlichkeit und System Sans auf macOS, um das native optische Sizing von SF ' +
    'Pro zu behalten. Jede Option liegt der Erweiterung bei. Editor-Oberflächen haben ihre eigene ' +
    'Schrift-Einstellung.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    'Mitgelieferte UI-Sans, für Bildschirme entworfen — rendert auf jedem Betriebssystem identisch, die App ' +
    'sieht also auf macOS, Windows und Linux gleich aus.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    'Standard-UI-Sans des Betriebssystems — San Francisco auf macOS, Segoe UI auf Windows, Roboto auf Linux. ' +
    'Nutze sie, wenn du den nativen Look der plattformübergreifenden Einheitlichkeit vorziehst.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    'Sans für Lesbarkeit bei Sehschwäche entworfen — markante Buchstabenformen verringern ' +
    'Zeichenverwechslungen. Mitgeliefert — immer verfügbar.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    'Monospace-UI passend zur eingebauten Terminal-Schrift — ein Entwicklertool-Look im ganzen Chrome. ' +
    'Mitgeliefert — immer verfügbar.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    'Die Pixel-Display-Schrift, die wir mit der App ausliefern. Mitgeliefert — immer verfügbar. Eine ' +
    'Spielerei: lesbar, aber hoch und breit; Chrome-Abstände wirken großzügig.',
  'workbench.settings.def.appearance.density.label': 'UI-Dichte',
  'workbench.settings.def.appearance.density.description':
    'Der Kompaktmodus verringert die Abstände in Listen, Tabellen und Formularen.',
  'workbench.settings.def.appearance.density.option.comfortable.label': 'Komfortabel',
  'workbench.settings.def.appearance.density.option.compact.label': 'Kompakt',
  'workbench.settings.def.appearance.editorHeaderPosition.label': 'Position des Editor-Kopfbereichs',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    'Wo jeder Editor seine Titel-und-Aktionen-Zeile andockt (Name, Aktiviert-Schalter, Speichern). Unten ' +
    'hält den oberen Rand des Editors leichter und die Hauptaktionen nah am Inhalt, den du bearbeitest.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': 'Oben',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    'Klassische Platzierung über dem Editor-Inhalt.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': 'Unten',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    'Unter dem Editor-Inhalt angedockt, über der Statusleiste.',
  'workbench.settings.def.appearance.clockFormat.label': 'Uhrzeitformat',
  'workbench.settings.def.appearance.clockFormat.description':
    'Wie Zeitstempel in der App gerendert werden (Benachrichtigungen, Protokolle). Explizit, weil die ' +
    'Browser-Locale der Browser-Sprache folgt, nicht deinem System-Regionsformat.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24 Stunden',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12 Stunden',
  'workbench.settings.def.appearance.accentColor.label': 'Akzentfarbe',
  'workbench.settings.def.appearance.accentColor.description':
    'Die Primärfarbe für Buttons, Links und aktive Hervorhebungen. Gilt nur für die Standard-Varianten — ' +
    'Hochkontrast- und getönte Varianten legen ihren eigenen Akzent fest.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'Version in der Fußzeile anzeigen',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    'Zeigt die Versionsnummer der Erweiterung in der Statusleiste des Arbeitsbereichs.',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': 'Theme-Umschalter in der Fußzeile anzeigen',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    'Zeigt das Dropdown für das helle/dunkle/automatische Theme in der Statusleiste des Arbeitsbereichs.',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label':
    'Panel-Umschalter in der oberen Leiste anzeigen',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'Zeigt die Umschalt-Icons für das linke / untere / rechte Panel in der oberen Leiste des ' + 'Arbeitsbereichs.',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': 'Layout-Menü in der oberen Leiste anzeigen',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    'Zeigt das Layout-Dropdown (unteres Panel in voller Breite, Werkzeugfenster-Namen, Layout der ' +
    'Aktivitätsleiste) in der oberen Leiste des Arbeitsbereichs.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': 'Ausrichtung des unteren Panels',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    'Wo das untere Panel in der Shell sitzt. Links/rechts richtet es unter einer Seitenleiste + dem Editor ' +
    'aus; zentriert verschachtelt es in der mittleren Spalte; Blocksatz umspannt den vollen Viewport.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': 'Zentriert',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    'Unteres Panel in der mittleren Spalte verschachtelt',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': 'Links',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    'Unteres Panel umspannt linke Seitenleiste + Editor',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': 'Rechts',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    'Unteres Panel umspannt Editor + rechte Seitenleiste',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': 'Blocksatz',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    'Unteres Panel umspannt die volle Viewport-Breite',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.label': 'Aufteilung des unteren Panels',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.description':
    'Wie sich zwei geöffnete untere Docks das untere Panel teilen: nebeneinander oder übereinander.',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.label': 'Nebeneinander',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.description':
    'Untere Docks liegen nebeneinander',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.label': 'Gestapelt',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.description': 'Untere Docks liegen übereinander',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': 'Werkzeugfenster-Namen anzeigen',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    'Rendert Textbeschriftungen neben den Icons der Aktivitätsleiste und der Dock-Tabs. Deaktivieren für ' +
    'eine kompakte Shell nur mit Icons.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': 'Breite der linken Aktivitätsleiste',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    'Breite der linken Aktivitätsleiste, wenn die Werkzeugfenster-Namen sichtbar sind. Im Nur-Icons-Modus ' +
    'auf 36px festgelegt.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': 'Breite der rechten Aktivitätsleiste',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    'Breite der rechten Aktivitätsleiste, wenn die Werkzeugfenster-Namen sichtbar sind. Im Nur-Icons-Modus ' +
    'auf 36px festgelegt.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': 'Layout der Aktivitätsleiste',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    'Wie die Aktivitätsleiste die obere und untere Werkzeugfenster-Gruppe aufteilt.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': 'Proportional',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    'Obere und untere Gruppe teilen sich die Aktivitätsleiste 50/50',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'Kompakt',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    'Obere Gruppe passt sich dem Inhalt an; untere unten fixiert',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': 'Gestapelt',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'Alle Gruppen oben gebündelt, mit Teilern dazwischen',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': 'Dynamisch',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'Chip-Gruppen spiegeln die Höhen ihrer angrenzenden Panels. Geschlossene Docks kollabieren auf den ' +
    'Inhalt, und aktive Nachbarn nehmen den Platz auf.',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'Debug-Modus',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'Inspiziere und verändere Anfragen mit derselben Tiefe wie die eingebauten Entwicklertools deines ' +
    'Browsers — Seitenladevorgänge, Worker und iframes, nicht nur Fetches auf Seitenebene. Der Browser zeigt ' +
    'auf jedem angehängten Tab ein Debug-Banner, solange dies an ist; in Chrome und Edge ist es ' +
    'standardmäßig an, und du kannst es jederzeit ausschalten.',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'Der Debug-Modus ist in Chrome und Edge verfügbar.',
  'workbench.settings.def.inspection.cdpScope.label': 'An welche Tabs anhängen',
  'workbench.settings.def.inspection.cdpScope.description':
    'An welche Tabs sich der Debug-Modus anhängt, solange er an ist. „Wo DevTools offen ist“ hängt sich an ' +
    'Browser-Tabs mit geöffneten Entwicklertools. „Der fokussierte Tab“ folgt dem aktiven Browser-Tab, ohne ' +
    'dass Entwicklertools offen sein müssen — der Wechsel auf eine Neuer-Tab- oder interne Seite lässt den ' +
    'vorherigen Tab angehängt, statt hin und her zu springen. „Beides“ kombiniert die beiden. Einzelne ' +
    'Browser-Tabs lassen sich unabhängig davon aus der Fußzeile anheften.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    'Der Debug-Modus ist in Chrome und Edge verfügbar.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'Wo DevTools offen ist',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description':
    'Browser-Tabs mit geöffneten Entwicklertools.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': 'Der fokussierte Tab',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    'Der aktive Browser-Tab, dem Fokus folgend — keine Entwicklertools nötig.',
  'workbench.settings.def.inspection.cdpScope.option.both.label': 'Beides',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'DevTools-Tabs und der fokussierte Tab.',

  // ── Traffic Monitor category defs ──────────────────────────────────
  'workbench.settings.def.trafficMonitor.captureDebugDefault.label': 'Erfassungen mit Debug-Modus starten',
  'workbench.settings.def.trafficMonitor.captureDebugDefault.description':
    'Neue Erfassungen binden den Debugger des Browsers für volle Detailtreue an — Antwortinhalte und exakte ' +
    'Header. Der Browser zeigt ein Debugging-Banner auf dem Tab. Jede Start-Geste kann dies unter „Erweitert“ ' +
    'überschreiben.',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.label': 'Erfassungen im Archiv speichern',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.description':
    'Neue Erfassungen werden im verschlüsselten Sitzungsarchiv auf diesem Computer aufgezeichnet. Jede ' +
    'Start-Geste kann dies unter „Erweitert“ überschreiben.',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label':
    'Agenten lesen archivierte Sitzungen ungeschwärzt',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description':
    'Verbundene Agenten lesen archivierte Sitzungen mit echten Werten statt Schwärzungsmarkern — einschließlich ' +
    'Authentifizierungs-Headern, Cookies und token-förmigen Werten. Standardmäßig aus; solange es aktiv ist, wird ' +
    'jeder ungeschwärzte Lesezugriff im Aktivitäts-Feed protokolliert.',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label': 'Größenbudget des Sitzungsarchivs (GiB)',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description':
    'Gesamter Speicherplatz für archivierte Sitzungen. Wird das Budget überschritten, werden zuerst die ältesten ' +
    'versiegelten Sitzungen entfernt; eine noch aufzeichnende Sitzung wird nie entfernt.',
  'workbench.settings.def.trafficMonitor.railSide.label': 'Seite der Quellen',
  'workbench.settings.def.trafficMonitor.railSide.description':
    'Auf welcher Seite des Traffic-Panels die Quellenliste sitzt. Der Layout-Button in der Panel-Kopfzeile ' +
    'wechselt sie ebenfalls.',
  'workbench.settings.def.trafficMonitor.railSide.option.left.label': 'Links',
  'workbench.settings.def.trafficMonitor.railSide.option.left.description':
    'Quellenliste links, Verkehrsansichten rechts.',
  'workbench.settings.def.trafficMonitor.railSide.option.right.label': 'Rechts',
  'workbench.settings.def.trafficMonitor.railSide.option.right.description':
    'Quellenliste rechts, Verkehrsansichten links.',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'Schriftgröße',
  'workbench.settings.def.editor.fontSize.description': 'Schriftgröße in Pixeln für Editor-Oberflächen.',
  'workbench.settings.def.editor.fontFamilyPreset.label': 'Schriftfamilie',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    'Kuratierte Monospace-Stapel für den Editor. Jede Option liegt der Erweiterung bei — keine ' +
    'Systeminstallation nötig. Standard ist JetBrains Mono auf Windows / Linux für plattformübergreifende ' +
    'Einheitlichkeit und System Mono auf macOS, um das native Rendering von SF Mono zu behalten.',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'Standard-Monospace des Betriebssystems — SF Mono auf macOS, Consolas auf Windows, Liberation Mono auf ' + 'Linux.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'Monospace mit Programmier-Ligaturen. Mitgeliefert — immer verfügbar.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'Monospace für Editoren abgestimmt, mit Ligaturen. Mitgeliefert — immer verfügbar.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'Monospace mit Programmier-Ligaturen. Mitgeliefert — immer verfügbar.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Adobe-Monospace für Code abgestimmt. Mitgeliefert — immer verfügbar.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    'Die Pixel-Display-Schrift, die wir mit der App ausliefern. Mitgeliefert — immer verfügbar. Eine ' +
    'Spielerei: lesbar, aber hoch und breit.',
  'workbench.settings.def.editor.fontLigatures.label': 'Schrift-Ligaturen',
  'workbench.settings.def.editor.fontLigatures.description':
    'Aktiviert Programmier-Ligaturen — Zeichenfolgen wie `=>` oder `!=` verschmelzen zu einzelnen Glyphen. ' +
    'Erfordert eine Schrift mit Ligatur-Unterstützung (z. B. Fira Code, JetBrains Mono).',
  'workbench.settings.def.editor.lineHeight.label': 'Zeilenhöhe',
  'workbench.settings.def.editor.lineHeight.description':
    'Zeilenhöhe des Editors in Pixeln. 0 lässt den Editor eine zur Schriftgröße proportionale Zeilenhöhe ' +
    'wählen; Werte ab 8 gelten als explizite Pixel.',
  'workbench.settings.def.editor.tabSize.label': 'Tabulatorbreite',
  'workbench.settings.def.editor.tabSize.description': 'Anzahl der Spalten, die ein Tabulatorzeichen belegt.',
  'workbench.settings.def.editor.insertSpaces.label': 'Leerzeichen einfügen',
  'workbench.settings.def.editor.insertSpaces.description':
    'Fügt beim Drücken der Tabulatortaste Leerzeichen statt Tabulatorzeichen ein.',
  'workbench.settings.def.editor.wordWrap.label': 'Zeilenumbruch',
  'workbench.settings.def.editor.wordWrap.description': 'Ob lange Zeilen im Editor in die nächste Zeile umbrechen.',
  'workbench.settings.def.editor.wordWrap.option.off.label': 'Aus',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'Viewport-Breite',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': 'Feste Spalte',
  'workbench.settings.def.editor.wordWrapColumn.label': 'Umbruchspalte',
  'workbench.settings.def.editor.wordWrapColumn.description':
    'Spalte, an der Zeilen umbrechen, wenn der Zeilenumbruch auf Feste Spalte steht.',
  'workbench.settings.def.editor.lineNumbers.label': 'Zeilennummern',
  'workbench.settings.def.editor.lineNumbers.description': 'Zeigt Zeilennummern in der linken Randspalte.',
  'workbench.settings.def.editor.renderWhitespace.label': 'Leerraum darstellen',
  'workbench.settings.def.editor.renderWhitespace.description': 'Stellt Leerraumzeichen sichtbar dar.',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'Keine',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': 'Nur an Grenzen',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'Alle',
  'workbench.settings.def.editor.renderLineEnds.label': 'Zeilenenden anzeigen',
  'workbench.settings.def.editor.renderLineEnds.description':
    'Zeichnet ein dezentes ¬ hinter das letzte Zeichen jeder echten Zeile, damit weich umbrochene Zeilen ' +
    '(leere Zeilennummer, hängender Einzug, keine Marke) nie mit Zeilenumbrüchen verwechselt werden können. ' +
    'Nur Anzeige: Die Marke wird nie ausgewählt, kopiert oder gesendet.',
  'workbench.settings.def.editor.formatOnSave.label': 'Beim Speichern formatieren',
  'workbench.settings.def.editor.formatOnSave.description':
    'Formatiert Editor-Inhalte automatisch, wenn du eine Regel oder Vorlage speicherst.',
  'workbench.settings.def.editor.bracketPairColorization.label': 'Klammernpaar-Einfärbung',
  'workbench.settings.def.editor.bracketPairColorization.description':
    'Hebt zusammengehörige Klammern in unterschiedlichen Farben hervor.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.responseBodyCapMB.label': 'Antwort-Body-Grenze (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    'Wie viel von einem Antwort-Body der Executor für die Anzeige behält. Größere Bodys werden an dieser ' +
    'Grenze abgeschnitten — die volle Größe wird trotzdem gemessen und gemeldet. Eine höhere Grenze erhöht ' +
    'den Speicherverbrauch pro offenem Anfrage-Tab.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'SSE-Ereignisse: Neueste zuerst',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Reihenfolge der Server-Sent-Events-Liste — neueste Ereignisse oben. Ausschalten, um die ältesten zuerst ' +
    'zu lesen. Die Listen-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'SSE-Ereignisse: Nach Ereignisname gruppieren',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Bündelt die Server-Sent-Events-Liste unter einklappbaren Ereignisnamen-Überschriften, ' +
    'Ankunftsreihenfolge innerhalb jeder Gruppe. Die Listen-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'SSE-Ereignisse: Zeilen pro Gruppe',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    'Zeigt beim Gruppieren nach Ereignisname nur so viele der neuesten Ereignisse jeder Gruppe — das Fenster ' +
    'wandert mit neuen Ereignissen mit, sodass mehrere Gruppen zugleich beobachtbar bleiben. 0 zeigt jedes ' +
    'Ereignis. Die Listen-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'gRPC-Nachrichten: Neueste zuerst',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'Reihenfolge des gRPC-Nachrichten-Zeitverlaufs — neueste Nachrichten oben. Ausschalten, um die ältesten ' +
    'zuerst zu lesen. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'gRPC-Nachrichten: Nachrichtentypen anzeigen',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'Versieht jede Zeitverlaufszeile mit ihrem deklarierten Protobuf-Nachrichtentyp. Standardmäßig aus — die ' +
    'Typen eines rpc sind pro Richtung fest, das Richtungs-Badge unterscheidet die Zeilen also schon. Die ' +
    'Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'gRPC-Nachrichten: Nach Nachrichtentyp gruppieren',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'Bündelt den gRPC-Nachrichten-Zeitverlauf unter einklappbaren Nachrichtentyp-Überschriften, ' +
    'Ankunftsreihenfolge innerhalb jeder Gruppe. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.label': 'gRPC-Nachrichten: Nach Richtung gruppieren',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.description':
    'Bündelt den gRPC-Nachrichten-Zeitverlauf unter einklappbaren Gesendet-/Empfangen-Überschriften. ' +
    'Kombiniert mit der Gruppierung nach Nachrichtentyp erhält jedes Paar (Typ, Richtung) eine eigene ' +
    'Gruppe — nützlich bei bidirektionalen Aufrufen, deren Anfrage und Antwort denselben Nachrichtentyp ' +
    'teilen. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'gRPC-Nachrichten: Zeilen pro Gruppe',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    'Zeigt beim Gruppieren nach Nachrichtentyp nur so viele der neuesten Nachrichten jeder Gruppe — das ' +
    'Fenster wandert mit neuen Nachrichten mit, sodass mehrere Gruppen zugleich beobachtbar bleiben. 0 zeigt ' +
    'jede Nachricht. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'WebSocket-Nachrichten: Neueste zuerst',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'Reihenfolge des WebSocket-Nachrichten-Zeitverlaufs — neueste Nachrichten oben. Ausschalten, um die ' +
    'ältesten zuerst zu lesen. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.label': 'WebSocket-Nachrichten: Nach Richtung gruppieren',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.description':
    'Bündelt den WebSocket-Nachrichten-Zeitverlauf unter einklappbaren Gesendet-/Empfangen-Überschriften, ' +
    'Ankunftsreihenfolge innerhalb jeder Gruppe. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.label': 'WebSocket-Nachrichten: Nach Ereignis gruppieren',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.description':
    'Bündelt Socket.IO-Sitzungs-Zeitverläufe unter einklappbaren Überschriften mit dekodiertem ' +
    'Ereignisnamen (Steuerframes ordnen sich nach ihrer Leitungsart ein). Kombiniert mit der Gruppierung ' +
    'nach Richtung erhält jedes Paar (Ereignis, Richtung) eine eigene Gruppe. Gilt nur für ' +
    'Socket.IO-Sitzungen — rohe WebSocket-Frames tragen keine Ereignisnamen. Die Zeitverlaufs-Toolbar ' +
    'ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.label': 'WebSocket-Nachrichten: Zeilen pro Gruppe',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.description':
    'Zeigt beim Gruppieren nach Richtung nur so viele der neuesten Nachrichten jeder Gruppe — das Fenster ' +
    'wandert mit neuen Nachrichten mit, sodass beide Gruppen zugleich beobachtbar bleiben. 0 zeigt jede ' +
    'Nachricht. Die Zeitverlaufs-Toolbar ändert dieselbe Einstellung.',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'gRPC: Ungültige Nachrichten senden',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'Wenn die gRPC-Nachricht kein gültiges JSON ist, trotzdem mit leerer Nachricht aufrufen und den Server ' +
    'antworten lassen — meist INVALID_ARGUMENT. Standardmäßig aus: der Aufruf scheitert vor der Leitung mit ' +
    'dem exakten Parse-Fehler.',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': 'Regelausführung pausieren',
  'workbench.settings.def.rulesEngine.paused.description':
    'Wendet Regeln nicht mehr auf laufende Netzwerkanfragen an. Regeln bleiben bearbeitbar.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': 'Auswertungsstrategie',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    'Wie die Engine zwischen Regeln wählt, wenn mehrere auf dieselbe Anfrage passen.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': 'Erster Treffer',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    'Die erste Regel in Prioritätsreihenfolge verwenden',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': 'Genauester Treffer',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    'Die spezifischste passende Regel bevorzugen',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'Alle Treffer',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    'Jede passende Regel der Reihe nach anwenden',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': 'Update-Entprellung',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'Verzögerung (ms), bevor Regeländerungen an declarativeNetRequest übergeben werden.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': 'Maximal aktive Regeln',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    'Höchstzahl der Regeln, die gleichzeitig in den dynamischen Regelsatz kompiliert werden.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': 'Sichtbare Ressourcentypen',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    'Welche Anfrage-Ressourcentypen in der Ansicht Diese Seite des Popups erscheinen. Gesammelt wird immer ' +
    'alles; dies ändert nur, was die UI zeigt. Die Chip-Zeile im Popup schreibt in dieselbe Einstellung.',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': 'Verschattungswarnungen anzeigen',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    'Hebt Regeln hervor, deren Wirkung von einer Regel höherer Priorität verschattet wird (Blockieren, ' +
    'Umleitung, Mock, Verzögerung oder ein Header-Stapelkonflikt).',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': 'Bei großen Regelsätzen warnen',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'Zeigt eine Warnung, wenn die Zahl aktiver Regeln sich der Browser-Grenze nähert.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': 'Schwelle für große Regelsätze',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description':
    'Zahl aktiver Regeln, ab der die Warnung ausgelöst wird.',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Live-Regeln-Modus',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    'Injiziert Cache-Control: no-cache auf jeder Anfrage, die auf eine deiner Regeln passt, und erzwingt so ' +
    'eine Revalidierung beim Server, damit die Wirkung der Regel immer frisch angewendet wird. Verhindert, ' +
    'dass abgestandene Cache-Antworten eine Regel verstecken — nützlich, wenn sich der Wert einer Regel ' +
    'ändert (etwa ein Auth-Token), die Seite aber weiter die alte Antwort aus dem Cache ausliefert.',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'HTTP-Cache umgehen',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    'Fügt Cache-Control: no-cache auf jeder Anfrage des inspizierten Tabs hinzu — erzwingt eine ' +
    'Revalidierung beim Server. Gilt nur für den HTTP-Cache; das eigene Disable Cache von Chrome ' +
    '(Network-Tab) ' +
    'umgeht auch den Renderer-Speichercache. Regel-getroffene Anfragen hält der Live-Regeln-Modus ohnehin ' +
    'automatisch frisch.',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': 'Variablen-Autovervollständigung',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    'Schlägt beim Tippen `{{env.X}}`- / `{{vault.X}}`- / `{{live.X}}`- / `{{workspace.X}}`- / ' +
    '`{{collection.X}}`- / `{{step.X.Y}}`-Referenzen vor. Öffnet sich bei `{{` in jedem ' +
    'Regelfeld-Wert-Eingabefeld und in JSON-/GraphQL-/XML-/Klartext-Body-Editoren. Deaktivieren, wenn du ' +
    'lieber reinen Text bearbeitest.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': 'URL-Strategie für Entwürfe',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'Wie vorausgefüllte Regeln aus dem DevTools-Inspector eine erfasste URL in ein url-filter-Muster ' +
    'verwandeln. Exakt (Standard) behält die URL wörtlich, sodass die Regel nur auf die inspizierte Anfrage ' +
    'passt. Pfad-Platzhalter ersetzt das letzte Pfadsegment durch *, sodass Geschwister-Ressourcen passen. ' +
    'Nur Host weitet auf die ganze Domain aus.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': 'Exakte URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'Diese URL wörtlich abgleichen, normalisiert (empfohlen)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'Pfad-Platzhalter',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    'Das letzte Pfadsegment mit einem Platzhalter versehen',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'Nur Host',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description':
    'Jede Anfrage auf dem Host abgleichen',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': 'Rohe URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description':
    'Diese URL wörtlich abgleichen, ohne Normalisierung',

  // ── Workspace Sharing category defs ────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label':
    'Merge-Strategie auf Importvorschau-Zeilen anzeigen',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    'Wenn an, zeigt jede Entitätszeile in der linken Seitenleiste der Importvorschau die gewählte ' +
    'Merge-Strategie (als neu hinzufügen, Ersetzen, Überspringen, …) neben den Zeilenzählern. Ausschalten, ' +
    'um auf schmalen Bereichen Zeilenbreite freizugeben.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': 'Diff-Ansicht der Importvorschau',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    'Rendert Ziel und Eingehendes nebeneinander oder gestapelt in einer Spalte. Wechselt automatisch auf ' +
    'vereinheitlicht, wenn der Diff-Bereich zu schmal ist.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': 'Nebeneinander',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': 'Vereinheitlicht',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label':
    'Leerraum-Behandlung im Importvorschau-Diff',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    'Ob der Diff reine Leerraum-Änderungen als Änderungen behandelt oder ausblendet.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': 'Nicht ignorieren',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': 'Leerzeichen ignorieren',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label':
    'Unveränderte Bereiche im Importvorschau-Diff einklappen',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    'Blendet Läufe unveränderter Zeilen aus und ersetzt sie durch einen Zum-Ausklappen-Stub.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label':
    'Leerraumzeichen im Importvorschau-Diff anzeigen',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    'Stellt Leerzeichen und Tabulatoren als sichtbare Glyphen (·, →) im Diff dar.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label':
    'Zeilennummern im Importvorschau-Diff anzeigen',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    'Zeigt die Zeilennummern-Spalte neben jeder Seite des Diffs.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label':
    'Einzugshilfen im Importvorschau-Diff anzeigen',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'Rendert vertikale Einzugshilfen, damit sich YAML-Verschachtelung leichter überfliegen lässt.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label':
    'Lange Zeilen im Importvorschau-Diff weich umbrechen',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    'Bricht lange Zeilen in die nächste sichtbare Zeile um, statt horizontal zu scrollen.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'Protokollstufe',
  'workbench.settings.def.data.logLevel.description':
    'Ausführlichkeit des Erweiterungs-Loggers. Höhere Stufen schließen jede darüberliegende Stufe ein.',
  'workbench.settings.def.data.logLevel.option.error.label': 'Error',
  'workbench.settings.def.data.logLevel.option.error.description': 'Nur Fehlschläge',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Warn',
  'workbench.settings.def.data.logLevel.option.warn.description': 'Anomalien und Wiederholungen',
  'workbench.settings.def.data.logLevel.option.info.label': 'Info',
  'workbench.settings.def.data.logLevel.option.info.description': 'Betriebsereignisse',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Debug',
  'workbench.settings.def.data.logLevel.option.debug.description': 'Ausführliche Interna',
  'workbench.settings.def.data.exportSettings.label': 'Einstellungen exportieren',
  'workbench.settings.def.data.exportSettings.description': 'Lädt alle Einstellungen als JSON-Datei herunter.',
  'workbench.settings.def.data.exportSettings.action.label': 'Exportieren',
  'workbench.settings.def.data.importSettings.label': 'Einstellungen importieren',
  'workbench.settings.def.data.importSettings.description':
    'Lädt Einstellungen aus einer zuvor exportierten JSON-Datei.',
  'workbench.settings.def.data.importSettings.action.label': 'Importieren…',
  'workbench.settings.def.data.exportObservabilityLog.label': 'Diagnoseprotokoll exportieren',
  'workbench.settings.def.data.exportObservabilityLog.description':
    'Lädt die letzten 500 strukturierten Ereignisse (Regel-Neuaufbauten, Anfragefehler, ' +
    'Arbeitsbereich-Wechsel) als JSON herunter. Nur lokal; nichts verlässt das Gerät, außer du hängst die ' +
    'Datei selbst an einen Fehlerbericht.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'Protokoll exportieren',
  'workbench.settings.def.data.clearObservabilityLog.label': 'Diagnoseprotokoll leeren',
  'workbench.settings.def.data.clearObservabilityLog.description':
    'Verwirft jedes gepufferte Ereignis. Berührt weder Regeln noch Anfragen noch Arbeitsbereich-Daten.',
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'Leeren',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    'Das Diagnoseprotokoll leeren? Dies verwirft jedes gepufferte Ereignis.',
  'workbench.settings.def.data.exportImportReports.label': 'Importberichte exportieren',
  'workbench.settings.def.data.exportImportReports.description':
    'Lädt die strukturierten Verwerfungs-/Transformationsberichte jedes Importlaufs (heute curl; HAR / ' +
    'Postman / Insomnia als Nächstes) als JSON herunter. Liegt pro Arbeitsbereich — die 50 jüngsten Importe ' +
    'je Arbeitsbereich. Verlässt das Gerät nie, außer du hängst die Datei an.',
  'workbench.settings.def.data.exportImportReports.action.label': 'Berichte exportieren',
  'workbench.settings.def.data.clearImportReports.label': 'Importberichte leeren',
  'workbench.settings.def.data.clearImportReports.description':
    'Verwirft jeden Importbericht des aktiven Arbeitsbereichs. Die Anfragen selbst bleiben unberührt — nur ' +
    'das Prüfprotokoll dessen, was beim Import verworfen/transformiert wurde.',
  'workbench.settings.def.data.clearImportReports.action.label': 'Leeren',
  'workbench.settings.def.data.clearImportReports.confirm':
    'Importberichte für diesen Arbeitsbereich leeren? Das lässt sich nicht rückgängig machen.',
  'workbench.settings.def.data.uploadFile.label': 'Datei hochladen',
  'workbench.settings.def.data.uploadFile.description':
    'Fügt dem aktiven Arbeitsbereich eine Datei für Multipart-Bodys und `{{file.X}}`-Referenzen hinzu. ' +
    'Dateien sind inhaltsadressiert (sha256), erneutes Hochladen derselben Bytes bleibt also ein Blob. ' +
    'Gespeichert wird lokal in IndexedDB; nichts verlässt das Gerät.',
  'workbench.settings.def.data.uploadFile.action.label': 'Hochladen…',
  'workbench.settings.def.data.exportFilesManifest.label': 'Dateimanifest exportieren',
  'workbench.settings.def.data.exportFilesManifest.description':
    'Lädt die Liste der Dateien im aktiven Arbeitsbereich (Dateiname, Hash, Größe, MIME-Typ) als JSON ' +
    'herunter. Die Bytes sind NICHT enthalten — dies ist ein Manifest für Prüfung und erneutes Hochladen ' +
    'durch Teammitglieder, kein Backup des Inhalts.',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'Manifest exportieren',
  'workbench.settings.def.data.filesBrowser.label': 'Dateien',
  'workbench.settings.def.data.filesBrowser.description':
    'Jedes hochgeladene Blob im aktiven Arbeitsbereich. Bytes herunterladen, den kurzen Hash kopieren oder ' +
    'löschen. Datei-Metadaten (Dateiname, Größe, MIME-Typ, Hash) sind über den Einstellungsindex ' +
    'durchsuchbar.',
  'workbench.settings.def.data.clearAllFiles.label': 'Alle Dateien löschen',
  'workbench.settings.def.data.clearAllFiles.description':
    'Löscht jedes Datei-Blob im aktiven Arbeitsbereich. Anfragen, die diese Dateien über Multipart-Teile ' +
    'referenzieren, schlagen bei der Ausführung fehl; du musst die Dateien neu hochladen oder diese Anfragen ' +
    'bearbeiten.',
  'workbench.settings.def.data.clearAllFiles.action.label': 'Alle löschen',
  'workbench.settings.def.data.clearAllFiles.confirm':
    'Jede Datei in diesem Arbeitsbereich löschen? Multipart-Teile, die sie referenzieren, schlagen beim ' +
    'Senden fehl.',
  'workbench.settings.def.data.resetAllSettings.label': 'Alle Einstellungen zurücksetzen',
  'workbench.settings.def.data.resetAllSettings.description':
    'Setzt jede Einstellung in jeder Kategorie auf ihren Standardwert zurück.',
  'workbench.settings.def.data.resetAllSettings.action.label': 'Auf Standard zurücksetzen',
  'workbench.settings.def.data.resetAllSettings.confirm':
    'Jede Einstellung auf ihren Standard zurücksetzen? Das lässt sich nicht rückgängig machen.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'Software-Update',
  'workbench.settings.def.updates.state.description':
    'Aktueller Update-Status. Herunterladen und Installieren verlangen immer deinen ausdrücklichen Klick.',
  'workbench.settings.def.updates.check.label': 'Nach Updates suchen',
  'workbench.settings.def.updates.check.description':
    'Sucht einmal täglich nach neuen Versionen und zeigt einen Benachrichtigungspunkt, wenn eine verfügbar ' +
    'ist. Die Prüfung lädt nichts herunter und sendet nichts über dich oder diese Installation — sie liest ' +
    'eine öffentliche Versionsliste und vergleicht lokal. „Nur Sicherheitskorrekturen“ bleibt still, außer ' +
    'ein Release behebt ein Sicherheitsproblem, das deine laufende Version betrifft. Updates werden nie ohne ' +
    'deine ausdrückliche Aktion installiert.',
  'workbench.settings.def.updates.check.option.all.label': 'Alle Releases',
  'workbench.settings.def.updates.check.option.security-only.label': 'Nur Sicherheitskorrekturen',
  'workbench.settings.def.updates.check.option.off.label': 'Aus',
  'workbench.settings.def.updates.channel.label': 'Update-Kanal',
  'workbench.settings.def.updates.channel.description':
    'Welcher Release-Linie die Update-Prüfungen folgen. Beta bekommt neue Funktionen früher, kann aber ' +
    'weniger ausgereift sein. Der Wechsel zurück zu Stabil stuft nie herab — du behältst die installierte ' +
    'Version, bis das nächste stabile Release sie überholt. Sicherheitshinweise folgen auf beiden Kanälen ' +
    'immer der stabilen Linie.',
  'workbench.settings.def.updates.channel.option.stable.label': 'Stabil',
  'workbench.settings.def.updates.channel.option.beta.label': 'Beta',
  'workbench.settings.def.updates.showWhatsNew.label': 'Neuigkeiten nach dem Aktualisieren anzeigen',
  'workbench.settings.def.updates.showWhatsNew.description':
    'Öffnet beim ersten Öffnen des Arbeitsbereich-Editors nach einem Funktions-Release einen Tab mit den ' +
    'Release-Highlights. Patch-Releases öffnen ihn nie — sie bleiben in der Benachrichtigungs-Zeitleiste. ' +
    'Die Notizen liegen der App bei; nichts wird abgerufen.',
  'workbench.settings.def.updates.autoDownload.label': 'Updates automatisch herunterladen',
  'workbench.settings.def.updates.autoDownload.description':
    'Lädt ein gefundenes Update sofort im Hintergrund, sodass die Installation ein einziges „Aktualisieren und ' +
    'neu starten“ ist — und schon Beenden und erneutes Öffnen der App startet die neue Version. Aus heißt, ' +
    'nichts wird geladen, bis du selbst „Aktualisieren und neu starten“ wählst. So oder so startet die App ' +
    'nie von selbst neu.',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'Version',
  'workbench.settings.def.about.version.description': 'Die derzeit installierte Version der Erweiterung.',
  'workbench.settings.def.about.build.label': 'Build',
  'workbench.settings.def.about.build.description': 'Build-Nummer und -Datum.',
  'workbench.settings.def.about.commit.label': 'Commit',
  'workbench.settings.def.about.commit.description': 'Git-Commit, aus dem dieser Build erzeugt wurde.',
  'workbench.settings.def.about.protocol.label': 'Protokoll',
  'workbench.settings.def.about.protocol.description':
    'Wire-Protokollversion, die diese Erweiterung mit der Desktop-App spricht. Nicht übereinstimmende Peers ' +
    'werden mit einer klaren Update-Aufforderung abgewiesen.',
  'workbench.settings.def.about.browser.label': 'Browser',
  'workbench.settings.def.about.browser.description': 'Erkannter Browser und Plattform.',
} as const satisfies Catalog;
