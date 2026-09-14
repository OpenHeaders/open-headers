/**
 * Workbench variables station — Russian. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * stays raw inside keyed sentences: `{{live.NAME}}` / `{{…}}`
 * reference syntax (composed as code chips at the render site), TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, secret-manager
 * product names (1Password / Bitwarden / AWS Secrets Manager / Azure
 * Key Vault / HashiCorp Vault) and their `Vault` field (the product's
 * own noun, raw), variable / workflow names ({name}), server error
 * text ({message}); lowercase-en `vault` rides raw (секреты vault).
 * Quotes the shipped ru mints: the scoping nouns (Vault raw / Окружение
 * / Коллекция / Рабочее пространство / Live — workbench-chrome's
 * varScope block, the sidebar entries Переменные рабочего пространства
 * / Переменные Live), **В области / Все области = In scope / All
 * scopes** (minted in workbench-docs-variables), ссылка без префикса =
 * bare reference (docs), Сделать активным / Сделать окружением по
 * умолчанию (the sidebar env rows), Открыть доверенные сертификаты
 * (the command palette), парольная фраза / издатель / закрытый ключ
 * (shared-conflicts), Менеджер секретов (shared-components), «{digits}
 * цифр · {period}s» (the templateInput TOTP preview), Обновить /
 * опубликовать / переопределение / черновик / привязка / захват /
 * рабочий процесс carried, связка ключей (settings panes), зашифрован
 * при хранении (the proxy trust pane). MINTS: чувствительная =
 * sensitive (a row mark — Пометить как чувствительную); хранилище
 * учётных данных ОС = OS credential store; ключ хранения = the at-rest
 * key; запечатал / запечатанные = sealed; проблемы разрешения =
 * resolution issues; the reason chips (не разрешено / вне области /
 * неизвестное пространство имён / ссылка на шаг вне области / пусто /
 * недопустимое значение / нужна авторизация / секрет не найден /
 * менеджер недоступен). The scopeInfo title restructures to
 * `{qualifier} области «{label}»` (Переменная области «Окружение»)
 * and its sandwich reads `Пишите` + [chip] + `только так — не как` +
 * [chip] + `.` / `или просто` + [chip]; the bare row `Ссылка без
 * префикса` + [chip] + `разрешается по приоритету:` accepts the
 * dangling code chip as ja / ko do. Counts take colon frames
 * (строк: {strings}; разрешено {resolved}/{total}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': 'Переменная',
  'workbench.variables.table.headerSecret': 'Секрет',
  'workbench.variables.table.headerValue': 'Значение',
  'workbench.variables.table.namePlaceholder': 'Имя',
  'workbench.variables.table.valuePlaceholder': 'Значение',
  'workbench.variables.table.addVariable': 'Добавить переменную…',
  'workbench.variables.table.addSecret': 'Добавить секрет…',
  'workbench.variables.table.enableRow': 'Включить переменную',
  'workbench.variables.table.disableRow': 'Выключить переменную',
  'workbench.variables.table.markSensitive': 'Пометить как чувствительную',
  'workbench.variables.table.unmarkSensitive': 'Снять пометку «чувствительная»',
  'workbench.variables.table.showValue': 'Показать значение',
  'workbench.variables.table.hideValue': 'Скрыть значение',
  'workbench.variables.table.kindText': 'Текст',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': 'Сертификат',
  'workbench.variables.table.kindSecretManager': 'Менеджер секретов',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': 'Хранилище учётных данных ОС',
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': 'Поставщик',
  'workbench.variables.table.smField.vault': 'Vault',
  'workbench.variables.table.smField.item': 'Элемент',
  'workbench.variables.table.smField.field': 'Поле',
  'workbench.variables.table.smField.account': 'Учётная запись',
  'workbench.variables.table.smField.secretId': 'ID секрета',
  'workbench.variables.table.smField.service': 'Сервис',
  'workbench.variables.table.smField.name': 'Имя',
  'workbench.variables.table.smField.stage': 'Стадия',
  'workbench.variables.table.smField.region': 'Регион',
  'workbench.variables.table.smField.profile': 'Профиль',
  'workbench.variables.table.smField.vaultUrl': 'URL-адрес Vault',
  'workbench.variables.table.smField.version': 'Версия',
  'workbench.variables.table.smField.mount': 'Точка монтирования',
  'workbench.variables.table.smField.path': 'Путь',
  'workbench.variables.table.smField.key': 'Ключ',
  'workbench.variables.table.smField.serverUrl': 'URL-адрес сервера',
  'workbench.variables.table.smFieldOptional': '{label} (необязательно)',
  'workbench.variables.table.smStatus.available': 'Доступен',
  'workbench.variables.table.smStatus.notInstalled': 'Недоступен на этом устройстве',
  'workbench.variables.table.smStatus.integrationDisabled': 'Интеграция выключена',
  'workbench.variables.table.smStatus.noCredentials': 'Учётные данные не настроены',
  'workbench.variables.table.smStatus.locked': 'Заблокирован',
  'workbench.variables.table.smStatus.unreachable': 'Недоступен по сети',
  'workbench.variables.table.certPlaceholder': 'Сертификат (PEM)',
  'workbench.variables.table.certKeyPlaceholder': 'Закрытый ключ (PEM)',
  'workbench.variables.table.passphrasePlaceholder': 'Парольная фраза ключа (необязательно)',
  'workbench.variables.table.showCertificate': 'Показать сертификат',
  'workbench.variables.table.hideCertificate': 'Скрыть сертификат',
  'workbench.variables.table.seedPlaceholder': 'Секрет Base32',
  'workbench.variables.table.showSeed': 'Показать секрет',
  'workbench.variables.table.hideSeed': 'Скрыть секрет',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} цифр · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} цифр · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': 'Издатель',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': 'ПЕРЕМЕННЫЕ ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': 'Переменные рабочего пространства',
  'workbench.variables.workspace.description':
    'Общие для всех окружений этого рабочего пространства. Самый низкий приоритет — перекрываются областями коллекции, окружения и vault.',
  'workbench.variables.workspace.saveFailed': 'Не удалось сохранить переменные рабочего пространства',
  'workbench.variables.workspace.saveFailedDetail': 'Не удалось сохранить переменные рабочего пространства: {message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': 'Окружение не найдено.',
  'workbench.variables.environment.activeTag': 'Активно',
  'workbench.variables.environment.defaultTag': 'По умолчанию',
  'workbench.variables.environment.defaultTooltip':
    'Резолвер откатывается сюда, когда в активном окружении нет переменной.',
  'workbench.variables.environment.setActive': 'Сделать активным',
  'workbench.variables.environment.setDefault': 'Сделать окружением по умолчанию',
  'workbench.variables.environment.unsetDefault': 'Снять «по умолчанию»',
  'workbench.variables.environment.setDefaultTooltip':
    'Сделать окружением по умолчанию — резолвер откатывается сюда, когда в активном окружении нет переменной.',
  'workbench.variables.environment.unsetDefaultTooltip':
    'Снять «по умолчанию» — резолвер перестанет откатываться к этому окружению.',
  'workbench.variables.environment.deletedElsewhere': 'Окружение удалено из другой вкладки',
  'workbench.variables.environment.updateFailed': 'Не удалось обновить окружение',
  'workbench.variables.environment.updateFailedDetail': 'Не удалось обновить окружение: {message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'Коллекция не найдена.',
  'workbench.variables.collection.title': '{name} · Переменные',
  'workbench.variables.collection.descriptionRule':
    'Переменные, доступные каждому правилу в этой коллекции. Перекрываются областями окружения и vault; перекрывают область рабочего пространства. Хранятся в открытом виде — для секретов используйте Vault.',
  'workbench.variables.collection.descriptionRequest':
    'Переменные, доступные каждому запросу в этой коллекции. Перекрываются областями окружения и vault; перекрывают область рабочего пространства. Хранятся в открытом виде — для секретов используйте Vault.',
  'workbench.variables.collection.descriptionTemplate':
    'Переменные, доступные каждому шаблону в этой коллекции. Перекрываются областями окружения и vault; перекрывают область рабочего пространства. Хранятся в открытом виде — для секретов используйте Vault.',
  'workbench.variables.collection.deletedElsewhere': 'Коллекция удалена из другой вкладки',
  'workbench.variables.collection.saveFailed': 'Не удалось сохранить переменные коллекции',
  'workbench.variables.collection.saveFailedDetail': 'Не удалось сохранить переменные коллекции: {message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Секреты Vault зашифрованы при хранении, никогда не покидают это устройство и имеют приоритет над всеми остальными областями.',
  'workbench.variables.vault.trustedRootsNote':
    'Ищете CA-сертификаты? Доверенные сертификаты — данные рабочего пространства, а не секреты; у них своя вкладка.',
  'workbench.variables.vault.trustedRootsLink': 'Открыть доверенные сертификаты',
  'workbench.variables.vault.cipherLocked':
    'Хранилище секретов заблокировано — система отказала в доступе к своей связке ключей, поэтому секреты vault нельзя прочитать или сохранить в этом сеансе.',
  'workbench.variables.vault.cipherLockedRelaunch': 'Перезапустить приложение',
  'workbench.variables.vault.lockedTitle': 'Vault заблокирован — ключ хранения утерян',
  'workbench.variables.vault.lockedDescription':
    'Секреты этого vault всё ещё хранятся на этом устройстве, но их больше нельзя расшифровать: ключ хранения, который их запечатал, исчез (очищены данные браузера, новый профиль или сброшенный ключ расширения). Редактирование отключено, чтобы новая запись не перезаписала запечатанные данные. Введите секреты заново, чтобы разблокировать vault — существующие записи будут заменены.',
  'workbench.variables.vault.secretsCount':
    'СЕКРЕТЫ (строк: {strings} · TOTP: {totps} · сертификатов: {certs} · менеджер секретов: {refs})',
  'workbench.variables.vault.saveFailed': 'Не удалось сохранить vault',
  'workbench.variables.vault.saveFailedDetail': 'Не удалось сохранить vault: {message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Переменные Live',
  'workbench.variables.live.newVariable': 'Новая переменная Live',
  'workbench.variables.live.descriptionPrefix':
    'Каждая привязка сопоставляет имя с захватом из рабочего процесса (цепочки запросов по расписанию). В правилах и запросах ссылка выглядит как',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': 'Имя',
  'workbench.variables.live.headerValue': 'Значение',
  'workbench.variables.live.headerWorkflow': 'Рабочий процесс',
  'workbench.variables.live.empty':
    'Переменных Live пока нет. Создайте одну, чтобы привязать имя к захваченному значению рабочего процесса.',
  'workbench.variables.live.draftMarker': 'черновик',
  'workbench.variables.live.offMarker': 'выкл.',
  'workbench.variables.live.overrideMarker': 'переопределение',
  'workbench.variables.live.clickEyeToReveal': 'Нажмите на глаз, чтобы показать',
  'workbench.variables.live.showValue': 'Показать значение',
  'workbench.variables.live.hideValue': 'Скрыть значение',
  'workbench.variables.live.notCapturedYet': 'ещё не захвачено',
  'workbench.variables.live.missingWorkflow': 'рабочий процесс отсутствует',
  'workbench.variables.live.refreshNow': 'Обновить рабочий процесс сейчас',
  'workbench.variables.live.refreshAria': 'Обновить {name}',
  'workbench.variables.live.editBinding': 'Изменить привязку (имя / включение / переопределение)',
  'workbench.variables.live.editAria': 'Изменить {name}',
  'workbench.variables.live.delete': 'Удалить',
  'workbench.variables.live.deleteAria': 'Удалить {name}',
  'workbench.variables.live.deleteFailed': 'Не удалось удалить «{name}»',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': 'Окружение',
  'workbench.variables.panel.scope.collection': 'Коллекция',
  'workbench.variables.panel.scope.workspace': 'Рабочее пространство',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': 'В области',
  'workbench.variables.panel.inContextTitleNamed': 'В области: {name}',
  'workbench.variables.panel.inContextSummary':
    'Переменные, на которые ссылается активное правило, запрос или шаблон, — каждая разрешена через все области, чтобы вы видели точное значение, которое применится. Пусто, пока вы ничего не открыли.',
  'workbench.variables.panel.allScopesTitle': 'Все области',
  'workbench.variables.panel.allScopesSummary':
    'Все переменные, определённые во всех областях, сгруппированные по приоритету разрешения. Откройте (i) области, чтобы узнать, как на неё ссылаться и где она стоит в порядке.',
  'workbench.variables.panel.sectionAboutAria': 'О разделе {title}',
  'workbench.variables.panel.scopeAboutAria': 'О переменных области {scope}',
  'workbench.variables.panel.scopeSummary.vault':
    'Личные секреты, хранятся в вашем vault и никогда не синхронизируются.',
  'workbench.variables.panel.scopeSummary.environment':
    'Переменные активного окружения, с откатом к окружению по умолчанию.',
  'workbench.variables.panel.scopeSummary.collection': 'Переменные в области активной коллекции.',
  'workbench.variables.panel.scopeSummary.workspace': 'Переменные, общие для всего рабочего пространства.',
  'workbench.variables.panel.scopeSummary.live': 'Значение из рабочего процесса, разрешённое по последнему запуску.',
  'workbench.variables.panel.scopeInfo.title': '{qualifier} области «{label}»',
  'workbench.variables.panel.scopeInfo.qualifierSecret': 'Секрет',
  'workbench.variables.panel.scopeInfo.qualifierVariable': 'Переменная',
  'workbench.variables.panel.scopeInfo.writePrefix': 'Пишите',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': 'только так — не как',
  'workbench.variables.panel.scopeInfo.orJustMiddle': 'или просто',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': 'Ссылка без префикса',
  'workbench.variables.panel.scopeInfo.bareSuffix': 'разрешается по приоритету:',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live стоит вне этого порядка.',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · по умолчанию: {default}',
  'workbench.variables.panel.env.subtitleNoneDefault': 'Без окружения · по умолчанию: {default}',
  'workbench.variables.panel.env.subtitleNone': 'Без окружения',
  'workbench.variables.panel.env.editTooltip': 'Открыть редактор переменных окружения',
  'workbench.variables.panel.env.createTooltip': 'Создать первое окружение',
  'workbench.variables.panel.env.selectTooltip': 'Выбрать активное окружение',
  'workbench.variables.panel.collection.noneActive': 'Нет активной коллекции',
  'workbench.variables.panel.live.resolvedCount': 'разрешено {resolved}/{total}',
  'workbench.variables.panel.live.noneDefined': 'переменные Live не определены',
  'workbench.variables.panel.action.edit': 'Изменить',
  'workbench.variables.panel.action.editTooltip': 'Открыть редактор переменных области {scope}',
  'workbench.variables.panel.action.create': 'Создать',
  'workbench.variables.panel.action.select': 'Выбрать',
  'workbench.variables.panel.emptyScopeSecrets': 'Секреты не определены.',
  'workbench.variables.panel.emptyScopeVariables': 'Переменные не определены.',
  'workbench.variables.panel.openHint':
    'Откройте запрос или правило, чтобы увидеть переменные, на которые они ссылаются.',
  'workbench.variables.panel.noneReferenced': 'В этом элементе ({noun}) нет ссылок на переменные.',
  'workbench.variables.panel.noun.rule': 'правило',
  'workbench.variables.panel.noun.request': 'запрос',
  'workbench.variables.panel.noun.template': 'шаблон',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Все переменные разрешены ({count})',
      few: 'Все переменные разрешены ({count})',
      many: 'Все переменные разрешены ({count})',
      other: 'Все переменные разрешены ({count})',
    }),
  'workbench.variables.panel.unresolvedCount': 'не разрешено: {count}',
  'workbench.variables.panel.valueUnresolved': 'не разрешено',
  'workbench.variables.panel.valueEmpty': '(пусто)',
  'workbench.variables.panel.showValue': 'Показать значение',
  'workbench.variables.panel.hideValue': 'Скрыть значение',
  'workbench.variables.panel.copyValue': 'Копировать значение',
  'workbench.variables.panel.copied': 'Скопировано',
  'workbench.variables.panel.errors.title': 'Проблемы разрешения ({count})',
  'workbench.variables.panel.errors.referenceTooltip': 'Исходная ссылка внутри {{…}}',
  'workbench.variables.panel.errors.reason.unresolved': 'не разрешено',
  'workbench.variables.panel.errors.reason.unsetInScope': 'вне области',
  'workbench.variables.panel.errors.reason.unknownNamespace': 'неизвестное пространство имён',
  'workbench.variables.panel.errors.reason.stepOutOfContext': 'ссылка на шаг вне области',
  'workbench.variables.panel.errors.reason.empty': 'пусто',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': 'недопустимое значение',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': 'нужна авторизация',
  'workbench.variables.panel.errors.reason.secretNotFound': 'секрет не найден',
  'workbench.variables.panel.errors.reason.secretUnavailable': 'менеджер недоступен',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Копировать код',
  'workbench.totpPreview.copied': 'Скопировано',
  'workbench.totpPreview.refreshesTooltip': 'Обновится через {seconds} с',
  'workbench.totpPreview.refreshesAria': 'Код TOTP обновится через {seconds} с',
} as const satisfies Catalog;
