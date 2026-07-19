/**
 * Shared merge-editor family — German. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included), the ✕ ▶ ◀ ↘ ↙ · glyphs and
 * the `+ − ~ =` kind-label prefixes stay raw. `Hunk` (m.) stays raw as
 * merge vocabulary; Merge = Merge raw (m.). Mints: incoming =
 * eingehend; current = aktuell; pane = Bereich (m.); side gutters =
 * seitliche Randspalten; base = Basis (f.).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': 'Vorheriger Hunk · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': 'Nächster Hunk · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'Alle Hunks aufgelöst',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Hunk verbleibend', other: '{count} Hunks verbleibend' }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Konflikt', other: '{count} Konflikte' }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} konfliktfrei',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    'Wendet jeden Hunk an, den nur eine Seite berührt hat, in einem Undo-Schritt. Konflikte bleiben zur ' +
    'manuellen Auflösung. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': 'Konfliktfreie anwenden',
  'shared.mergeEditor.toolbar.acceptAll': 'Alle übernehmen',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': 'Alle eingehenden übernehmen (diese Datei)',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': 'Alle aktuellen übernehmen (diese Datei)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': 'Alle eingehenden übernehmen (ganze Sitzung)',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': 'Alle aktuellen übernehmen (ganze Sitzung)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': 'Alle eingehenden übernehmen',
  'shared.mergeEditor.toolbar.acceptAllCurrent': 'Alle aktuellen übernehmen',
  'shared.mergeEditor.toolbar.baseUnavailable':
    'Basisansicht nicht verfügbar — kein gemeinsamer Vorfahre in dieser Sitzung.',
  'shared.mergeEditor.toolbar.resetLayout': 'Bereichsgrößen für das aktuelle Layout zurücksetzen',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': 'Spalte',
  'shared.mergeEditor.layout.baseOnTop': 'Basis oben',
  'shared.mergeEditor.layout.baseInCenter': 'Basis in der Mitte',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': 'Konfliktfreie anzeigen',
  'shared.mergeEditor.toggle.compactView': 'Kompaktansicht',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'Klappt unveränderte Abschnitte in allen Bereichen ein — sichtbar bleiben nur die Hunk-Stellen (plus ein ' +
    'paar Kontextzeilen). Nützlich bei Dateien, in denen die meisten Zeilen unverändert sind.',
  'shared.mergeEditor.toggle.singleClickResolve': 'Auflösen per Einzelklick',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    'Wenn aktiv, verwirft das Übernehmen einer Seite eines Hunks automatisch die andere, sodass sich der Hunk ' +
    'mit einem Klick auflöst. Wenn aus, bleibt die Diagonal-Anfüge-Affordanz (↘ / ↙) erhalten, sodass du beide ' +
    'Seiten stapeln kannst.',
  'shared.mergeEditor.toggle.inlineLabels': 'Inline-Beschriftungen',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    "Zeigt '{accept} | {combine} | {ignore}'-Beschriftungen über jedem offenen Hunk in den Seitenbereichen. " +
    'Unabhängig vom Layout.',
  'shared.mergeEditor.toggle.sideGutters': 'Seitliche Randspalten',
  'shared.mergeEditor.toggle.sideGuttersTooltip': 'Zeigt ✕ ▶ / ◀ ✕ Glyphen beidseits des Ergebnis-Editors.',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    'Seitliche Randspalten gibt es nur im Spalten-Layout — bei Basis oben und Basis in der Mitte liegt das ' +
    'Ergebnis in einer anderen Zeile als deren / meine Seite.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': 'Alle eingehenden übernehmen (Sitzung)',
  'shared.mergeEditor.confirm.acceptCurrentTitle': 'Alle aktuellen übernehmen (Sitzung)',
  'shared.mergeEditor.confirm.replaceWithIncoming': 'Ersetzt {scope} durch die eingehende Version.',
  'shared.mergeEditor.confirm.resetToCurrent': 'Setzt {scope} auf deine aktuelle Version zurück.',
  'shared.mergeEditor.confirm.discardsLocal': 'Das verwirft deine lokalen Änderungen für jede Datei der Sitzung.',
  'shared.mergeEditor.confirm.discardsIncoming': 'Das verwirft jede eingehende Änderung für jede Datei der Sitzung.',
  'shared.mergeEditor.confirm.okIncoming': 'Alle eingehenden übernehmen',
  'shared.mergeEditor.confirm.okCurrent': 'Alle aktuellen übernehmen',
  'shared.mergeEditor.confirm.cancel': 'Abbrechen',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Datei', other: '{count} Dateien' }),
  'shared.mergeEditor.groupOther': 'Sonstige',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': 'Beim Anwenden wurden Fehler gemeldet:',
  'shared.mergeEditor.errors.unknown': 'unbekannter Fehler',
  'shared.mergeEditor.emptySession': 'Keine Dateien in dieser Merge-Sitzung.',
  'shared.mergeEditor.footer.cancel': 'Abbrechen',
  'shared.mergeEditor.footer.completeMerge': 'Merge abschließen',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': 'Eingehend (deren)',
  'shared.mergeEditor.pane.result': 'Ergebnis',
  'shared.mergeEditor.pane.yoursEditHere': 'Deine (meine, hier bearbeiten)',
  'shared.mergeEditor.pane.current': 'Aktuell (meine)',
  'shared.mergeEditor.pane.base': 'Basis (gemeinsamer Vorfahre)',
  'shared.mergeEditor.sash.columns12': 'Größe von Spalte 1 / Spalte 2 anpassen',
  'shared.mergeEditor.sash.columns23': 'Größe von Spalte 2 / Spalte 3 anpassen',
  'shared.mergeEditor.sash.rows': 'Größe von oberer / unterer Zeile anpassen',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': 'Hinzugefügt',
  'shared.mergeEditor.fileList.kindModified': 'Geändert',
  'shared.mergeEditor.fileList.kindRemoved': 'Entfernt',
  'shared.mergeEditor.fileList.statusUnresolved': 'ungelöst',
  'shared.mergeEditor.fileList.statusPartial': 'teilweise',
  'shared.mergeEditor.fileList.statusResolved': 'gelöst',
  'shared.mergeEditor.fileList.statusFailed': 'fehlgeschlagen',
  'shared.mergeEditor.fileList.pairedWith': 'Gekoppelt mit: {label}',
  'shared.mergeEditor.fileList.hunksRemaining': '{count} Hunks verbleibend',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': 'Eingehendes übernehmen',
  'shared.mergeEditor.zone.acceptCurrent': 'Aktuelles übernehmen',
  'shared.mergeEditor.zone.acceptCombination': 'Kombination übernehmen',
  'shared.mergeEditor.zone.ignore': 'Ignorieren',
  'shared.mergeEditor.zone.combineTooltip': 'Beide Seiten stapeln — zuerst eingehend, dann aktuell',
  'shared.mergeEditor.zone.removeIncoming': 'Eingehendes entfernen',
  'shared.mergeEditor.zone.removeCurrent': 'Aktuelles entfernen',
  'shared.mergeEditor.zone.revertIncomingTitle': 'Eingehendes auf offen zurücksetzen, um neu zu entscheiden',
  'shared.mergeEditor.zone.revertCurrentTitle': 'Aktuelles auf offen zurücksetzen, um neu zu entscheiden',
  'shared.mergeEditor.zone.statusNoChanges': 'Keine Änderungen übernommen',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': 'Eingehend + Aktuell',
  'shared.mergeEditor.zone.statusIncoming': 'Eingehend',
  'shared.mergeEditor.zone.statusCurrent': 'Aktuell',
  'shared.mergeEditor.zone.statusIncomingSkipped': 'Eingehend übersprungen',
  'shared.mergeEditor.zone.statusCurrentSkipped': 'Aktuell übersprungen',
  'shared.mergeEditor.zone.kindAdds': '+ Fügt hinzu',
  'shared.mergeEditor.zone.kindRemoves': '− Entfernt',
  'shared.mergeEditor.zone.kindModifies': '~ Ändert',
  'shared.mergeEditor.zone.kindUnchanged': '= Unverändert',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: Zum nächsten Hunk',
  'shared.mergeEditor.action.prevHunk': 'Merge: Zum vorherigen Hunk',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: Eingehenden Hunk am Cursor übernehmen',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: Aktuellen Hunk am Cursor übernehmen',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: Konfliktfreie Änderungen anwenden',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: Alle eingehenden übernehmen',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: Alle aktuellen übernehmen',
  'shared.mergeEditor.action.undo': 'Merge: Rückgängig (Puffer + Auswahlzustand)',
  'shared.mergeEditor.action.redo': 'Merge: Wiederholen (Puffer + Auswahlzustand)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': 'Eingehendes übernehmen',
  'shared.mergeEditor.gutter.acceptCurrent': 'Aktuelles übernehmen',
  'shared.mergeEditor.gutter.appendIncoming': 'Eingehendes zusätzlich nach dem Aktuellen anfügen',
  'shared.mergeEditor.gutter.appendCurrent': 'Aktuelles zusätzlich nach dem Eingehenden anfügen',
  'shared.mergeEditor.gutter.skipIncoming': 'Eingehendes für diesen Hunk überspringen',
  'shared.mergeEditor.gutter.skipCurrent': 'Aktuelles für diesen Hunk überspringen',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'Alle Hunks aufgelöst.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Hunk verbleibend.', other: '{count} Hunks verbleibend.' }),
  'shared.mergeEditor.announce.acceptedIncoming': 'Eingehenden Hunk übernommen.',
  'shared.mergeEditor.announce.acceptedCurrent': 'Aktuellen Hunk übernommen.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} konfliktfreien Hunk angewendet.',
      other: '{count} konfliktfreie Hunks angewendet.',
    }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} eingehenden Hunk übernommen.',
      other: 'Alle {count} eingehenden Hunks übernommen.',
    }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} aktuellen Hunk übernommen.',
      other: 'Alle {count} aktuellen Hunks übernommen.',
    }),
} as const satisfies Catalog;
