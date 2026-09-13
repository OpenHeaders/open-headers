/**
 * Shared namespace — Russian. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules. Register contract for the
 * ru catalogs (pattern-setter): formal вы, written lowercase (the
 * Microsoft / Google ru software convention — never Вы, never ты);
 * requests to the user are polite imperatives (Нажмите, Введите,
 * Скопируйте); labels, buttons and menu rows are nouns or infinitives
 * (Сохранить, Закрыть, Копировать, Отмена), never 2nd-person forms;
 * sentence case everywhere — only the first word of a label is
 * capitalized (Изменить заголовки). The letter ё is always written.
 * Typography: «…» for UI labels quoted in prose (en's “” and "" alike),
 * JSON-wire quotes stay ASCII; the en aside dash KEEPS as a spaced
 * em dash ` — ` (native Russian punctuation — never restructured);
 * ellipsis is `…`; no space before `?!:;`; en's unspaced `{percent}%`
 * figure style kept; a `{count} с` unit takes a space (2 с, 5 000 мс)
 * while raw glossary units (`{period}s`, `ms`) copy en's spacing.
 * CASE-ENDING LAW: the lint's glossary boundary treats Cyrillic as a
 * letter, so a raw token NEVER takes a butted case ending (`URLа`,
 * `JWTом` read as dropped terms) — use the hyphenated apposition
 * (URL-адрес, JWT-токен, API-ключ, CSP-директивы, JSON-значение) or a
 * head noun (токен Bearer, заголовок Cookie, окно DevTools, браузер
 * Chrome, соединение WebSocket); a `{placeholder}` hole takes no case
 * ending and no agreeing adjective — restructure with a head noun
 * (версия {version}, хост {name}, соединение с {label}) or a colon
 * frame (`Отклонено: {reason}`). Gender of raw nouns, decided once:
 * URL м. р. (адрес), API м. р. (интерфейс), JWT м. р. (токен),
 * WebSocket м. р. (протокол / сокет), Vault м. р. (раздел), Live м. р.
 * as a product noun (переменные Live, рабочий процесс Live — never
 * лайв / живой), Cookie м. р. (файл cookie — prose lowercase `cookie`
 * stays Latin as Chrome's ru UI writes it: файлы cookie; the capitalized
 * `Cookie` header stays raw with заголовок as head noun); en prose
 * "header" TRANSLATES as заголовок (the CJK "Header raw" law does not
 * carry) — only the glossary `Header` JWT part / `Headers` DevTools tab
 * ride raw. Plurals: `plural()` with one / few / many / other (CLDR ru;
 * {count} правило / правила / правил / правил — the lint enforces the
 * four keys); never pluralize a raw token. Loanword ledger: сервер,
 * заголовок, браузер, пользователь, редактор, папка, рабочее
 * пространство = workspace, бэкенд = back-end, рукопожатие = handshake,
 * сопряжение = pairing, настольное приложение = desktop app,
 * всплывающее окно = popup, проверка = probe, буфер обмена = clipboard,
 * коллекция, секрет, прокси, скрипт, фрейм, поток = stream, домен, кеш,
 * флаг, панель, док, вкладка, оболочка = shell, коммит, токен = token
 * (fr jeton precedent — Cyrillic in prose, raw only as a grammar / code
 * token), рабочий процесс = workflow, окно инструментов = tool window.
 * Domain nouns: правило = rule, запрос = request, ответ = response,
 * переменная, окружение = environment, область = scope, Переопределить
 * = Override, Объединить = Merge, Добавить в конец = Append,
 * Переключить = Switch, Настройки = Settings, Включено / Выключено =
 * Enabled / Disabled, динамический = Dynamic, шаг = Step, расширение =
 * extension, Рабочая среда = Workbench (the surface name — distinct from
 * рабочее пространство = workspace). Dev nouns retain English liberally: the glossary raw-token
 * laws carry over unchanged (WebSocket, URL, Org / DevTools / JWT part
 * names raw). The diagram width helper counts Cyrillic as 1.0 like
 * Latin, but Russian runs ~25% longer than English — diagram labels
 * take the shortest correct form.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Сохранить',
  'shared.action.cancel': 'Отмена',
  'shared.action.close': 'Закрыть',
  'shared.action.copy': 'Копировать',
  'shared.action.remove': 'Удалить',
  'shared.toast.copiedToClipboard': 'Скопировано в буфер обмена',
  'shared.toast.copyFailed': 'Доступ к буферу обмена запрещён — скопируйте значение вручную',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} правило',
      few: '{count} правила',
      many: '{count} правил',
      other: '{count} правил',
    }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': 'Что-то пошло не так',
  'shared.errorBoundary.subtitle': 'Не удалось загрузить всплывающее окно. Закройте его и откройте снова.',
  'shared.errorBoundary.reload': 'Перезагрузить',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Расширение Open Headers было обновлено или перезагружено',
  'shared.contextInvalidated.body': 'Закройте и снова откройте DevTools, чтобы продолжить.',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': 'Соединение установлено',
  'shared.probe.reachableDescription': 'Соединение с {label} установлено.',
  'shared.probe.notReachable': 'Нет соединения',
  'shared.probe.title.authRequired': 'Доступен, но требуется аутентификация',
  'shared.probe.title.workspaceUnknown': 'Доступен, но это рабочее пространство ему неизвестно',
  'shared.probe.title.versionMismatch': 'Доступен, но версии не совпадают',
  'shared.probe.title.notReady': 'Доступен, но не готов',
  'shared.probe.fail.invalidUrl': 'Недопустимый URL-адрес.',
  'shared.probe.fail.invalidUrlDetail': 'Недопустимый URL-адрес. {detail}',
  'shared.probe.fail.timeout': 'Истекло время ожидания ответа — бэкенд запущен?',
  'shared.probe.fail.closedBeforeWelcome':
    'Соединение закрыто до рукопожатия — вероятно, бэкенд на этом порту не запущен.',
  'shared.probe.fail.openFailed': 'Не удалось открыть соединение WebSocket.',
  'shared.probe.fail.openFailedDetail': 'Не удалось открыть соединение WebSocket: {detail}.',
  'shared.probe.fail.protocolMismatch': 'Доступен, но версии протокола несовместимы — обновите оба приложения.',
  'shared.probe.fail.workspaceUnknown':
    'Доступен — бэкенд запущен, но пока не знает это рабочее пространство. Переключение выполнит сопряжение.',
  'shared.probe.fail.protocolTooOld': 'Доступен — но это приложение старее бэкенда. Обновите эту сторону.',
  'shared.probe.fail.protocolTooNew': 'Доступен — но бэкенд старее этого приложения. Обновите бэкенд.',
  'shared.probe.fail.authRequired':
    'Доступен — но это устройство ещё не аутентифицировано. Выполните сопряжение по коду или вставьте токен выше, ' +
    'затем нажмите «Переключить».',
  'shared.probe.fail.rejected': 'Отклонено: {reason}',
  'shared.probe.fail.rejectedUnknown': 'Отклонено: причина неизвестна',
  'shared.probe.fail.malformedWelcome': 'Сервер ответил, но не говорит на протоколе Open Headers.',
  'shared.probe.fail.generic': 'Проверка не удалась.',
} as const satisfies Catalog;
