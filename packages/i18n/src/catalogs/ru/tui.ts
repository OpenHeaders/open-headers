/**
 * TUI namespace — Russian. Mirrors `catalogs/en/tui.ts` key for key.
 * Data stays data: workspace / environment / rule names, uids, URLs,
 * kinds, and daemon-provided copy render verbatim in the composers;
 * `OpenHeaders`, `env: {name}`, `{count} vars`, `uid`, `oh status`, the
 * `r` key ride raw (ja / ko parity) with клавиша / команда as head
 * nouns (нажмите r — the bare key reads as a caption). Quotes the
 * shipped ru mints: демон = daemon (wire noun, workbench-chrome),
 * инструмент командной строки oh (settings panes), Палитра команд,
 * рабочее пространство / окружение / правило, вкл. / выкл. = on / off
 * (the abbreviated state pair), черновик = draft, опубликовать =
 * publish, Переключить = switch, Обновить, подключено = connected,
 * панель = pane. MINTS: панель мониторинга = dashboard; замаскировано
 * = masked; снять с публикации = unpublish (a rule — Прекратить
 * публикацию stays the workspace public-share verb); экран ожидания =
 * the park screen. Footer legend verbs stay bare infinitives / nouns
 * (the terminal width budget — shortest correct form).
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: нет',
  'tui.header.connected': 'подключено',
  'tui.header.unreachable': 'демон недоступен',
  'tui.header.synced': 'синхронизировано {ago} назад',
  'tui.header.syncedJustNow': 'синхронизировано только что',
  'tui.header.syncing': 'синхронизация…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'Рабочие пространства',
  'tui.pane.environments': 'Окружения',
  'tui.pane.rules': 'Правила',
  'tui.pane.rules.summary': '{on} вкл. {sep} {off} выкл. {sep} {draft} черн.',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'вкл.',
  'tui.row.off': 'выкл.',
  'tui.row.draft': '(черновик)',
  'tui.row.notLoaded': 'не загружено',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': 'Без окружения',
  'tui.row.masked': '(замаскировано)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': 'перейти',
  'tui.footer.open': 'открыть',
  'tui.footer.filter': 'фильтр',
  'tui.footer.refresh': 'обновить',
  'tui.footer.yank': 'скопировать uid',
  'tui.footer.quit': 'выход',
  'tui.footer.back': 'назад',
  'tui.footer.scroll': 'прокрутка',
  'tui.footer.retryNow': 'повторить сейчас',
  'tui.footer.palette': 'палитра',
  'tui.footer.help': 'справка',
  'tui.footer.toggle': 'переключить',
  'tui.footer.publish': 'опубликовать',
  'tui.footer.switch': 'сменить',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'Клавиатура',
  'tui.help.group.navigate': 'Навигация',
  'tui.help.group.act': 'Действия',
  'tui.help.group.find': 'Поиск',
  'tui.help.group.session': 'Сеанс',
  'tui.help.topBottom': 'в начало / в конец',
  'tui.help.page': 'страница',
  'tui.help.focusPane': 'фокус на панель',
  'tui.help.backClear': 'назад / очистить',
  'tui.help.filterPane': 'фильтр панели',
  'tui.help.thisHelp': 'эта справка',
  'tui.help.palette': 'палитра команд',
  'tui.help.openSwitch': 'открыть / сменить',
  'tui.help.toggleRule': 'переключить правило',
  'tui.help.publish': 'опубл./снять',
  'tui.help.note': 'Те же клавиши, что и в приложении, где терминал это позволяет.',
  'tui.help.close': 'закрыть',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': 'Обновить сейчас',
  'tui.palette.action.help': 'Открыть справку',
  'tui.palette.action.switchWorkspace': 'Сменить рабочее пространство…',
  'tui.palette.action.switchEnvironment': 'Сменить окружение…',
  'tui.palette.action.toggleRule': 'Переключить включение правила',
  'tui.palette.action.publishRule': 'Опубликовать / снять с публикации правило',
  'tui.palette.picker.workspace': 'Сменить рабочее пространство',
  'tui.palette.picker.environment': 'Сменить окружение',
  'tui.palette.empty': 'подходящих команд нет',
  'tui.palette.run': 'выполнить',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'фильтр: /{query} {sep} совпадений: {count}',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid скопирован в буфер обмена',
  'tui.notice.staleData': 'показаны последние известные данные — переподключение…',
  'tui.notice.writeLost': 'изменение не применено — демон недоступен',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'В этом рабочем пространстве пока нет правил.',
  'tui.empty.rules.body':
    'Правила создаются в приложении OpenHeaders — панель мониторинга подхватит их, как только они появятся. Нажмите r, чтобы обновить.',
  'tui.empty.environments.title': 'В этом рабочем пространстве пока нет окружений.',
  'tui.empty.environments.body':
    'Окружения создаются в приложении OpenHeaders. Пока что можно выбрать «Без окружения».',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'Правило: {name}',
  'tui.detail.state': 'состояние',
  'tui.detail.type': 'тип',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': 'опубликовано — действует в подключённых расширениях браузера',
  'tui.detail.state.draft': 'черновик — не влияет на живой трафик',
  'tui.detail.editingNote': 'Редактирование — в приложении OpenHeaders; TUI читает и переключает.',
  'tui.detail.loading': 'загрузка…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': 'Окружение: {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'Демон недоступен или MCP выключен',
  'tui.park.body1': 'Демон OpenHeaders недоступен по адресу',
  'tui.park.body2': '{url}, либо его поверхность MCP выключена.',
  'tui.park.hint1': 'Запустите приложение OpenHeaders (или ваш хост демона),',
  'tui.park.hint2': 'или проверьте поверхность командой:  oh status',
  'tui.park.hint3': 'Затем нажмите r, чтобы повторить.',
  'tui.park.retryIn': 'автоматический повтор {sep} следующая попытка через {seconds}s',
  'tui.park.retrying': 'повтор…',
} as const satisfies Catalog;
