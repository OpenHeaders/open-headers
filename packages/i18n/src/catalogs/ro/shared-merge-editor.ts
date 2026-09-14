/**
 * Shared merge-editor family — Romanian. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included, ` · ` separator), the
 * ✕ ▶ ◀ ↘ ↙ · glyphs, the `+ − ~ =` kind-label prefixes and the
 * `Merge:` command-palette namespace prefix (de / ko precedent) stay
 * raw. Mints: bloc = hunk (the Git ro documentation term for a diff
 * hunk — decided over the loanword hunk and fragment; one / few /
 * other: bloc / blocuri / de blocuri); modificări primite / curente =
 * incoming / current (the SIDES, plural as in „modificările primite”);
 * blocul primit / curent = the single hunk; bază = base / rezultat =
 * result; ale lor / ale mele = theirs / mine; acceptare = accept (a
 * side); panou = pane; margini laterale = side gutters (marginea = the
 * editor gutter); rezolvare = resolve; fără conflict = non-conflicting;
 * îmbinare = merge (the register — the palette prefix stays raw);
 * strămoș comun = common ancestor; în așteptare = pending; vizualizare
 * compactă = compact view; Coloane = the Column layout. `{scope}` takes
 * a colon frame (`Înlocuire cu versiunea primită: {scope}.`).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': 'Blocul anterior · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': 'Blocul următor · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'Toate blocurile sunt rezolvate',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} bloc rămas',
      few: '{count} blocuri rămase',
      other: '{count} de blocuri rămase',
    }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} conflict',
      few: '{count} conflicte',
      other: '{count} de conflicte',
    }),
  'shared.mergeEditor.toolbar.nonConflictingCount': 'fără conflict: {count}',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    'Aplică fiecare bloc atins de o singură parte, într-un singur pas de anulare. Conflictele rămân pentru rezolvare manuală. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': 'Aplicare fără conflict',
  'shared.mergeEditor.toolbar.acceptAll': 'Acceptare toate',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': 'Acceptare toate cele primite (acest fișier)',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': 'Acceptare toate cele curente (acest fișier)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': 'Acceptare toate cele primite (întreaga sesiune)',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': 'Acceptare toate cele curente (întreaga sesiune)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': 'Acceptare toate cele primite',
  'shared.mergeEditor.toolbar.acceptAllCurrent': 'Acceptare toate cele curente',
  'shared.mergeEditor.toolbar.baseUnavailable':
    'Vizualizarea de bază nu este disponibilă — niciun strămoș comun în această sesiune.',
  'shared.mergeEditor.toolbar.resetLayout': 'Resetare dimensiuni panouri pentru aspectul curent',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': 'Coloane',
  'shared.mergeEditor.layout.baseOnTop': 'Baza sus',
  'shared.mergeEditor.layout.baseInCenter': 'Baza în centru',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': 'Afișare fără conflict',
  'shared.mergeEditor.toggle.compactView': 'Vizualizare compactă',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'Restrânge regiunile neschimbate din toate panourile — rămân vizibile doar zonele blocurilor (plus câteva linii de context). Util pentru fișierele în care majoritatea liniilor sunt neschimbate.',
  'shared.mergeEditor.toggle.singleClickResolve': 'Rezolvare cu un singur clic',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    'Când este activată, acceptarea unei părți a unui bloc o respinge automat pe cealaltă, astfel încât blocul se rezolvă cu un singur clic. Dezactivată, păstrează afordanța de adăugare în diagonală (↘ / ↙), ca să puteți suprapune ambele părți.',
  'shared.mergeEditor.toggle.inlineLabels': 'Etichete inline',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    'Afișează etichetele „{accept} | {combine} | {ignore}” deasupra fiecărui bloc în așteptare din panourile laterale. Independent de aspect.',
  'shared.mergeEditor.toggle.sideGutters': 'Margini laterale',
  'shared.mergeEditor.toggle.sideGuttersTooltip': 'Afișează glifele ✕ ▶ / ◀ ✕ care flanchează editorul de rezultat.',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    'Marginile laterale sunt disponibile doar în aspectul Coloane — baza sus și baza în centru pun rezultatul pe un rând separat de ale lor / ale mele.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': 'Acceptare toate cele primite (sesiune)',
  'shared.mergeEditor.confirm.acceptCurrentTitle': 'Acceptare toate cele curente (sesiune)',
  'shared.mergeEditor.confirm.replaceWithIncoming': 'Înlocuire cu versiunea primită: {scope}.',
  'shared.mergeEditor.confirm.resetToCurrent': 'Resetare la versiunea dvs. curentă: {scope}.',
  'shared.mergeEditor.confirm.discardsLocal':
    'Aceasta renunță la editările dvs. locale pentru fiecare fișier din sesiune.',
  'shared.mergeEditor.confirm.discardsIncoming':
    'Aceasta renunță la fiecare modificare primită pentru fiecare fișier din sesiune.',
  'shared.mergeEditor.confirm.okIncoming': 'Acceptare toate cele primite',
  'shared.mergeEditor.confirm.okCurrent': 'Acceptare toate cele curente',
  'shared.mergeEditor.confirm.cancel': 'Anulare',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fișier',
      few: '{count} fișiere',
      other: '{count} de fișiere',
    }),
  'shared.mergeEditor.groupOther': 'Altele',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': 'Aplicarea a raportat erori:',
  'shared.mergeEditor.errors.unknown': 'eroare necunoscută',
  'shared.mergeEditor.emptySession': 'Niciun fișier în această sesiune de îmbinare.',
  'shared.mergeEditor.footer.cancel': 'Anulare',
  'shared.mergeEditor.footer.completeMerge': 'Finalizare îmbinare',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': 'Primite (ale lor)',
  'shared.mergeEditor.pane.result': 'Rezultat',
  'shared.mergeEditor.pane.yoursEditHere': 'Ale dvs. (ale mele, editați aici)',
  'shared.mergeEditor.pane.current': 'Curente (ale mele)',
  'shared.mergeEditor.pane.base': 'Bază (strămoșul comun)',
  'shared.mergeEditor.sash.columns12': 'Redimensionare coloana 1 / coloana 2',
  'shared.mergeEditor.sash.columns23': 'Redimensionare coloana 2 / coloana 3',
  'shared.mergeEditor.sash.rows': 'Redimensionare rândul de sus / rândul de jos',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': 'Adăugat',
  'shared.mergeEditor.fileList.kindModified': 'Modificat',
  'shared.mergeEditor.fileList.kindRemoved': 'Eliminat',
  'shared.mergeEditor.fileList.statusUnresolved': 'nerezolvat',
  'shared.mergeEditor.fileList.statusPartial': 'parțial',
  'shared.mergeEditor.fileList.statusResolved': 'rezolvat',
  'shared.mergeEditor.fileList.statusFailed': 'eroare',
  'shared.mergeEditor.fileList.pairedWith': 'Asociat cu: {label}',
  'shared.mergeEditor.fileList.hunksRemaining': 'blocuri rămase: {count}',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': 'Acceptare primit',
  'shared.mergeEditor.zone.acceptCurrent': 'Acceptare curent',
  'shared.mergeEditor.zone.acceptCombination': 'Acceptare combinație',
  'shared.mergeEditor.zone.ignore': 'Ignorare',
  'shared.mergeEditor.zone.combineTooltip': 'Suprapune ambele părți — mai întâi cel primit, apoi cel curent',
  'shared.mergeEditor.zone.removeIncoming': 'Eliminare primit',
  'shared.mergeEditor.zone.removeCurrent': 'Eliminare curent',
  'shared.mergeEditor.zone.revertIncomingTitle': 'Readuce blocul primit în așteptare, ca să puteți decide din nou',
  'shared.mergeEditor.zone.revertCurrentTitle': 'Readuce blocul curent în așteptare, ca să puteți decide din nou',
  'shared.mergeEditor.zone.statusNoChanges': 'Nicio modificare acceptată',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': 'Primit + curent',
  'shared.mergeEditor.zone.statusIncoming': 'Primit',
  'shared.mergeEditor.zone.statusCurrent': 'Curent',
  'shared.mergeEditor.zone.statusIncomingSkipped': 'Primit omis',
  'shared.mergeEditor.zone.statusCurrentSkipped': 'Curent omis',
  'shared.mergeEditor.zone.kindAdds': '+ Adaugă',
  'shared.mergeEditor.zone.kindRemoves': '− Elimină',
  'shared.mergeEditor.zone.kindModifies': '~ Modifică',
  'shared.mergeEditor.zone.kindUnchanged': '= Neschimbat',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: salt la blocul următor',
  'shared.mergeEditor.action.prevHunk': 'Merge: salt la blocul anterior',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: acceptare bloc primit la cursor',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: acceptare bloc curent la cursor',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: aplicare modificări fără conflict',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: acceptare toate cele primite',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: acceptare toate cele curente',
  'shared.mergeEditor.action.undo': 'Merge: anulare (buffer + starea alegerilor)',
  'shared.mergeEditor.action.redo': 'Merge: refacere (buffer + starea alegerilor)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': 'Acceptare primit',
  'shared.mergeEditor.gutter.acceptCurrent': 'Acceptare curent',
  'shared.mergeEditor.gutter.appendIncoming': 'Adăugare și a celui primit după cel curent',
  'shared.mergeEditor.gutter.appendCurrent': 'Adăugare și a celui curent după cel primit',
  'shared.mergeEditor.gutter.skipIncoming': 'Omitere cel primit pentru acest bloc',
  'shared.mergeEditor.gutter.skipCurrent': 'Omitere cel curent pentru acest bloc',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'Toate blocurile sunt rezolvate.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} bloc rămas.',
      few: '{count} blocuri rămase.',
      other: '{count} de blocuri rămase.',
    }),
  'shared.mergeEditor.announce.acceptedIncoming': 'Blocul primit a fost acceptat.',
  'shared.mergeEditor.announce.acceptedCurrent': 'Blocul curent a fost acceptat.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'S-a aplicat {count} bloc fără conflict.',
      few: 'S-au aplicat {count} blocuri fără conflict.',
      other: 'S-au aplicat {count} de blocuri fără conflict.',
    }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'S-a acceptat blocul primit ({count}, toate).',
      few: 'S-au acceptat toate cele {count} blocuri primite.',
      other: 'S-au acceptat toate cele {count} de blocuri primite.',
    }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'S-a acceptat blocul curent ({count}, toate).',
      few: 'S-au acceptat toate cele {count} blocuri curente.',
      other: 'S-au acceptat toate cele {count} de blocuri curente.',
    }),
} as const satisfies Catalog;
