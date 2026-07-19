/**
 * DevTools panel — inspector stream tabs — German. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, and
 * Base64 / Hex / UTF-8 modes stay parity-raw. Mints: Frame / Event /
 * Payload / Stream / Wrapper / Keepalive ride raw (m. / n. / f. / m. /
 * m. / n.); wire = die Leitung (carried); dropped = verworfen;
 * injected = injiziert; synthetic = synthetisch; delivered =
 * zugestellt; seeded = vorbefüllt aus; message rule =
 * Nachrichtenregel; capture plane = Erfassungsebene; payload viewer =
 * Payload-Viewer raw (m.); endpoints = Endpunkte; "this side" of the
 * split = diese Hälfte (die Seite stays the page); amber fire dot =
 * bernsteinfarbener Auslösungspunkt.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ──────────────────
  'panel.inspector.streams.clearAll': 'Alle löschen',
  'panel.inspector.streams.directionFilterTitle': 'Nach Richtung filtern',
  'panel.inspector.streams.directionAll': 'Alle',
  'panel.inspector.streams.directionSend': 'Senden',
  'panel.inspector.streams.directionReceive': 'Empfangen',
  'panel.inspector.streams.filterAria': 'Stream-Nachrichten filtern',
  'panel.inspector.streams.sortByTitle': 'Nach {column} sortieren',
  'panel.inspector.streams.resizeColumnAria': 'Breite der Spalte {column} ändern',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'Ansicht',
  'panel.inspector.streams.view.layout': 'Layout',
  'panel.inspector.streams.view.layoutCompact': 'Kompakt',
  'panel.inspector.streams.view.layoutWide': 'Breit',
  'panel.inspector.streams.view.split': 'Teilung',
  'panel.inspector.streams.view.splitSideBySide': 'Nebeneinander',
  'panel.inspector.streams.view.splitStacked': 'Übereinander',
  'panel.inspector.streams.view.splitDisabledTitle': 'Aktiviere die Payload-Vorschau, um den Bereich zu teilen',
  'panel.inspector.streams.view.showPreview': 'Payload-Vorschau anzeigen',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame':
    'Regel angewendet — die Payload des Frames stimmt mit der Payload der Regel überein',
  'panel.inspector.streams.fire.inferredFrame': 'Regel hat gegriffen — Anwendung für diesen Frame nicht verifizierbar',
  'panel.inspector.streams.fire.injectedFrame': 'Regel angewendet — dieser Frame wurde von der Regel injiziert',
  'panel.inspector.streams.fire.replacedFrame': 'Regel angewendet — die Regel hat diesen Frame ersetzt',
  'panel.inspector.streams.fire.droppedSendFrame':
    'Regel hat diesen Frame verworfen — er wurde nie an den Server gesendet',
  'panel.inspector.streams.fire.droppedRecvFrame': 'Regel hat diesen Frame verworfen — die Seite hat ihn nie empfangen',
  'panel.inspector.streams.fire.appliedEvent':
    'Regel angewendet — die Payload des Events stimmt mit der Payload der Regel überein',
  'panel.inspector.streams.fire.inferredEvent': 'Regel hat gegriffen — Anwendung für dieses Event nicht verifizierbar',
  'panel.inspector.streams.fire.injectedEvent': 'Regel angewendet — dieses Event wurde von der Regel injiziert',
  'panel.inspector.streams.fire.replacedEvent': 'Regel angewendet — die Regel hat dieses Event ersetzt',
  'panel.inspector.streams.fire.droppedEvent': 'Regel hat dieses Event verworfen — die Seite hat es nie empfangen',
  'panel.inspector.streams.row.copied': 'Kopiert',
  'panel.inspector.streams.row.copyPayload': 'Payload kopieren',
  'panel.inspector.streams.row.editRule': 'Regel bearbeiten',
  'panel.inspector.streams.row.override': 'Überschreiben',
  'panel.inspector.streams.row.droppedSendCell': 'Verworfen — nie an den Server gesendet',
  'panel.inspector.streams.row.droppedRecvCell': 'Verworfen — nie an die Seite zugestellt',
  'panel.inspector.streams.row.notCaptured': 'Nicht erfasst',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Nachrichten filtern',
  'panel.inspector.messages.listAria': 'WebSocket-Nachrichten',
  'panel.inspector.messages.overrideMessage': 'Nachricht überschreiben',
  'panel.inspector.messages.overrideMessageTitle': 'Eine Nachrichtenregel für diese Verbindung anlegen',
  'panel.inspector.messages.editRuleTitle': 'Die Nachrichtenregel bearbeiten, die auf diesen Frame gewirkt hat',
  'panel.inspector.messages.createRuleTitle': 'Eine aus diesem Frame vorbefüllte Nachrichtenregel anlegen',
  'panel.inspector.messages.syntheticDroppedTitle':
    'Synthetische Zeile — die Seite hat diesen Frame erzeugt; die Regel hat ihn vor dem Senden verworfen',
  'panel.inspector.messages.syntheticInjectedTitle':
    'Synthetischer Frame — von einer Regel innerhalb der Seite injiziert; ging nie über die Leitung',
  'panel.inspector.messages.emptyNoDebug':
    'WebSocket-Frames sind nur sichtbar, wenn der Debug-Modus für diesen Tab aktiviert ist.',
  'panel.inspector.messages.emptySynthetic':
    'Kein Frame ging über die Leitung — hier hat eine Injektionsregel ausgelöst, und injizierte Frames werden ' +
    'synthetisch innerhalb der Seite zugestellt, unsichtbar für die Netzwerk-Erfassung.',
  'panel.inspector.messages.emptyNone': 'Noch keine WebSocket-Frames ausgetauscht.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} älterer Frame verworfen.',
      other: '{count} ältere Frames verworfen.',
    });
    return `Die letzten ${String(shown)} Frames werden angezeigt — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Events filtern',
  'panel.inspector.sse.listAria': 'Server-Sent Events',
  'panel.inspector.sse.overrideEvent': 'Event überschreiben',
  'panel.inspector.sse.overrideEventTitle': 'Eine Nachrichtenregel für diesen Stream anlegen',
  'panel.inspector.sse.editRuleTitle': 'Die Nachrichtenregel bearbeiten, die auf dieses Event gewirkt hat',
  'panel.inspector.sse.createRuleTitle': 'Eine aus diesem Event vorbefüllte Nachrichtenregel anlegen',
  'panel.inspector.sse.syntheticTitle':
    'Synthetisches Event — von einer Regel innerhalb der Seite injiziert; ging nie über die Leitung',
  'panel.inspector.sse.emptySynthetic':
    'Kein Event ging über die Leitung — hier hat eine Injektionsregel ausgelöst, und injizierte Events werden ' +
    'synthetisch innerhalb der Seite zugestellt, unsichtbar für die Netzwerk-Erfassung.',
  'panel.inspector.sse.emptyUnparseable': 'Keine SSE-Events im Antwort-Body, die sich parsen lassen.',
  'panel.inspector.sse.emptyNoDebug':
    'Keine Events erfasst. Ohne Debug-Modus werden Server-Sent-Streams erst materialisiert, wenn die Anfrage ' +
    'abgeschlossen ist; langlaufende Streams erscheinen hier unter Umständen erst, wenn die Verbindung ' +
    'geschlossen wird.',
  'panel.inspector.sse.emptyNone': 'Noch keine Events empfangen.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} älteres Event verworfen.',
      other: '{count} ältere Events verworfen.',
    });
    return `Die letzten ${String(shown)} Events werden angezeigt — ${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': 'Keine Nachricht ausgewählt',
  'panel.inspector.streams.preview.noMessageHint': 'Wähle eine Nachricht, um ihren Inhalt anzusehen.',
  'panel.inspector.streams.preview.noEventTitle': 'Kein Event ausgewählt',
  'panel.inspector.streams.preview.noEventHint': 'Wähle ein Event, um seinen Inhalt anzusehen.',
  'panel.inspector.streams.preview.raw': 'Roh',
  'panel.inspector.streams.preview.copy': 'Kopieren',
  'panel.inspector.streams.preview.copied': 'Kopiert',
  'panel.inspector.streams.preview.copyTitle': 'In die Zwischenablage kopieren',
  'panel.inspector.streams.preview.decodeFailed': 'Die binäre Payload konnte nicht decodiert werden.',
  'panel.inspector.messages.preview.droppedSendPane':
    'Die Regel hat diesen Frame verworfen — die Seite hat ihn erzeugt, aber er wurde nie an den Server gesendet.',
  'panel.inspector.messages.preview.droppedRecvPane':
    'Die Regel hat diesen Frame verworfen — er hat den Browser erreicht, wurde aber nie an die Seite zugestellt.',
  'panel.inspector.messages.preview.originalNotCaptured':
    'Der von der Seite erzeugte Frame wurde nicht erfasst — nur der veränderte Frame ging über die Leitung.',
  'panel.inspector.messages.preview.syntheticNote':
    'Synthetischer Frame — von einer Regel innerhalb der Seite injiziert; er ging nie über die Leitung.',
  'panel.inspector.sse.preview.droppedPane':
    'Die Regel hat dieses Event verworfen — es hat den Browser erreicht, wurde aber nie an die Seite zugestellt.',
  'panel.inspector.sse.preview.syntheticNote':
    'Synthetisches Event — von einer Regel innerhalb der Seite injiziert; es ging nie über die Leitung.',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': 'Abgeleitet, nicht erfasst',
  'panel.inspector.messages.inferredModified.summary':
    'Diese Hälfte zeigt die Ersatz-Payload der Regel — die Erfassungsebene hat nur den Frame auf der Leitung ' +
    'gesehen.',
  'panel.inspector.messages.inferredModified.description':
    'Die Leitung hat den ursprünglichen Frame aufgezeichnet; die Änderung geschah innerhalb der Seite nach der ' +
    'Erfassung. Dass genau dieser Frame den Ersatz erhalten hat, ist aus dem Frame-Selektor der Regel ' +
    'abgeleitet, passend zum bernsteinfarbenen Auslösungspunkt.',
  'panel.inspector.messages.inferredDropped.title': 'Verworfen, abgeleitet',
  'panel.inspector.messages.inferredDropped.summary':
    'Die Leitung hat diesen Frame aufgezeichnet, aber die Regel hat seine Zustellung innerhalb der Seite gestoppt.',
  'panel.inspector.messages.inferredDropped.description':
    'Das Verwerfen geschieht nach der Erfassung, daher kann nichts die Nicht-Zustellung selbst aufzeichnen. Dass ' +
    'genau dieser Frame verworfen wurde, ist aus dem Frame-Selektor der Regel abgeleitet, passend zum ' +
    'bernsteinfarbenen Auslösungspunkt.',
  'panel.inspector.sse.inferredModified.title': 'Abgeleitet, nicht erfasst',
  'panel.inspector.sse.inferredModified.summary':
    'Diese Hälfte zeigt die Ersatz-Payload der Regel — die Erfassungsebene hat nur das Event auf der Leitung ' +
    'gesehen.',
  'panel.inspector.sse.inferredModified.description':
    'Die Leitung hat das ursprüngliche Event aufgezeichnet; die Änderung geschah innerhalb der Seite nach der ' +
    'Erfassung. Dass genau dieses Event den Ersatz erhalten hat, ist aus dem Event-Selektor der Regel ' +
    'abgeleitet, passend zum bernsteinfarbenen Auslösungspunkt.',
  'panel.inspector.sse.inferredDropped.title': 'Verworfen, abgeleitet',
  'panel.inspector.sse.inferredDropped.summary':
    'Die Leitung hat dieses Event aufgezeichnet, aber die Regel hat seine Zustellung innerhalb der Seite gestoppt.',
  'panel.inspector.sse.inferredDropped.description':
    'Das Verwerfen geschieht nach der Erfassung, daher kann nichts die Nicht-Zustellung selbst aufzeichnen. Dass ' +
    'genau dieses Event verworfen wurde, ist aus dem Event-Selektor der Regel abgeleitet, passend zum ' +
    'bernsteinfarbenen Auslösungspunkt.',

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Beispiel-Frame',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'Zeichen ·',
  'panel.inspector.messages.columnInfo.data.summary':
    'Die Frame-Payload — Text-Frames zeigen ihren Inhalt unverändert.',
  'panel.inspector.messages.columnInfo.data.description':
    'Wähle eine Zeile, um den Payload-Viewer zu öffnen: ein JSON-Baum, wenn sich der Text parsen lässt, ein ' +
    'Viewer mit Base64 / Hex / UTF-8 für binäre Frames.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'Anstelle der Payload',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'Ein binärer Frame — die Bytes leben im Payload-Viewer, nicht in der Zelle.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc':
    'Keepalive-Steuerframes, die zwischen den Endpunkten ausgetauscht werden.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'Der abschließende Handshake, der den Socket beendet.',
  'panel.inspector.messages.columnInfo.length.summary':
    'Die Payload-Größe — eine bloße Zeichenanzahl bei Text-Frames, formatierte Bytes (z. B. `4 B`) bei binären ' +
    'Frames.',
  'panel.inspector.messages.columnInfo.time.summary': 'Die Uhrzeit, zu der der Frame über die Leitung ging.',
  'panel.inspector.messages.columnInfo.time.description':
    'Die einzige sortierbare Spalte. Aufsteigend ist die Leitungsreihenfolge; Frames in derselben Millisekunde ' +
    'behalten in beide Richtungen ihre Ankunftsreihenfolge.',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': 'In welche Richtung der Frame unterwegs war.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Pfeile',
  'panel.inspector.messages.directionInfo.sentDesc': 'Gesendet — die Seite hat diesen Frame an den Server geschickt.',
  'panel.inspector.messages.directionInfo.receivedDesc':
    'Empfangen — der Server hat diesen Frame an die Seite geschickt.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Fehler — ein Transportfehler hat den Stream beendet; die Zeile erscheint rot.',
  'panel.inspector.streams.fireRail.title': 'Regel-Auslösungen',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Punktfarben',
  'panel.inspector.messages.fireRail.summary':
    'Ein Punkt markiert jeden Frame, auf den eine WebSocket-Nachrichtenregel gewirkt hat. Frames tragen keine ' +
    'Regel-Attribution, daher ist der Punkt abgeleitet: die ausgelösten Nachrichtenregeln dieser Anfrage, mit ' +
    'dem Frame-Selektor jeder Regel erneut gegen den Frame ausgeführt.',
  'panel.inspector.messages.fireRail.appliedDesc':
    'Angewendet — die Payload des Frames ist gleich der Ersatz-Payload oder der injizierten Payload der Regel.',
  'panel.inspector.messages.fireRail.inferredDesc':
    'Abgeleitet — Richtung und Nachrichtenfilter der Regel wählen diesen Frame aus, aber die Anwendung ist ' +
    'nicht verifizierbar (ein veränderter Frame enthält die Payload nicht mehr, auf die der Filter gepasst hat).',
  'panel.inspector.messages.fireRail.description':
    'Ein verworfener ausgehender Frame geht nie über die Leitung und hat daher gar keine Zeile. Ein verworfener ' +
    'eingehender Frame wurde zuerst auf der Leitung erfasst — seine Zeile bleibt, markiert mit „Verworfen — nie ' +
    'an die Seite zugestellt“.',
  'panel.inspector.sse.columnInfo.exampleCaption': 'Beispiel-Event',
  'panel.inspector.sse.columnInfo.id.summary':
    'Das `id:`-Feld des Events — der Wiederverbindungs-Cursor, den der Server ausgibt.',
  'panel.inspector.sse.columnInfo.id.description':
    'Leer, wenn der Server keine id sendet. Beim Wiederverbinden schickt der Browser die letzte id als ' +
    '`Last-Event-ID` zurück, damit der Server den Stream dort fortsetzen kann, wo er aufgehört hat.',
  'panel.inspector.sse.columnInfo.type.summary': 'Das `event:`-Feld des Events — `message` bei Standard-Events.',
  'panel.inspector.sse.columnInfo.type.description':
    'Seitencode abonniert pro Typ: `onmessage` sieht nur Standard-Events; benannte Events brauchen einen ' +
    '`addEventListener` für genau diesen Typ.',
  'panel.inspector.sse.columnInfo.data.summary':
    'Die Event-Payload — immer Text; mehrzeilige `data:`-Felder kommen zusammengefügt an.',
  'panel.inspector.sse.columnInfo.data.description':
    'Wähle eine Zeile, um den Payload-Viewer zu öffnen: ein JSON-Baum, wenn sich der Text parsen lässt, ' +
    'andernfalls unverändert.',
  'panel.inspector.sse.columnInfo.time.summary': 'Die Uhrzeit, zu der das Event angekommen ist.',
  'panel.inspector.sse.columnInfo.time.description':
    'Sortierbar, standardmäßig aufsteigend. Events, die aus einem fertigen Antwort-Body geparst wurden, tragen ' +
    'keine Zeit — das SSE-Leitungsformat hat keine — daher bleiben ihre Zellen leer.',
  'panel.inspector.sse.fireRail.summary':
    'Ein Punkt markiert jedes Event, auf das eine SSE-Nachrichtenregel gewirkt hat. Eine vom Wrapper ' +
    'aufgezeichnete Erfassung ist ein Beweis; ohne sie ist der Punkt abgeleitet: die ausgelösten SSE-Regeln ' +
    'dieser Anfrage, mit dem Event-Selektor jeder Regel erneut gegen das Event ausgeführt.',
  'panel.inspector.sse.fireRail.appliedDesc':
    'Angewendet — der Wrapper hat aufgezeichnet, dass er auf genau dieses Event gewirkt hat, oder eine ' +
    'injizierte Payload stimmt überein.',
  'panel.inspector.sse.fireRail.inferredDesc':
    'Abgeleitet — Event-Name und Datenfilter der Regel wählen dieses Event aus, aber die Anwendung ist allein ' +
    'von der Leitung aus nicht verifizierbar.',
  'panel.inspector.sse.fireRail.description':
    'Server-Sent Events reisen nur in Richtung Server → Seite, und die Leitung zeichnet sie auf, bevor die ' +
    'Regel wirkt: ein verworfenes Event behält seine Zeile, markiert mit „Verworfen — nie an die Seite ' +
    'zugestellt“; ein injiziertes Event geht nie über die Leitung und erscheint als synthetische Zeile.',
} as const satisfies Catalog;
