/**
 * Workbench editors — gRPC client + gRPC response examples — German.
 * Mirrors `catalogs/en/workbench-editors-grpc.ts` key for key. Raw by
 * design: gRPC status-code names (OK, CANCELLED, …) with their
 * `Status code N NAME` lead-ins rendered as `Statuscode N NAME`,
 * rpc/service identifiers ({rpc}), Protobuf / `.proto` / TLS / SSL /
 * lowercase `base64` vocabulary, `host:port` and `authorization:
 * Bearer <token>` wire syntax, `Metadata` / `Trailers` tab nouns kept
 * as the gRPC protocol terms, der Frame and der Token per the shared
 * register, `Docs` / `Streaming` / `Stream` raw, and the {count} /
 * {ms} / {bytes} / {name} / {message} holes. Settings tab =
 * Einstellungen (S58 law); Timeline = Zeitverlauf (register mint);
 * unary reuses the spec-outline `Unär` family (unäre Antwort);
 * invoke = aufrufen / der Aufruf; spec in editor chrome =
 * Spezifikation (editors-spec precedent).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'gRPC-Anfrage nicht gefunden.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (z. B. grpc.openheaders.com:443)',
  'workbench.editors.grpc.tls.on': 'TLS an — klicke, um zu Klartext zu wechseln',
  'workbench.editors.grpc.tls.off': 'TLS aus (Klartext) — klicke, um zu TLS zu wechseln',
  'workbench.editors.grpc.method.placeholder': 'Wähle eine Methode',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'Verknüpfe eine Protobuf-Spezifikation, um eine Methode zu wählen',
  'workbench.editors.grpc.method.unresolvedGroup': 'Nicht in der verknüpften Spezifikation',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (nicht aufgelöst)',
  'workbench.editors.grpc.method.linkGroup': 'Eine Protobuf-Spezifikation verknüpfen',
  'workbench.editors.grpc.method.importProto': 'Eine .proto-Datei importieren…',
  'workbench.editors.grpc.invoke.label': 'Aufrufen',
  'workbench.editors.grpc.invoke.stop': 'Stoppen',
  'workbench.editors.grpc.invoke.browserHost':
    'Aufrufe laufen in der Desktop-App — Verfassen und Speichern funktioniert hier.',
  'workbench.editors.grpc.invoke.needsMethod':
    'Wähle eine Methode, die sich gegen die verknüpfte Spezifikation auflöst, um aufzurufen',
  'workbench.editors.grpc.invoke.needsUrl': 'Gib einen Ziel-Host ein, um aufzurufen',
  'workbench.editors.grpc.invoke.failed': 'Aufruf fehlgeschlagen — der Host hat den Aufruf nicht beantwortet',
  'workbench.editors.grpc.response.title': 'Antwort',
  'workbench.editors.grpc.response.empty.prompt': 'Rufe eine Methode auf, um eine Antwort zu erhalten.',
  'workbench.editors.grpc.response.empty.invoking': 'Rufe auf…',
  'workbench.editors.grpc.status.kicker': 'gRPC-Status',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions; the status-code name tokens ride raw.
  'workbench.editors.grpc.status.desc.unknownCode':
    'Ein nicht standardisierter Statuscode außerhalb des gRPC-Vokabulars.',
  'workbench.editors.grpc.status.desc.OK':
    'Statuscode 0 OK ist die Standardantwort auf den erfolgreichen Aufruf einer gRPC-Methode.',
  'workbench.editors.grpc.status.desc.CANCELLED':
    'Statuscode 1 CANCELLED wird zurückgegeben, wenn der Aufrufer die Operation abbricht.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    'Statuscode 2 UNKNOWN wird zurückgegeben, wenn die Operation wegen eines unbekannten Fehlers nicht ' +
    'abgeschlossen werden konnte. Dieser Fehler kann zum Beispiel auftreten, wenn ein von einem anderen ' +
    'Adressraum empfangener Status-Wert zu einem Fehlerraum gehört, der in diesem Adressraum unbekannt ist. ' +
    'Auch Fehler von APIs, die nicht genug Fehlerinformationen liefern, können in diesen Fehler umgewandelt ' +
    'werden.',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'Statuscode 3 INVALID_ARGUMENT wird zurückgegeben, wenn der Client ein ungültiges Argument angegeben hat. ' +
    'Das steht für Argumente, die unabhängig vom Zustand des Systems problematisch sind (z. B. ein ' +
    'fehlerhafter Dateiname).',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'Statuscode 4 DEADLINE_EXCEEDED wird zurückgegeben, wenn die Frist abläuft, bevor die Operation ' +
    'abgeschlossen werden konnte. Bei Operationen, die den Zustand des Systems ändern, kann dieser Fehler ' +
    'auch dann zurückgegeben werden, wenn die Operation erfolgreich abgeschlossen wurde. Zum Beispiel könnte ' +
    'eine erfolgreiche Antwort eines Servers lange verzögert worden sein.',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'Statuscode 5 NOT_FOUND wird zurückgegeben, wenn eine angeforderte Entität (z. B. eine Datei oder ein ' +
    'Verzeichnis) nicht gefunden wurde.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    'Statuscode 6 ALREADY_EXISTS wird zurückgegeben, wenn die Entität, die du erstellen wolltest (z. B. eine ' +
    'Datei oder ein Verzeichnis), bereits existiert.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'Statuscode 7 PERMISSION_DENIED wird zurückgegeben, wenn der Aufrufer keine Berechtigung hat, die ' +
    'angegebene Operation auszuführen. Dieser Fehlercode bedeutet nicht, dass die Anfrage gültig ist oder ' +
    'dass die angeforderte Entität existiert oder andere Vorbedingungen erfüllt.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'Statuscode 8 RESOURCE_EXHAUSTED wird zurückgegeben, wenn ein Nutzerkontingent — oder womöglich das ' +
    'ganze Dateisystem — keinen Platz mehr hat.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    'Statuscode 9 FAILED_PRECONDITION wird zurückgegeben, wenn die Operation abgelehnt wurde, weil sich das ' +
    'System nicht in dem für die Ausführung erforderlichen Zustand befand. Zum Beispiel ist das zu löschende ' +
    'Verzeichnis nicht leer, eine rmdir-Operation wird auf etwas angewendet, das kein Verzeichnis ist, usw.',
  'workbench.editors.grpc.status.desc.ABORTED':
    'Statuscode 10 ABORTED wird zurückgegeben, wenn die Operation abgebrochen wurde, typischerweise wegen ' +
    'eines Nebenläufigkeitsproblems wie einer fehlgeschlagenen Sequencer-Prüfung oder einer abgebrochenen ' +
    'Transaktion.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'Statuscode 11 OUT_OF_RANGE wird zurückgegeben, wenn die Operation über den gültigen Bereich hinaus ' +
    'versucht wurde. Zum Beispiel das Suchen oder Lesen hinter dem Dateiende.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    'Statuscode 12 UNIMPLEMENTED wird zurückgegeben, wenn die Operation nicht implementiert oder in diesem ' +
    'Service nicht unterstützt/aktiviert ist.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    'Statuscode 13 INTERNAL wird zurückgegeben, wenn ein interner Fehler vorliegt. Das bedeutet, dass ' +
    'Invarianten verletzt wurden, die das darunterliegende System voraussetzt.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'Statuscode 14 UNAVAILABLE wird zurückgegeben, wenn der Service derzeit nicht verfügbar ist.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'Statuscode 15 DATA_LOSS wird zurückgegeben, wenn ein nicht wiederherstellbarer Datenverlust oder eine ' +
    'Datenbeschädigung vorliegt.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'Statuscode 16 UNAUTHENTICATED wird zurückgegeben, wenn die Anfrage keine gültigen Anmeldedaten für die ' +
    'Operation trägt.',
  'workbench.editors.grpc.response.error.title': 'Aufruf fehlgeschlagen',
  'workbench.editors.grpc.response.error.localGuidance':
    'Der Aufruf hat nie eine Antwort erreicht. Prüfe das Ziel, den TLS-Modus und ob der Server erreichbar ist.',
  'workbench.editors.grpc.response.error.statusGuidance': 'Prüfe die Nachricht und rufe die Methode erneut auf.',
  'workbench.editors.grpc.response.tab.response': 'Antwort',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': 'Metadata filtern',
  'workbench.editors.grpc.response.filterTrailers': 'Trailers filtern',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'Kein gRPC-Status',
  'workbench.editors.grpc.response.connectionLost': 'Verbindung verloren',
  'workbench.editors.grpc.response.includeDefaultValues': 'Standardwerte einbeziehen',
  'workbench.editors.grpc.response.noMessage': 'Die Antwort trug keine Antwortnachricht.',
  'workbench.editors.grpc.response.noMetadata': 'Keine Metadata',
  'workbench.editors.grpc.response.noTrailers': 'Keine Trailers',
  'workbench.editors.grpc.response.trailersOnly':
    'Trailers-only-Antwort — der Status kam mit den initialen Metadata, und keine Nachricht folgte.',
  'workbench.editors.grpc.response.compressed':
    'Der Antwort-Frame ist komprimiert — Kompression ist nicht ausgehandelt, daher lässt er sich nicht ' +
    'dekodieren.',
  'workbench.editors.grpc.response.structuralNotice':
    'Strukturelle Dekodierung (Feldnummern) — der Antworttyp hat sich nicht gegen die verknüpfte ' +
    'Spezifikation aufgelöst.',
  'workbench.editors.grpc.response.rawNotice':
    'Die Nachricht ließ sich nicht dekodieren; Rohbytes als base64 angezeigt.',
  'workbench.editors.grpc.response.extraFrames':
    '{count} Nachrichten-Frames kamen an — eine unäre Antwort trägt einen; der erste wird angezeigt.',
  'workbench.editors.grpc.response.incompleteTail':
    'Die Antwort endete mitten im Frame; vollständige Frames werden angezeigt.',
  'workbench.editors.grpc.response.truncated': 'Antwort bei {bytes} Bytes gekappt.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'Nachricht',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.settings': 'Einstellungen',
  'workbench.editors.grpc.messagePlaceholder': 'Anfragenachricht als JSON',
  'workbench.editors.grpc.example.label': 'Beispielnachricht verwenden',
  'workbench.editors.grpc.example.needsMethod':
    'Wähle zuerst eine Methode, die sich gegen die verknüpfte Spezifikation auflöst',
  'workbench.editors.grpc.metadata.keyPlaceholder': 'Schlüssel',
  'workbench.editors.grpc.metadata.valuePlaceholder': 'Wert',
  'workbench.editors.grpc.spec.selectLabel': 'Protobuf-Spezifikation',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Protobuf-Spezifikation verknüpfen…',
  'workbench.editors.grpc.spec.summary': '{services} Services · {methods} Methoden',
  'workbench.editors.grpc.spec.parseFailure': '{path}: {message}',
  'workbench.editors.grpc.spec.issue': '{kind}: {reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'Datei konnte nicht gelesen werden: {message}',
  'workbench.editors.grpc.spec.importFailed': '.proto-Datei konnte nicht importiert werden',
  'workbench.editors.grpc.method.usingSpec': 'Verwendet {name}',
  'workbench.editors.grpc.method.refreshSpec': 'Aus den aktuellen Dateien der Spezifikation neu aufbauen',
  'workbench.editors.grpc.settings.exampleCaption': 'Beispielaufruf',
  'workbench.editors.grpc.settings.group.connection': 'Verbindung',
  'workbench.editors.grpc.settings.group.tls': 'TLS & Vertrauen',
  'workbench.editors.grpc.settings.group.messages': 'Nachrichten',
  'workbench.editors.grpc.settings.groupInfo.connection':
    'Wie der Aufruf den Server erreicht: wohin der Kanal wählt, an welchen Namen der Aufruf adressiert ist, die Obergrenze für den gesamten Aufruf und das Keepalive, das eine tote Verbindung mitten im Aufruf erkennt.',
  'workbench.editors.grpc.settings.groupInfo.tls':
    'Wie TLS-Kanäle Vertrauen herstellen: ob das Serverzertifikat gegen die Systemwurzeln geprüft wird, welches Client-Zertifikat dieses Gerät vorlegt, das TLS-Versionsfenster und die Cipher-Liste im Handshake sowie der angebotene SNI-Name.',
  'workbench.editors.grpc.settings.groupInfo.messages':
    'Wie die Workbench eine Nachricht behandelt, die sich nicht parsen lässt — eine app-weite Haltung, ' +
    'geteilt mit den API-Anfragen-Einstellungen, kein Feld pro Anfrage.',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Unix-Socket',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'Wählt dieses lokale Socket an — einen absoluten Unix-Socket-Pfad oder eine benannte Windows-Pipe wie ' +
    '\\\\.\\pipe\\name — statt eine TCP-Verbindung zu öffnen. Das Ziel bestimmt weiterhin den ' +
    ':authority-Header, den TLS-Servernamen und die Zertifikatsprüfung; nur wohin die Verbindung geht, ' +
    'ändert sich. Leer lassen für eine normale TCP-Verbindung.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'TCP-Verbindung (Standard)',
  'workbench.editors.grpc.settings.timeoutLabel': 'Aufruf-Zeitlimit',
  'workbench.editors.grpc.settings.timeoutHelp':
    'Obergrenze der realen Zeit für den gesamten Aufruf — als gRPC-Deadline gesendet, damit der Server sie ' +
    'durchsetzen kann, und lokal durchgesetzt. Leer setzt keine Deadline.',
  'workbench.editors.grpc.settings.timeoutPlaceholder': 'Kein Limit (Standard)',
  'workbench.editors.grpc.settings.authorityLabel': 'Authority',
  'workbench.editors.grpc.settings.authorityHelp':
    'Die :authority, an die der Aufruf auf der Leitung adressiert ist — der Name, nach dem der Server routet — während die Verbindung weiterhin zum Ziel geht. Für ein Gateway, das nach Authority routet, oder einen per IP erreichten Server, der seinen eigenen Namen erwartet. TLS-Servername und Zertifikatsprüfung behalten den Host des Ziels; die Einstellung SNI-Servername ändert diesen. Leer lassen, um das Ziel selbst zu senden.',
  'workbench.editors.grpc.settings.authorityPlaceholder': 'Das Ziel (Standard)',
  'workbench.editors.grpc.settings.keepaliveIntervalLabel': 'Keepalive-Ping',
  'workbench.editors.grpc.settings.keepaliveIntervalHelp':
    'Sendet in diesem Takt einen HTTP/2-PING, solange der Aufruf offen ist, damit ein stiller Server-Stream oder ein langsamer Unary-Aufruf eine tote Verbindung erkennt, statt auf die Frist zu warten. Jede Verbindung bedient genau einen Aufruf, zwischen Aufrufen gibt es also nichts am Leben zu halten. Server lehnen Pings ab, die schneller als ihre Untergrenze eintreffen — standardmäßig 5 Minuten ohne fließende Daten — und schließen die Verbindung mit too_many_pings; der Aufruf benennt das dann. Leer lassen für keine Pings.',
  'workbench.editors.grpc.settings.keepaliveIntervalPlaceholder': 'Keine Pings (Standard)',
  'workbench.editors.grpc.settings.keepaliveTimeoutLabel': 'Keepalive-Timeout',
  'workbench.editors.grpc.settings.keepaliveTimeoutHelp':
    'Wie lange auf die Bestätigung des Pings gewartet wird, bevor die Verbindung als tot gilt und der Aufruf mit dieser Begründung endet. Leer lassen für den Standard von 20 s.',
  'workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder': '20 s (Standard)',
  'workbench.editors.grpc.settings.sendInvalidMessageLabel': 'Ungültige Nachrichten senden',
  'workbench.editors.grpc.settings.sendInvalidMessageHelp':
    'Wenn die Nachricht kein gültiges JSON ist, trotzdem mit leerer Nachricht aufrufen und den Server ' +
    'antworten lassen — meist INVALID_ARGUMENT. Standardmäßig aus: der Aufruf scheitert vor dem Netz mit ' +
    'dem genauen Parse-Fehler. Gilt für jede gRPC-Anfrage.',
  'workbench.editors.grpc.tab.auth': 'Autorisierung',
  'workbench.editors.grpc.auth.inheritUnsupported':
    '{type} — von {source} — kann nicht auf einen gRPC-Aufruf angewendet werden.',
  'workbench.editors.grpc.auth.helpOwn':
    'Wird einmal pro Aufruf erzeugt und als Metadata authorization (oder unter dem eigenen Namen des Schlüssels) am Aufruf gesendet — eine Query-Platzierung reist nie auf einem gRPC-Aufruf. Eine explizite Metadata-Zeile mit demselben Namen hat Vorrang.',
  'workbench.editors.grpc.auth.ownUnsupported': '{type} kann nicht auf einen gRPC-Aufruf angewendet werden.',
  'workbench.editors.grpc.auth.help':
    'Wird als Metadata authorization: Bearer <token> am Aufruf gesendet. Eine explizite ' +
    'authorization-Metadata-Zeile hat Vorrang.',
  'workbench.editors.grpc.invoke.connectCompanion':
    'Verbinde die Desktop-App zum Aufrufen — Verfassen und Speichern funktioniert hier.',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': 'Gestoppt',
  'workbench.editors.grpc.stream.tab.timeline': 'Zeitverlauf',
  'workbench.editors.grpc.stream.trailersPending': 'Trailers kommen an, wenn der Aufruf abgeschlossen ist.',
  'workbench.editors.grpc.stream.sendMessage': 'Nachricht senden',
  'workbench.editors.grpc.stream.endStreaming': 'Streaming beenden',
  'workbench.editors.grpc.stream.controlsIdle': 'Starte zuerst den Aufruf, um den Stream zu öffnen',
  'workbench.editors.grpc.stream.sendFailed': 'Die Nachricht wurde nicht gesendet',
  'workbench.editors.grpc.timeline.requestSent': 'Anfrage gesendet',
  'workbench.editors.grpc.timeline.noMetadataSent': 'Keine Metadaten gesendet.',
  'workbench.editors.grpc.timeline.receivedMetadata': '{metadata} empfangen.',
  'workbench.editors.grpc.timeline.receivedMetadataLink': 'Metadaten',
  'workbench.editors.grpc.timeline.noMetadataReceived': 'Keine Metadaten empfangen.',
  'workbench.editors.grpc.timeline.responseReceived': 'Antwort empfangen',
  'workbench.editors.grpc.timeline.completed': 'Aufruf abgeschlossen',
  'workbench.editors.grpc.timeline.stopped': 'Aufruf gestoppt',
  'workbench.editors.grpc.timeline.failed': 'Aufruf fehlgeschlagen',
  'workbench.editors.grpc.timeline.lost': 'Verbindung verloren',
  'workbench.editors.grpc.timeline.noMatches': 'Keine Nachricht passt.',
  'workbench.editors.grpc.timeline.searchMessages': 'Nachrichten durchsuchen',
  'workbench.editors.grpc.timeline.filterAll': 'Alle',
  'workbench.editors.grpc.timeline.filterSent': 'Gesendet',
  'workbench.editors.grpc.timeline.filterReceived': 'Empfangen',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Nachricht', other: '{count} Nachrichten' }),
  'workbench.editors.grpc.timeline.sortOrder': 'Sortieren und gruppieren',
  'workbench.editors.grpc.timeline.newestFirst': 'Neueste zuerst',
  'workbench.editors.grpc.timeline.oldestFirst': 'Älteste zuerst',
  'workbench.editors.grpc.timeline.showTypes': 'Nachrichtentypen anzeigen',
  'workbench.editors.grpc.timeline.groupByType': 'Nach Nachrichtentyp gruppieren',
  'workbench.editors.grpc.timeline.groupByDirection': 'Nach Richtung gruppieren',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'Zeilen pro Gruppe',
  'workbench.editors.grpc.timeline.noLimit': 'Kein Limit',
  'workbench.editors.grpc.timeline.clearMessages': 'Nachrichten leeren (nur Anzeige)',
  'workbench.editors.grpc.timeline.trustCertificate': 'Zertifikat vertrauen',
  'workbench.editors.grpc.timeline.newMessages': 'Neue Nachrichten',
  'workbench.editors.grpc.timeline.sentAria': 'Gesendete Nachricht',
  'workbench.editors.grpc.timeline.receivedAria': 'Empfangene Nachricht',
  'workbench.editors.grpc.toast.deletedOtherTab': 'Die gRPC-Anfrage wurde in einem anderen Tab gelöscht',
  'workbench.editors.grpc.toast.updateFailed': 'gRPC-Anfrage konnte nicht aktualisiert werden',
  'workbench.editors.grpc.toast.updateFailedDetail': 'gRPC-Anfrage konnte nicht aktualisiert werden: {message}',
  'workbench.editors.grpc.response.saveResponse': 'Antwort speichern',
  'workbench.editors.grpc.toast.savedExample': 'Beispiel „{name}“ gespeichert',
  'workbench.editors.grpc.toast.saveExampleFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  'workbench.editors.grpcExample.loading': 'Beispiel wird geladen…',
  'workbench.editors.grpcExample.notFound': 'Beispiel nicht gefunden.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': 'Das Beispiel wurde in einem anderen Tab gelöscht',
  'workbench.editors.grpcExample.toast.saveFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.grpcExample.toast.saveFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  'workbench.editors.grpcExample.openInRequest': 'In der Anfrage öffnen',
  'workbench.editors.grpcExample.openInRequestTooltip':
    'Den erfassten Aufruf dieses Beispiels als ungespeicherte Änderungen in den Editor der übergeordneten ' +
    'gRPC-Anfrage kopieren',
  'workbench.editors.grpcExample.noMethod': 'Keine Methode aufgezeichnet',
  'workbench.editors.grpcExample.capturedTooltip': 'Erfasst am {date}',
  'workbench.editors.grpcExample.result.title': 'Erfasste Antwort',
} as const satisfies Catalog;
