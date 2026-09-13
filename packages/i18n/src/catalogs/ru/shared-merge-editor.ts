/**
 * Shared merge-editor family — Russian. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included, ` · ` separator), the
 * ✕ ▶ ◀ ↘ ↙ · glyphs, the `+ − ~ =` kind-label prefixes and the
 * `Merge:` command-palette namespace prefix (de / ko precedent) stay
 * raw. Mints: фрагмент = hunk (the Git / GitHub ru documentation
 * term — decided over ханк / блок изменений; one / few / many:
 * фрагмент / фрагмента / фрагментов); входящие / текущие = incoming /
 * current (the SIDES, plural as in «входящие изменения»); входящий /
 * текущий фрагмент = the single hunk; база = base / результат =
 * result; их / мои = theirs / mine; принять = accept (a side);
 * панель = pane; боковые поля = side gutters (поле = the editor
 * gutter); разрешить = resolve; без конфликтов = non-conflicting;
 * объединение = merge (the register — the palette prefix stays raw);
 * общий предок = common ancestor; в ожидании = pending; компактный
 * вид = compact view; Колонки = the Column layout. `{scope}` takes a
 * colon frame (`Заменить входящей версией: {scope}.`).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': 'Предыдущий фрагмент · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': 'Следующий фрагмент · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'Все фрагменты разрешены',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Остался {count} фрагмент',
      few: 'Осталось {count} фрагмента',
      many: 'Осталось {count} фрагментов',
      other: 'Осталось {count} фрагментов',
    }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} конфликт',
      few: '{count} конфликта',
      many: '{count} конфликтов',
      other: '{count} конфликтов',
    }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} без конфликтов',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    'Применить все фрагменты, которые затронула только одна сторона, одним шагом отмены. Конфликты остаются для ручного разрешения. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': 'Применить без конфликтов',
  'shared.mergeEditor.toolbar.acceptAll': 'Принять всё',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': 'Принять все входящие (этот файл)',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': 'Принять все текущие (этот файл)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': 'Принять все входящие (весь сеанс)',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': 'Принять все текущие (весь сеанс)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': 'Принять все входящие',
  'shared.mergeEditor.toolbar.acceptAllCurrent': 'Принять все текущие',
  'shared.mergeEditor.toolbar.baseUnavailable': 'Вид базы недоступен — в этом сеансе нет общего предка.',
  'shared.mergeEditor.toolbar.resetLayout': 'Сбросить размеры панелей для текущей компоновки',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': 'Колонки',
  'shared.mergeEditor.layout.baseOnTop': 'База сверху',
  'shared.mergeEditor.layout.baseInCenter': 'База по центру',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': 'Показывать без конфликтов',
  'shared.mergeEditor.toggle.compactView': 'Компактный вид',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'Свернуть неизменённые области во всех панелях — видимыми остаются только зоны фрагментов (плюс несколько строк контекста). Полезно для файлов, где большинство строк не менялось.',
  'shared.mergeEditor.toggle.singleClickResolve': 'Разрешение одним щелчком',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    'Когда включено, принятие одной стороны фрагмента автоматически отклоняет другую, и фрагмент разрешается одним щелчком. Когда выключено, остаётся диагональное добавление (↘ / ↙), чтобы сложить обе стороны.',
  'shared.mergeEditor.toggle.inlineLabels': 'Встроенные подписи',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    'Показывать подписи «{accept} | {combine} | {ignore}» над каждым ожидающим фрагментом в боковых панелях. Не зависит от компоновки.',
  'shared.mergeEditor.toggle.sideGutters': 'Боковые поля',
  'shared.mergeEditor.toggle.sideGuttersTooltip': 'Показывать глифы ✕ ▶ / ◀ ✕ по бокам редактора результата.',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    'Боковые поля доступны только в компоновке «Колонки» — «База сверху» и «База по центру» помещают результат в отдельный ряд от их / моих.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': 'Принять все входящие (сеанс)',
  'shared.mergeEditor.confirm.acceptCurrentTitle': 'Принять все текущие (сеанс)',
  'shared.mergeEditor.confirm.replaceWithIncoming': 'Заменить входящей версией: {scope}.',
  'shared.mergeEditor.confirm.resetToCurrent': 'Сбросить к вашей текущей версии: {scope}.',
  'shared.mergeEditor.confirm.discardsLocal': 'Это отменит ваши локальные правки во всех файлах сеанса.',
  'shared.mergeEditor.confirm.discardsIncoming': 'Это отбросит все входящие изменения во всех файлах сеанса.',
  'shared.mergeEditor.confirm.okIncoming': 'Принять все входящие',
  'shared.mergeEditor.confirm.okCurrent': 'Принять все текущие',
  'shared.mergeEditor.confirm.cancel': 'Отмена',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} файл',
      few: '{count} файла',
      many: '{count} файлов',
      other: '{count} файлов',
    }),
  'shared.mergeEditor.groupOther': 'Прочее',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': 'При применении возникли ошибки:',
  'shared.mergeEditor.errors.unknown': 'неизвестная ошибка',
  'shared.mergeEditor.emptySession': 'В этом сеансе объединения нет файлов.',
  'shared.mergeEditor.footer.cancel': 'Отмена',
  'shared.mergeEditor.footer.completeMerge': 'Завершить объединение',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': 'Входящие (их)',
  'shared.mergeEditor.pane.result': 'Результат',
  'shared.mergeEditor.pane.yoursEditHere': 'Ваши (мои, правьте здесь)',
  'shared.mergeEditor.pane.current': 'Текущие (мои)',
  'shared.mergeEditor.pane.base': 'База (общий предок)',
  'shared.mergeEditor.sash.columns12': 'Изменить размер колонок 1 / 2',
  'shared.mergeEditor.sash.columns23': 'Изменить размер колонок 2 / 3',
  'shared.mergeEditor.sash.rows': 'Изменить размер верхнего / нижнего ряда',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': 'Добавлен',
  'shared.mergeEditor.fileList.kindModified': 'Изменён',
  'shared.mergeEditor.fileList.kindRemoved': 'Удалён',
  'shared.mergeEditor.fileList.statusUnresolved': 'не разрешён',
  'shared.mergeEditor.fileList.statusPartial': 'частично',
  'shared.mergeEditor.fileList.statusResolved': 'разрешён',
  'shared.mergeEditor.fileList.statusFailed': 'ошибка',
  'shared.mergeEditor.fileList.pairedWith': 'В паре с: {label}',
  'shared.mergeEditor.fileList.hunksRemaining': 'Осталось фрагментов: {count}',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': 'Принять входящие',
  'shared.mergeEditor.zone.acceptCurrent': 'Принять текущие',
  'shared.mergeEditor.zone.acceptCombination': 'Принять комбинацию',
  'shared.mergeEditor.zone.ignore': 'Игнорировать',
  'shared.mergeEditor.zone.combineTooltip': 'Сложить обе стороны — сначала входящие, затем текущие',
  'shared.mergeEditor.zone.removeIncoming': 'Убрать входящие',
  'shared.mergeEditor.zone.removeCurrent': 'Убрать текущие',
  'shared.mergeEditor.zone.revertIncomingTitle': 'Вернуть входящие в ожидание, чтобы решить заново',
  'shared.mergeEditor.zone.revertCurrentTitle': 'Вернуть текущие в ожидание, чтобы решить заново',
  'shared.mergeEditor.zone.statusNoChanges': 'Изменения не приняты',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': 'Входящие + текущие',
  'shared.mergeEditor.zone.statusIncoming': 'Входящие',
  'shared.mergeEditor.zone.statusCurrent': 'Текущие',
  'shared.mergeEditor.zone.statusIncomingSkipped': 'Входящие пропущены',
  'shared.mergeEditor.zone.statusCurrentSkipped': 'Текущие пропущены',
  'shared.mergeEditor.zone.kindAdds': '+ Добавляет',
  'shared.mergeEditor.zone.kindRemoves': '− Удаляет',
  'shared.mergeEditor.zone.kindModifies': '~ Изменяет',
  'shared.mergeEditor.zone.kindUnchanged': '= Без изменений',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: перейти к следующему фрагменту',
  'shared.mergeEditor.action.prevHunk': 'Merge: перейти к предыдущему фрагменту',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: принять входящий фрагмент под курсором',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: принять текущий фрагмент под курсором',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: применить изменения без конфликтов',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: принять все входящие',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: принять все текущие',
  'shared.mergeEditor.action.undo': 'Merge: отменить (буфер + состояние выбора)',
  'shared.mergeEditor.action.redo': 'Merge: повторить (буфер + состояние выбора)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': 'Принять входящие',
  'shared.mergeEditor.gutter.acceptCurrent': 'Принять текущие',
  'shared.mergeEditor.gutter.appendIncoming': 'Также добавить входящие после текущих',
  'shared.mergeEditor.gutter.appendCurrent': 'Также добавить текущие после входящих',
  'shared.mergeEditor.gutter.skipIncoming': 'Пропустить входящие в этом фрагменте',
  'shared.mergeEditor.gutter.skipCurrent': 'Пропустить текущие в этом фрагменте',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'Все фрагменты разрешены.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Остался {count} фрагмент.',
      few: 'Осталось {count} фрагмента.',
      many: 'Осталось {count} фрагментов.',
      other: 'Осталось {count} фрагментов.',
    }),
  'shared.mergeEditor.announce.acceptedIncoming': 'Принят входящий фрагмент.',
  'shared.mergeEditor.announce.acceptedCurrent': 'Принят текущий фрагмент.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Применён {count} фрагмент без конфликтов.',
      few: 'Применено {count} фрагмента без конфликтов.',
      many: 'Применено {count} фрагментов без конфликтов.',
      other: 'Применено {count} фрагментов без конфликтов.',
    }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Принят {count} входящий фрагмент (все).',
      few: 'Приняты все {count} входящих фрагмента.',
      many: 'Приняты все {count} входящих фрагментов.',
      other: 'Приняты все {count} входящих фрагментов.',
    }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Принят {count} текущий фрагмент (все).',
      few: 'Приняты все {count} текущих фрагмента.',
      many: 'Приняты все {count} текущих фрагментов.',
      other: 'Приняты все {count} текущих фрагментов.',
    }),
} as const satisfies Catalog;
