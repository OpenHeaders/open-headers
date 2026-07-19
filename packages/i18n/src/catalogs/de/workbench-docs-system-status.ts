/**
 * Workbench Docs panel — the System Status section body — German.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals, state tokens, and the popover status
 * messages the doc quotes (Connected to desktop, N workflows fresh, …)
 * ride RAW — untranslated wire output, same class as the quoted
 * browser phrasing law. Subsystem display names copy the shipped
 * `de/shared-chrome.ts` labels (Synchronisierung, Regeln, Anfragen,
 * Berechtigungen, Secrets, Live, Systemstatus). MINTS: `Senden` (the
 * Send button) and the settings path `Einstellungen → Daten →
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
    'ist ein Live-Schnappschuss der Gesundheit der Erweiterung. Die Fußzeile des Arbeitsbereich-Editors ' +
    'zeigt ihn als Reihe aus sechs Anzeigen — eine Anzeige pro Subsystem, jede mit ihrem eigenen farbigen ' +
    'Punkt. Popup und Seitenpanel falten ihn zu einem einzigen Eintrag',
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
    'Sechs Subsystem-Zustände falten sich per max zu einem zusammen — Rot schlägt Gelb schlägt Grün.',
  'workbench.docs.body.systemStatus.popover1':
    'Ein Klick auf jede beliebige Anzeige öffnet dasselbe Detail-Popover. Die Zeilen kommen in zwei Gruppen: ' +
    'zuerst die grauen (noch keine Ereignisse in dieser Lebenszeit des Service Workers), danach die farbigen ' +
    '(mindestens einmal gemeldet). Innerhalb jeder Gruppe bleibt die kanonische Subsystem-Reihenfolge ' +
    'erhalten. Die volle Historie liegt im Observability-Protokoll — exportiere sie über',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Einstellungen → Daten → Diagnoseprotokoll exportieren',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Graue über dem Trenner, farbige darunter; bei der ersten Meldung wandert eine Zeile genau einmal.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'grün',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'gelb',
  'workbench.docs.body.systemStatus.stateRedLabel': 'rot',
  'workbench.docs.body.systemStatus.syncName': 'Synchronisierung',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Verbindung zur Desktop-App',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Spiegelt die WebSocket-Verbindung zwischen dem Service Worker der Erweiterung und der Desktop-App von ' +
    'OpenHeaders auf deinem Rechner. Die Verbindung ist reines Loopback (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') und trägt dynamische Variablen, Team-Arbeitsbereichsdaten und Präsenz — nichts verlässt dein Gerät.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Ein einziger WebSocket zwischen der Erweiterung und der Desktop-App auf localhost.',
  'workbench.docs.body.systemStatus.sync2':
    'Die Anzeige spiegelt den Verbindungszustand live. Ein Abriss löst Wiederverbindungen mit exponentiellem ' +
    'Backoff aus; regelmäßige Pings erkennen stille Trennungen hinter strikten Unternehmens-Proxys.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled und Connected sind grün; Connecting, Reconnecting und URL rejected sind gelb.',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '(der Handshake ist gelungen) oder',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(automatisches Verbinden aus).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': ', oder',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'Reserviert für fatale Fehler der Desktop-Synchronisierung; kein Codepfad sendet das heute.',
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
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'Desktop-App — Produkthinweis',
  'workbench.docs.body.systemStatus.desktopNote1':
    'Die Desktop-App ist in Entwicklung und erscheint, sobald sich die Erweiterung stabilisiert hat. ' +
    'Arbeitsbereiche, Variablen und Team-Synchronisierung, die mit der Desktop-App zusammenspielen, werden ' +
    'dann freigeschaltet. Das Subsystem',
  'workbench.docs.body.systemStatus.desktopNote2':
    'wechselt beim ersten Start automatisch von deaktiviert zu verbindend — keine Neuinstallation nötig.',
} as const satisfies Catalog;
