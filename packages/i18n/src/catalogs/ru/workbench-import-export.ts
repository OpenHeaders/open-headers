/**
 * Import/export family — Russian. Mirrors
 * `catalogs/en/workbench-import-export.ts` key for key. Raw by design
 * inside keyed sentences: brand + format proper nouns (Postman /
 * Insomnia / Bruno / Thunder Client / HAR / OpenAPI / cURL per the
 * glossary), file extensions and filenames rendered as code chips
 * (`.bru`, `.har`, `.openheaders.yaml`, `bruno.json`), export ids /
 * fingerprints / entity names ({id} / {name} holes carry data), uid /
 * workspace.uid, `{{ _.var }}` / `{{var}}` / `{{baseUrl}}` /
 * `{{clientId}}` / `{{clientSecret}}` template tokens, oh.* API, the
 * Postman-UI walkthrough steps (Postman's own UI is English; the glyph
 * labels and its menu rows stay English as ja / ko do), Insomnia's
 * Preferences → Data → Export path, and the ` · ` separator glyphs;
 * lowercase-en `vault` rides raw with Vault м. р. (Зашифрованный
 * vault, Расшифровать vault). Quotes the shipped ru mints: центр
 * импорта = import hub (settings keyboard defs), the merge strategies
 * «Добавить как новые» / «Заменить» / «Пропустить» (settings defs),
 * отброшено / преобразовано = drops / transforms (the settings
 * import-report wording), Перенести из другого инструмента = Migrate
 * from another tool (workbench-chrome / popup), «Копировать как cURL»
 * (the panel request menu), парольная фраза, спецификация,
 * предустановка = preset, Правило заголовков = header rule,
 * сопряжение / настольное приложение carried, опубликовать /
 * неопубликованное, шифротекст = ciphertext (system-status), Отчёты
 * об импорте (settings). MINTS: открытый текст = plaintext; строгий
 * литерал = strict literal; коллизия = collision; перепривязать =
 * rebind; отпечаток = fingerprint; Просканировать этот компьютер =
 * Scan this computer; Обнаружено = detected; анонимизировать carried;
 * сохранённый пример = saved example; глобальная переменная = global
 * variable; сущность = entity; стойкость = passphrase strength
 * (слабая / посредственная / хорошая / стойкая). The report sentence
 * fragments read `Импортировано` + count + word + `(в том числе` … `и`
 * … `)` + `в` + `{count} рабочее пространство` (the accusative after
 * `в` equals the nominative, so the wordWorkspace plural serves both).
 * Plurals one / few / many / other (сущность / сущности / сущностей,
 * элемент / элемента / элементов, файл / файла / файлов, секрет /
 * секрета / секретов, ссылка / ссылки / ссылок, запрос / запроса /
 * запросов, папка / папки / папок, заметка / заметки / заметок).
 * ALL-CAPS section headers keep en's caps (ИМПОРТ ИЗ HAR).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'Экспорт',
  'workbench.importExport.export.cancel': 'Отмена',
  'workbench.importExport.export.download': 'Скачать',
  'workbench.importExport.export.sourceLabel': 'Источник:',
  'workbench.importExport.export.scopeLabel': 'Охват:',
  'workbench.importExport.export.filenameLabel': 'Имя файла:',
  'workbench.importExport.export.scopeWholeWorkspace': 'Всё рабочее пространство',
  'workbench.importExport.export.vaultSecrets': 'Секреты Vault',
  'workbench.importExport.export.vaultOmit': 'Не включать (по умолчанию)',
  'workbench.importExport.export.vaultEncrypted': 'Зашифровать (парольная фраза)',
  'workbench.importExport.export.vaultPlaintext': 'Открытый текст (для опытных)',
  'workbench.importExport.export.passphrasePlaceholder': 'Парольная фраза',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'Повторите парольную фразу',
  'workbench.importExport.export.hintPlaceholder':
    'Подсказка (необязательно; видна получателю — никогда не сама парольная фраза)',
  'workbench.importExport.export.strengthEmpty': 'введите парольную фразу',
  'workbench.importExport.export.strengthWeak': 'слабая',
  'workbench.importExport.export.strengthFair': 'посредственная',
  'workbench.importExport.export.strengthGood': 'хорошая',
  'workbench.importExport.export.strengthStrong': 'стойкая',
  'workbench.importExport.export.strengthNote':
    'Стойкость парольной фразы: {label}. Передайте парольную фразу по другому каналу (Signal, менеджер паролей, голосом). Любой, у кого она есть, сможет прочитать каждый секрет в этом экспорте.',
  'workbench.importExport.export.plaintextTitle': 'Секреты в открытом тексте прочитает любой, кто увидит этот файл',
  'workbench.importExport.export.plaintextUseOnly':
    'Используйте только для передачи в систему, которой полностью доверяете (например, резервная копия на собственном зашифрованном диске).',
  'workbench.importExport.export.switchToEncrypted': 'Переключиться на зашифрованный (рекомендуется)',
  'workbench.importExport.export.acknowledgeRisks': 'Я понимаю риски',
  'workbench.importExport.export.fingerprintsTitle': 'Зашифровано — передайте эти отпечатки получателю',
  'workbench.importExport.export.ciphertextFingerprint': 'Отпечаток шифротекста:',
  'workbench.importExport.export.keyFingerprint': 'Отпечаток ключа:',
  'workbench.importExport.export.fingerprintMatchNote':
    'Когда получатель введёт парольную фразу, он увидит тот же отпечаток ключа, если она совпадает с вашей.',
  'workbench.importExport.export.advanced': 'Дополнительно',
  'workbench.importExport.export.strictLiteralLabel': 'Строгий литерал — экспортировать только выбранное',
  'workbench.importExport.export.strictLiteralHelp':
    'По умолчанию выбор коллекции или папки добавляет всех потомков и родительские контейнеры, чтобы импорт был самодостаточным. Со строгим литералом уходят только выбранные uid — получатель увидит отсутствующие зависимости для всего, что вы не включили.',
  'workbench.importExport.export.oauthNote':
    'Секреты клиента OAuth не включаются никогда, независимо от режима vault. Получатель введёт свои при первой авторизации.',
  'workbench.importExport.export.exportFailed': 'Экспорт не удался',
  'workbench.importExport.export.exportedShareFingerprints':
    'Экспортировано в {filename} — передайте отпечатки получателю',
  'workbench.importExport.export.exported': 'Экспортировано в {filename}',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'ИМПОРТ',
  'workbench.importExport.hub.closeAria': 'Закрыть импорт',
  'workbench.importExport.hub.readingFile': 'Чтение файла…',
  'workbench.importExport.hub.pastePlaceholder': 'Вставьте команду curl или URL-адрес',
  'workbench.importExport.hub.continueAria': 'Продолжить импорт',
  'workbench.importExport.hub.notRecognized':
    'Пока не распознано — вставьте команду curl, URL-адрес, HAR, экспорт Postman / Insomnia / Bruno, документ OpenAPI или экспорт рабочего пространства.',
  'workbench.importExport.hub.dropAria': 'Перетащите сюда файл или папку для импорта',
  'workbench.importExport.hub.dropTitle': 'Перетащите файл или папку для импорта',
  'workbench.importExport.hub.kindHar': 'Захват HAR',
  'workbench.importExport.hub.kindPostman': 'Коллекция или резервная копия Postman',
  'workbench.importExport.hub.kindInsomnia': 'Экспорт Insomnia',
  'workbench.importExport.hub.kindBrunoSuffix': 'файл или папка коллекции',
  'workbench.importExport.hub.kindOpenapi': 'Документ OpenAPI 3.x',
  'workbench.importExport.hub.kindGraphqlSchema': 'Схема GraphQL (SDL или JSON интроспекции)',
  'workbench.importExport.hub.kindWorkspaceSuffix': 'экспорт рабочего пространства',
  'workbench.importExport.hub.autoDetected': 'Формат распознаётся автоматически.',
  'workbench.importExport.hub.browseFiles': 'Выбрать файлы…',
  'workbench.importExport.hub.browseFolder': 'Выбрать папку…',
  'workbench.importExport.hub.switchingFrom': 'Переход с',
  'workbench.importExport.hub.switchingOr': 'или',
  'workbench.importExport.hub.migrateCta': 'Перенести из другого инструмента',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles': 'В этой папке нет файлов Bruno — ожидались файлы .bru или bruno.json.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} файл не удалось прочитать, он пропущен.',
      few: '{count} файла не удалось прочитать, они пропущены.',
      many: '{count} файлов не удалось прочитать, они пропущены.',
      other: '{count} файлов не удалось прочитать, они пропущены.',
    }),
  'workbench.importExport.modals.readFailed': 'Не удалось прочитать {name}: {message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `Импортировано из «${label}»: ${plural(locale, Number(count), {
      one: '{count} сущность',
      few: '{count} сущности',
      many: '{count} сущностей',
      other: '{count} сущностей',
    })}`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': 'ИМПОРТ ЭКСПОРТА РАБОЧЕГО ПРОСТРАНСТВА',
  'workbench.importExport.preview.closeAria': 'Закрыть предпросмотр импорта',
  'workbench.importExport.preview.cancel': 'Отмена',
  'workbench.importExport.preview.emptyFile': 'Перетащите файл .openheaders.yaml, чтобы просмотреть его.',
  'workbench.importExport.preview.emptyClipboard': 'Вставьте экспорт рабочего пространства, чтобы просмотреть его.',
  'workbench.importExport.preview.preparing': 'Подготовка импорта…',
  'workbench.importExport.preview.footerExportInfo': 'Экспорт {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'Выберите файл для предпросмотра',
  'workbench.importExport.preview.footerNoData': 'Нет данных',
  'workbench.importExport.preview.importInto': 'Импортировать в:',
  'workbench.importExport.preview.staleTitle': 'Рабочее пространство изменилось после открытия предпросмотра',
  'workbench.importExport.preview.staleDescription':
    'Снова откройте предпросмотр импорта, чтобы обновить diff, затем повторите.',
  'workbench.importExport.preview.advanced': 'Дополнительно',
  'workbench.importExport.preview.advancedCount': 'Дополнительно ({count})',
  'workbench.importExport.preview.previewFailed': 'Предпросмотр не удался',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `Импорт — ${plural(locale, Number(count), {
      one: '{count} элемент',
      few: '{count} элемента',
      many: '{count} элементов',
      other: '{count} элементов',
    })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'Импортировать в',
  'workbench.importExport.target.current': 'Текущее',
  'workbench.importExport.target.new': 'Новое',
  'workbench.importExport.target.pickExisting': 'Выбрать существующее',
  'workbench.importExport.target.noActiveWorkspace': 'Нет активного рабочего пространства',
  'workbench.importExport.target.selectWorkspace': 'Выберите рабочее пространство',
  'workbench.importExport.target.landsOnOrg': 'Попадёт в организацию {name} и синхронизируется на её устройства',
  'workbench.importExport.target.staysLocal': 'Останется на этом устройстве',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': 'Дополнительно',
  'workbench.importExport.advanced.closeAria': 'Закрыть панель «Дополнительно»',
  'workbench.importExport.advanced.backupRestoreLabel': 'Это моё — предпочитать обновление по uid',
  'workbench.importExport.advanced.backupRestoreHelp':
    'Переключает коллизии по совпавшему uid с «Добавить как новые» на «Заменить». Пропускается для сущностей, изменённых локально после создания экспорта.',
  'workbench.importExport.advanced.trustExportLabel': 'Доверять этому экспорту — сохранить флаги включения',
  'workbench.importExport.advanced.trustExportHelp':
    'Импортированные правила / рабочие процессы Live / переменные Live по умолчанию попадают выключенными. Включайте только если доверяете отправителю.',
  'workbench.importExport.advanced.stripScriptsLabel': 'Убирать скрипты запросов при импорте',
  'workbench.importExport.advanced.stripScriptsHelp':
    'Удаляет скрипты до запроса и после ответа из каждого импортированного запроса. Рекомендуется, если отправитель незнаком.',
  'workbench.importExport.advanced.omitOAuthLabel': 'Не включать конфигурации OAuth',
  'workbench.importExport.advanced.omitOAuthHelp':
    'По умолчанию конфигурации OAuth2 идут вместе с запросом (конечная точка токена, id клиента, области — никогда секрет клиента или токены). Когда включено, каждый запрос OAuth2 попадает с авторизацией «нет».',
  'workbench.importExport.advanced.keepOrderLabel': 'Сохранять порядок целевой коллекции при обновлении',
  'workbench.importExport.advanced.keepOrderHelp':
    'По умолчанию обновлённая коллекция принимает порядок дочерних элементов из экспорта. Когда включено, ваш существующий порядок в целевой коллекции сохраняется.',
  'workbench.importExport.advanced.workspaceSettingsLabel': 'Включить настройки уровня рабочего пространства',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    'Зарезервировано для будущего списка разрешённых настроек с семантикой рабочего пространства. Сейчас список пуст — в v1 через этот переключатель ничего не передаётся.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'Отказывать при коллизии workspace.uid',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    'По умолчанию импорт в новое рабочее пространство при коллизии молча создаёт новый uid рабочего пространства. Когда включено, существующее рабочее пространство с тем же uid блокирует импорт.',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': 'Скрыть',
  'workbench.importExport.chips.plaintextLabel': 'Секреты в открытом тексте',
  'workbench.importExport.chips.plaintextTitle': 'Этот экспорт содержит секреты vault в открытом тексте.',
  'workbench.importExport.chips.plaintextBody':
    'Любой, у кого есть этот файл, прочитает каждый секрет в нём. Перед пересылкой лучше выпустить экспорт заново в зашифрованном виде.',
  'workbench.importExport.chips.skippedLabel': 'пропущено: {count}',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} сущность не удалось разобрать, она будет пропущена.',
      few: '{count} сущности не удалось разобрать, они будут пропущены.',
      many: '{count} сущностей не удалось разобрать, они будут пропущены.',
      other: '{count} сущностей не удалось разобрать, они будут пропущены.',
    }),
  'workbench.importExport.chips.andMore': '…и ещё {count}',
  'workbench.importExport.chips.dedupSameLabel': 'Уже импортировано сюда',
  'workbench.importExport.chips.dedupSameTitle': 'Вы уже импортировали этот экспорт ({id}) сюда {date}.',
  'workbench.importExport.chips.dedupSameBody':
    'Повторный импорт применит ваш текущий выбор стратегии для каждой сущности.',
  'workbench.importExport.chips.dedupOtherLabel': 'Импортировано в другое место',
  'workbench.importExport.chips.dedupOtherTitle': 'Вы также импортировали экспорт {id} в «{name}».',
  'workbench.importExport.chips.dedupOtherBody': 'Этот импорт не затрагивает то рабочее пространство.',
  'workbench.importExport.chips.dedupUidLabel': 'Источник уже существует',
  'workbench.importExport.chips.dedupUidTitle': 'Рабочее пространство из этого источника уже существует («{name}»).',
  'workbench.importExport.chips.dedupUidBody':
    'Переключите цель выше, чтобы обновить его, или импортируйте как новую копию.',
  'workbench.importExport.chips.staleLabel': 'Данные изменились',
  'workbench.importExport.chips.staleTitle': 'Целевое рабочее пространство изменено из другой вкладки.',
  'workbench.importExport.chips.staleBody':
    'Дерево коллизий ниже обновлено — просмотрите его и снова нажмите «Импортировать».',
  'workbench.importExport.chips.previewErrorLabel': 'Предпросмотр не удался',
  'workbench.importExport.chips.previewErrorTitle': 'Не удалось вычислить diff коллизий.',
  'workbench.importExport.chips.unresolvedLabel': 'не разрешено: {count}',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} неразрешённая ссылка.',
      few: '{count} неразрешённые ссылки.',
      many: '{count} неразрешённых ссылок.',
      other: '{count} неразрешённых ссылок.',
    }),
  'workbench.importExport.chips.unresolvedBody':
    'Эти имена не разрешаются ни в экспорте, ни в цели. Импорт создаст сломанные привязки — перепривяжите их, когда появится недостающая сущность.',
  'workbench.importExport.chips.referencedBy': 'ссылок: {count}',
  'workbench.importExport.chips.summaryThen': 'Было:',
  'workbench.importExport.chips.summaryNow': 'Стало:',
  'workbench.importExport.chips.summaryNew': 'новых: {count}',
  'workbench.importExport.chips.summaryKept': 'сохранено: {count}',
  'workbench.importExport.chips.summaryRemoved': 'удалено: {count}',
  'workbench.importExport.chips.showBreakdown': 'Показать разбивку по разделам',
  'workbench.importExport.chips.hideBreakdown': 'Скрыть разбивку',
  'workbench.importExport.chips.sectionNew': '(новых: +{count})',
  'workbench.importExport.chips.sectionRemoved': '(удалено: {count})',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Зашифрованный vault — {count} секрет',
      few: 'Зашифрованный vault — {count} секрета',
      many: 'Зашифрованный vault — {count} секретов',
      other: 'Зашифрованный vault — {count} секретов',
    }),
  'workbench.importExport.vault.hintFromSender': 'Подсказка от отправителя:',
  'workbench.importExport.vault.enterPassphrase':
    'Введите парольную фразу, чтобы расшифровать эти секреты локально. Если пропустить расшифровку, остальной импорт продолжится — секреты просто не будут включены.',
  'workbench.importExport.vault.passphrasePlaceholder': 'Парольная фраза',
  'workbench.importExport.vault.decrypt': 'Расшифровать vault',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault расшифрован — {count} секрет готов к импорту',
      few: 'Vault расшифрован — {count} секрета готовы к импорту',
      many: 'Vault расшифрован — {count} секретов готовы к импорту',
      other: 'Vault расшифрован — {count} секретов готовы к импорту',
    }),
  'workbench.importExport.vault.keyFingerprint': 'Отпечаток ключа:',
  'workbench.importExport.vault.compareWithSender': '(сверьте с отправителем)',
  'workbench.importExport.vault.ciphertextFingerprint': 'Отпечаток шифротекста:',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} секрет не удалось декодировать — он не войдёт в импорт',
      few: '{count} секрета не удалось декодировать — они не войдут в импорт',
      many: '{count} секретов не удалось декодировать — они не войдут в импорт',
      other: '{count} секретов не удалось декодировать — они не войдут в импорт',
    }),
  'workbench.importExport.vault.andMore': '…и ещё {count}',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'Отмена',
  'workbench.importExport.import.importCta': 'Импортировать',
  'workbench.importExport.import.importCtaCount': 'Импортировать ({count})',
  'workbench.importExport.import.importShortcutTooltip': 'Импортировать ({shortcut})',
  'workbench.importExport.import.importTo': 'ИМПОРТИРОВАТЬ В',
  'workbench.importExport.import.hintNavigate': 'перейти',
  'workbench.importExport.import.hintSelect': 'выбрать',
  'workbench.importExport.import.hintImport': 'импортировать',
  'workbench.importExport.import.hintClose': 'закрыть',
  'workbench.importExport.import.cantReadFile': 'Не удалось прочитать этот файл',
  'workbench.importExport.import.failedCreateCollection': 'Не удалось создать коллекцию',
  'workbench.importExport.import.importFailed': 'Импорт не удался: {message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} преобразование',
      few: '{count} преобразования',
      many: '{count} преобразований',
      other: '{count} преобразований',
    }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} отброшенное',
      few: '{count} отброшенных',
      many: '{count} отброшенных',
      other: '{count} отброшенных',
    }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Импортирован {count} запрос',
      few: 'Импортировано {count} запроса',
      many: 'Импортировано {count} запросов',
      other: 'Импортировано {count} запросов',
    }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'ИМПОРТ ИЗ HAR',
  'workbench.importExport.har.tooltipChooseFile': 'Сначала выберите файл .har',
  'workbench.importExport.har.tooltipSelectEntry': 'Выберите хотя бы одну запись',
  'workbench.importExport.har.footerSelected': 'выбрано {selected} из {total}',
  'workbench.importExport.har.footerChooseFile': 'Выберите файл .har',
  'workbench.importExport.har.introPrefix': 'Импортируйте файл',
  'workbench.importExport.har.introSuffix':
    '(HTTP Archive), экспортированный из DevTools или прокси. Каждая запись становится запросом в выбранной коллекции. Файлы cookie и multipart-загрузки отбрасываются с отслеживающими пометками; заголовки авторизации повышаются до полноценных типов авторизации.',
  'workbench.importExport.har.filterPlaceholder': 'Фильтр по URL-адресу / методу / имени',
  'workbench.importExport.har.selectAll': 'Выбрать все',
  'workbench.importExport.har.selectNone': 'Ничего',
  'workbench.importExport.har.readFailed': 'Не удалось прочитать HAR: {message}',
  'workbench.importExport.har.dropTitle': 'Перетащите сюда файл .har или щёлкните, чтобы выбрать',
  'workbench.importExport.har.dropHint':
    'Экспортируется из окна DevTools → Network → правый щелчок → Сохранить все как HAR',
  'workbench.importExport.har.noImportableEntries': 'В файле нет записей для импорта.',
  'workbench.importExport.har.noFilterMatch': 'Ни одна запись не совпадает с фильтром.',
  'workbench.importExport.har.showingFirst': 'Показаны первые {shown} из {total}. Сузьте список с помощью фильтра.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} преобразование применено к источнику',
      few: '{count} преобразования применены к источнику',
      many: '{count} преобразований применены к источнику',
      other: '{count} преобразований применены к источнику',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} отброшенное записано',
      few: '{count} отброшенных записаны',
      many: '{count} отброшенных записаны',
      other: '{count} отброшенных записаны',
    }),
  'workbench.importExport.har.transformsTooltip':
    'Преобразования переписывают поля источника в нормализованные эквиваленты — например, повышают заголовки Authorization до полноценных типов авторизации.',
  'workbench.importExport.har.dropsTooltip':
    'Отброшенное — поля источника, которым нет места в модели (cookie, multipart-загрузки и т. д.). У каждого есть отслеживающая пометка в полном отчёте.',
  'workbench.importExport.har.reportHover':
    'Наведите для подробностей · полный список в экспорте отчётов об импорте (Приложение › Данные)',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'ИМПОРТ ИЗ CURL',
  'workbench.importExport.curl.tooltipPasteFirst': 'Сначала вставьте команду curl',
  'workbench.importExport.curl.tooltipEnterName': 'Введите имя',
  'workbench.importExport.curl.introPrefix': 'Вставьте команду',
  'workbench.importExport.curl.introSuffix':
    '— например, «Копировать как cURL» из DevTools браузера или документации API.',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': 'Не удалось разобрать эту команду',
  'workbench.importExport.curl.parseFallback': 'Не удалось разобрать — проверьте команду и попробуйте снова.',
  'workbench.importExport.curl.nameLabel': 'ИМЯ',
  'workbench.importExport.curl.namePlaceholder': 'Как этот запрос будет показан в боковой панели',
  'workbench.importExport.curl.failedCreateRequest': 'Не удалось создать запрос',
  'workbench.importExport.curl.importedName': 'Импортировано: «{name}»',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} заголовок',
      few: '{count} заголовка',
      many: '{count} заголовков',
      other: '{count} заголовков',
    }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} параметр запроса',
      few: '{count} параметра запроса',
      many: '{count} параметров запроса',
      other: '{count} параметров запроса',
    }),
  'workbench.importExport.curl.noBody': 'без тела',
  'workbench.importExport.curl.bodyType': 'тело {type}',
  'workbench.importExport.curl.noAuth': 'без авторизации',
  'workbench.importExport.curl.authType': 'авторизация {type}',
  'workbench.importExport.curl.droppedWord': 'отброшено',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'ИМПОРТ ИЗ POSTMAN',
  'workbench.importExport.postman.intro':
    'Импортируйте JSON коллекции Postman v2.1. Сохраняются структура папок, переменные коллекции, документация и настройки запросов, авторизация каждого запроса (basic / bearer / api-key / OAuth 2.0) и скрипты запросов (по возможности переведённые на API oh.*). AWS sigv4 и загрузка файлов отслеживаются как отброшенное. При желании приложите файл окружения Postman, чтобы создать соответствующее окружение.',
  'workbench.importExport.postman.tooltipChooseFile': 'Сначала выберите файл коллекции',
  'workbench.importExport.postman.tooltipEnterName': 'Введите имя коллекции',
  'workbench.importExport.postman.collectionNameLabel': 'ИМЯ КОЛЛЕКЦИИ',
  'workbench.importExport.postman.collectionNamePlaceholder': 'Имя новой коллекции',
  'workbench.importExport.postman.readFileFailed': 'Не удалось прочитать файл: {message}',
  'workbench.importExport.postman.readEnvFailed': 'Не удалось прочитать окружение: {message}',
  'workbench.importExport.postman.parsedCollection': 'РАЗОБРАННАЯ КОЛЛЕКЦИЯ',
  'workbench.importExport.postman.requestsLabel': 'Запросов:',
  'workbench.importExport.postman.foldersLabel': 'Папок:',
  'workbench.importExport.postman.collectionVarsLabel': 'Переменных коллекции:',
  'workbench.importExport.postman.folderTree': 'Дерево папок',
  'workbench.importExport.postman.optionalEnvFile': 'НЕОБЯЗАТЕЛЬНО · ФАЙЛ ОКРУЖЕНИЯ',
  'workbench.importExport.postman.environmentLabel': 'Окружение: {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} переменная',
      few: '{count} переменные',
      many: '{count} переменных',
      other: '{count} переменных',
    }),
  'workbench.importExport.postman.secretCount': 'секретных: {count}',
  'workbench.importExport.postman.remove': 'Убрать',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} переменная окружения отброшена (выключенные записи)',
      few: '{count} переменные окружения отброшены (выключенные записи)',
      many: '{count} переменных окружения отброшены (выключенные записи)',
      other: '{count} переменных окружения отброшены (выключенные записи)',
    }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Перетащите сюда JSON коллекции Postman v2.1 или щёлкните, чтобы выбрать',
  'workbench.importExport.postman.dropEnvTitle': 'Перетащите сюда JSON окружения Postman (необязательно)',
  'workbench.importExport.postman.dropCollectionHint':
    'Экспортируется из Postman → Collection → ⋯ → Export (Collection v2.1)',
  'workbench.importExport.postman.dropEnvHint': 'Экспортируется из Postman → Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} папка',
      few: '{count} папки',
      many: '{count} папок',
      other: '{count} папок',
    }),
  'workbench.importExport.postman.oneEnvironment': '1 окружение',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'ИМПОРТ ИЗ РЕЗЕРВНОЙ КОПИИ POSTMAN',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Импортируйте дамп резервной копии Postman. Распознаются коллекции, окружения, глобальные переменные и предустановки заголовков; предустановки заголовков попадают как неопубликованные правила заголовков. Скрипты, OAuth 2.0, AWS sigv4 и загрузка файлов отслеживаются как отброшенное.',
  'workbench.importExport.sectioned.titleInsomnia': 'ИМПОРТ ИЗ INSOMNIA',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Импортируйте экспорт Insomnia (JSON v4 или YAML v5). Рабочие пространства становятся коллекциями с их деревьями папок; окружения сплющиваются (подокружения накладываются на базовое), а ссылки {{ _.var }} переписываются в {{var}}; встроенные спецификации API сохраняются как редактируемые спецификации, привязанные к сгенерированным коллекциям.',
  'workbench.importExport.sectioned.titleBruno': 'ИМПОРТ ИЗ BRUNO',
  'workbench.importExport.sectioned.blurbBruno':
    'Импортируйте запрос Bruno .bru или целую папку коллекции. Сохраняются метод, заголовки, параметры, тело и авторизация basic/bearer/api-key; папка приносит своё дерево папок, порядок и окружения; скрипты, тесты и блоки docs отслеживаются как отброшенное.',
  'workbench.importExport.sectioned.titleOpenapi': 'ИМПОРТ ИЗ OPENAPI',
  'workbench.importExport.sectioned.blurbOpenapi':
    'Импортируйте документ OpenAPI 3.x (JSON или YAML). Операции становятся запросами под {{baseUrl}}, теги — папками, параметры и тела запросов сохраняются (тела, заданные только схемой, получают заготовку-заполнитель), а схемы безопасности отображаются в авторизацию — после импорта заполните заполнители {{clientId}}/{{clientSecret}}. Документ может также остаться редактируемой спецификацией, привязанной к сгенерированной коллекции.',
  'workbench.importExport.sectioned.titleGraphqlSchema': 'ИМПОРТ СХЕМЫ GRAPHQL',
  'workbench.importExport.sectioned.blurbGraphqlSchema':
    'Импортируйте схему GraphQL — текст SDL или результат интроспекции. Она попадает как редактируемая спецификация, которую запросы GraphQL привязывают как источник схемы; затем откройте её, чтобы сгенерировать коллекцию запросов из её корневых полей.',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'Пока ничего не разобрано',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'Каждой коллекции нужно имя',
  'workbench.importExport.sectioned.cantReadImport': 'Не удалось прочитать этот импорт',
  'workbench.importExport.sectioned.readInputFailed': 'Не удалось прочитать ввод: {message}',
  'workbench.importExport.sectioned.importAs': 'ИМПОРТИРОВАТЬ КАК',
  'workbench.importExport.sectioned.specWithCollection': 'Спецификация с коллекцией',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'Документ остаётся редактируемой спецификацией, привязанной к сгенерированной коллекции.',
  'workbench.importExport.sectioned.collectionOnly': 'Коллекция',
  'workbench.importExport.sectioned.collectionOnlyHelp': 'Только преобразовать — сам документ не сохраняется.',
  'workbench.importExport.sectioned.specificationsSection': 'СПЕЦИФИКАЦИИ · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'КОЛЛЕКЦИИ · {count}',
  'workbench.importExport.sectioned.environmentsSection': 'ОКРУЖЕНИЯ · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': 'ПРЕДУСТАНОВКИ ЗАГОЛОВКОВ · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'Имя коллекции',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} переменная',
      few: '{count} переменные',
      many: '{count} переменных',
      other: '{count} переменных',
    }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} заголовок',
      few: '{count} заголовка',
      many: '{count} заголовков',
      other: '{count} заголовков',
    }),
  'workbench.importExport.sectioned.presetsNote':
    'Каждая предустановка попадает как неопубликованное правило заголовков — добавьте условия и опубликуйте, когда будете готовы; до тех пор живой трафик не затрагивается.',
  'workbench.importExport.sectioned.nothingImportable': 'В этом файле нечего импортировать',
  'workbench.importExport.sectioned.nothingImportableDesc':
    'Файл разобран, но каждый раздел оказался пустым или отброшенным — см. заметки импорта ниже.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} спецификация',
      few: '{count} спецификации',
      many: '{count} спецификаций',
      other: '{count} спецификаций',
    }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} окружение',
      few: '{count} окружения',
      many: '{count} окружений',
      other: '{count} окружений',
    }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} правило заголовков (не опубликовано)',
      few: '{count} правила заголовков (не опубликованы)',
      many: '{count} правил заголовков (не опубликованы)',
      other: '{count} правил заголовков (не опубликованы)',
    }),
  'workbench.importExport.sectioned.importedLead': 'Импортировано: {parts}',
  'workbench.importExport.sectioned.emptyFinish': 'Импорт завершён — переносить нечего',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': 'Перенести из другого инструмента',
  'workbench.importExport.migrate.scanCta': 'Просканировать этот компьютер',
  'workbench.importExport.migrate.pullCta': 'Импортировать из учётной записи Postman',
  'workbench.importExport.migrate.scanNote':
    'Сканирование проверяет фиксированный список папок приложений и читает только файлы данных инструментов (резервные копии и локальные хранилища). Оно никогда не открывает файлы учётных данных, cookie или сеансов, и ничто не покидает этот компьютер. Импорт чего-либо — отдельный явный шаг.',
  'workbench.importExport.migrate.scanFailed':
    'Сканирование не удалось запустить — попробуйте снова или используйте центр импорта с экспортированным файлом.',
  'workbench.importExport.migrate.backupReadFailed': 'Не удалось прочитать файл резервной копии.',
  'workbench.importExport.migrate.localReadFailed': 'Не удалось прочитать локальные данные.',
  'workbench.importExport.migrate.detected': 'Обнаружено',
  'workbench.importExport.migrate.notFound': 'Не найдено',
  'workbench.importExport.migrate.cancel': 'Отмена',
  'workbench.importExport.migrate.fromAccount': 'Импортировать из вашей учётной записи Postman',
  'workbench.importExport.migrate.localDataPrefix':
    'Есть локальные данные Insomnia, Thunder Client или Bruno? Экспортируйте их из инструмента и перетащите файл в',
  'workbench.importExport.migrate.importHub': 'центр импорта',
  'workbench.importExport.migrate.localDataSuffix':
    '— или просканируйте этот компьютер настольным приложением Open Headers.',
  'workbench.importExport.migrate.desktopConnected':
    'Настольное приложение подключено — выберите там «Перенести из другого инструмента»; ход выполнения отражается здесь, а импортированные рабочие пространства синхронизируются сюда.',
  'workbench.importExport.migrate.desktopNeeded':
    'Для сканирования нужно настольное приложение; когда оно выполнится там, импортированные рабочие пространства синхронизируются в этот браузер.',
  'workbench.importExport.migrate.closeConfirmTitle': 'Закрыть импорт?',
  'workbench.importExport.migrate.closeListingContent':
    'Список ваших рабочих пространств ещё загружается — для больших учётных записей это может занять минуту. Закрытие прервёт загрузку.',
  'workbench.importExport.migrate.closeListingOk': 'Подождать',
  'workbench.importExport.migrate.closeSelectingContent':
    'Выбор рабочих пространств будет сброшен. Пока ничего не импортировано.',
  'workbench.importExport.migrate.closeSelectingOk': 'Продолжить выбор',
  'workbench.importExport.migrate.closeAnyway': 'Всё равно закрыть',
  'workbench.importExport.migrate.discardAndClose': 'Сбросить и закрыть',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman's UI is English, so the glyph labels
  // and its menu rows stay English (ja / ko parity).
  'workbench.importExport.pull.keyIntro':
    'Вставьте API-ключ Postman, чтобы получить список рабочих пространств и выбрать, какие импортировать.',
  'workbench.importExport.pull.keyAria': 'API-ключ Postman',
  'workbench.importExport.pull.listCta': 'Показать рабочие пространства',
  'workbench.importExport.pull.listFailed': 'Не удалось получить список рабочих пространств.',
  'workbench.importExport.pull.startFailed': 'Не удалось запустить импорт.',
  'workbench.importExport.pull.quipContacting': 'Обращаемся к вашей учётной записи Postman',
  'workbench.importExport.pull.quipCounting': 'Считаем коллекции',
  'workbench.importExport.pull.quipWeighing': 'Взвешиваем окружения',
  'workbench.importExport.pull.quipWrangling': 'Укрощаем рабочие пространства',
  'workbench.importExport.pull.quipAlphabetizing': 'Сортируем папки по алфавиту',
  'workbench.importExport.pull.quipSniffing': 'Вынюхиваем запросы',
  'workbench.importExport.pull.quipUntangling': 'Распутываем переменные',
  'workbench.importExport.pull.quipStacking': 'Складываем заголовки',
  'workbench.importExport.pull.pickIntro':
    'Каждое выбранное рабочее пространство Postman попадает в собственное рабочее пространство с тем же именем и отчётом по завершении.',
  'workbench.importExport.pull.noWorkspaces': 'В этой учётной записи рабочих пространств не найдено.',
  'workbench.importExport.pull.workspaceCounts': 'коллекций: {collections} · окружений: {environments}',
  'workbench.importExport.pull.importCta': 'Импортировать выбранные',
  'workbench.importExport.pull.back': 'Назад',
  'workbench.importExport.pull.steps.menuA': 'В приложении Postman или на https://postman.co',
  'workbench.importExport.pull.steps.menuB': 'Меню Settings → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Левая боковая панель → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': 'Введите любое имя → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'Скопируйте ключ → вставьте его выше',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'Инструмент',
  'workbench.importExport.detection.dataFoundCol': 'Найденные данные',
  'workbench.importExport.detection.contentsCol': 'Содержимое',
  'workbench.importExport.detection.backupFrom': 'Резервная копия от {date}',
  'workbench.importExport.detection.localData': 'Локальные данные',
  'workbench.importExport.detection.importCta': 'Импортировать…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'Или экспортируйте их (Preferences → Data → Export), затем перетащите файл в',
  'workbench.importExport.detection.backupContents':
    'коллекций: {collections} · окружений: {environments} · предустановок заголовков: {headerPresets} · глобальных переменных: {globals}',
  'workbench.importExport.detection.localContents':
    'коллекций: {collections} · окружений: {environments} · запросов: {requests}',
  'workbench.importExport.detection.emptyScanned': 'На этом компьютере не найдено хранилищ данных для импорта.',
  'workbench.importExport.detection.emptyNotScanned':
    'Пока ничего не сканировалось — «Просканировать этот компьютер» покажет здесь данные для импорта.',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} файл хранилища пропущен —',
      few: '{count} файла хранилища пропущены —',
      many: '{count} файлов хранилища пропущены —',
      other: '{count} файлов хранилища пропущены —',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Отчёт об импорте из Postman',
  'workbench.importExport.report.noReport': 'Отчёт об импорте для этого рабочего пространства не найден.',
  'workbench.importExport.report.cleanImport': 'Всё импортировано чисто — ничего не отброшено и не преобразовано.',
  'workbench.importExport.report.copyOk': 'Отчёт скопирован как JSON',
  'workbench.importExport.report.copyAnonymizedOk': 'Анонимизированный отчёт скопирован как JSON',
  'workbench.importExport.report.copyFailed': 'Не удалось скопировать отчёт.',
  'workbench.importExport.report.copyReport': 'Копировать отчёт',
  'workbench.importExport.report.download': 'Скачать',
  'workbench.importExport.report.anonymizeTooltip':
    'Для публичной публикации (например, в issue на GitHub): имена рабочих пространств заменяются на «Workspace N», а переписанные значения скрываются. Пути, причины и счётчики остаются, чтобы отчёт можно было отлаживать.',
  'workbench.importExport.report.anonymize': 'Анонимизировать',
  'workbench.importExport.report.close': 'Закрыть',
  'workbench.importExport.report.openWorkspace': 'Открыть рабочее пространство',
  'workbench.importExport.report.countsLine':
    'коллекций: {collections} · окружений: {environments} · запросов: {requests}',
  'workbench.importExport.report.savedExamplesPart': 'сохранённых примеров: {count}',
  'workbench.importExport.report.globalVariablesPart': 'глобальных переменных: {count}',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} заметка',
      few: '{count} заметки',
      many: '{count} заметок',
      other: '{count} заметок',
    }),
  'workbench.importExport.report.summaryImported': 'Импортировано',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'коллекция', few: 'коллекции', many: 'коллекций', other: 'коллекций' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'окружение', few: 'окружения', many: 'окружений', other: 'окружений' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'запрос', few: 'запроса', many: 'запросов', other: 'запросов' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'сохранённый пример',
      few: 'сохранённых примера',
      many: 'сохранённых примеров',
      other: 'сохранённых примеров',
    }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'глобальная переменная',
      few: 'глобальные переменные',
      many: 'глобальных переменных',
      other: 'глобальных переменных',
    }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} рабочее пространство',
      few: '{count} рабочих пространства',
      many: '{count} рабочих пространств',
      other: '{count} рабочих пространств',
    }),
  'workbench.importExport.report.withOpen': '(в том числе',
  'workbench.importExport.report.and': 'и',
  'workbench.importExport.report.into': 'в',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': 'ранее',
  'workbench.importExport.reimport.previouslyImported': '(ранее импортировано {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} новая проблема с прошлого импорта',
      few: '{count} новые проблемы с прошлого импорта',
      many: '{count} новых проблем с прошлого импорта',
      other: '{count} новых проблем с прошлого импорта',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} ранее не поддерживавшаяся запись теперь обрабатывается',
      few: '{count} ранее не поддерживавшиеся записи теперь обрабатываются',
      many: '{count} ранее не поддерживавшихся записей теперь обрабатываются',
      other: '{count} ранее не поддерживавшихся записей теперь обрабатываются',
    }),
  'workbench.importExport.reimport.countsChanged': 'Счётчики изменились с прошлого импорта',
  'workbench.importExport.reimport.minorChanges': 'Незначительные изменения относительно прошлого импорта',
  'workbench.importExport.reimport.newDrops': 'Новое отброшенное ({count})',
  'workbench.importExport.reimport.dropsResolved': 'Отброшенное устранено ({count})',
  'workbench.importExport.reimport.newTransforms': 'Новые преобразования ({count})',
  'workbench.importExport.reimport.transformsResolved': 'Преобразования больше не нужны ({count})',
} as const satisfies Catalog;
