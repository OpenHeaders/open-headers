/**
 * Shared conflicts family — Russian. Mirrors
 * `catalogs/en/shared-conflicts.ts` key for key; schema paths, entity
 * uids, {name}/{step}/{uid} wire data and identifier leaf labels
 * (dependsOn, runIf, priorityFrom, id, timeout — de / ko precedent)
 * stay raw; `seed` rides raw (S67/S75 + de precedent); `Хранилище
 * Cookie` = the capitalized en `Cookie jar` label (the case-exact
 * glossary trap — хранилище cookie stays the prose form). Mints:
 * внешнее изменение = external change; Оставить моё = keep mine /
 * Взять сохранённое = use saved; спецификация carried; bodies stay
 * Тело запроса / Тело ответа; Авторизация = the Authorization FIELD
 * label (the raw header name Authorization stays raw — Сохранять
 * заголовок Authorization); захват carried; экстрактор = extractor;
 * политика повторов = retry policy; парольная фраза = passphrase;
 * учётные данные carried; Издатель = issuer (carried from trusted
 * roots). THE SETTINGS-KNOB SCALAR TWINS live here and editors-request
 * quotes them verbatim: Минимальная версия TLS / Максимальная версия
 * TLS / Наборы шифров TLS / Имя сервера SNI / Версия HTTP / Разрешать в
 * адрес / Клиентский сертификат / Режим прокси / URL-адрес прокси /
 * Учётные данные прокси / Сокет Unix / Хранилище Cookie / Тайм-аут
 * запроса / Предел размера ответа / Максимум перенаправлений /
 * Сохранять исходный HTTP-метод / Сохранять заголовок Authorization /
 * Режим учётных данных / Следовать перенаправлениям / Проверка SSL /
 * Скрипт перед запросом / Скрипт после ответа. The `{noun}` and
 * `{scope}`-style holes take a colon frame (no agreeing verb);
 * `{set}s — order changed` drops the en plural onto the hole's own
 * label (`{set} — порядок изменён`); the aside dash keeps.
 */

import type { Catalog } from '../../types';

