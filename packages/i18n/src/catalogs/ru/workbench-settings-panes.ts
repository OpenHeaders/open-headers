/**
 * Workbench settings — custom pane components — Russian. Extends the
 * ru register contract (`ru/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: бэкенд keeps the back-end mint, демон = daemon, vault /
 * workflow-seed `seed` / `Org` as dev loanwords, networking
 * vocabulary (loopback, LAN, WAN, TLS, `ws://` / `wss://`), IANA port
 * constants (1024 / 49152 / 65535), IP literals, `MCP` / `SSO` /
 * `CLI` / `oh` / streamable HTTP, snippet filenames
 * (claude_desktop_config.json), the `oh-license.…` key prefix, git
 * command vocabulary (`git remote add`, `--no-verify`, HEAD), and the
 * {chord} / {token} / {url} holes. Settings paths quote the ru shell
 * mints («Резервное копирование и синхронизация › Синхронизация»);
 * место = seat, уровень = tier (бесплатный уровень); отозвать =
 * revoke; выпустить = mint (a token) reuses the chrome mint;
 * предустановка and сочетание reuse workbench-settings-defs-keyboard;
 * сопряжение = pair carries the shared mint (код сопряжения = pairing
 * code, Сопряжение по коду = the Pair-with-a-code button, повторное
 * сопряжение = re-pair); спрятать / коммит carried from the chrome.
 * MINTS: перевыпустить = rotate (a token); хранилище доверия = trust
 * store (carried); центр сертификации = certificate authority (CA raw
 * in chip contexts); спасательная ветка = rescue branch;
 * привилегированный помощник = privileged helper; предпросмотр
 * маршрута = route preview; связка ключей входа / системная связка
 * ключей = login / system keychain; незафиксированные изменения =
 * uncommitted changes (JetBrains ru); Сделать коммит = the commit
 * verb. Sandwich fragments: the pairing intro joins its chips with
 * its own spaces except between the settings-path chip and part2
 * (`,` in en), so part2 opens with the comma (`, укажите в поле`) and
 * the address chip reads as the field name; the remove-body /
 * fallback fragments open with a head noun (Это соединение
 * предоставляет / Нет варианта … на том устройстве?). Holes take a
 * head noun or a colon frame (Удалено: {label}; Синхронизация для
 * {orgs} прекращена; ветка {branch}; хост {host}; процесс {pid}).
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.learnMore': 'Подробнее',
  'workbench.settings.backendPane.rowMenuAria': 'Действия: {label}',
  'workbench.settings.backendPane.tierZero.title.extension': 'Этот браузер',
  'workbench.settings.backendPane.tierZero.title.desktop': 'Этот компьютер',
  'workbench.settings.backendPane.tierZero.title.web': 'Этот сервер',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'Ваши рабочие пространства живут здесь. Их резервное копирование и синхронизация идут только через места ниже.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    'Ваши рабочие пространства живут в настольном приложении на этом компьютере. Их резервное копирование и ' +
    'синхронизация идут только через места ниже.',
  'workbench.settings.backendPane.tierZero.copy.web':
    'Ваши рабочие пространства живут на этом сервере. Каждый браузер и устройство, выполнившие вход сюда, работают с теми же копиями.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Всегда включено',
  'workbench.settings.backendPane.tierZero.administer': 'Администрировать…',
  'workbench.settings.backendPane.wizard.step.connect': 'Подключение',
  'workbench.settings.backendPane.wizard.editTitle': 'Изменить: {label}',
  'workbench.settings.backendPane.wizard.title.desktop': 'Подключить настольное приложение',
  'workbench.settings.backendPane.wizard.title.server': 'Войти на сервер',
  'workbench.settings.backendPane.wizard.step.address': 'Адрес',
  'workbench.settings.backendPane.wizard.step.signIn': 'Вход',
  'workbench.settings.backendPane.wizard.connect': 'Подключить',
  'workbench.settings.backendPane.wizard.checkAgain': 'Проверить снова',
  'workbench.settings.backendPane.wizard.checking': 'Проверяем {host}…',
  'workbench.settings.backendPane.wizard.verdict.needsPairing': 'Хост {host} просит это устройство выполнить вход.',
  'workbench.settings.backendPane.wizard.verdict.signedIn': 'Выполнен вход: {name}.',
  'workbench.settings.backendPane.wizard.verdict.signedInUnnamed': 'Вход выполнен.',
  'workbench.settings.backendPane.wizard.verdict.signedInAs': 'Выполнен вход как {person} · {name}.',
  'workbench.settings.backendPane.wizard.verdict.signedInAsUnnamed': 'Выполнен вход как {person}.',
  'workbench.settings.backendPane.wizard.signIn.primary': 'Войти на {host}',
  'workbench.settings.backendPane.wizard.signIn.intro':
    'В браузере откроется страница хоста {host}. Войдите там со своей учётной записью и подтвердите это устройство — здесь ничего вводить не нужно.',
  'workbench.settings.backendPane.wizard.signIn.codeLabel': 'Код входа',
  'workbench.settings.backendPane.wizard.signIn.waiting': 'Ожидаем, пока вы подтвердите это устройство в браузере…',
  'workbench.settings.backendPane.wizard.signIn.openAgain': 'Открыть страницу снова',
  'workbench.settings.backendPane.wizard.signIn.waitingBrowser': 'Завершите вход в браузере, затем вернитесь сюда…',
  'workbench.settings.backendPane.wizard.signIn.linkHint': 'Браузер не открылся? Откройте эту ссылку в любом браузере:',
  'workbench.settings.backendPane.wizard.signIn.tryAgain': 'Повторить',
  'workbench.settings.backendPane.wizard.signIn.unclaimed':
    'У этого сервера ещё нет администратора. Сначала настройте его по адресу {url}, затем войдите отсюда.',
  'workbench.settings.backendPane.wizard.signIn.noLogin':
    'Никто не может войти на {host} из браузера, поэтому единственный путь — код сопряжения или токен от администратора.',
  'workbench.settings.backendPane.wizard.signIn.secondary': 'Есть код сопряжения или токен от администратора?',
  'workbench.settings.backendPane.wizard.signIn.fail.denied': 'Вход отклонён на странице сервера.',
  'workbench.settings.backendPane.wizard.signIn.fail.expired': 'Запрос на вход истёк до подтверждения.',
  'workbench.settings.backendPane.wizard.signIn.fail.lost':
    'Сервер больше не хранит этот запрос на вход. Начните заново.',
  'workbench.settings.backendPane.wizard.signIn.fail.abandoned': 'Вход в браузере не был завершён. Попробуйте ещё раз.',
  'workbench.settings.backendPane.wizard.signIn.fail.tooManyPending':
    'На хосте {host} слишком много ожидающих входов. Повторите через несколько минут.',
  'workbench.settings.backendPane.wizard.signIn.fail.throttled':
    'Хост {host} пока отклоняет запросы с этого устройства. Повторите позже.',
  'workbench.settings.backendPane.wizard.signIn.fail.forbidden':
    'Хост {host} отклонил запрос на вход с этого устройства.',
  'workbench.settings.backendPane.wizard.signIn.fail.offline':
    'По адресу {host} ничего не ответило. Он запущен на этом адресе?',
  'workbench.settings.backendPane.wizard.signIn.fail.generic': 'Не удалось начать вход. Повторите попытку.',
  'workbench.settings.backendPane.wizard.back': 'Назад',
  'workbench.settings.backendPane.wizard.next': 'Далее',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': 'Завершить без подключения',
  'workbench.settings.backendPane.wizard.connectIntro':
    'Адрес, к которому подключается это устройство. Ничего не подключается, пока последний шаг его не проверит.',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    'Автоматическое сопряжение с настольным приложением не прошло — возможно, оно не запущено или этот браузер не удалось проверить. Выполните сопряжение по коду или токену.',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    'Готово: {label} по адресу {url}, вход выполнен. Подключение сначала проверяет адрес и вход; затем его рабочие пространства синхронизируются сюда и остаются доступными офлайн.',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    'Готово: {label} по адресу {url} — вход ещё не выполнен. Подключение сначала проверяет адрес и вход; затем его рабочие пространства синхронизируются сюда и остаются доступными офлайн.',
  'workbench.settings.backendPane.wizard.additionalConnection':
    'Это дополнительное соединение. Его рабочие пространства появятся новой группой в переключателе рабочих пространств, поповер состояния получит строку для него, и каждая группа синхронизируется ровно из одного места — группа, которую уже предоставляет другое соединение, не присоединится дважды.',
  'workbench.settings.backendPane.wizard.disableFirst':
    'Соединение с {label} установлено. Правка соединения — это перенос живого провода, поэтому оно сначала отключается — ваши настройки и сопряжение сохраняются, а повторное включение проверяет новую конфигурацию, прежде чем что-либо подключится.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Отключить и изменить',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Синхронизируется с',
  'workbench.settings.backendPane.connections.connectDesktop': 'Подключить настольное приложение',
  'workbench.settings.backendPane.connections.signInServer': 'Войти на сервер…',
  'workbench.settings.backendPane.connections.emptyDesktopLine':
    'Синхронизация между браузерами на этом компьютере: подключите настольное приложение.',
  'workbench.settings.backendPane.connections.emptyServerLine':
    'Синхронизация между вашими устройствами или с командой: войдите на OpenHeaders Server.',
  'workbench.settings.backendPane.connections.menu.connect': 'Подключить',
  'workbench.settings.backendPane.connections.menu.disconnect': 'Отключить',
  'workbench.settings.backendPane.connections.menu.edit': 'Изменить…',
  'workbench.settings.backendPane.connections.menu.remove': 'Удалить…',
  'workbench.settings.backendPane.connections.place.desktopApp': 'Настольное приложение на этом компьютере',
  'workbench.settings.backendPane.placement.section': 'Новые рабочие пространства',
  'workbench.settings.backendPane.placement.label': 'Куда попадают',
  'workbench.settings.backendPane.placement.description':
    'Можно изменить в любой момент. Существующие рабочие пространства остаются на месте.',
  'workbench.settings.backendPane.connections.writeFailed': 'Не удалось сохранить соединение',
  'workbench.settings.backendPane.connections.status.connected': 'Подключено',
  'workbench.settings.backendPane.connections.status.connecting': 'Подключение…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Нужно повторное сопряжение',
  'workbench.settings.backendPane.connections.status.error': 'Соединение потеряно',
  'workbench.settings.backendPane.connections.status.off': 'Выключено',
  'workbench.settings.backendPane.connections.repair': 'Повторное сопряжение',
  'workbench.settings.backendPane.connections.autoConnect': 'Автоподключение',
  'workbench.settings.backendPane.connections.orgConflict':
    'Org «{org}» уже предоставляется через {provider} — не присоединена',
  'workbench.settings.backendPane.connections.removedBackend': 'удалённое соединение',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': 'Подключение к {label}…',
  'workbench.settings.backendPane.enable.connected': 'Подключено к {label}.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    'Соединение с {label} установлено, но его Org не присоединена — см. строку соединения.',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': 'Удалить {label}?',
  'workbench.settings.backendPane.remove.confirmBody':
    'Его адрес и сопряжение будут забыты. Из него ещё ничего не синхронизировалось.',
  'workbench.settings.backendPane.remove.aria': 'Удалить {label}',
  'workbench.settings.backendPane.remove.removed': 'Удалено: {label}.',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} рабочее пространство',
      few: '{count} рабочих пространства',
      many: '{count} рабочих пространств',
      other: '{count} рабочих пространств',
    }),
  'workbench.settings.backendPane.remove.body.prefix': 'Это соединение предоставляет',
  'workbench.settings.backendPane.remove.body.suffix':
    'и на это устройство синхронизировано: {workspaces}. Его собственные данные никогда не затрагиваются — выберите, что делать с локальными копиями.',
  'workbench.settings.backendPane.remove.outcomeAria': 'Результат удаления',
  'workbench.settings.backendPane.remove.recommendedBadge': 'Рекомендуется',
  'workbench.settings.backendPane.remove.keep.title': 'Оставить локальные копии',
  'workbench.settings.backendPane.remove.keep.description':
    'Синхронизация для {orgs} прекращается. На этом устройстве остаются как автономные локальные данные: {workspaces}.',
  'workbench.settings.backendPane.remove.discard.title': 'Удалить локальные копии',
  'workbench.settings.backendPane.remove.discard.description':
    'Каждое рабочее пространство сначала сохраняется в скачиваемый файл резервной копии, затем удаляется с этого устройства. ' +
    'Повторное подключение позже снова синхронизирует их сюда.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'Включить секреты vault в файлы резервных копий (открытым текстом — храните файлы в безопасности)',
  'workbench.settings.backendPane.remove.removeBackend': 'Удалить соединение',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Создать резервную копию и удалить',
  'workbench.settings.backendPane.remove.progress.removing': 'Удаление соединения…',
  'workbench.settings.backendPane.remove.progress.preparing': 'Подготовка резервных копий…',
  'workbench.settings.backendPane.remove.progress.backingUp': 'Резервное копирование «{name}»…',
  'workbench.settings.backendPane.remove.progress.deleting': 'Удаление «{name}»…',
  'workbench.settings.backendPane.remove.keepDone':
    'Удалено: {label}. Синхронизация для {orgs} прекращена; на этом устройстве остаётся: {workspaces}.',
  'workbench.settings.backendPane.remove.discardDone':
    'Удалено: {label}. Сохранено в резервную копию и удалено: {workspaces}; привязка к {orgs} снята.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      one: `Удалено: ${String(label)}, но осталось {count} рабочее пространство`,
      few: `Удалено: ${String(label)}, но осталось {count} рабочих пространства`,
      many: `Удалено: ${String(label)}, но осталось {count} рабочих пространств`,
      other: `Удалено: ${String(label)}, но осталось {count} рабочих пространств`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody':
    'Не удалось удалить: {names}. Они остаются локальными данными.',
  'workbench.settings.backendPane.remove.backupFailedTitle': 'Не удалось создать резервную копию «{name}»',
  'workbench.settings.backendPane.remove.backupFailedBody': 'Экспорт не завершился. Ничего не удалено.',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'Сопряжение по коду',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'Вставить токен',
  'workbench.settings.backendPane.pair.codeBlurb':
    'Введите код, показанный в настольном приложении или на сервере. Он обменивается на токен, который выполняет вход этого устройства.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    'Вставьте токен, показанный в настольном приложении или на сервере — перевыпуск показывает новый секрет один раз. Он сохраняется как учётные данные этого устройства.',
  'workbench.settings.backendPane.pair.codePlaceholder': '6-значный код',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': 'Имя устройства (необязательно)',
  'workbench.settings.backendPane.pair.codeRequired':
    'Введите код сопряжения, показанный в настольном приложении или на сервере.',
  'workbench.settings.backendPane.pair.pasteTokenRequired':
    'Вставьте токен, показанный в настольном приложении или на сервере.',
  'workbench.settings.backendPane.pair.pairAction': 'Сопрячь',
  'workbench.settings.backendPane.pair.saveToken': 'Сохранить токен',
  'workbench.settings.backendPane.pair.tokenSaved': 'Токен авторизации сохранён.',
  'workbench.settings.backendPane.pair.pairedSaved': 'Сопряжено — токен авторизации сохранён.',
  'workbench.settings.backendPane.pair.switchToToken': 'Есть токен? Вставьте его вместо кода',
  'workbench.settings.backendPane.pair.switchToCode': 'Есть код сопряжения?',
  'workbench.settings.backendPane.pair.fail.unknown':
    'Этот код неизвестен или истёк. Запросите новый код и попробуйте снова.',
  'workbench.settings.backendPane.pair.fail.expired':
    'Срок действия этого кода сопряжения истёк. Создайте новый в настольном приложении или на сервере.',
  'workbench.settings.backendPane.pair.fail.consumed':
    'Этот код уже использован. Создайте новый в настольном приложении или на сервере.',
  'workbench.settings.backendPane.pair.fail.unreachable':
    'По адресу {url} никто не ответил. Оно запущено по этому адресу?',
  'workbench.settings.backendPane.pair.fail.generic': 'Сопряжение не удалось. Попробуйте снова.',
  'workbench.settings.backendPane.pair.nmRequired':
    'Ручное сопряжение с настольным приложением выключено — этот браузер подключается только через проверенное сопряжение. См. параметр «Требовать проверенное сопряжение».',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Имя',
  'workbench.settings.backendPane.field.label.description':
    'Как это соединение называется в приложении. По умолчанию — его адрес.',
  'workbench.settings.backendPane.field.label.placeholder': 'Рабочая ВМ',
  'workbench.settings.backendPane.field.label.aria': 'Имя соединения',
  'workbench.settings.backendPane.field.url.label': 'Адрес сервера',
  'workbench.settings.backendPane.field.url.description':
    'Адрес или URL-адрес, который вам дал администратор. `http` или `ws` для этого компьютера или вашей сети, `https` или `wss` для удалённого сервера.',
  'workbench.settings.backendPane.field.url.invalid': 'Введите хост, хост:порт или URL-адрес.',
  'workbench.settings.backendPane.field.auth.label': 'Вход',
  'workbench.settings.backendPane.field.auth.description':
    'Как это устройство выполняет вход. Сопряжение по коду или прямая вставка токена.',
  'workbench.settings.backendPane.field.auth.codeAria': 'Код сопряжения',
  'workbench.settings.backendPane.field.auth.tokenAria': 'Токен авторизации',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'Вставьте токен',
  'workbench.settings.backendPane.field.auth.paired': 'Сопряжено — токен доступа сохранён',
  'workbench.settings.backendPane.field.auth.useToken': 'Использовать токен авторизации',
  'workbench.settings.backendPane.field.auth.useCode': 'Выполнить сопряжение по коду',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'Введите порт.',
  'workbench.settings.backendPane.port.notInteger': 'Порт должен быть целым числом.',
  'workbench.settings.backendPane.port.privileged':
    'Порты ниже 1024 привилегированные и требуют повышенных прав — выберите 1024 или выше.',
  'workbench.settings.backendPane.port.aboveMax': 'Порт должен быть не больше 65535.',
  'workbench.settings.backendPane.port.ephemeral':
    'Порты 49152–65535 — диапазон, который ОС выдаёт для исходящих соединений; слушатель на них может периодически не привязываться. Порт из диапазона 1024–49151 надёжнее.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'Разрешить пиров из LAN?',
  'workbench.settings.backendPane.lan.confirmOk': 'Разрешить пиров из LAN',
  'workbench.settings.backendPane.lan.confirmCancel': 'Оставить только loopback',
  'workbench.settings.backendPane.lan.confirmBody':
    'Настольное приложение будет слушать на каждом интерфейсе локальной сети, чтобы другие устройства в вашей сети могли подключаться. ' +
    'Каждое соединение, из вашей сети или с этого компьютера, должно предъявить сопряжённый токен; пути без ' +
    'токена нет. Устройства сопрягаются по коду, который показывает приложение (или вставляют токен в разделе «Резервное копирование и синхронизация › Синхронизация»).',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.empty':
    'Хосты ещё не добавились. Браузер попадает в этот список, когда держит seed эксклюзивного рабочего процесса Live в этом рабочем пространстве.',
  'workbench.settings.backendPane.fallback.saveFailed': 'Не удалось сохранить новый порядок',
  'workbench.settings.backendPane.fallback.removeFailed': 'Не удалось удалить хост',
  'workbench.settings.backendPane.fallback.dragAria': 'Перетащите, чтобы изменить порядок',
  'workbench.settings.backendPane.fallback.selfTag': 'Этот браузер',
  'workbench.settings.backendPane.fallback.pruneTitle': 'Удалить этот хост?',
  'workbench.settings.backendPane.fallback.pruneBody':
    'Он добавится снова автоматически, если всё ещё держит seed эксклюзивного рабочего процесса.',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'Поиск сочетаний',
  'workbench.settings.keymapPane.noMatches': 'Нет сочетаний по вашему запросу.',
  'workbench.settings.keymapPane.recording': 'Нажмите клавиши…',
  'workbench.settings.keymapPane.unbound': 'Не назначено',
  'workbench.settings.keymapPane.recordTip': 'Нажмите, чтобы записать новое сочетание',
  'workbench.settings.keymapPane.recordAria': 'Изменить сочетание для {label}',
  'workbench.settings.keymapPane.unbind': 'Удалить сочетание',
  'workbench.settings.keymapPane.unbindAria': 'Удалить сочетание для {label}',
  'workbench.settings.keymapPane.resetAria': 'Сбросить сочетание для {label}',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} сочетание имеет конфликтующее назначение',
      few: '{count} сочетания имеют конфликтующие назначения',
      many: '{count} сочетаний имеют конфликтующие назначения',
      other: '{count} сочетаний имеют конфликтующие назначения',
    }),
  'workbench.settings.keymapPane.conflictShowOnly': 'Показать конфликты',
  'workbench.settings.keymapPane.conflictShowAll': 'Показать все сочетания',
  'workbench.settings.keymapPane.conflictBadgeAria': 'Конфликт сочетаний',
  'workbench.settings.keymapPane.conflictTooltip': 'Также назначено: {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': 'Зарезервированное сочетание',
  'workbench.settings.keymapPane.reservedBrowser':
    'Браузер резервирует это сочетание — он может обработать его раньше, чем оно дойдёт до приложения.',
  'workbench.settings.keymapPane.reservedSystem':
    'Операционная система резервирует это сочетание — она может обработать его раньше, чем оно дойдёт до приложения.',
  'workbench.settings.keymapPane.lookupTip': 'Найти действие, нажав его сочетание',
  'workbench.settings.keymapPane.lookupAria': 'Найти действие по сочетанию',
  'workbench.settings.keymapPane.lookupEmpty': 'На {chord} не назначено ни одно действие.',
  'workbench.settings.keymapPane.conflictPrompt': 'Сочетание {chord} уже назначено: {labels}',
  'workbench.settings.keymapPane.conflictReassign': 'Переназначить',
  'workbench.settings.keymapPane.conflictKeepBoth': 'Оставить оба',
  'workbench.settings.keymapPane.presetAria': 'Предустановка раскладки',
  'workbench.settings.keymapPane.presetSection': 'Раскладка',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Восстановить предустановку ({count} изменение)',
      few: 'Восстановить предустановку ({count} изменения)',
      many: 'Восстановить предустановку ({count} изменений)',
      other: 'Восстановить предустановку ({count} изменений)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip': 'Сбросить каждое настроенное сочетание к активной предустановке.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': 'Сопряжённые устройства',
  'workbench.settings.backendTokens.sectionBlurb':
    'Каждое устройство, подключающееся к этому бэкенду, проходит аутентификацию по токену доступа. Подключённые устройства выделены; перевыпустите токен, чтобы выдать новый секрет и отозвать старый.',
  'workbench.settings.backendTokens.labelPlaceholder': 'Метка (необязательно) — например, «телефон Алисы»',
  'workbench.settings.backendTokens.bindUserPlaceholder': 'Привязать к пользователю (необязательно)',
  'workbench.settings.backendTokens.generate': 'Создать токен',
  'workbench.settings.backendTokens.pairDevice': 'Сопрячь устройство',
  'workbench.settings.backendTokens.explainer.intro': 'Оба действия добавляют токен ниже.',
  'workbench.settings.backendTokens.explainer.generateText':
    'показывает секрет, который вы сами копируете и вставляете на устройстве.',
  'workbench.settings.backendTokens.explainer.pairText':
    'показывает короткий код, который устройство вводит в разделе «Резервное копирование и синхронизация › Синхронизация › Сопряжение по коду» (или открывает ссылку как запасной вариант) — используйте, когда устройство настраивает кто-то другой.',
  'workbench.settings.backendTokens.empty':
    'Устройств пока нет. Создайте токен и вставьте его в разделе «Резервное копирование и синхронизация › Синхронизация» на устройстве или сопрягите устройство и введите там код.',
  'workbench.settings.backendTokens.mintFailed': 'Не удалось выпустить токен: {message}',
  'workbench.settings.backendTokens.rotateFailed': 'Не удалось перевыпустить: {message}',
  'workbench.settings.backendTokens.revokeFailed': 'Не удалось отозвать: {message}',
  'workbench.settings.backendTokens.revokedDevice': 'Токен отозван. Все устройства, использовавшие его, отключены.',
  'workbench.settings.backendTokens.revokedSession': 'Сеанс отозван. Пользователь вышел из учётной записи.',
  'workbench.settings.backendTokens.rotate': 'Перевыпустить',
  'workbench.settings.backendTokens.revoke': 'Отозвать',
  'workbench.settings.backendTokens.rotateConfirmTitle': 'Перевыпустить этот токен?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    'Выпускается новый секрет, а текущий отзывается. Устройству нужно передать новый токен, прежде чем оно сможет переподключиться.',
  'workbench.settings.backendTokens.revokeConfirmTitle': 'Отозвать этот токен?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    'Любое устройство, использующее его сейчас, немедленно отключается и не сможет переподключиться.',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': 'Отозвать этот сеанс?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    'Пользователь немедленно выходит из учётной записи и отключается. Ему придётся снова войти через поставщика удостоверений.',
  'workbench.settings.backendTokens.revokedTag': 'Отозван: {when}',
  'workbench.settings.backendTokens.connectedTag': 'Подключено',
  'workbench.settings.backendTokens.expiredTag': 'Истёк',
  'workbench.settings.backendTokens.unlabeled': '(без метки)',
  'workbench.settings.backendTokens.unbound': '(не привязан)',
  'workbench.settings.backendTokens.meta.device': 'id {id} · создан: {created} · последнее использование: {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'пользователь {user}',
  'workbench.settings.backendTokens.meta.session':
    'вход: {signedIn} · истекает: {expires} · последняя активность: {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'Сеансы SSO',
  'workbench.settings.backendTokens.ssoBlurb':
    'Каждый вход через SSO выпускает сеанс, который истекает сам. Отзовите сеанс, чтобы немедленно выйти из учётной записи пользователя — ему придётся снова войти через поставщика удостоверений.',
  'workbench.settings.backendTokens.secretTitle': 'Скопируйте этот токен сейчас',
  'workbench.settings.backendTokens.secretTitleRotated': 'Скопируйте перевыпущенный токен сейчас',
  'workbench.settings.backendTokens.secretBody':
    'Бэкенд хранит только хеш этого значения. После закрытия этого диалога секрет восстановить нельзя — если потеряете его, отзовите токен и выпустите новый.',
  'workbench.settings.backendTokens.secretBodyRotated':
    'Предыдущий токен теперь отозван — передайте этот новый секрет устройству, чтобы оно могло переподключиться. Бэкенд хранит только хеш этого значения. После закрытия этого диалога секрет восстановить нельзя — если потеряете его, отзовите токен и выпустите новый.',
  'workbench.settings.backendTokens.secretSaved': 'Я сохранил',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': 'Готово',
  'workbench.settings.backendTokens.pairModal.allocating': 'Выделение кода…',
  'workbench.settings.backendTokens.pairModal.startFailed': 'Не удалось начать сопряжение',
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'Срок сопряжения истёк',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    '5-минутное окно прошло без подтверждения. Закройте этот диалог и снова нажмите «Сопрячь устройство», чтобы начать заново.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'Сопряжено',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    'Устройство подтвердило код. Новый токен доступа выдан и сохранён на этом устройстве; оно появится в списке ниже. Если устройство не может подключиться, отзовите запись и выполните сопряжение снова.',
  'workbench.settings.backendTokens.pairModal.intro.part1': 'На другом устройстве откройте',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath':
    'Резервное копирование и синхронизация › Синхронизация',
  'workbench.settings.backendTokens.pairModal.intro.part2': ', укажите в поле',
  'workbench.settings.backendTokens.pairModal.intro.address': 'Адрес бэкенда',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'это приложение, затем нажмите',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'и введите:',
  'workbench.settings.backendTokens.pairModal.codeLabel': 'Код сопряжения',
  'workbench.settings.backendTokens.pairModal.expiresIn': 'истекает через {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'Адрес бэкенда этого приложения',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': 'Нет варианта',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    'на том устройстве? Откройте там одну из этих ссылок — она отдаёт страницу, которая передаёт токен для ручной вставки.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'Доступ из CLI',
  'workbench.settings.cliAccess.sectionBlurb':
    'Одно нажатие подключает инструмент командной строки oh на этой машине к приложению — для него создаётся и сохраняется токен доступа, ничего копировать не нужно.',
  'workbench.settings.cliAccess.statusUnconfigured': 'CLI на этой машине ещё не подключён.',
  'workbench.settings.cliAccess.statusConfigured': 'CLI подключён как {label}.',
  'workbench.settings.cliAccess.statusStale':
    'Сохранённый токен CLI больше недействителен — настройте доступ снова, чтобы переподключиться.',
  'workbench.settings.cliAccess.statusExternal':
    'CLI сейчас подключён к другому бэкенду ({url}). Настройка доступа здесь направит его на это приложение.',
  'workbench.settings.cliAccess.statusMalformed': 'Не удалось прочитать файл конфигурации CLI: {message}',
  'workbench.settings.cliAccess.pathNote': 'Сохранено в {path}',
  'workbench.settings.cliAccess.setUp': 'Настроить доступ из CLI',
  'workbench.settings.cliAccess.rotate': 'Перевыпустить доступ CLI',
  'workbench.settings.cliAccess.connectHere': 'Подключить к этому приложению',
  'workbench.settings.cliAccess.provisioned':
    'Доступ из CLI настроен — oh теперь работает в любом терминале на этой машине.',
  'workbench.settings.cliAccess.rotated': 'Токен CLI перевыпущен — предыдущий токен отозван.',
  'workbench.settings.cliAccess.provisionFailed': 'Не удалось настроить CLI: {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.connect.title': 'Подключить клиент',
  'workbench.settings.mcpPane.connect.blurb':
    'Выберите клиент, замените заглушку токена токеном доступа и поправьте путь к приложению, если ' +
    'установили его в другое место. Для подключения клиентов приложение должно быть запущено.',
  'workbench.settings.mcpPane.tokensHome': 'Токены доступа выпускаются и отзываются в разделе',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle':
    'claude_desktop_config.json — объедините с существующим файлом',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'Выполните один раз в терминале',
  'workbench.settings.mcpPane.snippet.cliTitle':
    'Выполните один раз в терминале — дальнейшие запуски oh не требуют флагов',
  'workbench.settings.mcpPane.snippet.httpTitle': 'Для клиентов, которые напрямую говорят по streamable HTTP',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'Включить MCP-сервер',
  'workbench.settings.mcpConsent.body':
    'Клиенты-агенты и oh TUI общаются с этим приложением через MCP-сервер, который сейчас выключен.',
  'workbench.settings.mcpConsent.info.title': 'MCP-сервер',
  'workbench.settings.mcpConsent.info.summary':
    'MCP-клиенты обращаются к этому приложению через конечную точку /mcp бэкенда (Model Context Protocol поверх streamable ' +
    'HTTP). Параметр mcp.enabled управляет этой конечной точкой — пока он выключен, она возвращает 404. Клиенты ' +
    'проходят аутентификацию теми же токенами доступа, что и любое другое соединение.',
  'workbench.settings.mcpConsent.ok': 'Включить',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': 'Установленный файл — не лицензионный ключ.',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'Установленная лицензия не соответствует ни одной схеме, которую поддерживает эта версия.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'Установленная лицензия подписана ключом, которому эта сборка не доверяет.',
  'workbench.settings.licensePane.invalid.bad-signature':
    'Установленная лицензия не прошла проверку подписи — текст был изменён после подписания.',
  'workbench.settings.licensePane.installed': 'Лицензия установлена',
  'workbench.settings.licensePane.removed': 'Лицензия удалена — снова бесплатный уровень',
  'workbench.settings.licensePane.removeFailed': 'Не удалось удалить лицензию: {message}',
  'workbench.settings.licensePane.freeTier.title': 'Бесплатный уровень',
  'workbench.settings.licensePane.freeTier.body':
    'Всё, что есть в Open Headers сегодня, включено — бесплатный уровень допускает до {limit} активных пользователей на сервер. Установите лицензионный ключ, чтобы повысить предел мест.',
  'workbench.settings.licensePane.invalidAlert.title': 'Установленная лицензия непригодна',
  'workbench.settings.licensePane.invalidAlert.body':
    'Приложение продолжает работать на бесплатном уровне (до {limit} активных пользователей). Вставьте новый ключ ниже или обратитесь в поддержку.',
  'workbench.settings.licensePane.grace.title': 'Лицензия истекла — действует льготный период',
  'workbench.settings.licensePane.grace.body':
    'Срок этой лицензии истёк {expiredOn}. Продлите её до {graceEndsOn} — после этого создание и повторная активация пользователей вернутся к бесплатному пределу {limit}. Существующие пользователи продолжают входить, и данные никогда не затрагиваются.',
  'workbench.settings.licensePane.expired.title': 'Лицензия и льготный период закончились',
  'workbench.settings.licensePane.expired.body':
    'Создание и повторная активация пользователей теперь подчиняются бесплатному пределу в {limit} активных пользователей. Существующие пользователи продолжают входить, существующие рабочие пространства продолжают работать, и данные никогда не затрагиваются. Установите продлённый ключ, чтобы вернуть лицензированное число мест.',
  'workbench.settings.licensePane.getLicenseCta': 'Получить лицензию',
  'workbench.settings.licensePane.renewLicenseCta': 'Продлить лицензию',
  'workbench.settings.licensePane.detailsSection': 'Лицензия',
  'workbench.settings.licensePane.detail.licensedTo': 'Лицензия выдана',
  'workbench.settings.licensePane.detail.contact': 'Контакт',
  'workbench.settings.licensePane.detail.seats': 'Места',
  'workbench.settings.licensePane.detail.validUntil': 'Действует до',
  'workbench.settings.licensePane.detail.licenseId': 'Идентификатор лицензии',
  'workbench.settings.licensePane.tag.active': 'Активна',
  'workbench.settings.licensePane.tag.offline': 'Офлайн-лицензия',
  'workbench.settings.licensePane.removeConfirm.title': 'Удалить эту лицензию?',
  'workbench.settings.licensePane.removeConfirm.body':
    'Приложение вернётся на бесплатный уровень (до {limit} активных пользователей). Данные не затрагиваются.',
  'workbench.settings.licensePane.removeConfirm.ok': 'Удалить',
  'workbench.settings.licensePane.removeButton': 'Удалить лицензию',
  'workbench.settings.licensePane.replaceTitle': 'Заменить лицензию',
  'workbench.settings.licensePane.installTitle': 'Установить лицензию',
  'workbench.settings.licensePane.pastePlaceholder': 'Вставьте лицензионный ключ (oh-license.…)',
  'workbench.settings.licensePane.installButton': 'Установить',
  'workbench.settings.licensePane.loadFromFile': 'Загрузить из файла…',

  // ── System-plane proxy section (the request-engine proxy design P3) ─
  'workbench.settings.systemProxy.section': 'Прокси',
  'workbench.settings.systemProxy.previewSection': 'Предпросмотр маршрута',
  'workbench.settings.systemProxy.introNote':
    'Локально для устройства и никогда не синхронизируется — всё следует этому, если запрос не задаёт собственный режим прокси.',
  'workbench.settings.systemProxy.mode.label': 'Режим',
  'workbench.settings.systemProxy.mode.infoTitle': 'Режимы прокси',
  'workbench.settings.systemProxy.mode.infoSummary':
    'Как это устройство решает, каким маршрутом пойдёт каждый запрос, сеанс WebSocket и вызов gRPC.',
  'workbench.settings.systemProxy.mode.infoHeading': 'Режимы',
  'workbench.settings.systemProxy.mode.system': 'Системный',
  'workbench.settings.systemProxy.mode.systemDesc':
    'Следовать собственной конфигурации прокси этой машины — системным настройкам, PAC-файлам и автообнаружению — ровно как браузер. Значение по умолчанию; неуправляемая машина просто подключается напрямую.',
  'workbench.settings.systemProxy.system.valuesLabel': 'Системные значения',
  'workbench.settings.systemProxy.system.sourcedNote':
    'Прочитано с этой машины ({source}) — разрешение по-прежнему выполняется для каждого URL-адреса.',
  'workbench.settings.systemProxy.system.unavailable': 'Не удалось прочитать системную конфигурацию: {message}',
  'workbench.settings.systemProxy.mode.manual': 'Вручную',
  'workbench.settings.systemProxy.mode.manualDesc':
    'Один прокси для всего — HTTP, HTTPS или SOCKS5 по схеме URL — с учётными данными из vault и списком исключений.',
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    'PAC-файл по URL-адресу или локальному пути решает для каждого URL-адреса. Скрипт выполняется только внутри изолированного сетевого стека браузера, никогда в приложении.',
  'workbench.settings.systemProxy.mode.off': 'Выключен',
  'workbench.settings.systemProxy.mode.offDesc': 'Всегда подключаться напрямую, что бы ни говорила машина.',
  'workbench.settings.systemProxy.manual.url': 'Прокси',
  'workbench.settings.systemProxy.manual.urlPlaceholder': 'Без прокси — прямое соединение',
  'workbench.settings.systemProxy.manual.urlExample':
    'например, http://proxy.example:8080 или socks5://proxy.example:1080',
  'workbench.settings.systemProxy.manual.urlError':
    'Введите host:port или URL-адрес прокси http://, https:// или socks5:// — SOCKS4 не поддерживается.',
  'workbench.settings.systemProxy.manual.credentials': 'Учётные данные',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': 'Без аутентификации',
  'workbench.settings.systemProxy.manual.credentialsEmpty': 'В vault этого устройства пока нет строковых записей.',
  'workbench.settings.systemProxy.manual.credentialsManage': 'Управлять учётными данными в vault',
  'workbench.settings.systemProxy.manual.bypass': 'Список исключений',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': 'Без исключений — каждый хост идёт через прокси',
  'workbench.settings.systemProxy.manual.bypassExample': 'например, localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.manual.bypassError':
    'Только записи через запятую — без пробелов внутри записи, без схемы.',
  'workbench.settings.systemProxy.manual.supported': 'Поддерживается',
  'workbench.settings.systemProxy.pac.source': 'PAC',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'Без PAC URL — прямое соединение',
  'workbench.settings.systemProxy.pac.sourceExample': 'например, https://proxy.example/proxy.pac',
  'workbench.settings.systemProxy.pac.sourceError': 'Нужен PAC URL вида http:// или https://.',
  'workbench.settings.systemProxy.pac.kindUrl': 'URL',
  'workbench.settings.systemProxy.pac.kindFile': 'Файл',
  'workbench.settings.systemProxy.pac.filePlaceholder': 'Без PAC-файла — прямое соединение',
  'workbench.settings.systemProxy.pac.fileExample': 'например, /path/to/proxy.pac',
  'workbench.settings.systemProxy.pac.fileError': 'Нужен абсолютный путь к файлу.',
  'workbench.settings.systemProxy.pac.browse': 'Обзор…',
  'workbench.settings.systemProxy.saveFailed': 'Не удалось сохранить параметр: {message}',
  'workbench.settings.systemProxy.previewPlaceholder': 'Проверьте URL-адрес — каким маршрутом он пойдёт?',
  'workbench.settings.systemProxy.previewButton': 'Разрешить',

  // ── Proxy trust pane body (the proxy-security design §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'Для расшифровки HTTPS-трафика нужен центр сертификации, созданный на этой машине. Ничего не устанавливается, пока вы не настроите доверие здесь, и всё установленное здесь можно здесь же удалить.',
  'workbench.settings.proxyTrustPane.refresh': 'Проверить снова',
  'workbench.settings.proxyTrustPane.loadFailed': 'Не удалось прочитать состояние доверия: {message}',
  'workbench.settings.proxyTrustPane.ca.title': 'Центр сертификации',
  'workbench.settings.proxyTrustPane.ca.none':
    'Центра сертификации пока нет. Он создаётся на этой машине при первой настройке доверия — он никогда не поставляется с приложением, а его закрытый ключ никогда не покидает этот компьютер.',
  'workbench.settings.proxyTrustPane.ca.subject': 'Субъект',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'Отпечаток SHA-256',
  'workbench.settings.proxyTrustPane.ca.validity': 'Действует',
  'workbench.settings.proxyTrustPane.ca.validityRange': 'с {from} до {until}',
  'workbench.settings.proxyTrustPane.ca.deleteButton': 'Удалить центр сертификации',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': 'Удалить центр сертификации?',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    'Пара ключей удаляется с этой машины. Повторная настройка доверия создаст новый центр.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': 'Удалить',
  'workbench.settings.proxyTrustPane.ca.deleted': 'Центр сертификации удалён',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': 'Не удалось удалить центр сертификации: {message}',
  'workbench.settings.proxyTrustPane.stores.title': 'Хранилища доверия',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'Связка ключей входа',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'Системная связка ключей',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Профиль Firefox',
  'workbench.settings.proxyTrustPane.stores.state.trusted': 'Доверенный',
  'workbench.settings.proxyTrustPane.stores.state.absent': 'Не установлен',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': 'Есть, но не доверенный',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': 'Другой сертификат',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': 'Не читается',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'Покрыто хранилищем ОС',
  'workbench.settings.proxyTrustPane.stores.state.optedOut': 'Отключено в Firefox',
  'workbench.settings.proxyTrustPane.stores.empty': 'На этой машине не видно ни одного хранилища доверия.',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': 'В хранилище доверия другой сертификат',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    'Установлен сертификат с именем нашего центра, но его отпечаток — не центр этой машины. Это приложение его не устанавливало и никогда не использует — проверьте хранилище, в котором он лежит.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} записанная установка',
      few: '{count} записанные установки',
      many: '{count} записанных установок',
      other: '{count} записанных установок',
    }),
  'workbench.settings.proxyTrustPane.installButton': 'Настроить доверие…',
  'workbench.settings.proxyTrustPane.wizard.title': 'Установить центр сертификации прокси',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'Что устанавливается',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'Корневой сертификат, созданный на этой машине и уникальный для этой установки. Его закрытый ключ зашифрован при хранении и никуда не отправляется.',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': 'Что это даёт',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'Хранилища доверия, где он лежит, принимают сертификаты прокси захвата, поэтому он может расшифровывать HTTPS — только для хостов, которые вы явно включили в область. Всё остальное проходит нетронутым.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': 'Как это удаляется',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'Каждое изменение записывается, и одно нажатие на этой странице отменяет ровно эти изменения. Удаление приложения делает то же самое.',
  'workbench.settings.proxyTrustPane.wizard.explain.next': 'Выбрать хранилища доверия',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb':
    'Выберите, куда установить. Ничего не меняется, пока вы не подтвердите.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    'Приложения, запущенные от вашего имени — одобрение администратора не нужно.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    'Каждый пользователь этой машины — запрашивает одобрение администратора.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    'Общесистемное доверие в этой сборке пока недоступно — для него нужен помощник OpenHeaders. Пока используйте связку ключей входа.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox ведёт собственное хранилище доверия — установка идёт в каждый найденный профиль.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone': 'На этой машине не найдено профилей Firefox.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'Профили Firefox найдены, но certutil (инструменты NSS) не установлен — их хранилищами доверия нельзя управлять с этой машины.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox автоматически доверяет хранилищу ОС (Firefox 120 и новее) — связки ключей выше его покрывают.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Установить в {count} хранилище',
      few: 'Установить в {count} хранилища',
      many: 'Установить в {count} хранилищ',
      other: 'Установить в {count} хранилищ',
    }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': 'Доверие установлено во все выбранные хранилища.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    'Некоторые хранилища остались без изменений. Ничего не повторяется само — устраните причину и настройте доверие снова или удалите доверие для отката.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'Установлен и доверенный',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    'Одобрение администратора отклонено — хранилище осталось без изменений.',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    'Сертификат добавлен, но доверие установить не удалось. Используйте «Удалить доверие», чтобы навести порядок.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': 'Сбой: {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': 'Не удалось настроить доверие: {message}',
  'workbench.settings.proxyTrustPane.wizard.done': 'Готово',
  'workbench.settings.proxyTrustPane.removeButton': 'Удалить доверие',
  'workbench.settings.proxyTrustPane.removeConfirm.title': 'Удалить сертификат из всех записанных хранилищ?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    'Каждая записанная установка отменяется и проверяется на чистоту, прежде чем её запись удаляется. Сам центр сертификации сохраняется для последующей повторной установки.',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': 'Удалить',
  'workbench.settings.proxyTrustPane.removed': 'Доверие удалено — все записанные хранилища проверены и чисты.',
  'workbench.settings.proxyTrustPane.removePartial':
    'Некоторые хранилища не удалось проверить на чистоту. Их записи сохранены — повторите удаление, когда причина будет устранена.',
  'workbench.settings.proxyTrustPane.removeFailed': 'Не удалось удалить: {message}',
  'workbench.settings.proxyTrustPane.helper.title': 'Привилегированный помощник',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'Доверие в системной связке ключей работает через подписанного помощника, зарегистрированного в macOS как фоновый объект. Он только переносит байты сертификата — каждое решение о доверии по-прежнему проходит через диалог администратора macOS.',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    'Не входит в эту сборку — только упакованные сборки для macOS.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': 'Регистрация',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'Сервер',
  'workbench.settings.proxyTrustPane.helper.state.enabled': 'Зарегистрирован',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': 'Ожидает одобрения',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': 'Не зарегистрирован',
  'workbench.settings.proxyTrustPane.helper.state.notFound':
    'Не найден — сначала установите приложение в папку «Программы»',
  'workbench.settings.proxyTrustPane.helper.state.unknown': 'Неизвестно',
  'workbench.settings.proxyTrustPane.helper.probe.ok': 'Отвечает',
  'workbench.settings.proxyTrustPane.helper.probe.down': 'Не отвечает',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS ожидает одобрения: включите OpenHeaders в разделе «Объекты входа › Разрешить в фоновом режиме», затем проверьте снова.',
  'workbench.settings.proxyTrustPane.helper.registerButton': 'Зарегистрировать',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': 'Отменить регистрацию',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'Открыть «Объекты входа»',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'Действие помощника не удалось: {message}',

  // ── Git pane (workspace-tree binding card, the git-sync plan §9) ─────────
  'workbench.settings.gitPane.notBound.title': 'Папка не привязана',
  'workbench.settings.gitPane.notBound.body':
    'Привяжите это рабочее пространство к папке, чтобы держать живое YAML-дерево каждого правила, запроса и окружения — готовое к резервным копиям, сравнениям, ручным правкам и (скоро) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Абсолютный путь к папке',
  'workbench.settings.gitPane.chooseFolder': 'Выбрать папку…',
  'workbench.settings.gitPane.bindButton': 'Привязать папку',
  'workbench.settings.gitPane.bound': 'Папка привязана.',
  'workbench.settings.gitPane.boundInitialized': 'Папка инициализирована как новое дерево рабочего пространства.',
  'workbench.settings.gitPane.boundBody':
    'Правки непрерывно материализуются в эту папку; изменения в файлах возвращаются в приложение.',
  'workbench.settings.gitPane.unbindButton': 'Отвязать',
  'workbench.settings.gitPane.unbindConfirm.title': 'Отвязать эту папку?',
  'workbench.settings.gitPane.unbindConfirm.body':
    'Папка остаётся корректным деревом рабочего пространства на диске; приложение просто перестаёт её читать и записывать.',
  'workbench.settings.gitPane.unbindConfirm.ok': 'Отвязать',
  'workbench.settings.gitPane.unbound': 'Папка отвязана.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} файл не удалось прочитать, он оставлен без изменений',
      few: '{count} файла не удалось прочитать, они оставлены без изменений',
      many: '{count} файлов не удалось прочитать, они оставлены без изменений',
      other: '{count} файлов не удалось прочитать, они оставлены без изменений',
    }),
  'workbench.settings.gitPane.refusal.locked': 'Эта папка уже привязана к другому запущенному движку (процесс {pid}).',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'В этой папке лежит рабочее пространство, которое уже существует на этом хосте из другого источника.',
  'workbench.settings.gitPane.refusal.identityMismatch': 'Эта папка принадлежит другому рабочему пространству ({uid}).',
  'workbench.settings.gitPane.refusal.invalidManifest': 'Не удалось прочитать workspace.yaml в папке: {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'Это рабочее пространство уже привязано к папке.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'Нет активного рабочего пространства для привязки.',
  'workbench.settings.gitPane.git.available': 'Найден Git {version}',
  'workbench.settings.gitPane.needsRepo':
    'Этой странице нужна привязанная папка с репозиторием — привяжите её в разделе',
  'workbench.settings.gitPane.section.workingTree': 'Рабочее дерево',
  'workbench.settings.gitPane.section.branches': 'Ветки',
  'workbench.settings.gitPane.section.commit': 'Коммит',
  'workbench.settings.gitPane.section.history': 'История',
  'workbench.settings.gitPane.git.missing.title': 'Git не установлен',
  'workbench.settings.gitPane.git.missing.body':
    'Установите git, чтобы вести историю коммитов этой папки. Всё остальное работает и без него.',
  'workbench.settings.gitPane.git.belowFloor.body':
    'Установленный git ({version}) слишком старый для этой функции. Обновите git, чтобы включить коммиты.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} незафиксированное изменение',
      few: '{count} незафиксированных изменения',
      many: '{count} незафиксированных изменений',
      other: '{count} незафиксированных изменений',
    }),
  'workbench.settings.gitPane.git.clean': 'Рабочее дерево чистое',
  'workbench.settings.gitPane.git.indexBusy':
    'Автокоммит приостановлен, пока в вашем собственном индексе git есть подготовленные изменения.',
  'workbench.settings.gitPane.git.messagePlaceholder': 'Сообщение коммита',
  'workbench.settings.gitPane.git.commitButton': 'Сделать коммит',
  'workbench.settings.gitPane.git.committed': 'Создан коммит {sha}.',
  'workbench.settings.gitPane.git.nothingToCommit': 'Нечего коммитить — дерево совпадает с последним коммитом.',
  'workbench.settings.gitPane.git.commitFailed': 'Коммит не удался: {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': 'Автокоммит',
  'workbench.settings.gitPane.git.cadenceDescription':
    'Когда движок сам записывает ваши правки как коммиты. Выключено — каждый коммит остаётся явным действием.',
  'workbench.settings.gitPane.git.cadenceOff': 'Выключено — коммитить вручную',
  'workbench.settings.gitPane.git.cadenceAuto': 'После затишья в правках',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'Когда фокус покидает приложение',
  'workbench.settings.gitPane.git.cadenceEvery': 'Раз в {minutes} мин',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'Обходить хуки git',
  'workbench.settings.gitPane.git.bypassHooksDescription':
    'Выполнять коммиты движка с --no-verify, пропуская ваши хуки pre-commit и commit-msg.',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'Пока это включено, коммиты движка пропускают ваши хуки pre-commit и commit-msg.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}: синхронизировано',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}: впереди на {ahead}, позади на {behind}',
  'workbench.settings.gitPane.git.noUpstream':
    'Удалённый репозиторий не настроен — добавьте его командами git remote add и git push -u, чтобы включить Pull.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': 'Слито: {sha}.',
  'workbench.settings.gitPane.git.upToDate': 'Уже актуально.',
  'workbench.settings.gitPane.git.pullFailed': 'Pull не удался: {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': 'Отправлено: {sha}.',
  'workbench.settings.gitPane.git.nothingToPush': 'Нечего отправлять — уже синхронизировано.',
  'workbench.settings.gitPane.git.pushFailed': 'Push не удался: {detail}',
  'workbench.settings.gitPane.git.pushRejected':
    'В удалённом репозитории есть новые коммиты — сначала выполните Pull, затем снова Push.',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'Нет доступа на Push',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'Этот удалённый репозиторий для вас доступен только для чтения. Ваши коммиты остаются локальными; вы можете опубликовать их новой веткой и открыть запрос на слияние на своём git-хостинге.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.exportBranchButton': 'Push новой веткой',
  'workbench.settings.gitPane.git.exportedBranch': 'Ветка {branch} отправлена.',
  'workbench.settings.gitPane.git.autoPushLabel': 'Push после каждого коммита',
  'workbench.settings.gitPane.git.autoPushDescription':
    'Отправлять текущую ветку в её вышестоящую ветку сразу после каждого коммита, который записывает движок.',
  'workbench.settings.gitPane.git.branch.current': 'На ветке {branch}',
  'workbench.settings.gitPane.git.branch.detached': 'Отсоединённый HEAD — создайте ветку, чтобы сохранить эту историю.',
  'workbench.settings.gitPane.git.branch.switchLabel': 'Переключиться на',
  'workbench.settings.gitPane.git.branch.switched': 'Переключено на {branch}.',
  'workbench.settings.gitPane.git.branch.switchFailed': 'Не удалось переключиться: {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': 'У вас есть незафиксированные изменения',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Сделайте коммит, спрячьте или отмените {count} незафиксированное изменение, прежде чем переключиться на {branch}.',
        few: 'Сделайте коммит, спрячьте или отмените {count} незафиксированных изменения, прежде чем переключиться на {branch}.',
        many: 'Сделайте коммит, спрячьте или отмените {count} незафиксированных изменений, прежде чем переключиться на {branch}.',
        other:
          'Сделайте коммит, спрячьте или отмените {count} незафиксированных изменений, прежде чем переключиться на {branch}.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'Коммит и переключение',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'Спрятать и переключиться',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': 'Отменить изменения',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': 'Отменить незафиксированные изменения?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    'Все незафиксированные изменения удаляются, включая новые файлы. Это действие нельзя отменить.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': 'Отменить изменения',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.branch.createButton': 'Создать и переключиться',
  'workbench.settings.gitPane.git.branch.created': 'Создана ветка {branch}.',
  'workbench.settings.gitPane.git.branch.createFailed': 'Не удалось создать ветку: {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': 'Слить в текущую',
  'workbench.settings.gitPane.git.branch.mergeButton': 'Слить',
  'workbench.settings.gitPane.git.branch.merged': 'Слито: {sha}.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': 'Уже актуально.',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'Слияние не удалось: {detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'История удалённого репозитория переписана',
  'workbench.settings.gitPane.git.forcePush.body':
    'Удалённая ветка больше не содержит историю, которую вы синхронизировали последней ({sha}). Выберите, как поступить — ничего не изменится, пока вы не решите.',
  'workbench.settings.gitPane.git.forcePush.abandon': 'Отказаться от локальных изменений',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': 'Отказаться от локальных изменений?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    'Локальные коммиты после последней синхронизации отбрасываются, и переписанная удалённая история становится состоянием рабочего пространства.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': 'Отказаться',
  'workbench.settings.gitPane.git.forcePush.rescue': 'Сохранить в спасательной ветке',
  'workbench.settings.gitPane.git.forcePush.reapply': 'Применить заново поверх',
  'workbench.settings.gitPane.git.forcePush.resolved': 'Переписанная история принята ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': 'Локальная история сохранена в ветке {branch}.',
  'workbench.settings.gitPane.git.forcePush.failed': 'Не удалось разрешить: {detail}',
  'workbench.settings.gitPane.git.history.show': 'Показать историю',
  'workbench.settings.gitPane.git.history.hide': 'Скрыть',
  'workbench.settings.gitPane.git.history.empty': 'Коммитов пока нет.',
  'workbench.settings.gitPane.git.history.loadFailed': 'Не удалось прочитать историю: {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': 'Соавторы: {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': 'История — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'Этот файл пока не затронут ни одним коммитом.',
} as const satisfies Catalog;
