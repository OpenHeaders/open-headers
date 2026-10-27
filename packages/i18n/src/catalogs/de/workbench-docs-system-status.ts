/**
 * Workbench Docs panel — the System Status section body — German.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals, state tokens, and the popover status
 * messages the doc quotes (Connected to desktop, N workflows fresh, …)
 * ride RAW — untranslated wire output, same class as the quoted
 * browser phrasing law. Subsystem display names copy the shipped
 * `de/shared-chrome.ts` labels (Synchronisierung, Regeln, Anfragen,
 * Berechtigungen, Secrets, Live, Systemstatus). MINTS: `Senden` (the
 * Send button) and the settings path `Anwendung › Daten ›
 * Diagnoseprotokoll exportieren` — the de editors-request and
 * settings files must reuse them; die Anzeige = status pill (the
 * debug-mode precedent). Workbench in prose = Arbeitsbereich-Editor
 * (shared-components mint); wake = das Aufwachen (shared-chrome
 * Aufwachvorgang family).
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'Der Systemstatus',
  'workbench.docs.body.systemStatus.intro1':
    'ist ein Live-Schnappschuss der Gesundheit der Erweiterung. Die Fußzeile des Arbeitsbereich-Editors zeigt ihn als Reihe aus acht Anzeigen — eine Anzeige pro Subsystem, jede mit ihrem eigenen farbigen Punkt. Popup und Seitenpanel falten ihn zu einem einzigen Eintrag',
  'workbench.docs.body.systemStatus.intro1Suffix':
    'in ihrer unteren Fußzeile zusammen; die Farbe des Punkts folgt dem Subsystem im schlechtesten Zustand.',
  'workbench.docs.body.systemStatus.workbenchCaption':
    'Im Arbeitsbereich-Editor sitzt die Reihe in der Fußzeile, eine Anzeige pro Subsystem.',
  'workbench.docs.body.systemStatus.popupCaption':
    'Klicke auf das Symbol in der Werkzeugleiste, und derselbe Status erscheint als einzelne beschriftete ' +
    'Anzeige in der Fußzeile des Popups.',
  'workbench.docs.body.systemStatus.worstLevel1':
    'Jedes Subsystem meldet genau einen Zustand, und die schlechteste Stufe gewinnt: Rot > Gelb > Grün. Ein ' +
    'einziges Rot irgendwo färbt den zusammengesetzten Punkt rot.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Acht Subsystem-Zustände falten sich per max zu einem zusammen — Rot schlägt Gelb schlägt Grün.',
  'workbench.docs.body.systemStatus.popover1':
    'Ein Klick auf jede beliebige Anzeige öffnet dasselbe Detail-Popover. Die Zeilen stehen unter vier betitelten Gruppen — Verbindung, Browser Interceptor, API-Anfragen und Anwendung — in fester Reihenfolge. Eine Zeile bleibt grau, bis ihr Subsystem in dieser Lebenszeit des Service Workers zum ersten Mal meldet, und ist danach farbig. Die volle Historie liegt im Observability-Protokoll — exportiere sie über',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Anwendung › Daten › Diagnoseprotokoll exportieren',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Vier betitelte Gruppen in fester Reihenfolge; bei der ersten Meldung wird eine Zeile farbig und bleibt an ihrem Platz.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'grün',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'gelb',
  'workbench.docs.body.systemStatus.stateRedLabel': 'rot',
  'workbench.docs.body.systemStatus.syncName': 'Synchronisierung',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Back-End-Verbindungen',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Fasst jedes Back-End, dessen Client diese Oberfläche ist — die Desktop-App auf diesem Rechner (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') und jeder OpenHeaders Server — in einer Zeile zusammen: die schlechteste Verbindung bestimmt das Etikett, und jedes Back-End bekommt im Popover eine eigene Zeile darunter. Ohne konfiguriertes Back-End lautet die Zeile „Läuft in diesem Browser“ — die Erweiterung ist ihr eigenes Back-End.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Ein WebSocket pro Back-End — gezeigt ist die Desktop-App auf localhost; ein Server ist dieselbe Verbindung über das Netzwerk.',
  'workbench.docs.body.systemStatus.sync2':
    'Jede Leitung meldet zwei Schichten. Der Socket: verbindend, nach einem Abbruch mit exponentiellem Backoff neu verbindend, verbunden — periodische Pings erkennen stille Abbrüche hinter strengen Unternehmens-Proxys. Darüber der Handshake: Handshake läuft, Aufholen der verpassten Änderungen, synchronisiert. Innerhalb eines Back-Ends gewinnt die jüngste Meldung; über Back-Ends hinweg der schlechteste Zustand.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Deaktiviert, Verbunden und Synchronisiert sind grün; Verbindend, Neu verbindend, Aufholend und URL abgelehnt sind gelb.',
  'workbench.docs.body.systemStatus.sync3':
    'Eine Desktop-App oder ein Server ist auch Back-End für andere, und diese Rolle fließt in dieselbe Zusammenfassung ein: das Binden der Erweiterungs-Pipe — rot, wenn eine andere Instanz den Port hält, gelb während des Starts — und, einmal gebunden, wie viele Erweiterungen verbunden sind und ob von diesem Gerät oder aus dem LAN. Ein git-gebundener Arbeitsbereich steuert die Zahl seiner nicht committeten Änderungen bei.',
  'workbench.docs.body.systemStatus.syncGreenSynced': 'Mit Back-End synchronisiert',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Mit Back-End verbunden',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Back-End-Synchronisierung deaktiviert',
  'workbench.docs.body.systemStatus.syncGreenRunningHere': 'Läuft in diesem Browser',
  'workbench.docs.body.systemStatus.syncGreenExplain':
    '— der Handshake ist abgeschlossen, der Socket steht und der Handshake läuft noch, Auto-Verbinden ist aus, oder kein Back-End ist konfiguriert. Ein Host, der selbst bedient, meldet stattdessen seine Gegenstellen:',
  'workbench.docs.body.systemStatus.syncGreenIdle': 'Leerlauf — keine Erweiterungen verbunden',
  'workbench.docs.body.systemStatus.syncGreenPeers': 'Mit N Erweiterungen auf diesem Gerät verbunden',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(oder im LAN).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Verbinde mit Back-End…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Neu verbinden (Versuch N)',
  'workbench.docs.body.systemStatus.syncYellowHandshaking': 'Handshake mit Back-End…',
  'workbench.docs.body.systemStatus.syncYellowCatchingUp': 'Änderungen werden aufgeholt…',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop-URL von den Einstellungen abgelehnt',
  'workbench.docs.body.systemStatus.syncYellowOff': '<Back-End> ist aus — seine Arbeitsbereiche synchronisieren nicht',
  'workbench.docs.body.systemStatus.syncYellowExplain':
    '— ein Socket auf dem Weg hoch oder zurück, ein laufender Handshake, ein Eintrag ohne brauchbare URL oder ein beigetretenes Back-End, das ausgeschaltet ist. Ein Host, der selbst bedient, ergänzt',
  'workbench.docs.body.systemStatus.syncYellowPipe': 'Erweiterungs-Pipe startet…',
  'workbench.docs.body.systemStatus.syncYellowGit': 'N nicht committete Änderungen',
  'workbench.docs.body.systemStatus.syncYellowSuffix': 'für einen git-gebundenen Arbeitsbereich.',
  'workbench.docs.body.systemStatus.syncRedRejected': 'Back-End hat Handshake abgelehnt',
  'workbench.docs.body.systemStatus.syncRedTimedOut':
    'Back-End hat auf den Handshake nicht geantwortet — neuer Versuch',
  'workbench.docs.body.systemStatus.syncRedCatchUp': 'Aufholen fehlgeschlagen',
  'workbench.docs.body.systemStatus.syncRedExplain':
    '— der Server hat den Handshake verweigert (Protokoll passt nicht, Arbeitsbereich unbekannt, Authentifizierung fehlt; die Zeile nennt den Grund), nie geantwortet, oder die Aufhol-Wiedergabe ist fehlgeschlagen. Ein Host, der selbst bedient, ergänzt',
  'workbench.docs.body.systemStatus.syncRedPipe': 'Erweiterungs-Pipe offline — Port N wird bereits verwendet',
  'workbench.docs.body.systemStatus.syncRedSuffix': 'wenn eine andere Instanz den Port hält.',
  'workbench.docs.body.systemStatus.activityName': 'Aktivität',
  'workbench.docs.body.systemStatus.activitySubtitle': 'Aktivitäts-Feed',
  'workbench.docs.body.systemStatus.activity1':
    'Zählt die ungelesenen Einträge im Aktivitäts-Feed des aktiven Arbeitsbereichs — die Änderungen, die über die Synchronisierung eingetroffen sind: eine Entität erstellt, bearbeitet, gelöscht oder verschoben, eine lokale Bearbeitung überschrieben, ein sensibles Feld rotiert, ein Berechtigungsumfang erweitert, ein KI-Agent, der Datenverkehr beobachtet.',
  'workbench.docs.body.systemStatus.activity2':
    'Nur der aktive Arbeitsbereich zählt. Einträge für einen anderen Arbeitsbereich landen weiterhin in dessen Feed, und beim Wechsel dorthin wird der Zähler neu aus dem Protokoll gelesen — kein Arbeitsbereich trägt das Abzeichen eines anderen.',
  'workbench.docs.body.systemStatus.activityGreenLabel': 'Aktivität auf dem neuesten Stand',
  'workbench.docs.body.systemStatus.activityGreenSuffix': '— nichts Ungelesenes im aktiven Arbeitsbereich.',
  'workbench.docs.body.systemStatus.activityYellowLabel': 'N neu · <Überschrift>',
  'workbench.docs.body.systemStatus.activityYellowMiddle':
    '— ungelesene Einträge, mit dem neuesten als Überschrift, bis der Feed gelesen wird.',
  'workbench.docs.body.systemStatus.activityRed': 'Reserviert; heute löst kein Codepfad dies aus.',
  'workbench.docs.body.systemStatus.rulesName': 'Regeln',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'declarativeNetRequest-Engine',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Meldet jeden DNR-Neuaufbau. Jedes Speichern schickt deine Regel durch vier Stufen, bevor sie live geht: ' +
    'zu DNR-JSON kompilieren, die Referenzen',
  'workbench.docs.body.systemStatus.rules1Middle':
    'auflösen, die Obergrenze aktiver Regeln durchsetzen und dann in Chrome anwenden über',
  'workbench.docs.body.systemStatus.rules1Suffix': '— die Browser-API. Jede Stufe kann die Anzeige umfärben.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    'Vier Stufen — jede kann eine Statusstufe melden, wenn etwas schiefgeht.',
  'workbench.docs.body.systemStatus.rules2':
    'Die Zahl aktiver Regeln bildet sich auf einen Zustand auf einer Kapazitätsleiste mit drei Zonen ab. ' +
    'Regeln über der Obergrenze werden in Treffer-Reihenfolge verworfen (oben gewinnt), und die gelbe ' +
    'Meldung trägt die Zahl der verworfenen.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    'Grün bis zur Warnschwelle, gelb bis zur Obergrenze, rot darüber — die Kürzung hält dich zur Laufzeit ' +
    'aber aus der roten Zone heraus.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'oder',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Unaufgelöste',
  'workbench.docs.body.systemStatus.rulesYellowRefs': 'Referenzen (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), die Regel-Obergrenze wurde überschritten (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': '), oder du näherst dich der DNR-Kapazität (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Transportfehler — Chrome hat das Update der dynamischen oder Sitzungs-Regeln abgelehnt (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Anfragen',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'Ausführer für API-Anfragen',
  'workbench.docs.body.systemStatus.requests1Prefix':
    'Spiegelt die letzte Ad-hoc-API-Anfrage, abgeschickt über den Button',
  'workbench.docs.body.systemStatus.requestsSend': 'Senden',
  'workbench.docs.body.systemStatus.requests1Middle': 'des Anfragen-Editors. Die Anzeige wird grün bei',
  'workbench.docs.body.systemStatus.requestsAny': 'jeder',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP-Antwort — einschließlich 4xx und 5xx — denn „die Anfrage ist durchgelaufen“ ist eine andere Frage ' +
    'als „dem Server hat sie gefallen“. Nur Fehler auf Netzwerkebene ohne Antwort färben sie gelb.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'Jeder Statuscode = grün. Gelb ist Fehlern ohne zurückkommende Antwort vorbehalten.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    'Hintergrundverkehr aktualisiert diese Anzeige nicht: Aktualisierungen von Live-Workflows laufen an ihr',
  'workbench.docs.body.systemStatus.requests2Suffix':
    'vorbei, und Anfragen von Webseiten laufen durch die Regel-Engine, nicht durch den Ausführer.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Nur der Ad-hoc-Verkehr des Senden-Buttons formt diese Anzeige — alles andere bleibt still.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '— jede HTTP-Antwort (z. B.',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '— Fehler auf Netzwerkebene vor jeder Antwort (z. B.',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', offline/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Berechtigungen',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'Audit der Host-Berechtigungen',
  'workbench.docs.body.systemStatus.permissions1Prefix':
    'DNR-Regeln und Content-Scripts, die auf einen Host zielen, der widerrufen wurde über',
  'workbench.docs.body.systemStatus.permissions1Middle':
    ', werfen keinen Fehler — sie tun stillschweigend nichts. Die ganze Aufgabe dieses Audits ist es, diesen ' +
    'verborgenen Zustand sichtbar zu machen; sonst verbringst du 30 Minuten mit dem Debugging einer Regel, die',
  'workbench.docs.body.systemStatus.permissionsLooks': 'korrekt aussieht',
  'workbench.docs.body.systemStatus.permissions1Suffix': '.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    'Erteilt: Die Regel greift. Eingeschränkt: Die Regel tut stillschweigend nichts, und der Header kommt ' + 'nie an.',
  'workbench.docs.body.systemStatus.permissions2Prefix': 'Das Audit fragt',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'bei jedem Aufwachen des Service Workers ab. MV3 hat in Chromium keinen Beobachter für ' +
    'Berechtigungsänderungen, also ist die Abfrage beim Aufwachen das günstigste verfügbare Signal.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    'Ein Aufruf, drei Zweige — grün bei erteilt, rot bei eingeschränkt, gelb, wenn der API-Aufruf selbst ' +
    'fehlschlägt.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'ist weiterhin abgedeckt.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': '— ungewöhnlich; der Browser verweigerte',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '— manche Regeln tun auf widerrufenen Hosts stillschweigend nichts, bis der Zugriff wiederhergestellt ' +
    'ist über',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.debugModeName': 'Debug-Modus',
  'workbench.docs.body.systemStatus.debugModeSubtitle': 'Debugger-Anbindungszustand',
  'workbench.docs.body.systemStatus.debugMode1':
    'Spiegelt den Debugger, den der Debug-Modus an Tabs anbindet, um Anfragen exakt zuzuordnen. Aus meldet Grün — ein Fehler ist belanglos, solange der Schalter aus ist. An zählt die Zeile die angebundenen Tabs; ein Tab, dessen Anbindung der Browser verweigert hat, färbt sie rot, ein Tab, der auf den heuristischen Pfad zurückgefallen ist, gelb.',
  'workbench.docs.body.systemStatus.debugMode2':
    'Browser ohne Debugger-API installieren diesen Reporter nie, daher bleibt die Zeile dort grau und der heuristische Pfad ist der einzige.',
  'workbench.docs.body.systemStatus.debugModeGreenOff': 'Aus',
  'workbench.docs.body.systemStatus.debugModeGreenOr': 'oder',
  'workbench.docs.body.systemStatus.debugModeGreenOn': 'An · N Tabs',
  'workbench.docs.body.systemStatus.debugModeGreenSuffix':
    '— der Schalter ist aus, oder an und jeder angebundene Tab ist gesund.',
  'workbench.docs.body.systemStatus.debugModeYellowLabel': 'Tab N auf Heuristik zurückgefallen',
  'workbench.docs.body.systemStatus.debugModeYellowMiddle':
    '— der Debugger hat sich von diesem Tab gelöst (etwa ein abgebrochener Banner), und der Tab wird über den heuristischen Pfad zugeordnet, bis er wieder angebunden ist.',
  'workbench.docs.body.systemStatus.debugModeRedLabel': 'Anbindung an Tab N fehlgeschlagen',
  'workbench.docs.body.systemStatus.debugModeRedMiddle':
    '— der Browser hat die Anbindung verweigert, meist weil ein anderer Debugger den Tab bereits hält.',
  'workbench.docs.body.systemStatus.secretsName': 'Secrets',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Integrität des vault',
  'workbench.docs.body.systemStatus.secrets1Prefix': 'Verfolgt den verschlüsselten vault-Blob pro Arbeitsbereich in',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. Bei jedem Aufwachen des Service Workers wird jedes gespeicherte Secret gegen das aktuelle Schema ' +
    'validiert; Einträge, die die Validierung nicht bestehen, fliegen aus dem vault im Speicher, und die ' +
    'Anzeige bleibt gelb, bis sie neu gespeichert sind.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'Die Hydration lädt den Blob; der Schema-Validator behält passende Einträge, verwirft Abweichungen und ' +
    'meldet Gelb.',
  'workbench.docs.body.systemStatus.secrets2':
    '„Abweichung“ heißt meist: Ein gespeicherter Eintrag stammt aus einem älteren Build (ein inzwischen ' +
    'erforderliches Feld fehlt, oder ein Feld hat den falschen Typ). Die Aufgabe des Validators ist es, ' +
    'laut zu scheitern — unbekannte Formen stillschweigend zu übernehmen ist genau das, was sechs Versionen ' +
    'später den Bug verursacht.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Dieselben zwei Felder nebeneinander: ein gültiger Eintrag gegenüber einem abgewichenen mit fehlendem ' +
    'cipher und falsch typisiertem createdAt.',
  'workbench.docs.body.systemStatus.secretsGreen':
    'Standard — keine Schema-Abweichungen in dieser Lebenszeit des Service Workers.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '— mindestens ein gespeicherter Eintrag im vault passte nicht zur aktuellen Form und wurde bei der ' +
    'Hydration verworfen. Neu speichern im Vault-Editor stellt ihn wieder her.',
  'workbench.docs.body.systemStatus.secretsRed':
    'Reserviert für Entschlüsselungsfehler; kein Codepfad sendet das heute.',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Workflow-Aktualisierung der Live-Variablen',
  'workbench.docs.body.systemStatus.live1Prefix':
    'Jeder Live-Workflow aktualisiert sich in seinem eigenen Takt. Der Zustand pro Workflow hängt an drei ' +
    'Prüfungen: ob der letzte Extraktor erfolgreich war, ob der Lauf innerhalb von',
  'workbench.docs.body.systemStatus.live1Suffix':
    'seines Takts liegt und wie viele Fehlschläge er in Folge hatte. Die drei Zustände falten sich per ' +
    '„der schlechteste gewinnt“ in die Anzeige.',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Fresh = sauberer Lauf · stale = über 2× Takt oder 1–4 Fehlschläge · failing = ≥ 5 Fehlschläge in Folge.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Nur die Workflows',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': 'des aktiven Arbeitsbereichs',
  'workbench.docs.body.systemStatus.live2Suffix':
    'zählen. Inaktive Arbeitsbereiche sind ausgenommen — deren Regeln kannst du gerade weder sehen noch ' +
    'bedienen; eine Anzeige dafür wäre Rauschen außerhalb deiner Reichweite. Der Wechsel des ' +
    'Arbeitsbereichs berechnet die Anzeige gegen die neue aktive Menge neu.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'Die Workflows des aktiven Arbeitsbereichs falten sich per max() in eine Anzeige; andere ' +
    'Arbeitsbereiche werden übersprungen.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '— der letzte Lauf jedes Workflows im aktiven Arbeitsbereich war OK und innerhalb von 2× seines Takts. ' +
    'Erscheint auch als',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': ', wenn es keine gibt.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— mindestens ein Lauf liegt über 2× Takt, der letzte Extraktor ist fehlgeschlagen, oder es gibt 1–4 ' +
    'Fehlschläge in Folge.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— ein einzelner Workflow hat fünf Fehlschläge in Folge überschritten und gilt jetzt als fehlschlagend.',
} as const satisfies Catalog;