export const sharedConflicts = {
  // ── Entity banner ──────────────────────────────────────────────────
  'shared.conflicts.banner.changedExternally': 'Внешнее изменение во время редактирования: {noun}.',
  'shared.conflicts.banner.fieldsNoun': 'поля',
  'shared.conflicts.banner.review': 'Просмотреть изменения',
  'shared.conflicts.banner.keepAllMine': 'Оставить всё моё',
  'shared.conflicts.banner.useAllSaved': 'Взять всё сохранённое',

  // ── Merge-dialog shim ──────────────────────────────────────────────
  'shared.conflicts.dialog.title': 'Разрешить внешние изменения',

  // ── Per-leaf diff chip ─────────────────────────────────────────────
  'shared.conflicts.chip.trigger': 'Доступно внешнее изменение — нажмите, чтобы разрешить',
  'shared.conflicts.chip.externalChange': 'Внешнее изменение',
  'shared.conflicts.chip.savedValue': 'Сохранённое значение',
  'shared.conflicts.chip.yourEdit': 'Ваша правка',
  'shared.conflicts.chip.keepMine': 'Оставить моё',
  'shared.conflicts.chip.useSaved': 'Взять сохранённое',
  'shared.conflicts.chip.lastSyncedValue': 'Последнее синхронизированное значение',
  'shared.conflicts.chip.empty': '(пусто)',

  // ── Set-row removal chip ───────────────────────────────────────────
  'shared.conflicts.rowChip.trigger': 'Сохранённая версия удалила эту строку — нажмите, чтобы разрешить',
  'shared.conflicts.rowChip.removedExternally': 'Строка удалена извне',
  'shared.conflicts.rowChip.lastSyncedRow': 'Последняя синхронизированная строка',
  'shared.conflicts.rowChip.useSavedRemove': 'Взять сохранённое (удалить)',

  // ── Adapter label plane: field-tree walker fallback ────────────────
  'shared.conflicts.label.walker.orderChanged': '{set} — порядок изменён',

  // ── Adapter label plane: action entities (rule + template) ─────────
  'shared.conflicts.label.action.set.requestHeader': 'Заголовок запроса',
  'shared.conflicts.label.action.set.responseHeader': 'Заголовок ответа',
  'shared.conflicts.label.action.set.queryParam': 'Параметр запроса',
  'shared.conflicts.label.action.set.param': 'Параметр',
  'shared.conflicts.label.action.set.condition': 'Условие',
  'shared.conflicts.label.action.orderChanged': '{set} — порядок изменён',
  'shared.conflicts.label.action.setRowNamed': '{kind} {name}',
  'shared.conflicts.label.action.name': 'Имя',
  'shared.conflicts.label.action.conditionLeafLabel': 'Условие: {leaf}',
  'shared.conflicts.label.action.requestHeaderLeafNamed': 'Заголовок запроса {name} ({leaf})',
  'shared.conflicts.label.action.requestHeaderLeaf': 'Заголовок запроса ({leaf})',
  'shared.conflicts.label.action.responseHeaderLeafNamed': 'Заголовок ответа {name} ({leaf})',
  'shared.conflicts.label.action.responseHeaderLeaf': 'Заголовок ответа ({leaf})',
  'shared.conflicts.label.action.queryParamLeafNamed': 'Параметр запроса {name} ({leaf})',
  'shared.conflicts.label.action.queryParamLeaf': 'Параметр запроса ({leaf})',
  'shared.conflicts.label.action.headerLeaf.value': 'значение',
  'shared.conflicts.label.action.headerLeaf.name': 'имя',
  'shared.conflicts.label.action.headerLeaf.operation': 'операция',
  'shared.conflicts.label.action.headerLeaf.mergeSeparator': 'разделитель объединения',
  'shared.conflicts.label.action.paramLeaf.value': 'значение',
  'shared.conflicts.label.action.paramLeaf.name': 'имя',
  'shared.conflicts.label.action.paramLeaf.operation': 'операция',
  'shared.conflicts.label.action.conditionLeaf.values': 'значения',
  'shared.conflicts.label.action.conditionLeaf.type': 'тип',
  'shared.conflicts.label.action.conditionLeaf.headerName': 'имя заголовка',
  'shared.conflicts.label.action.scalar.redirectTo': 'URL-адрес перенаправления',
  'shared.conflicts.label.action.scalar.delayMs': 'Задержка (ms)',
  'shared.conflicts.label.action.scalar.injectType': 'Тип внедрения',
  'shared.conflicts.label.action.scalar.source': 'Источник внедрения',
  'shared.conflicts.label.action.scalar.code': 'Код внедрения',
  'shared.conflicts.label.action.scalar.sourceUrl': 'URL-адрес источника внедрения',
  'shared.conflicts.label.action.scalar.position': 'Позиция внедрения',
  'shared.conflicts.label.action.scalar.requestBody': 'Тело запроса',
  'shared.conflicts.label.action.scalar.bodyType': 'Тип тела',
  'shared.conflicts.label.action.scalar.resourceType': 'Тип ресурса',
  'shared.conflicts.label.action.scalar.statusCode': 'Код статуса ответа',
  'shared.conflicts.label.action.scalar.responseBody': 'Тело ответа',
  'shared.conflicts.label.action.scalar.contentType': 'Тип содержимого ответа',
  'shared.conflicts.label.action.scalar.operation': 'Операция',
  'shared.conflicts.label.action.scalar.direction': 'Направление',
  'shared.conflicts.label.action.scalar.eventName': 'Имя события',
  'shared.conflicts.label.action.scalar.payload': 'Полезная нагрузка сообщения',
  'shared.conflicts.label.action.scalar.injectTrigger': 'Триггер внедрения',
  'shared.conflicts.label.action.messageFilter.matchType': 'Тип фильтра сообщений',
  'shared.conflicts.label.action.messageFilter.value': 'Значение фильтра сообщений',

  // ── Adapter label plane: variables ─────────────────────────────────
  'shared.conflicts.label.variable.row': 'Переменная',
  'shared.conflicts.label.variable.rowNamed': 'Переменная {name}',
  'shared.conflicts.label.variable.leafNamed': 'Переменная {name} ({label})',
  'shared.conflicts.label.variable.leaf': 'Переменная ({label})',
  'shared.conflicts.label.variable.orderChanged': 'Переменные — порядок изменён',
  'shared.conflicts.label.variable.field.name': 'имя',
  'shared.conflicts.label.variable.field.value': 'значение',
  'shared.conflicts.label.variable.field.type': 'тип',
  'shared.conflicts.label.variable.field.enabled': 'включено',

  // ── Adapter label plane: vault secrets ─────────────────────────────
  'shared.conflicts.label.vault.row': 'Секрет',
  'shared.conflicts.label.vault.rowNamed': 'Секрет {name}',
  'shared.conflicts.label.vault.leafNamed': 'Секрет {name} ({label})',
  'shared.conflicts.label.vault.leaf': 'Секрет ({label})',
  'shared.conflicts.label.vault.orderChanged': 'Секреты — порядок изменён',
  'shared.conflicts.label.vault.field.name': 'имя',
  'shared.conflicts.label.vault.field.kind': 'вид',
  'shared.conflicts.label.vault.field.value': 'значение',
  'shared.conflicts.label.vault.field.seed': 'seed',
  'shared.conflicts.label.vault.field.algorithm': 'алгоритм',
  'shared.conflicts.label.vault.field.digits': 'цифры',
  'shared.conflicts.label.vault.field.period': 'период',
  'shared.conflicts.label.vault.field.issuer': 'издатель',
  'shared.conflicts.label.vault.field.cert': 'сертификат',
  'shared.conflicts.label.vault.field.key': 'закрытый ключ',
  'shared.conflicts.label.vault.field.passphrase': 'парольная фраза',

  // ── Adapter label plane: live variables ────────────────────────────
  'shared.conflicts.label.liveVariable.leaf': 'Переменная Live ({label})',
  'shared.conflicts.label.liveVariable.field.name': 'имя',
  'shared.conflicts.label.liveVariable.field.description': 'описание',
  'shared.conflicts.label.liveVariable.field.enabled': 'включено',
  'shared.conflicts.label.liveVariable.field.requireFreshOnRuleBuild': 'ждать свежее значение',
  'shared.conflicts.label.liveVariable.field.workflowUid': 'рабочий процесс',
  'shared.conflicts.label.liveVariable.field.stepId': 'шаг',
  'shared.conflicts.label.liveVariable.field.captureName': 'захват',

  // ── Adapter label plane: live workflows ────────────────────────────
  'shared.conflicts.label.workflow.leaf': 'Рабочий процесс ({label})',
  'shared.conflicts.label.workflow.stepLeaf': 'Шаг {step} ({leaf})',
  'shared.conflicts.label.workflow.captureLeaf': 'Шаг {step} → {capture} ({leaf})',
  'shared.conflicts.label.workflow.stepFallback': 'шаг {uid}',
  'shared.conflicts.label.workflow.captureFallback': 'захват {uid}',
  'shared.conflicts.label.workflow.field.name': 'имя',
  'shared.conflicts.label.workflow.field.description': 'описание',
  'shared.conflicts.label.workflow.field.enabled': 'включено',
  'shared.conflicts.label.workflow.field.refreshKind': 'вид обновления',
  'shared.conflicts.label.workflow.field.refreshSeconds': 'интервал обновления',
  'shared.conflicts.label.workflow.field.refreshStepId': 'шаг обновления',
  'shared.conflicts.label.workflow.field.refreshCaptureName': 'захват обновления',
  'shared.conflicts.label.workflow.field.refreshLeadSeconds': 'секунды упреждения обновления',
  'shared.conflicts.label.workflow.stepField.id': 'id',
  'shared.conflicts.label.workflow.stepField.description': 'описание',
  'shared.conflicts.label.workflow.stepField.requestUid': 'запрос',
  'shared.conflicts.label.workflow.stepField.dependsOn': 'dependsOn',
  'shared.conflicts.label.workflow.stepField.runIf': 'runIf',
  'shared.conflicts.label.workflow.stepField.priorityFrom': 'priorityFrom',
  'shared.conflicts.label.workflow.stepField.retry': 'политика повторов',
  'shared.conflicts.label.workflow.stepField.timeoutMs': 'timeout',
  'shared.conflicts.label.workflow.stepField.runScripts': 'запуск скриптов',
  'shared.conflicts.label.workflow.captureField.name': 'имя',
  'shared.conflicts.label.workflow.captureField.extractor': 'экстрактор',

  // ── Adapter label plane: specs ─────────────────────────────────────
  'shared.conflicts.label.spec.leaf': 'Спецификация ({label})',
  'shared.conflicts.label.spec.field.name': 'имя',
  'shared.conflicts.label.spec.field.description': 'описание',
  'shared.conflicts.label.spec.field.format': 'формат',
  'shared.conflicts.label.spec.field.rootFileUid': 'корневой файл',
  'shared.conflicts.label.spec.fileRow': 'Файл спецификации',
  'shared.conflicts.label.spec.fileRowNamed': 'Файл спецификации {name}',
  'shared.conflicts.label.spec.fileLeafNamed': 'Файл спецификации {name} ({label})',
  'shared.conflicts.label.spec.fileLeaf': 'Файл спецификации ({label})',
  'shared.conflicts.label.spec.fileField.fileName': 'имя файла',
  'shared.conflicts.label.spec.fileField.content': 'содержимое',

  // ── Adapter label plane: requests ──────────────────────────────────
  'shared.conflicts.label.request.set.header': 'Заголовок',
  'shared.conflicts.label.request.set.queryParam': 'Параметр запроса',
  'shared.conflicts.label.request.orderChanged': '{set} — порядок изменён',
  'shared.conflicts.label.request.setRowNamed': '{kind} {name}',
  'shared.conflicts.label.request.unionAuth': 'Тип авторизации',
  'shared.conflicts.label.request.unionBody': 'Тип тела',
  'shared.conflicts.label.request.headerLeafNamed': 'Заголовок {name} ({leaf})',
  'shared.conflicts.label.request.headerLeaf': 'Заголовок ({leaf})',
  'shared.conflicts.label.request.queryParamLeafNamed': 'Параметр запроса {name} ({leaf})',
  'shared.conflicts.label.request.queryParamLeaf': 'Параметр запроса ({leaf})',
  'shared.conflicts.label.request.authTail': 'Авторизация · {path}',
  'shared.conflicts.label.request.bodyTail': 'Тело · {path}',
  'shared.conflicts.label.request.headerField.key': 'имя',
  'shared.conflicts.label.request.headerField.value': 'значение',
  'shared.conflicts.label.request.headerField.description': 'описание',
  'shared.conflicts.label.request.headerField.enabled': 'включено',
  'shared.conflicts.label.request.paramField.key': 'имя',
  'shared.conflicts.label.request.paramField.value': 'значение',
  'shared.conflicts.label.request.paramField.description': 'описание',
  'shared.conflicts.label.request.paramField.enabled': 'включено',
  'shared.conflicts.label.request.paramField.hasEquals': 'разделитель',
  'shared.conflicts.label.request.scalar.name': 'Имя',
  'shared.conflicts.label.request.scalar.description': 'Описание',
  'shared.conflicts.label.request.scalar.url': 'URL',
  'shared.conflicts.label.request.scalar.method': 'Метод',
  'shared.conflicts.label.request.scalar.auth': 'Авторизация',
  'shared.conflicts.label.request.scalar.body': 'Тело',
  'shared.conflicts.label.request.scalar.credentialsMode': 'Режим учётных данных',
  'shared.conflicts.label.request.scalar.followRedirects': 'Следовать перенаправлениям',
  'shared.conflicts.label.request.scalar.sslVerification': 'Проверка SSL',
  'shared.conflicts.label.request.scalar.tlsMinVersion': 'Минимальная версия TLS',
  'shared.conflicts.label.request.scalar.tlsMaxVersion': 'Максимальная версия TLS',
  'shared.conflicts.label.request.scalar.tlsCipherSuites': 'Наборы шифров TLS',
  'shared.conflicts.label.request.scalar.sniServerName': 'Имя сервера SNI',
  'shared.conflicts.label.request.scalar.httpVersion': 'Версия HTTP',
  'shared.conflicts.label.request.scalar.resolveToAddress': 'Разрешать в адрес',
  'shared.conflicts.label.request.scalar.clientCertificateRef': 'Клиентский сертификат',
  'shared.conflicts.label.request.scalar.proxyMode': 'Режим прокси',
  'shared.conflicts.label.request.scalar.proxyUrl': 'URL-адрес прокси',
  'shared.conflicts.label.request.scalar.proxyCredentialRef': 'Учётные данные прокси',
  'shared.conflicts.label.request.scalar.unixSocketPath': 'Сокет Unix',
  'shared.conflicts.label.request.scalar.cookieJar': 'Хранилище Cookie',
  'shared.conflicts.label.request.scalar.timeoutMs': 'Тайм-аут запроса',
  'shared.conflicts.label.request.scalar.maxResponseBytes': 'Предел размера ответа',
  'shared.conflicts.label.request.scalar.maxRedirects': 'Максимум перенаправлений',
  'shared.conflicts.label.request.scalar.followOriginalHttpMethod': 'Сохранять исходный HTTP-метод',
  'shared.conflicts.label.request.scalar.followAuthorizationHeader': 'Сохранять заголовок Authorization',
  'shared.conflicts.label.request.scalar.preRequestScript': 'Скрипт перед запросом',
  'shared.conflicts.label.request.scalar.postResponseScript': 'Скрипт после ответа',
} as const satisfies Catalog;
