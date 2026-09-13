/**
 * Shared notifications family — Russian. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key. Mints: уведомление
 * = notification; рекомендация = suggestion; хронология = timeline;
 * Скрыть = Dismiss; Больше не показывать = Don't show again; примечания
 * к выпуску = release notes; связка ключей / кольцо ключей = keychain /
 * keyring; хранилище учётных данных = credential store. `{version}`
 * takes the head noun версия where a case ending would follow.
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': 'Уведомления',
  'shared.notifications.info.summary':
    'Рекомендации по вашей конфигурации и хронология событий приложения за сеанс — доступные обновления, итоги ' +
    'фоновых задач и другие сообщения собираются здесь, не прерывая вашу работу.',
  'shared.notifications.suggestionsHeading': 'Рекомендации',
  'shared.notifications.timelineHeading': 'Хронология',
  'shared.notifications.clearAll': 'Очистить всё',
  'shared.notifications.suggestionsEmpty.title': 'Нет рекомендаций',
  'shared.notifications.suggestionsEmpty.description': 'Здесь будут появляться советы по вашей конфигурации.',
  'shared.notifications.timelineEmpty.title': 'Нет уведомлений',
  'shared.notifications.timelineEmpty.description': 'Здесь будут появляться события и обновления приложения.',
  'shared.notifications.dismiss': 'Скрыть',
  'shared.notifications.moreActions': 'Другие действия',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': 'Больше не показывать',
  'shared.notifications.muted.title': 'Уведомления отключены',
  'shared.notifications.muted.description': '«{title}» больше не будет показываться.',
  'shared.notifications.muted.reEnable': 'Включить снова',
  'shared.notifications.muted.reEnableTooltip': 'Снова разрешить показ этого уведомления',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Познакомьтесь с Open Headers',
  'shared.notifications.seed.website.description':
    'Посмотрите все наши возможности в интерактивном виде, а также последние обновления.',
  'shared.notifications.seed.website.action': 'Перейти на наш сайт',
  'shared.notifications.seed.website.tooltip': 'Открыть сайт и убрать уведомление',
  'shared.notifications.seed.star.title': 'Помогите нам расти',
  'shared.notifications.seed.star.description': 'Порекомендуйте нас друзьям и коллегам',
  'shared.notifications.seed.star.action': 'Поставьте нам звезду на GitHub',
  'shared.notifications.seed.star.tooltip': 'Открыть GitHub и убрать уведомление',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': 'Единый пользовательский опыт',
  'shared.notifications.desktopApp.rowTerminal':
    'Встроенный терминал — полный доступ к оболочке в рабочих пространствах',
  'shared.notifications.desktopApp.rowGit': 'Контроль версий — коммиты и история Git для рабочих пространств',
  'shared.notifications.desktopApp.rowProxy': 'Захват живого трафика из вкладок браузера или системы',
  'shared.notifications.desktopApp.rowMcp': 'MCP-сервер для ИИ-ассистентов — анализ и отладка живого трафика',
  'shared.notifications.desktopApp.rowRequests':
    'Создание и выполнение нативных API-запросов — gRPC, WebSocket, SSE и другие',
  'shared.notifications.desktopApp.action': 'Скачать настольное приложение',
  'shared.notifications.desktopApp.tooltip': 'Скачать приложение и убрать рекомендацию',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': 'Доступна версия {version}',
  'shared.notifications.appUpdate.securityTitle': 'Доступно обновление безопасности {version}',
  'shared.notifications.appUpdate.securityDescription':
    'Этот выпуск исправляет проблему безопасности, затрагивающую вашу текущую версию. Обновитесь как можно скорее.',
  'shared.notifications.appUpdate.download': 'Скачать…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': 'Настройки…',
  'shared.notifications.toast.dontShowAgain': 'Больше не показывать',
  'shared.notifications.toast.optionsTooltip': 'Отключить или изменить поведение',
  'shared.notifications.toast.optionsAria': 'Параметры уведомлений об обновлениях',
  'shared.notifications.toast.close': 'Закрыть',
  'shared.notifications.toast.upToDateTitle': 'У вас последняя версия',
  'shared.notifications.toast.upToDateDescription': 'Версия {version} — самая новая.',
  'shared.notifications.toast.checkFailed': 'Не удалось проверить обновления',
  'shared.notifications.toast.downloadFailed': 'Не удалось скачать обновление',
  'shared.notifications.toast.available': 'Доступна версия {version}',
  'shared.notifications.toast.update': 'Обновить…',
  'shared.notifications.toast.packageManager': 'Обновите через менеджер пакетов вашего дистрибутива Linux.',
  'shared.notifications.toast.releaseNotes': 'Примечания к выпуску',
  'shared.notifications.toast.readyToInstall': 'Версия {version} готова к установке',
  'shared.notifications.toast.restartToInstall': 'Перезапустить для установки',
  'shared.notifications.toast.updatedTo': 'Обновлено до версии {version}',
  'shared.notifications.toast.seeWhatsNew': 'Что нового',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    'Версия {availableVersion} исправляет проблему безопасности, затрагивающую вашу текущую версию ' +
    '({currentVersion}). Обновитесь как можно скорее.',
  'shared.notifications.securityBanner.messageNoVersion':
    'Опубликовано исправление безопасности для вашей текущей версии ({currentVersion}). Обновитесь как можно ' +
    'скорее.',
  'shared.notifications.securityBanner.update': 'Обновить…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'Хранилище секретов заблокировано',
  'shared.notifications.secrets.description':
    'Секреты Vault и токены OAuth нельзя прочитать или сохранить в этом сеансе. {remedy}',
  'shared.notifications.secrets.relaunch': 'Перезапустить приложение',
  'shared.notifications.secrets.remedy.darwin':
    'Приложению Open Headers отказано в доступе к системной связке ключей. Перезапустите приложение и разрешите ' +
    'доступ к связке ключей при запросе.',
  'shared.notifications.secrets.remedy.linux':
    'Нет доступного бэкенда кольца ключей. Настройте его (GNOME Keyring или KWallet), затем перезапустите приложение.',
  'shared.notifications.secrets.remedy.other':
    'Приложению Open Headers не удалось получить доступ к системному хранилищу учётных данных. Перезапустите ' +
    'приложение, чтобы повторить попытку.',
} as const satisfies Catalog;
