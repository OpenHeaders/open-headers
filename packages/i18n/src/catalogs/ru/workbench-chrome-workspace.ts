/**
 * Workbench chrome — the workspace plane — Russian. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); Org stays the raw product noun
 * (shared-workspace precedent); `OAuth`, format names (PNG, JPEG,
 * WebP, SVG) and the `KB` unit ride raw as en writes them; vault rides
 * raw in en's case (содержимое vault / записи vault, the case-ending
 * law). Runtime-quoted names use «…». File mints: дублировать =
 * duplicate / Копия {name} = copy-of (копировать stays the copy
 * action); переключатель = switcher; выдать доступ = grant;
 * администратор = admin; оператор сервера = server operator; участник
 * = member; владелец = owner; снимок = snapshot (carried); покинуть =
 * leave; активное рабочее пространство carries the АКТИВНО mint;
 * organization prose = организация (Org the product noun stays raw);
 * `Копировать в {place}` = Copy to <place>. `{name}` holes take
 * рабочее пространство / участник as head nouns or «…» quotes with no
 * ending; `{orgs}` takes a preposition (Подключено к {orgs}).
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'Рабочие пространства',
  'workbench.workspace.newWorkspace': 'Новое рабочее пространство',
  'workbench.workspace.intro':
    'Каждое рабочее пространство хранит собственные правила, коллекции, папки, шаблоны, переменные и историю тестовых запусков. Перетаскивайте, чтобы изменить порядок.',
  'workbench.workspace.deleteTitle': 'Удалить «{name}»?',
  'workbench.workspace.deleteBody':
    'Рабочее пространство и все его правила, коллекции, папки, шаблоны, переменные и история тестовых запусков будут удалены безвозвратно. Это действие нельзя отменить.',
  'workbench.workspace.deleteOk': 'Удалить',
  'workbench.workspace.deleteFailed': 'Не удалось удалить рабочее пространство',
  'workbench.workspace.deletedToast': 'Удалено «{name}»',
  'workbench.workspace.leaveTitle': 'Покинуть «{name}»?',
  'workbench.workspace.leaveBody':
    'Вы отказываетесь от собственного доступа к этому рабочему пространству — оно исчезнет из всех ваших открытых вкладок. У остальных доступ сохраняется, а администратор сможет выдать его вам снова.',
  'workbench.workspace.leaveOk': 'Покинуть',
  'workbench.workspace.leaveFailed': 'Не удалось покинуть рабочее пространство',
  'workbench.workspace.leftToast': 'Вы покинули «{name}»',
  'workbench.workspace.leaveAria': 'Покинуть рабочее пространство',
  'workbench.workspace.members.title': 'Участники «{name}»',
  'workbench.workspace.members.openAria': 'Управление участниками',
  'workbench.workspace.members.loadFailed': 'Не удалось загрузить участников',
  'workbench.workspace.members.updateFailed': 'Не удалось обновить участников',
  'workbench.workspace.members.operatorTag': 'Оператор сервера',
  'workbench.workspace.members.managedTag': 'Управляется',
  'workbench.workspace.members.managedTooltip': 'Этим доступом управляет поставщик удостоверений.',
  'workbench.workspace.members.removeConfirm': 'Удалить участника {name} из этого рабочего пространства?',
  'workbench.workspace.members.removeOk': 'Удалить',
  'workbench.workspace.members.removeAria': 'Удалить участника',
  'workbench.workspace.members.removedToast': 'Удалён участник {name}',
  'workbench.workspace.members.updatedToast': 'Обновлён участник {name}',
  'workbench.workspace.members.addedToast': 'Добавлен участник {name}',
  'workbench.workspace.members.addPlaceholder': 'Добавьте человека или служебную учётную запись…',
  'workbench.workspace.members.addButton': 'Добавить',
  'workbench.workspace.members.noneToAdd': 'У всех на этом сервере уже есть доступ.',
  'workbench.workspace.members.readOnlyHint': 'Изменять участников может только владелец рабочего пространства.',
  'workbench.workspace.members.visibilityLabel': 'Доступ',
  'workbench.workspace.members.visibilityPrivate': 'Закрытое',
  'workbench.workspace.members.visibilityInternal': 'Внутреннее',
  'workbench.workspace.members.visibilityPrivateHint': 'Это рабочее пространство видят только приглашённые участники.',
  'workbench.workspace.members.visibilityInternalHint':
    'Это рабочее пространство может просматривать каждый участник этого сервера. Изменять могут только добавленные вами участники.',
  'workbench.workspace.members.visibilityUpdatedToast': 'Доступ к рабочему пространству обновлён',
  'workbench.workspace.members.visibilityPublic': 'Публичное',
  'workbench.workspace.members.visibilityPublicHint':
    'Любой, у кого есть ссылка, может просматривать общий снимок этого рабочего пространства только для чтения. Изменять могут только добавленные вами участники.',
  'workbench.workspace.publicShare.heading': 'Публичная ссылка',
  'workbench.workspace.publicShare.loadFailed': 'Не удалось загрузить состояние публичного доступа',
  'workbench.workspace.publicShare.disabledHint':
    'Публичные рабочие пространства выключены на этом сервере. Оператор может включить их параметром publicWorkspaces в daemon.json.',
  'workbench.workspace.publicShare.notShared':
    'Снимок ещё не опубликован — ссылка заработает, когда вы опубликуете его.',
  'workbench.workspace.publicShare.sharedAt': 'Снимок опубликован {when}',
  'workbench.workspace.publicShare.shareButton': 'Опубликовать…',
  'workbench.workspace.publicShare.updateButton': 'Обновить публичную копию…',
  'workbench.workspace.publicShare.stopButton': 'Прекратить публикацию',
  'workbench.workspace.publicShare.stopConfirm':
    'Прекратить публикацию этого рабочего пространства? Публичная ссылка сразу перестанет работать.',
  'workbench.workspace.publicShare.stopOk': 'Прекратить публикацию',
  'workbench.workspace.publicShare.stoppedToast': 'Публичная ссылка удалена',
  'workbench.workspace.publicShare.sharedToast': 'Публичный снимок опубликован',
  'workbench.workspace.publicShare.copyLink': 'Копировать ссылку',
  'workbench.workspace.publicShare.copiedToast': 'Ссылка скопирована',
  'workbench.workspace.publicShare.reviewTitle': 'Опубликовать «{name}»',
  'workbench.workspace.publicShare.reviewIntro':
    'Любой, у кого есть ссылка, увидит снимок этого рабочего пространства только для чтения в его текущем состоянии. Проверьте, что уйдёт, прежде чем подтвердить:',
  'workbench.workspace.publicShare.reviewUpdateNote': 'Повторная публикация заменяет публичную копию по той же ссылке.',
  'workbench.workspace.publicShare.reviewStripped':
    'Никогда не включаются: записи vault, токены OAuth, значения Live, содержимое файлов и значения переменных типа «секрет».',
  'workbench.workspace.publicShare.reviewStrippedCount':
    'Значения секретных переменных ({count}) остаются скрытыми — их имена видны.',
  'workbench.workspace.publicShare.reviewContents': 'Содержимое',
  'workbench.workspace.publicShare.reviewEmpty':
    'Это рабочее пространство пусто — опубликованный снимок тоже будет пустым.',
  'workbench.workspace.publicShare.reviewVariables': 'Переменные ({count})',
  'workbench.workspace.publicShare.reviewNoVariables': 'Переменных нет.',
  'workbench.workspace.publicShare.reviewValueHidden': 'скрыто',
  'workbench.workspace.publicShare.confirmShare': 'Опубликовать снимок',
  'workbench.workspace.publicShare.previewFailed': 'Не удалось подготовить предпросмотр снимка',
  'workbench.workspace.publicShare.shareFailed': 'Не удалось опубликовать снимок',
  'workbench.workspace.publicShare.scope.workspace': 'Рабочее пространство',
  'workbench.workspace.publicShare.scope.environment': 'Окружение',
  'workbench.workspace.publicShare.scope.collection': 'Коллекция',
  'workbench.workspace.publicShare.cat.requests': 'запросов: {count}',
  'workbench.workspace.publicShare.cat.collections': 'коллекций: {count}',
  'workbench.workspace.publicShare.cat.folders': 'папок: {count}',
  'workbench.workspace.publicShare.cat.rules': 'правил: {count}',
  'workbench.workspace.publicShare.cat.environments': 'окружений: {count}',
  'workbench.workspace.publicShare.cat.examples': 'примеров ответов: {count}',
  'workbench.workspace.publicShare.cat.specs': 'API-спецификаций: {count}',
  'workbench.workspace.publicShare.cat.scripts': 'пакетов скриптов: {count}',
  'workbench.workspace.publicShare.cat.templates': 'шаблонов: {count}',
  'workbench.workspace.publicShare.cat.live': 'рабочих процессов Live: {count}',
  'workbench.workspace.publicShare.cat.files': 'файлов: {count}',
  'workbench.workspace.publicView.bannerTag': 'Публичный снимок',
  'workbench.workspace.publicView.banner':
    'Публичная копия «{name}» только для чтения. Ваши правки здесь нигде не сохраняются.',
  'workbench.workspace.publicView.loadFailed': 'Эта публичная ссылка на рабочее пространство недоступна.',
  'workbench.workspace.createOk': 'Создать',
  'workbench.workspace.createFailed': 'Не удалось создать рабочее пространство',
  'workbench.workspace.createdToastPrefix': 'Создано рабочее пространство',
  'workbench.workspace.duplicateTitle': 'Дублировать «{name}»',
  'workbench.workspace.duplicateTitleFallback': 'Дублировать рабочее пространство',
  'workbench.workspace.duplicateOk': 'Дублировать',
  'workbench.workspace.duplicateFailed': 'Не удалось дублировать рабочее пространство',
  'workbench.workspace.duplicatedToast': 'Дублировано: «{source}» → «{name}»',
  'workbench.workspace.publishFailed': 'Не удалось скопировать рабочее пространство',
  'workbench.workspace.publishedToast': '«{name}» скопировано в {place}',
  'workbench.workspace.selectedOrgFallback': 'выбранное место назначения',
  'workbench.workspace.editTitle': 'Изменить рабочее пространство',
  'workbench.workspace.saveOk': 'Сохранить',
  'workbench.workspace.updatedToast': 'Обновлено «{name}»',
  'workbench.workspace.deletedElsewhere': 'Это рабочее пространство удалено из другой вкладки',
  'workbench.workspace.updateFailed': 'Не удалось обновить рабочее пространство',
  'workbench.workspace.updateFailedWithMessage': 'Не удалось обновить рабочее пространство: {message}',
  'workbench.workspace.otherWorkspaces': 'Другие рабочие пространства',
  'workbench.workspace.dragToReorder': 'Перетащите, чтобы изменить порядок',
  'workbench.workspace.activePill': 'Активно',
  'workbench.workspace.switch': 'Переключиться',
  'workbench.workspace.renameAria': 'Переименовать рабочее пространство',
  'workbench.workspace.duplicateAria': 'Дублировать рабочее пространство',
  'workbench.workspace.publishAria': 'Скопировать рабочее пространство в настольное приложение или на сервер',
  'workbench.workspace.deleteAria': 'Удалить рабочее пространство',
  'workbench.workspace.prefixLabel': 'Префикс',
  'workbench.workspace.nameLabel': 'Имя',
  'workbench.workspace.nameRequired': 'Имя обязательно',
  'workbench.workspace.nameTooLong': 'Имя должно быть короче 60 символов',
  'workbench.workspace.namePlaceholder': 'Моё рабочее пространство',
  'workbench.workspace.descriptionLabel': 'Описание (необязательно)',
  'workbench.workspace.copyOfName': 'Копия {name}',
  'workbench.workspace.copyOfPlaceholder': 'Копия …',
  'workbench.workspace.intoOrg': 'Куда',
  'workbench.workspace.includeSecrets': 'Включить содержимое vault (секреты)',
  'workbench.workspace.includeSecretsHint':
    'При необходимости введите секреты в копии заново. Соединения OAuth в любом случае авторизуются повторно.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': 'Сделать «{name}» активным рабочим пространством?',
  'workbench.workspace.makeActiveBody':
    'Всплывающее окно, боковая панель и все новые {units}, не закреплённые за конкретным рабочим пространством, переключатся на «{name}».',
  'workbench.workspace.makeActiveOk': 'Сделать активным',
  'workbench.workspace.cancel': 'Отмена',
  'workbench.workspace.nowActiveToast': '«{name}» теперь активное рабочее пространство',
  'workbench.workspace.switcherAria':
    'Этот элемент ({unit}) редактирует рабочее пространство {name}. Нажмите, чтобы переключиться.',

  // ── Workspace: publish modal — "Copy to <place>" to the user ────────
  'workbench.workspace.publishTitle': 'Копировать «{name}»',
  'workbench.workspace.publishTitleFallback': 'Копировать рабочее пространство',
  'workbench.workspace.publishToOk': 'Копировать в {place}',
  'workbench.workspace.publishOk': 'Копировать',
  'workbench.workspace.publishIntro':
    'Копия этого рабочего пространства появится в выбранном настольном приложении или на сервере и будет синхронизироваться оттуда. Оригинал остаётся здесь.',
  'workbench.workspace.toOrg': 'Копировать в',
  'workbench.workspace.pickTargetOrg': 'Выберите, куда отправится копия',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Логотип',
  'workbench.workspace.org.logoAria': 'Изменить логотип этой организации',
  'workbench.workspace.org.renameButton': 'Переименовать',
  'workbench.workspace.org.renameAria': 'Переименовать эту организацию',
  'workbench.workspace.org.renameTitle': 'Переименовать {hint}',
  'workbench.workspace.org.renameTitleFallback': 'Переименовать',
  'workbench.workspace.org.nameUpdated': 'Имя обновлено',
  'workbench.workspace.org.identityLoading': 'Идентичность ещё загружается — повторите попытку через мгновение',
  'workbench.workspace.org.renameExtra':
    'Показывается в переключателе рабочих пространств и всем, с кем вы делитесь рабочими пространствами.',
  'workbench.workspace.org.nameTooLong': 'Имя должно быть короче {max} символов',
  'workbench.workspace.org.namePlaceholder': 'Мой рабочий ноутбук',
  'workbench.workspace.org.logoTitle': 'Логотип {hint}',
  'workbench.workspace.org.logoTitleFallback': 'Логотип организации',
  'workbench.workspace.org.logoAlt': 'Текущий логотип организации',
  'workbench.workspace.org.replace': 'Заменить…',
  'workbench.workspace.org.upload': 'Загрузить…',
  'workbench.workspace.org.remove': 'Удалить',
  'workbench.workspace.org.logoUpdated': 'Логотип обновлён',
  'workbench.workspace.org.logoRemoved': 'Логотип удалён',
  'workbench.workspace.org.fileReadFailed': 'Не удалось прочитать этот файл.',
  'workbench.workspace.org.logoHint':
    'PNG, JPEG, WebP или SVG размером до {kb} KB. Лучше всего выглядят квадратные изображения. Показывается всем, кто синхронизируется с этой организацией.',
  'workbench.workspace.org.logoReject.notImage': 'Не удалось прочитать этот файл как изображение.',
  'workbench.workspace.org.logoReject.corruptImage': 'Этот файл не является корректным изображением заявленного типа.',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'Используйте файл PNG, JPEG, WebP или SVG.',
  'workbench.workspace.org.logoReject.tooLarge': 'Размер логотипа не должен превышать {kb} KB.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'Этот SVG содержит скрипты или внешние ссылки — экспортируйте простой самодостаточный SVG.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'Теперь у вас есть доступ к рабочему пространству',
  'workbench.workspace.grant.arrivedTitle': 'Доступно новое рабочее пространство',
  'workbench.workspace.grant.open': 'Открыть рабочее пространство',
  'workbench.workspace.grant.notifTitleActive': 'Теперь у вас есть доступ к {name}',
  'workbench.workspace.grant.notifTitle': 'Рабочее пространство {name} теперь доступно',
  'workbench.workspace.grant.notifBodyActive': 'Администратор выдал вам доступ — вы уже работаете в нём.',
  'workbench.workspace.grant.notifBody':
    'Администратор выдал вам доступ — оно появилось в переключателе рабочих пространств.',
  'workbench.workspace.grant.orgFallback': 'вашей организации',
  'workbench.workspace.grant.zeroBanner':
    'Подключено к {orgs} — доступ к рабочим пространствам вам ещё не выдан. Вы работаете в локальном рабочем пространстве; выданные рабочие пространства появятся здесь автоматически, как только администратор откроет вам доступ.',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': 'Цвет {name}',
  'workbench.workspace.picker.searchIcons': 'Поиск значков...',
  'workbench.workspace.picker.noIconTooltip': 'Без значка — только цветной квадрат',
  'workbench.workspace.picker.noIconAria': 'Без значка',
  'workbench.workspace.picker.triggerAria': 'Выбрать префикс рабочего пространства (цвет или значок)',
} as const satisfies Catalog;
