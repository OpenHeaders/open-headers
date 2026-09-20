/**
 * Daemon-admin family — Russian. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`), admission
 * status enum values and audit `reason` strings ({status} / {reason}
 * holes carry server data), license ids ({id}), the `oh-license.` key
 * prefix, `IdP` / `SSO` / `JSONL` / `Git` vocabulary with вход / формат
 * / репозиторий as head nouns (Сеансы SSO, вход через SSO, Экспорт в
 * JSONL, адрес для Git), and the ` · ` separator glyphs. Quotes the
 * shipped ru mints: Администрирование сервера / журнал аудита
 * (workbench-chrome), Администратор / Оператор сервера / Участник /
 * владелец рабочего пространства / выдать доступ = grant
 * (workbench-chrome-workspace), место = seat / уровень = tier /
 * бесплатный уровень / отозвать = revoke / выпустить = mint /
 * Сопряжённые устройства / Сеансы SSO / поставщик удостоверений
 * (settings panes), служебная учётная запись (the members
 * placeholder), примечания к выпуску, Войти = sign in, Обновить.
 * MINTS: допуск = admission (a device / user is admitted — допущен);
 * личное место = individual seat; пул мест = the seat pool (pull stays
 * the git verb, raw); поглотить = absorb; Наблюдатель / Редактор /
 * Владелец = the grant roles; пользователь каталога = directory user;
 * Субъект = actor (the audit column); Разрешено / Запрещено = allow /
 * deny (the audit events and the decision filter); только оператор =
 * operator only; плоскость администрирования = admin plane; веб-шлюз
 * = the web gate (web quotes it); деактивировать = deactivate;
 * функциональные роли. `{name}` holes ride the en aside dash (`Задать
 * пароль — {name}`); `{id}` takes a parenthesis; `{limit}` / `{date}`
 * take head nouns or a colon frame.
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'Администрирование сервера',
  'workbench.serverAdmin.intro':
    'Пользователи каталога входят по привязанному токену или через SSO и видят ровно те рабочие пространства, доступ к которым выдан здесь. Деактивация отзывает токены пользователя и немедленно отключает его.',
  'workbench.serverAdmin.deniedDescription': 'Для администрирования этого сервера нужна возможность daemon.admin.',
  'workbench.serverAdmin.cancel': 'Отмена',

  // ── Server admin panel (the administration nav — one row per
  //    domain, each opening its own slim tab) ─────────────────────────
  'workbench.serverAdmin.panel.users': 'Пользователи',
  'workbench.serverAdmin.panel.usersHint': 'Каталог, роли и доступ к рабочим пространствам',
  'workbench.serverAdmin.panel.devices': 'Сопряжённые устройства',
  'workbench.serverAdmin.panel.devicesHint': 'Токены, сопряжение и активные сеансы входа',
  'workbench.serverAdmin.panel.git': 'Git',
  'workbench.serverAdmin.panel.gitHint': 'Привязка рабочих пространств сервера к репозиториям',
  'workbench.serverAdmin.panel.audit': 'Аудит',
  'workbench.serverAdmin.panel.auditHint': 'Запросы к журналу аудита сервера',
  'workbench.serverAdmin.panel.server': 'Сервер',
  'workbench.serverAdmin.panel.serverHint': 'Сборка, версия и примечания к выпуску',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.build.sectionTitle': 'Сборка',
  'workbench.serverAdmin.build.sectionHint': 'Сборка сервера, которой управляет эта консоль.',
  'workbench.serverAdmin.build.versionLabel': 'Версия',
  'workbench.serverAdmin.build.versionUnknown': 'Неизвестно',
  'workbench.serverAdmin.notes.sectionTitle': 'Примечания к выпуску',
  'workbench.serverAdmin.notes.sectionHint': 'Что вошло в сборку сервера, которым управляет эта консоль.',
  'workbench.serverAdmin.notes.empty': 'В этой сборке нет примечаний к выпуску.',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'Пользователи',
  'workbench.serverAdmin.users.sectionHint':
    'Допустите пользователя, затем выдайте роли по рабочим пространствам ниже. Email связывает входы через SSO с записью.',
  'workbench.serverAdmin.users.nameRequired': 'Имя обязательно',
  'workbench.serverAdmin.users.workspaceRequired': 'Выдайте доступ хотя бы к одному рабочему пространству',
  'workbench.serverAdmin.users.displayNamePlaceholder': 'Отображаемое имя',
  'workbench.serverAdmin.users.emailPlaceholder': 'Email',
  'workbench.serverAdmin.users.emailRequired': 'Email обязателен. Пользователи входят по нему.',
  'workbench.serverAdmin.users.emailInvalid': 'Введите корректный адрес email',
  'workbench.serverAdmin.users.initialPasswordPlaceholder': 'Начальный пароль (необязательно)',
  'workbench.serverAdmin.users.passwordTooShort': 'Пароль должен содержать не менее 8 символов',
  'workbench.serverAdmin.users.seatKeyPlaceholder': 'Ключ личного места (oh-license.…)',
  'workbench.serverAdmin.users.addUser': 'Добавить пользователя',
  'workbench.serverAdmin.users.kindUser': 'Пользователь',
  'workbench.serverAdmin.users.kindService': 'Служебная учётная запись',
  'workbench.serverAdmin.users.serviceExplainer':
    'Служебная учётная запись хранит доступ к рабочим пространствам и привязанные токены для автоматизации — она никогда не входит сама и не занимает место. Выпустите её токен в разделе устройств ниже.',
  'workbench.serverAdmin.users.serviceNamePlaceholder': 'Имя служебной учётной записи (например, CI deploy)',
  'workbench.serverAdmin.users.addService': 'Добавить служебную учётную запись',
  'workbench.serverAdmin.users.serviceTag': 'Служебная',
  'workbench.serverAdmin.users.serviceLimit':
    'Бесплатный тариф допускает служебных учётных записей: {limit}; любая платная лицензия снимает ограничение.',
  'workbench.serverAdmin.users.licensesSoldAt': 'Лицензии продаются на',
  'workbench.serverAdmin.users.neverSeenService': 'не использовалась',
  'workbench.serverAdmin.users.seatLimit':
    'Сервер достиг предела мест. Добавьте места в командную лицензию или вставьте выше ключ личного места нового пользователя — он допускает его без места из пула.',
  'workbench.serverAdmin.users.seatsSoldAt': 'Личные места продаются на',
  'workbench.serverAdmin.users.emptyDirectory':
    'Пользователей каталога пока нет — сервер работает на одиночном уровне. Добавьте пользователя, чтобы открыть командный уровень.',
  'workbench.serverAdmin.users.deactivatedOn': 'Деактивирован {date}',
  'workbench.serverAdmin.users.addedOn': 'добавлен {date}',
  'workbench.serverAdmin.users.lastSeenOn': 'последний вход {date}',
  'workbench.serverAdmin.users.neverSeen': 'ни разу не входил',
  'workbench.serverAdmin.users.sortByCreated': 'Сначала новые',
  'workbench.serverAdmin.users.sortByLastSeen': 'По последнему входу',
  'workbench.serverAdmin.users.loadFailed': 'Не удалось загрузить каталог пользователей: {message}',
  'workbench.serverAdmin.users.addFailed': 'Не удалось добавить пользователя: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': 'Личное место',
  'workbench.serverAdmin.seat.healthyTooltip':
    'Допущен по собственному личному месту ({id}) — не учитывается в пуле этого сервера.',
  'workbench.serverAdmin.seat.lapsedTooltip':
    'Его личное место ({id}) в состоянии {status}. Он остаётся в системе — просрочка никогда не выгоняет, — но место больше не продлевается.',
  'workbench.serverAdmin.seat.absorbTitle': 'Поглотить это место в пул?',
  'workbench.serverAdmin.seat.absorbDescription':
    'Пользователь становится обычным местом из пула, а его личная лицензия перестаёт продлеваться здесь. Это нельзя отменить.',
  'workbench.serverAdmin.seat.absorbOk': 'Поглотить',
  'workbench.serverAdmin.seat.absorbCta': 'Поглотить в пул',
  'workbench.serverAdmin.seat.absorbed': 'Место поглощено в пул.',
  'workbench.serverAdmin.seat.absorbFailed': 'Не удалось поглотить место: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': 'Деактивировать этого пользователя?',
  'workbench.serverAdmin.deactivate.description':
    'Его токены будут отозваны, а живые соединения закрыты. Чтобы допустить снова, добавьте тот же email заново.',
  'workbench.serverAdmin.deactivate.cta': 'Деактивировать',
  'workbench.serverAdmin.deactivate.done': 'Пользователь деактивирован. Его токены отозваны, живые соединения закрыты.',
  'workbench.serverAdmin.deactivate.failed': 'Не удалось деактивировать: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': 'Наблюдатель',
  'workbench.serverAdmin.grants.roleEditor': 'Редактор',
  'workbench.serverAdmin.grants.roleOwner': 'Владелец',
  'workbench.serverAdmin.grants.none': 'Доступа к рабочим пространствам пока нет.',
  'workbench.serverAdmin.grants.idpTooltip':
    'Выдано сопоставлением поставщика удостоверений. Отзыв действует только до следующего входа через SSO, который применит его заново.',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'Рабочее пространство',
  'workbench.serverAdmin.grants.grantCta': 'Выдать доступ',
  'workbench.serverAdmin.grants.everyWorkspace': 'Доступ выдан ко всем рабочим пространствам.',
  'workbench.serverAdmin.grants.grantFailed': 'Не удалось выдать доступ: {message}',
  'workbench.serverAdmin.grants.revokeFailed': 'Не удалось отозвать доступ: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'Задать пароль — {name}',
  'workbench.serverAdmin.password.resetTitle': 'Сбросить пароль — {name}',
  'workbench.serverAdmin.password.explainer':
    'Пользователь входит по email и этому паролю на веб-шлюзе сервера. Передайте его напрямую — на сервере он хранится в виде хеша и не может быть прочитан обратно.',
  'workbench.serverAdmin.password.placeholder': 'Новый пароль (не менее 8 символов)',
  'workbench.serverAdmin.password.setCta': 'Задать пароль',
  'workbench.serverAdmin.password.resetCta': 'Сбросить пароль',
  'workbench.serverAdmin.password.removeCta': 'Удалить пароль',
  'workbench.serverAdmin.password.setDone': 'Пароль задан.',
  'workbench.serverAdmin.password.removedDone': 'Пароль удалён.',
  'workbench.serverAdmin.password.updateFailed': 'Не удалось обновить пароль: {message}',
  'workbench.serverAdmin.password.needsEmail': 'Сначала задайте email — пользователи входят по нему.',

  // ── Email modal (the client sign-in plan D5) ────────────────────────
  'workbench.serverAdmin.email.setTitle': 'Задать email — {name}',
  'workbench.serverAdmin.email.explainer':
    'Пользователи входят по своему email — на странице сервера и из каждого клиента. Без email этот пользователь не сможет войти ни одним способом.',
  'workbench.serverAdmin.email.setCta': 'Задать email',
  'workbench.serverAdmin.email.setDone': 'Email задан.',
  'workbench.serverAdmin.email.updateFailed': 'Не удалось задать email: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Задать email для Git — {name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Изменить email для Git — {name}',
  'workbench.serverAdmin.gitEmail.explainer':
    'Коммиты с работой этого пользователя подписываются этим адресом, чтобы они связывались с его профилем на Git-хостинге. Без него используется email из каталога, затем адрес noreply.',
  'workbench.serverAdmin.gitEmail.placeholder': 'email автора коммитов',
  'workbench.serverAdmin.gitEmail.setCta': 'Задать email для Git',
  'workbench.serverAdmin.gitEmail.changeCta': 'Изменить email для Git',
  'workbench.serverAdmin.gitEmail.removeCta': 'Удалить переопределение',
  'workbench.serverAdmin.gitEmail.setDone': 'Email для Git задан.',
  'workbench.serverAdmin.gitEmail.removedDone': 'Переопределение email для Git удалено.',
  'workbench.serverAdmin.gitEmail.updateFailed': 'Не удалось обновить email для Git: {message}',

  // ── Functional roles ───────────────────────────────────────────────
  'workbench.serverAdmin.roles.daemonAdmin': 'Администратор сервера',
  'workbench.serverAdmin.roles.daemonAdminTooltip':
    'Администрирует этот сервер: пользователей, роли, доступ, устройства и отчёты. Сама по себе роль не даёт доступа к рабочим пространствам — этот пользователь по-прежнему видит только те, доступ к которым выдан ниже.',
  'workbench.serverAdmin.roles.createWorkspaces': 'Создание рабочих пространств',
  'workbench.serverAdmin.roles.createWorkspacesTooltip':
    'Позволяет этому пользователю создавать новые рабочие пространства на сервере. Созданным он владеет; для существующих по-прежнему нужен выданный доступ.',
  'workbench.serverAdmin.roles.daemonAdminGranted': 'Теперь администратор сервера.',
  'workbench.serverAdmin.roles.daemonAdminRevoked': 'Роль администратора сервера отозвана.',
  'workbench.serverAdmin.roles.createWorkspacesGranted': 'Теперь может создавать рабочие пространства.',
  'workbench.serverAdmin.roles.createWorkspacesRevoked': 'Больше не может создавать рабочие пространства.',
  'workbench.serverAdmin.roles.lastAdmin':
    'это единственный администратор сервера — сначала назначьте администратором кого-то другого',
  'workbench.serverAdmin.roles.updateFailed': 'Не удалось изменить роль: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    'Привяжите рабочее пространство сервера к репозиторию и управляйте коммитами, pull, push и ветками удалённо. Пути указываются в файловой системе самого сервера.',
  'workbench.serverAdmin.git.workspaceLabel': 'Рабочее пространство',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'Отчёты',
  'workbench.serverAdmin.audit.sectionHint':
    'Каждое решение о разрешении, которое принимает этот сервер, и каждый допуск устройства — в виде фильтруемого журнала аудита. Экспорт учитывает активные фильтры.',
  'workbench.serverAdmin.audit.capAdmission': 'Допуск (подключение)',
  'workbench.serverAdmin.audit.capAdminPlane': 'Плоскость администрирования',
  'workbench.serverAdmin.audit.capOperatorPlane': 'Только оператор',
  'workbench.serverAdmin.audit.capSsoGrant': 'Выдача через SSO (сопоставление)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'Отзыв через SSO (сопоставление)',
  'workbench.serverAdmin.audit.capSsoAdmin': 'Администратор через SSO (объявлено)',
  'workbench.serverAdmin.audit.capWorkspaceRead': 'Чтение рабочего пространства',
  'workbench.serverAdmin.audit.capWorkspaceWrite': 'Запись в рабочее пространство',
  'workbench.serverAdmin.audit.capWorkspaceList': 'Список рабочих пространств',
  'workbench.serverAdmin.audit.rangeLastHour': 'Последний час',
  'workbench.serverAdmin.audit.rangeLast24Hours': 'Последние 24 часа',
  'workbench.serverAdmin.audit.rangeLast7Days': 'Последние 7 дней',
  'workbench.serverAdmin.audit.rangeLast30Days': 'Последние 30 дней',
  'workbench.serverAdmin.audit.colTime': 'Время',
  'workbench.serverAdmin.audit.colEvent': 'Событие',
  'workbench.serverAdmin.audit.colCapability': 'Возможность',
  'workbench.serverAdmin.audit.colWorkspace': 'Рабочее пространство',
  'workbench.serverAdmin.audit.colActor': 'Субъект',
  'workbench.serverAdmin.audit.eventAdmission': 'Допуск',
  'workbench.serverAdmin.audit.eventAdmissionRefused': 'Отказ в допуске',
  'workbench.serverAdmin.audit.eventSsoGrant': 'Выдача через SSO',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'Отзыв через SSO',
  'workbench.serverAdmin.audit.eventSsoAdmin': 'Администратор через SSO',
  'workbench.serverAdmin.audit.eventAllow': 'Разрешено',
  'workbench.serverAdmin.audit.eventDeny': 'Запрещено',
  'workbench.serverAdmin.audit.filterActor': 'Субъект',
  'workbench.serverAdmin.audit.filterCapability': 'Возможность',
  'workbench.serverAdmin.audit.filterDecision': 'Решение',
  'workbench.serverAdmin.audit.filterWorkspace': 'Рабочее пространство',
  'workbench.serverAdmin.audit.filterAnyTime': 'За всё время',
  'workbench.serverAdmin.audit.decisionAllow': 'Разрешено',
  'workbench.serverAdmin.audit.decisionDeny': 'Запрещено',
  'workbench.serverAdmin.audit.refresh': 'Обновить',
  'workbench.serverAdmin.audit.exportJsonl': 'Экспорт в JSONL',
  'workbench.serverAdmin.audit.emptyText': 'Ни одна запись аудита не совпадает.',
  'workbench.serverAdmin.audit.loadMore': 'Загрузить ещё',
} as const satisfies Catalog;
