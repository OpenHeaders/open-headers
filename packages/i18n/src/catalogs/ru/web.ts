/**
 * Web namespace — Russian. Mirrors `catalogs/en/web.ts` key for key.
 * Brand ('OpenHeaders' / 'OpenHeaders Server' — the tier-neutral
 * server name, quoted from the ru settings panes), URLs, the
 * `oh-license.` key prefix and `{provider}` ride raw with экземпляр /
 * поставщик as head nouns (этот экземпляр OpenHeaders Server, через
 * поставщика {provider}) — prefix/suffix fragments split around those
 * islands. Quotes the shipped ru mints: Войти / Выйти из учётной
 * записи = sign in / sign out (shared-chrome), Настройки, Сопряжённые
 * устройства (settings panes), администратор сервера / личное место /
 * место / веб-шлюз (server admin), поставщик удостоверений, Рабочая
 * среда = Workbench, обратный прокси carried. MINTS: код настройки =
 * setup code; единый вход = single sign-on; защищённый источник /
 * защищённое соединение = secure origin / connection; удостоверение
 * устройства = a device's identity. Plurals one / few / many / other
 * (устройство / устройства / устройств).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Вход на этот сервер',
  'web.gate.titleSetup': 'Настройка этого сервера',
  'web.gate.introSso': 'Войдите через поставщика {provider}, чтобы попасть на этот экземпляр OpenHeaders Server.',
  'web.gate.introPassword': 'Войдите с email и паролем, которые задал для вас администратор сервера.',
  'web.gate.introSetup':
    'Этот экземпляр OpenHeaders Server ещё никто не настроил. Создайте первую учётную запись — она администрирует сервер и ' +
    'владеет всем, что на нём уже есть.',
  'web.gate.introNoLogin':
    'На этот сервер невозможно войти из браузера: единый вход не настроен, и ни у одной учётной записи на нём нет ' +
    'пароля. Попросите того, кто управляет сервером, задать его вам.',
  'web.gate.ssoButton': 'Войти через {provider}',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Пароль',
  'web.gate.signIn': 'Войти',
  'web.gate.setupNamePlaceholder': 'Ваше имя',
  'web.gate.setupConfirmPlaceholder': 'Повторите пароль',
  'web.gate.setupPasswordHint': 'Не менее {min} символов. Сброса пароля нет — сохраните его в надёжном месте.',
  'web.gate.setupCodePlaceholder': 'Код настройки',
  'web.gate.setupCodeHint': 'Печатается в журнале сервера при запуске. Каждый перезапуск печатает новый.',
  'web.gate.setupSubmit': 'Создать учётную запись',
  'web.gate.setupDoneTitle': 'Сервер настроен',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        '{count} сопряжённое устройство было отвязано настройкой, поэтому оно не может дальше администрировать этот сервер в обход ' +
        'вашей новой учётной записи. Сопрягите его заново в настройках.',
      few:
        '{count} сопряжённых устройства были отвязаны настройкой, поэтому они не могут дальше администрировать этот сервер в обход ' +
        'вашей новой учётной записи. Сопрягите их заново в настройках.',
      many:
        '{count} сопряжённых устройств были отвязаны настройкой, поэтому они не могут дальше администрировать этот сервер в обход ' +
        'вашей новой учётной записи. Сопрягите их заново в настройках.',
      other:
        '{count} сопряжённых устройств были отвязаны настройкой, поэтому они не могут дальше администрировать этот сервер в обход ' +
        'вашей новой учётной записи. Сопрягите их заново в настройках.',
    }),
  'web.gate.setupDoneContinue': 'Перейти к администрированию сервера',
  'web.gate.setupDoneReload': 'Перезагрузить',
  'web.gate.setupErrorDisplayName': 'Введите имя для учётной записи.',
  'web.gate.setupErrorEmail': 'Введите email для входа.',
  'web.gate.setupErrorPasswordShort': 'Используйте не менее {min} символов.',
  'web.gate.setupErrorPasswordMismatch': 'Пароли не совпадают.',
  'web.gate.setupErrorMalformed': 'Сервер не смог прочитать форму. Перезагрузите страницу и попробуйте снова.',
  'web.gate.setupErrorRefused':
    'Сервер отклонил настройку. Возможно, он уже настроен, либо код настройки неверен или остался от ' +
    'прошлого запуска — сервер печатает новый при каждом перезапуске.',
  'web.gate.setupErrorSessionRefused':
    'Учётная запись создана, но этой вкладке не удалось открыть сеанс. Перезагрузите страницу и войдите с ней.',
  'web.gate.clientsIntro':
    'Эта вкладка — не единственный клиент. Расширение и настольное приложение обращаются к этому серверу напрямую по адресу',
  'web.gate.clientsExtension': 'Установить расширение',
  'web.gate.clientsDesktop': 'Скачать настольное приложение',
  'web.gate.errorServerOffline': 'Сервер не ответил. Убедитесь, что он запущен, и попробуйте снова.',
  'web.gate.errorPasswordRefused': 'Войти не удалось. Проверьте email и пароль и попробуйте снова.',
  'web.gate.errorSessionRefused': 'Сервер не принял сеанс. Попробуйте снова.',
  'web.gate.seatIntroPrefix':
    'Есть личное место? Вставьте его ключ, чтобы войти, не дожидаясь свободного командного места, — он допускает email, ' +
    'с которым был куплен. Приобрести можно на',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Ключ личного места (oh-license.…)',
  'web.gate.seatSignIn': 'Войти по личному месту',
  'web.overlay.signingIn': 'Выполняется вход…',
  'web.overlay.takingYouTo': 'Переход к {provider}…',
  'web.overlay.takingYouBack': 'Возвращаемся в {client}…',
  'web.oidcError.unknownUser':
    'Вход выполнен, но на этом сервере нет пользователя с вашим email. Попросите администратора сервера добавить вас.',
  'web.oidcError.userDeactivated':
    'Вход выполнен, но ваш пользователь на этом сервере деактивирован. Обратитесь к администратору сервера.',
  'web.oidcError.emailUnverified':
    'Поставщик удостоверений сообщает, что email не подтверждён. Подтвердите его и попробуйте снова.',
  'web.oidcError.providerUnavailable': 'Не удалось связаться с поставщиком удостоверений. Попробуйте чуть позже.',
  'web.oidcError.seatLimitReached':
    'Вход выполнен, но на этом сервере нет свободных мест для нового пользователя. Обратитесь к администратору сервера — или войдите сейчас по собственному ' +
    'личному месту.',
  'web.oidcError.personalSeatsDisabled':
    'Личные места на этом сервере отключены. Спросите администратора сервера о месте.',
  'web.oidcError.personalLicenseInvalid':
    'Этот ключ личного места непригоден — он недействителен, просрочен или не является личным местом. Проверьте ключ и ' +
    'попробуйте снова.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'Это личное место принадлежит другому email. Оно допускает только адрес, с которым было куплено.',
  'web.oidcError.personalLicenseNoIdentity':
    'Ваш вход не содержал email, с которым можно сопоставить личное место. Обратитесь к администратору сервера.',
  'web.oidcError.failed':
    'Единый вход не удался. Попробуйте снова или попросите того, кто управляет сервером, проверить поставщика.',
  'web.access.title': 'Доступ к рабочим пространствам ещё не выдан',
  'web.access.intro':
    'Вы вошли в {org}, но доступ ни к одному рабочему пространству на ней вам ещё не выдан. Администратор должен выдать ' +
    'вам доступ к рабочему пространству.',
  'web.access.introNoOrg':
    'Вы вошли на этот сервер, но доступ ни к одному рабочему пространству на нём вам ещё не выдан. Администратор должен ' +
    'выдать вам доступ к рабочему пространству.',
  'web.access.signedInAs': 'Вы вошли как {name}',
  'web.access.signedInAsWithEmail': 'Вы вошли как {name} ({email})',
  'web.access.waiting': 'Этот экран обновится в момент выдачи доступа — перезагружать не нужно.',
  'web.access.signOut': 'Выйти из учётной записи',
  'web.consent.wouldSignIn': '{who} запрашивает вход на этот сервер',
  'web.consent.grantBody':
    'После разрешения устройство действует на этом сервере от вашего имени и может делать всё, что доступно вашей учётной записи.',
  'web.consent.clientDesktop': 'настольное приложение',
  'web.consent.clientExtension': 'расширение браузера',
  'web.consent.clientCli': 'инструмент командной строки',
  'web.consent.whoLabelled': '{device} ({client})',
  'web.consent.code': 'Код {code} — убедитесь, что он совпадает с кодом на вашем устройстве.',
  'web.consent.expires': 'Истекает примерно через {minutes} мин',
  'web.consent.allow': 'Разрешить',
  'web.consent.decline': 'Отклонить',
  'web.consent.switchAccount': 'Сменить учётную запись',
  'web.consent.approvedTitle': 'Устройство подтверждено',
  'web.consent.approvedBody': 'Устройство вошло от вашего имени. Эту вкладку можно закрыть.',
  'web.consent.deniedTitle': 'Вход отклонён',
  'web.consent.deniedBody': 'Это устройство не войдёт на сервер. Эту вкладку можно закрыть.',
  'web.consent.expiredTitle': 'Срок запроса на вход истёк',
  'web.consent.expiredBody': 'Время ожидания вышло. Начните вход заново с устройства.',
  'web.consent.notFoundTitle': 'Запрос на вход не найден',
  'web.consent.notFoundBody': 'Этот запрос истёк или не был выдан. Начните вход заново с устройства.',
  'web.consent.offlineTitle': 'Вход недоступен',
  'web.consent.continue': 'Перейти в Рабочую среду',
  'web.insecure.title': 'Этой странице нужно защищённое соединение',
  'web.insecure.intro':
    'В этой вкладке работает вся Рабочая среда, а не тонкое представление сервера, поэтому ей нужно создать удостоверение для этого ' +
    'устройства — а браузеры разрешают это только на защищённом источнике.',
  'web.insecure.optionLocal': 'На самом сервере:',
  'web.insecure.optionTls': 'Отсюда по HTTPS — поставьте перед сервером обратный прокси с завершением TLS.',
  'web.insecure.optionClients': 'Отсюда без TLS — расширение и настольное приложение подключаются напрямую к',
} as const satisfies Catalog;
