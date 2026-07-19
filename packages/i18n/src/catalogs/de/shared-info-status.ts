/**
 * Shared info-popover corpus — HTTP status codes — German. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes and canonical
 * reason phrases stay raw — only prose translates. Mints: e.g. =
 * z. B.; gateway = Gateway raw (n.); rate limit = Rate-Limit raw
 * (n.); captive portal = Captive Portal raw (n.); upstream server =
 * Upstream-Server (m.); the Body / Authorization tab names ride raw
 * (es precedent).
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'HTTP-Status · {range}',
  'shared.info.status.undocumented':
    'Dieser genaue Code ist in unserem Register nicht dokumentiert — der Bereich oben ist seine ' +
    'Standardbedeutung.',
  'shared.info.status.serverPhrase': 'Der Server hat die Reason-Phrase „{statusText}“ gesendet.',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx Informativ',
  'shared.info.status.range1xx.fallback': 'Zwischenantwort — der Austausch läuft noch, ein endgültiger Status folgt.',
  'shared.info.status.range2xx.kicker': '2xx Erfolg',
  'shared.info.status.range2xx.fallback': 'Die Anfrage wurde empfangen, verstanden und akzeptiert.',
  'shared.info.status.range3xx.kicker': '3xx Umleitung',
  'shared.info.status.range3xx.fallback':
    'Zum Abschluss der Anfrage ist ein weiterer Schritt nötig — sieh dir den Location-Antwort-Header an.',
  'shared.info.status.range4xx.kicker': '4xx Client-Fehler',
  'shared.info.status.range4xx.fallback':
    'Der Server hat die Anfrage in dieser Form abgelehnt — etwas an der Anfrage muss sich ändern.',
  'shared.info.status.range5xx.kicker': '5xx Server-Fehler',
  'shared.info.status.range5xx.fallback':
    'Der Server konnte eine offenbar gültige Anfrage nicht erfüllen — der Fehler liegt auf der Serverseite.',
  'shared.info.status.rangeOther.kicker': 'Nicht standardisiert',
  'shared.info.status.rangeOther.fallback': 'Dieser Code liegt außerhalb der Standard-HTTP-Statusbereiche.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    'Zwischenantwort — der Server hat die Anfrage-Header erhalten und der Client soll mit dem Body fortfahren.',
  'shared.info.status.s101.summary':
    'Der Server hat dem über den Upgrade-Header angefragten Protokollwechsel zugestimmt (z. B. zu WebSocket).',
  'shared.info.status.s102.summary':
    'WebDAV-Zwischenantwort — der Server hat die Anfrage angenommen, aber noch nicht abgeschlossen.',
  'shared.info.status.s103.summary':
    'Zwischenantwort mit Headern (typischerweise Link-Preloads) vor der endgültigen Antwort.',
  'shared.info.status.s200.summary': 'Die Anfrage war erfolgreich und die Antwort trägt das Ergebnis im Body.',
  'shared.info.status.s201.summary': 'Die Anfrage war erfolgreich und eine neue Ressource wurde erstellt.',
  'shared.info.status.s201.body': 'Der Location-Antwort-Header zeigt meist auf die neue Ressource.',
  'shared.info.status.s202.summary':
    'Die Anfrage wurde zur Verarbeitung angenommen, die Verarbeitung ist aber noch nicht abgeschlossen.',
  'shared.info.status.s202.body':
    'Üblich bei asynchronen Jobs — das Ergebnis muss später abgeholt werden, oft über eine Status-URL im Body.',
  'shared.info.status.s203.summary':
    'Die Antwort war erfolgreich, wurde aber von einem transformierenden Proxy zwischen Server und Client verändert.',
  'shared.info.status.s204.summary': 'Die Anfrage war erfolgreich und es gibt absichtlich keinen Antwort-Body.',
  'shared.info.status.s204.body': 'Ein leerer Body-Tab ist hier zu erwarten, kein Fehler.',
  'shared.info.status.s205.summary':
    'Die Anfrage war erfolgreich und der Client soll die auslösende Ansicht zurücksetzen (z. B. das Formular leeren).',
  'shared.info.status.s206.summary':
    'Der Server hat nur den Bytebereich zurückgegeben, der über den Range-Anfrage-Header angefragt wurde.',
  'shared.info.status.s206.body':
    'Content-Range beschreibt, welcher Ausschnitt der vollständigen Ressource dieser Body ist.',
  'shared.info.status.s207.summary':
    'WebDAV-Sammelantwort — der Body trägt einen eigenen Status für jede Teiloperation.',
  'shared.info.status.s208.summary':
    'WebDAV — dieses Element wurde in derselben Multi-Status-Antwort bereits früher aufgeführt.',
  'shared.info.status.s226.summary':
    'Die Antwort ist ein Diff (Instanzmanipulation) gegenüber einer früheren Version, nicht die volle Ressource.',
  'shared.info.status.s300.summary': 'Mehr als eine Repräsentation ist verfügbar und der Server wählt keine aus.',
  'shared.info.status.s301.summary': 'Die Ressource ist dauerhaft zur URL im Location-Header umgezogen.',
  'shared.info.status.s301.body':
    'Clients und Caches merken sich das; aktualisiere die Anfrage-URL auf die neue Adresse.',
  'shared.info.status.s302.summary': 'Die Ressource liegt vorübergehend unter der URL im Location-Header.',
  'shared.info.status.s302.body':
    'Browser schreiben die Methode beim Folgen häufig auf GET um — verwende 307, um die Methode zu erhalten.',
  'shared.info.status.s303.summary': 'Das Ergebnis liegt unter der Location-URL und soll mit GET abgeholt werden.',
  'shared.info.status.s303.body': 'Typisch nach einem POST, mit Umleitung zur erstellten oder resultierenden Seite.',
  'shared.info.status.s304.summary':
    'Die zwischengespeicherte Kopie ist noch gültig — der Server hat absichtlich keinen Body gesendet.',
  'shared.info.status.s304.body': 'Antwort auf bedingte Anfragen (If-None-Match / If-Modified-Since).',
  'shared.info.status.s305.summary':
    'Veraltet — die Ressource muss über den Proxy in Location abgerufen werden. Moderne Clients ignorieren es.',
  'shared.info.status.s307.summary':
    'Vorübergehend unter der Location-URL; Methode und Body müssen beim Folgen erhalten bleiben.',
  'shared.info.status.s308.summary':
    'Dauerhaft unter der Location-URL; Methode und Body müssen beim Folgen erhalten bleiben.',
  'shared.info.status.s400.summary': 'Der Server konnte die Anfrage in dieser Form nicht parsen oder akzeptieren.',
  'shared.info.status.s400.body':
    'Prüfe Body-Syntax, Query-Parameter und Pflicht-Header — der Antwort-Body nennt oft das betroffene Feld.',
  'shared.info.status.s401.summary': 'Der Anfrage fehlen gültige Authentifizierungsdaten.',
  'shared.info.status.s401.body':
    'Der WWW-Authenticate-Antwort-Header nennt das erwartete Schema. Prüfe den Authorization-Tab und die ' +
    'Frische des Tokens.',
  'shared.info.status.s402.summary':
    'Reservierter Code, von manchen APIs für Kontingent- oder Abrechnungsgrenzen verwendet.',
  'shared.info.status.s403.summary':
    'Der Server hat Anfrage und Anmeldedaten verstanden, verweigert sie aber trotzdem.',
  'shared.info.status.s403.body':
    'Anders als bei 401 hilft erneutes Anmelden nicht — dieser Identität fehlt die Berechtigung für diese Ressource.',
  'shared.info.status.s404.summary':
    'Unter dieser URL existiert keine Ressource (oder der Server verbirgt, ob sie existiert).',
  'shared.info.status.s404.body':
    'Prüfe den Pfad und die IDs darin; manche APIs liefern auch 404 statt 403, um die Existenz nicht preiszugeben.',
  'shared.info.status.s405.summary': 'Die Ressource existiert, aber nicht für diese HTTP-Methode.',
  'shared.info.status.s405.body': 'Der Allow-Antwort-Header listet die Methoden auf, die diese URL akzeptiert.',
  'shared.info.status.s406.summary':
    'Der Server kann keine Repräsentation liefern, die zu den Accept-Anfrage-Headern passt.',
  'shared.info.status.s407.summary':
    'Ein Proxy zwischen dir und dem Server verlangt Anmeldedaten (Proxy-Authenticate nennt das Schema).',
  'shared.info.status.s408.summary':
    'Der Server hat das Warten auf den Rest der Anfrage aufgegeben und den Austausch beendet.',
  'shared.info.status.s409.summary': 'Die Anfrage steht im Konflikt mit dem aktuellen Zustand der Ressource.',
  'shared.info.status.s409.body':
    'Typisch bei gleichzeitigen Bearbeitungen oder doppelten Erstellungen — lies die Ressource neu und versuche es erneut.',
  'shared.info.status.s410.summary': 'Die Ressource existierte, wurde aber absichtlich und dauerhaft entfernt.',
  'shared.info.status.s411.summary':
    'Der Server verlangt einen Content-Length-Header und lehnt Chunked- oder größenlose Bodys ab.',
  'shared.info.status.s412.summary':
    'Ein bedingter Header (If-Match, If-Unmodified-Since, …) traf nicht zu, also hat der Server nicht gehandelt.',
  'shared.info.status.s413.summary': 'Der Anfrage-Body überschreitet, was der Server akzeptiert.',
  'shared.info.status.s414.summary':
    'Die Anfrage-URL überschreitet das Limit des Servers — meist Query-String-Daten, die in einen Body gehören.',
  'shared.info.status.s415.summary': 'Der Server lehnt das Body-Format ab.',
  'shared.info.status.s415.body': 'Prüfe den Content-Type-Anfrage-Header gegen das, was die API erwartet.',
  'shared.info.status.s416.summary': 'Der Range-Anfrage-Header verlangt Bytes außerhalb der Ressource.',
  'shared.info.status.s417.summary':
    'Der Server kann den Expect-Anfrage-Header nicht erfüllen (typischerweise Expect: 100-continue).',
  'shared.info.status.s418.summary': 'Aprilscherz-RFC-Code; manche APIs verwenden ihn als verspielte Ablehnung.',
  'shared.info.status.s421.summary':
    'Die Anfrage erreichte einen Server, der für diese Authority nicht zuständig ist (häufig bei ' +
    'wiederverwendeten HTTP/2-Verbindungen).',
  'shared.info.status.s422.summary':
    'Der Body ist syntaktisch gültig, aber semantisch falsch — die Validierung ist fehlgeschlagen.',
  'shared.info.status.s422.body': 'Der Antwort-Body listet meist die Validierungsfehler pro Feld auf.',
  'shared.info.status.s423.summary': 'WebDAV — die Ressource ist durch eine andere Operation gesperrt.',
  'shared.info.status.s424.summary':
    'WebDAV — diese Aktion scheiterte, weil eine frühere Aktion scheiterte, von der sie abhing.',
  'shared.info.status.s425.summary':
    'Der Server verweigert eine Anfrage, die wiederholt eingespielt werden könnte (frühe TLS-Daten).',
  'shared.info.status.s426.summary':
    'Der Server besteht auf einem anderen Protokoll — der Upgrade-Antwort-Header nennt es.',
  'shared.info.status.s428.summary':
    'Der Server verlangt einen bedingten Header (meist If-Match), um verlorene Updates zu verhindern.',
  'shared.info.status.s429.summary': 'Rate-Limit erreicht — mach langsamer.',
  'shared.info.status.s429.body':
    'Der Retry-After-Antwort-Header (falls vorhanden) sagt, wie lange zu warten ist; viele APIs senden auch ' +
    'RateLimit-*-Header.',
  'shared.info.status.s431.summary':
    'Ein Anfrage-Header (oder alle zusammen) überschreitet das Größenlimit des Servers — oft ein übergroßes Cookie.',
  'shared.info.status.s451.summary':
    'Der Server verweigert den Zugriff aus rechtlichen Gründen (Zensur, Gerichtsbeschluss, DSGVO-Löschung).',
  'shared.info.status.s500.summary':
    'Der Server ist auf einen unerwarteten Zustand gestoßen — der Fehler liegt auf der Serverseite.',
  'shared.info.status.s500.body':
    'Ein erneuter Versuch kann helfen, wenn der Fehler vorübergehend ist; sonst liegt die Lösung in den ' +
    'Server-Logs, nicht in der Anfrage.',
  'shared.info.status.s501.summary':
    'Der Server unterstützt die erforderliche Funktionalität nicht — oft eine unbekannte Methode.',
  'shared.info.status.s502.summary': 'Ein Gateway oder Proxy hat eine ungültige Antwort vom Upstream-Server erhalten.',
  'shared.info.status.s502.body':
    'Der Origin hinter dem Proxy fällt aus oder ist nicht erreichbar — meist vorübergehend.',
  'shared.info.status.s503.summary':
    'Der Server kann die Anfrage vorübergehend nicht bearbeiten (Überlast oder Wartung).',
  'shared.info.status.s503.body': 'Retry-After (falls vorhanden) sagt, wann ein neuer Versuch lohnt.',
  'shared.info.status.s504.summary':
    'Ein Gateway oder Proxy hat beim Warten auf den Upstream-Server das Zeitlimit überschritten.',
  'shared.info.status.s505.summary': 'Der Server lehnt die in der Anfrage verwendete HTTP-Protokollversion ab.',
  'shared.info.status.s506.summary':
    'Server-Fehlkonfiguration bei der Inhaltsaushandlung — die gewählte Variante verhandelt sich selbst.',
  'shared.info.status.s507.summary': 'WebDAV — der Server kann nicht speichern, was die Anfrage erfordert.',
  'shared.info.status.s508.summary':
    'WebDAV — der Server hat bei der Verarbeitung der Anfrage eine Endlosschleife festgestellt.',
  'shared.info.status.s510.summary':
    'Die Anfrage braucht eine weitere Erweiterung, damit der Server sie erfüllen kann.',
  'shared.info.status.s511.summary':
    'Das Netzwerk (typischerweise ein Captive Portal) verlangt eine Authentifizierung, bevor es Zugriff gewährt.',
} as const satisfies Catalog;
