/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — Russian. Mirrors `catalogs/en/panel-quick-editor.ts` key for
 * key; compact mirrors of workbench controls reuse the
 * `workbench.editors.rule.fields.*` keys (S35). Raw by design: names,
 * URLs, `{{template}}` chips, status codes, MIME values, code / JSON
 * placeholders, the CSS / JS / GraphQL / cURL proper nouns, core
 * validator sentences, the req / res wire chips and op glyphs. Mints:
 * поповер = popover (never всплывающее окно, which stays the extension
 * popup); перенацелить = retarget; слушатель = listener; полезная
 * нагрузка = payload; фрейм = frame (carried); изменение = the
 * modification (mod); разделитель объединения = merge separator;
 * черновик = draft; Исходно / Сейчас / Далее = Original / Now / Future;
 * отложенная ссылка = deferred ref; Имитация / Изменение = the Mock /
 * Modify tags (имитировать = mock carried from shared-components);
 * the snapshot op chips read as lowercase infinitives (внедрить /
 * переопределить / добавить в конец / объединить / удалить — the
 * shared ledger's op verbs).
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': 'Очистить имя правила',
  'panel.quickEditor.renameTitle': '{name} — нажмите, чтобы переименовать',
  'panel.quickEditor.enabledOn': 'Включено',
  'panel.quickEditor.enabledOff': 'Выключено',
  'panel.quickEditor.ruleEnabledAria': 'Правило включено',
  'panel.quickEditor.openInTab': 'Открыть во вкладке',
  'panel.quickEditor.openInWorkspace': 'Открыть в рабочем пространстве →',
  'panel.quickEditor.saveButton': 'Сохранить',
  'panel.quickEditor.openToInspect': 'Откройте в рабочем пространстве, чтобы изучить или изменить это правило.',
  'panel.quickEditor.variableMissing':
    'Переменная отсутствует — наведите курсор на красную ссылку, чтобы создать её и разблокировать сохранение.',
  'panel.quickEditor.retargetHint': 'Измените условия ниже, чтобы перенацелить правило.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Правило обновлено',
  'panel.quickEditor.toast.ruleNotFound': 'Правило не найдено — возможно, оно было удалено.',
  'panel.quickEditor.toast.saveFailed': 'Не удалось сохранить',
  'panel.quickEditor.toast.toggleFailed': 'Не удалось переключить правило',
  'panel.quickEditor.toast.changedElsewhere': 'Правило изменено в другом месте — закройте и снова откройте поповер.',
  'panel.quickEditor.toast.noWorkspace': 'Нет активного рабочего пространства',
  'panel.quickEditor.toast.collectionCreateFailed': 'Не удалось создать коллекцию для правила',
  'panel.quickEditor.toast.folderCreateFailed': 'Не удалось создать папку «{name}» — сохраняем в корень коллекции.',
  'panel.quickEditor.toast.createFailed': 'Не удалось создать правило',
  'panel.quickEditor.toast.createdDraft': 'Правило создано как черновик — опубликуйте его из рабочего пространства.',
  'panel.quickEditor.toast.created': 'Правило создано',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Выберите, куда сохранить правило',
  'panel.quickEditor.destination.savingTo': 'Сохранить в',
  'panel.quickEditor.destination.newTag': 'новая',
  'panel.quickEditor.destination.autoNamed': 'Авто — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Авто — корень коллекции',
  'panel.quickEditor.destination.root': 'Корень коллекции',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Показать и изменить, когда срабатывает это правило',
  'panel.quickEditor.conditions.label': 'Условия',
  'panel.quickEditor.conditions.none': 'нет — не совпадает ни с одним запросом',

  // Header quick editors (single-mod hover + whole-list + create).
  // Operation options reuse the workbench op keys; validator sentences
  // from core ride raw — only the UI fallbacks are keyed here.
  'panel.quickEditor.header.addHeader': 'Добавить заголовок',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Разделитель объединения',
  'panel.quickEditor.header.directionRequest': 'Запрос',
  'panel.quickEditor.header.directionResponse': 'Ответ',
  'panel.quickEditor.validation.nameRequired': 'Укажите имя заголовка.',
  'panel.quickEditor.validation.invalidName': 'Недопустимое имя заголовка.',
  'panel.quickEditor.validation.invalidValue': 'Недопустимое значение заголовка.',
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Переключить на {operation}',

  // Typed bodies — popover-only copy. Field labels / option words that
  // mirror a workbench control reuse its key (see the station comment
  // above); the ws direction words differ from the workbench's
  // parenthesized pair, so they are popover-local (glyphs ride raw).
  'panel.quickEditor.redirect.targetPlaceholder': 'например https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint': 'Совпавшие запросы отправляются на этот URL-адрес до выхода в сеть.',
  'panel.quickEditor.delay.hint':
    'Переходы задерживаются до 30 000 ms; XHR/fetch ограничены 5 000 ms. Подресурсы не задерживаются.',
  'panel.quickEditor.block.editHint': 'Совпавшие запросы блокируются до выхода в сеть.',
  'panel.quickEditor.block.blockRequestsTo': 'Блокировать запросы к',
  'panel.quickEditor.block.createHint':
    'Совпавшие запросы отменяются, не покидая браузер — страница видит сетевую ошибку.',
  'panel.quickEditor.response.tagModify': 'Изменение',
  'panel.quickEditor.response.tagMock': 'Имитация',
  'panel.quickEditor.response.dynamicBody':
    'Это правило строит ответ с помощью JavaScript. Откройте в рабочем пространстве, чтобы изменить скрипт.',
  'panel.quickEditor.requestBody.hint': 'Совпавшие запросы отправляются с этим телом вместо тела страницы.',
  'panel.quickEditor.requestBody.dynamicBody':
    'Это правило строит тело с помощью JavaScript. Откройте в рабочем пространстве, чтобы изменить скрипт.',
  'panel.quickEditor.inject.sourceUrlLabel': 'URL-адрес источника',
  'panel.quickEditor.inject.loadsStylesheetHint': 'Совпавшие страницы загружают эту таблицу стилей при загрузке.',
  'panel.quickEditor.inject.loadsScriptHint': 'Совпавшие страницы загружают этот скрипт при загрузке.',
  'panel.quickEditor.inject.injectedHint': 'Внедряется в совпавшие страницы при их загрузке.',
  'panel.quickEditor.message.incoming': 'Входящие ⬇',
  'panel.quickEditor.message.outgoing': 'Исходящие ⬆',
  'panel.quickEditor.message.injectedConnectionsHint':
    'Внедряется в совпавшие соединения до того, как его увидят слушатели.',
  'panel.quickEditor.message.injectedStreamsHint': 'Внедряется в совпавшие потоки до того, как его увидят слушатели.',
  'panel.quickEditor.message.replacedFramesHint':
    'Совпавшие фреймы заменяются этой полезной нагрузкой до того, как их увидят.',
  'panel.quickEditor.message.replacedEventsHint':
    'Совпавшие события заменяются этой полезной нагрузкой до того, как их увидят.',
  'panel.quickEditor.message.droppedFramesHint': 'Совпавшие фреймы отбрасываются до того, как их увидят.',
  'panel.quickEditor.message.droppedEventsHint': 'Совпавшие события отбрасываются до того, как их увидят.',
  'panel.quickEditor.queryParam.addAction': 'Добавить действие',
  'panel.quickEditor.queryParam.removeAllWarning':
    '«Удалить все» убирает всю строку запроса — остальные операции этого правила будут проигнорированы.',
  'panel.quickEditor.auth.challengesHint':
    'Отвечает на запросы аутентификации сервера (401) и прокси (407) для совпавших запросов.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  // Raw by design: header names/values, `{{template}}` text, the
  // sibling-mod rows (req / res wire chips, op glyphs, the wire-shaped
  // hover title) and the snapshot byline's direction word
  // (request/response — wire vocabulary beside the raw header name).
  'panel.ruleHover.tagRuleEdited': 'Правило изменено',
  'panel.ruleHover.tagVariableChanged': 'Переменная изменена',
  'panel.ruleHover.tagDeleted': 'Удалено',
  'panel.ruleHover.tagDisabled': 'Выключено',
  'panel.ruleHover.tagModRemoved': 'Изменение удалено',
  'panel.ruleHover.tagConditionsMismatch': 'Условия не совпадают',
  'panel.ruleHover.tagWontFire': 'Не сработает',
  'panel.ruleHover.tagTitle.ruleDisabled':
    'Флаг включения правила снят — оно не сработает ни на одном будущем запросе.',
  'panel.ruleHover.tagTitle.modGone': 'Совпавшее изменение удалено из правила.',
  'panel.ruleHover.tagTitle.conditionsMismatch': 'Условия правила больше не покрывают этот URL-адрес.',
  'panel.ruleHover.tagTitle.nameUnresolved':
    'Шаблон имени заголовка нельзя разрешить полностью (например, он ссылается на TOTP). DNR отклоняет буквальные символы шаблона в именах заголовков.',
  'panel.ruleHover.tagTitle.valueUnresolved': 'Шаблон значения заголовка нельзя разрешить полностью.',
  'panel.ruleHover.tagTitle.separatorUnresolved': 'Шаблон разделителя объединения нельзя разрешить полностью.',
  'panel.ruleHover.deletedBody': 'Это правило удалено. Захват выше показывает, что оно сделало при срабатывании.',
  'panel.ruleHover.modRemovedBody':
    'Совпавшее изменение удалено из правила. Откройте в рабочем пространстве, чтобы создать его заново или поправить.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'внедрить',
  'panel.ruleHover.snapshot.opOverride': 'переопределить',
  'panel.ruleHover.snapshot.opAppend': 'добавить в конец',
  'panel.ruleHover.snapshot.opMerge': 'объединить',
  'panel.ruleHover.snapshot.opRemove': 'удалить',
  'panel.ruleHover.snapshot.templateTitle': 'Шаблон до разрешения переменных в момент срабатывания',
  'panel.ruleHover.snapshot.nameDriftTitle':
    'Тот же шаблон — переменная, на которую он ссылается, теперь разрешается в другое имя заголовка',
  'panel.ruleHover.snapshot.cancels': 'отменяет «{rule}»',
  'panel.ruleHover.snapshot.original': 'Исходно',
  'panel.ruleHover.snapshot.now': 'Сейчас',
  'panel.ruleHover.snapshot.future': 'Далее',
  'panel.ruleHover.snapshot.futureTitle': 'Что получит следующий совпавший запрос',
  'panel.ruleHover.snapshot.removed': 'удалено',
  'panel.ruleHover.snapshot.empty': '(пусто)',
  'panel.ruleHover.snapshot.totpNote':
    'TOTP и отложенные ссылки разрешаются в момент запроса и здесь не захватываются.',
  'panel.ruleHover.snapshot.alsoByRule': 'Также этим правилом на этом запросе',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': 'правило удалено — не сработает',
  'panel.ruleHover.future.ruleDisabled': 'правило выключено — не сработает',
  'panel.ruleHover.future.modGone': 'это изменение удалено из правила',
  'panel.ruleHover.future.conditionsMismatch': 'условия правила больше не совпадают с этим URL-адресом',
  'panel.ruleHover.future.nameUnresolved': 'шаблон имени заголовка нельзя разрешить — правило не сработает',
  'panel.ruleHover.future.valueUnresolved': 'шаблон значения нельзя разрешить — правило не сработает',
  'panel.ruleHover.future.separatorUnresolved': 'шаблон mergeSeparator нельзя разрешить — правило не сработает',
  'panel.ruleHover.future.templateTitle': 'Шаблон: {template}',
} as const satisfies Catalog;
