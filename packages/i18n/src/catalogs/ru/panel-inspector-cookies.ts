/**
 * DevTools panel — inspector Cookies tab — Russian. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by
 * design: cookie names/values, Set-Cookie attribute names as titles
 * and field labels (Name / Value / Domain / Path / Expires / SameSite
 * / HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary (Unspecified /
 * None (cross-site) / Lax / Strict — rendered AND parsed, never
 * convert one side alone), the literal `Session`, `__Host-` /
 * `__Secure-` prefixes, role chips (auth? / tracking? / pref), format
 * nouns, and byte figures. Mints: **On/Off projection = Вкл. / Выкл.**
 * (round-trip, both sides — decided once); the отбросить / отклонить
 * split — the browser отклоняет (rejects) a Set-Cookie, the dropped
 * chip reads отброшен, a rule отбрасывает (drops) a frame (carried
 * from shared-components); сторонний = third-party (carried);
 * разделённый = partitioned carried; хранилище cookie = jar carried;
 * роль = role (classifier); префикс = prefix. Prefix prose leads with
 * a head noun (cookie с префиксом __Host-) — never a butted ending on
 * the raw token. The DevTools path quotes Chrome's own ru UI
 * (Приложение → Файлы cookie).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ───────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    'Фильтр — текст, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Фильтр cookie',
  'panel.inspector.cookies.empty': 'Cookie не отправлялись и не получались.',

  // Table column headers.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': 'отправлено {count} · {bytes} B',
  'panel.inspector.cookies.footprint.set': 'установлено {count} · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': 'будет отброшено: {count}',
  'panel.inspector.cookies.footprint.filteredOut': 'отфильтровано: {count}',
  'panel.inspector.cookies.footprint.flagged': 'отмечено: {count}',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Переопределить cookie',
  'panel.inspector.cookies.cta.overrideCookiesTitle': 'Создать правило, меняющее cookie на совпавших запросах',
  'panel.inspector.cookies.cta.requestCookies': 'Cookie запроса…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'Заменить заголовок Cookie, отправленный с этим запросом',
  'panel.inspector.cookies.cta.responseCookies': 'Cookie ответа…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Заменить заголовок Set-Cookie, приходящий от сервера',
  'panel.inspector.cookies.cta.noCookies': 'Не отправлять cookie…',
  'panel.inspector.cookies.cta.noCookiesTitle': 'Отбросить заголовок Cookie целиком, чтобы сервер не видел cookie',
  'panel.inspector.cookies.cta.addCookie': 'Добавить cookie',
  'panel.inspector.cookies.cta.addCookieTitle': 'Добавить cookie в хранилище браузера (включая HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Переопределить cookie',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Правило',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    'Создаёт правило, которое переписывает заголовки Cookie / Set-Cookie на совпавших запросах, пока срабатывает. Хранилище cookie браузера не затрагивается.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Варианты',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Cookie запроса',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'Заменить заголовок Cookie, который отправляет браузер.',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Cookie ответа',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Заменить заголовок Set-Cookie, приходящий от сервера.',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'Не отправлять cookie',
  'panel.inspector.cookies.ctaInfo.noneDesc': 'Отбросить заголовок Cookie целиком — сервер видит запрос без cookie.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Добавить Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Хранилище браузера',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Записывает настоящий cookie в хранилище браузера — то же хранилище, которое браузер показывает в разделе Приложение → Файлы cookie.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'Он сохраняется после этого запроса, и браузер прикладывает его везде, где совпадают домен, путь и флаги — без участия правил. Так же создаются HttpOnly cookie, которые скрипты страницы задать не могут. Значение принимает ссылки {{variable}}, разрешаемые один раз при сохранении — хранилище держит этот снимок, даже если переменная потом изменится; используйте «Переопределить cookie», когда значение должно следовать за переменной.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie «{name}» сохранён',
  'panel.inspector.cookies.toast.saveFailed': 'Не удалось сохранить cookie «{name}»',
  'panel.inspector.cookies.toast.saveFailedWithError': 'Не удалось сохранить cookie «{name}» — {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie «{name}» удалён',
  'panel.inspector.cookies.toast.deleteFailed': 'Не удалось удалить cookie «{name}»',
  'panel.inspector.cookies.toast.mergeApplied': 'Объединение применено к форме — сохранение запишет его в браузер',
  'panel.inspector.cookies.confirmDelete.title': 'Удалить cookie «{name}»?',
  'panel.inspector.cookies.confirmDelete.content':
    'Он будет удалён из хранилища cookie браузера. Страница перестанет его отправлять.',
  'panel.inspector.cookies.confirmDelete.ok': 'Удалить',

  // More filters ▾ / View ▾ — this tab's own menus.
  'panel.inspector.cookies.moreFilters.label': 'Ещё фильтры',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Только с проблемами',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': 'Только сторонние',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Только изменённые правилами',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Показывать отфильтрованные cookie запроса',
  'panel.inspector.cookies.view.label': 'Вид',
  'panel.inspector.cookies.view.sort': 'Сортировка',
  'panel.inspector.cookies.view.sortOriginal': 'Исходный порядок',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Размер',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Относительно',
  'panel.inspector.cookies.view.expiresAbsolute': 'Абсолютно',
  'panel.inspector.cookies.view.decodeValues': 'Декодировать значения в URL-кодировке',
  'panel.inspector.cookies.view.groupByRole': 'Группировать по роли (auth / pref / tracking)',
  'panel.inspector.cookies.view.showTags': 'Показывать теги',
  'panel.inspector.cookies.view.showSuggestions': 'Показывать рекомендации',

  // Section chrome.
  'panel.inspector.cookies.section.responseCookies': 'Cookie ответа',
  'panel.inspector.cookies.section.requestCookies': 'Cookie запроса',
  'panel.inspector.cookies.section.countOf': '{visible} из {total}',

  // Role vocabulary — product classifier copy.
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': 'Аутентификация и сеанс',
  'panel.inspector.cookies.role.sectionFunctional': 'Функциональные',
  'panel.inspector.cookies.role.sectionPref': 'Предпочтения',
  'panel.inspector.cookies.role.sectionTracking': 'Аналитика и отслеживание',
  'panel.inspector.cookies.role.nounAuth': 'аутентификация / сеанс',
  'panel.inspector.cookies.role.nounTracking': 'аналитика / отслеживание',
  'panel.inspector.cookies.role.nounPref': 'предпочтения / согласие',
  'panel.inspector.cookies.role.nounOther': 'cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — cookie: {noun}.',
  'panel.inspector.cookies.role.tooltipAuth': 'Похоже на cookie аутентификации / сеанса (эвристика).',
  'panel.inspector.cookies.role.tooltipTracking': 'Похоже на cookie аналитики / отслеживания (эвристика).',
  'panel.inspector.cookies.role.tooltipPref': 'Cookie пользовательских предпочтений.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'разделённый',
  'panel.inspector.cookies.chips.partitionedTitle': 'Изолирован для сайта верхнего уровня: {key}',
  'panel.inspector.cookies.chips.thirdParty': 'сторонний',
  'panel.inspector.cookies.chips.justSet': 'только что установлен',
  'panel.inspector.cookies.chips.justSetTitle': 'Установлен этим ответом.',
  'panel.inspector.cookies.chips.dropped': 'отброшен',
  'panel.inspector.cookies.chips.droppedTitle': 'Браузер отклонит этот Set-Cookie.',
  'panel.inspector.cookies.chips.filteredOut': 'отфильтрован',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'Не отправлен с этим запросом.',
  'panel.inspector.cookies.chips.problemTitle': 'См. рекомендацию выше.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — отправляется только по HTTPS.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Нет Secure — SameSite=None требует Secure; браузер отклонит этот cookie.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix': 'Нет Secure — префикс __Host- / __Secure- требует Secure.',
  'panel.inspector.cookies.glyphs.secureOff': 'Нет атрибута Secure.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — недоступен из JavaScript.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Доступен из JavaScript (нет HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict — отправляется только при навигации внутри сайта.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — отправляется при межсайтовых GET верхнего уровня.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None без Secure — браузер отклонит.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — отправляется с каждым межсайтовым запросом.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite не указан.',

  // Row actions + status dots + name/value tooltips.
  'panel.inspector.cookies.row.copyValue': 'Копировать значение',
  'panel.inspector.cookies.row.copied': 'Скопировано',
  'panel.inspector.cookies.row.override': 'Переопределить',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Создать правило для переопределения этого Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Создать правило для переопределения этого значения Cookie',
  'panel.inspector.cookies.row.editCookieTitle': 'Изменить этот cookie в хранилище браузера',
  'panel.inspector.cookies.row.editCookieAria': 'Изменить cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Удалить этот cookie из хранилища браузера',
  'panel.inspector.cookies.row.deleteCookieAria': 'Удалить cookie',
  'panel.inspector.cookies.row.ruleDotTitle': 'Правило изменяет заголовок {header} на этом запросе',
  'panel.inspector.cookies.row.ruleDotAria': 'Применяется правило',
  'panel.inspector.cookies.row.editedDotTitle': 'Изменён из этой панели',
  'panel.inspector.cookies.row.editedDotAria': 'Изменён',
  'panel.inspector.cookies.row.hostPrefixHint':
    'Префикс __Host- привязывает этот cookie к одному хосту: браузер требует Secure, Path=/ и отсутствие атрибута Domain. Строки Set-Cookie, нарушающие любое из условий, отклоняются.',
  'panel.inspector.cookies.row.securePrefixHint':
    'Префикс __Secure- требует, чтобы этот cookie был Secure (только HTTPS). Строки Set-Cookie без Secure отклоняются.',
  'panel.inspector.cookies.row.editedValueTitle': 'Изменён — запрос нёс: {value}',
  'panel.inspector.cookies.row.valueNoteResponse':
    'Этот ответ установил: {value} — значение в хранилище с тех пор изменилось.',
  'panel.inspector.cookies.row.valueNoteRequest':
    'Этот запрос отправил: {value} — значение в хранилище с тех пор изменилось.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Состояние',
  'panel.inspector.cookies.statusRail.summary':
    'Квадрат отмечает cookie, которые не в своём исходном состоянии в браузере.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Цвета квадратов',
  'panel.inspector.cookies.statusRail.blue': 'синий',
  'panel.inspector.cookies.statusRail.blueDesc':
    'Правило, сработавшее на этом запросе, изменяет заголовок Cookie / Set-Cookie этого направления.',
  'panel.inspector.cookies.statusRail.grey': 'серый',
  'panel.inspector.cookies.statusRail.greyDesc': 'Добавлен или изменён из этой панели в этом сеансе.',

  // Add / edit popover. The SameSite labels, On/Off flag words and the
  // Session expires word are ROUND-TRIP vocabulary.
  'panel.inspector.cookies.edit.editTitle': 'Изменить cookie',
  'panel.inspector.cookies.edit.valueChanged': 'значение изменилось',
  'panel.inspector.cookies.edit.goneNote':
    'Этот cookie удалён в браузере, пока форма была открыта — сохранение запишет его обратно.',
  'panel.inspector.cookies.edit.openInTab': 'Открыть в новой вкладке',
  'panel.inspector.cookies.edit.openDirtyTitle':
    'Сначала сохраните или отмените правки — документ открывается из хранилища браузера',
  'panel.inspector.cookies.edit.openTitle': 'Открыть этот cookie как вкладку документа',
  'panel.inspector.cookies.edit.save': 'Сохранить',
  'panel.inspector.cookies.edit.unresolved': 'Не разрешается — создайте переменную или исправьте ссылку.',
  'panel.inspector.cookies.edit.writes': 'Запишет: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'имя cookie',
  'panel.inspector.cookies.edit.valuePlaceholder': 'значение или {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'В дату',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'Вкл.',
  'panel.inspector.cookies.edit.flagOff': 'Выкл.',
  // Pre-write constraint sentences.
  'panel.inspector.cookies.edit.constraint.hostSecure': 'У cookie с префиксом __Host- флаг Secure должен быть включён.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    'Cookie с префиксом __Host- не может нести атрибут Domain — включите «Host only».',
  'panel.inspector.cookies.edit.constraint.hostPath': 'Cookie с префиксом __Host- должен использовать путь «/».',
  'panel.inspector.cookies.edit.constraint.securePrefix':
    'У cookie с префиксом __Secure- флаг Secure должен быть включён.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite «{label}» требует флага Secure.',
  // Merge parse-back errors — rendered inline in the merge modal.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'Результат объединения — недопустимый JSON; исправьте синтаксис и завершите объединение снова.',
  'panel.inspector.cookies.edit.merge.notObject': 'Результат объединения должен быть JSON-объектом с полями cookie.',
  'panel.inspector.cookies.edit.merge.fieldMissing': 'Поле "{field}" должно присутствовать как строка.',
  'panel.inspector.cookies.edit.merge.flagOnOff': 'Поле "{field}" должно быть "{on}" или "{off}".',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': 'Поле "sameSite" должно быть одним из {labels}.',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    'Поле "expires" должно быть "{session}" или датой вида 2026-07-09T14:30.',

  // Edit-form field (i) corpus.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Пример Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Поле Cookie',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Флаг Cookie',
  'panel.inspector.cookies.fieldInfo.templateNote':
    'Принимает ссылки {{variable}}, разрешаемые один раз при сохранении — хранилище сохраняет разрешённый текст.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'Идентификатор cookie. Браузеры различают их по (name, domain, path) — то же имя с другой областью — отдельный cookie.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'Префиксы проверяет браузер: __Host- требует Secure, Path=/ и отсутствие Domain; __Secure- требует Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'Полезная нагрузка cookie — то, что браузер отправляет обратно в заголовке Cookie.',
  'panel.inspector.cookies.fieldInfo.value.description':
    'Значение — снимок: если переменная потом изменится, хранилище сохранит этот текст — используйте правило «Переопределить cookie», когда значение должно следовать за переменной.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Какие хосты получают cookie.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'Простой домен вроде openheaders.com включает свои поддомены (браузер хранит его с ведущей точкой), если не включён Host-only, который привязывает cookie ровно к этому хосту.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'Префикс пути URL-адреса, с которым идёт cookie — /api означает, что его несут только запросы под /api.',
  'panel.inspector.cookies.fieldInfo.path.description': 'По умолчанию /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'Когда браузер удалит cookie.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Сеансовые cookie живут до конца сеанса браузера; «В дату» задаёт абсолютный срок (хранится как атрибут Expires).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'Когда межсайтовые запросы могут нести cookie.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Значения',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Только запросы внутри сайта.',
  'panel.inspector.cookies.fieldInfo.samesite.lax': 'Внутри сайта плюс межсайтовая навигация верхнего уровня (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none': 'Отправляется и между сайтами — браузер требует с ним Secure.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': 'По умолчанию браузера (в Chrome трактуется как Lax).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Скрывает cookie от JavaScript страницы — document.cookie не может его прочитать или перезаписать.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Только серверы (Set-Cookie) и этот редактор могут создавать HttpOnly cookie; скрипты страницы — нет. Стандартная защита для сеансовых токенов.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'Cookie передаётся только по HTTPS — обычные http-запросы его никогда не несут.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Обязателен для SameSite=None и для префиксов имени __Host- / __Secure-.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Привязывает cookie ровно к хосту из Domain — поддомены его не получают.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Если выключено, cookie хранится на весь домен (с ведущей точкой) и уходит на поддомены. Собственные cookie браузера — host-only, когда сервер опустил атрибут Domain.',

  // Column (i) corpus.
  'panel.inspector.cookies.columnInfo.name.summary':
    'Идентификатор cookie. Браузеры различают их по (name, domain, path) — два cookie с одним именем, но разной областью различны.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Чипы справа показывают то, чего нет ни в одном столбце. Они появляются рядом с именем; наведите курсор на строку, чтобы над значением появилось действие «Переопределить».',
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Роль (эвристика)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    'Похоже на cookie аутентификации / сеанса — имя содержит sess / session / auth / sid / token / csrf / xsrf, либо cookie HttpOnly с длинным случайным значением.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    'Похоже на cookie аналитики / отслеживания — имя совпадает с известным трекером (_ga, _gid, _fbp, NID, IDE, MUID, _hjid, …), либо cookie сторонний без другой классификации.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'Cookie пользовательских предпочтений — tz, lang, locale, theme, color-mode, currency, cpu-bucket, font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Жизненный цикл',
  'panel.inspector.cookies.columnInfo.name.justSetDesc': 'Set-Cookie пришёл с этим ответом, и браузер его принял.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie пришёл, но браузер его отклонит — нарушено правило вроде SameSite=None без Secure, нарушение префикса __Host-, префикс __Secure- без Secure или Partitioned без Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'Хранилище содержит этот cookie, но с этим запросом он не отправлен (несовпадение пути, Secure на http, истёк, ограничение SameSite, …). Показывается только при включённом «Показывать отфильтрованные cookie запроса».',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Контекст',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    'Домен cookie — межсайтовый по отношению к источнику верхнего фрейма страницы.',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'Изоляция в стиле CHIPS — cookie привязан к сайту верхнего уровня в дополнение к своей области. Наведите курсор, чтобы увидеть ключ раздела.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'Этот cookie вызвал рекомендацию (карточки предупреждений вверху вкладки). Смотрите выноску, чтобы узнать почему.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Префиксы (видны в имени)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'Привязан к хосту — браузер требует Secure, Path=/, без Domain. Нарушения отклоняются.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'Только HTTPS — браузер требует Secure. Нарушения отклоняются.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'Полезная нагрузка cookie. Нажмите строку, чтобы раскрыть панель с разобранными видами, когда значение имеет структуру.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Автоопределяемые форматы',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'Три сегмента base64url — заголовок и полезная нагрузка декодируются; утверждения exp / iat / nbf показаны как относительное время.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc':
    'Форматируется в раскрывающейся панели (работает и после URL-декодирования).',
  'panel.inspector.cookies.columnInfo.value.b64Desc': 'Обычный base64 — декодированное тело показано, если печатаемо.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Текст в процентном кодировании — включите «Декодировать значения в URL-кодировке» в меню «Вид», чтобы показывать декодированным в строке.',
  'panel.inspector.cookies.columnInfo.scope.summary': 'Куда браузер приложит этот cookie — сочетание Domain + Path.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'Ведущая точка в домене (например `.openheaders.com`) означает, что включены поддомены. Путь в конце вроде `/api` означает, что cookie отправляется только с запросами под этим путём.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'Когда браузер перестанет отправлять этот cookie. Цвет отражает срочность.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Как читать цвет',
  'panel.inspector.cookies.columnInfo.expires.red': 'красный',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'Уже истёк или истекает менее чем через час.',
  'panel.inspector.cookies.columnInfo.expires.yellow': 'жёлтый',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Истекает в течение 24 часов.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'обычный',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': 'В будущем — более чем через день.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Нет Expires / Max-Age — браузер отбрасывает его по окончании сеанса.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Формат',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Относительно (по умолчанию)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '«через 7 мес.», «30 с назад» — относительно текущего момента. Наведите курсор, чтобы увидеть точную дату.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Абсолютно',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'Дата в UTC. Переключается в меню Вид → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Размер сериализованного cookie в байтах — длина `name=value`, используется для итога полезной нагрузки запроса.',
  'panel.inspector.cookies.columnInfo.size.description':
    'Большинство серверов и посредников ограничивают общий заголовок Cookie 4 KB. Слишком большие полезные нагрузки могут вызывать ответы 4xx / 5xx без внятной ошибки.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Безопасность (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Три глифа сворачивают атрибуты Secure / HttpOnly / SameSite в одну ячейку. Смысл несёт цвет.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Глифы',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — отправляется только по HTTPS.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — недоступен из JavaScript.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'Ограничение SameSite (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Цвет',
  'panel.inspector.cookies.columnInfo.sec.green': 'зелёный',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'Включено / strict — надёжно защищён.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'жёлтый',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — отправляется при межсайтовых GET верхнего уровня.',
  'panel.inspector.cookies.columnInfo.sec.red': 'красный',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Отсутствует там, где требуется (SameSite=None без Secure, __Host- без Secure, …) — браузер отклонит.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'серый',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Выключено / не указано.',

  // Cookie insights (t-fed `computeCookieInsights`).
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie установлен с SameSite=None, но без Secure',
      few: '{count} cookie установлены с SameSite=None, но без Secure',
      many: '{count} cookie установлены с SameSite=None, но без Secure',
      other: '{count} cookie установлены с SameSite=None, но без Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Современные браузеры отклоняют cookie с SameSite=None, у которых нет Secure — они не будут сохранены.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Добавить атрибут Secure',
  'panel.inspector.cookies.insights.hostPrefix.title': 'Нарушен префикс __Host- у {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    'Cookie с префиксом __Host- должны быть Secure, Path=/ и без атрибута Domain. Иначе браузеры их отклоняют.',
  'panel.inspector.cookies.insights.securePrefix.title': 'Нарушен префикс __Secure- у {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    'Cookie с префиксом __Secure- должны нести атрибут Secure. Иначе браузеры их отклоняют.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie с Partitioned без Secure',
      few: '{count} cookie с Partitioned без Secure',
      many: '{count} cookie с Partitioned без Secure',
      other: '{count} cookie с Partitioned без Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Cookie с Partitioned должны быть Secure.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookie установлены по обычному HTTP',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'Эти cookie может наблюдать и воспроизводить любой на пути. Используйте HTTPS + атрибут Secure.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} истёкший cookie всё ещё отправляется',
      few: '{count} истёкших cookie всё ещё отправляются',
      many: '{count} истёкших cookie всё ещё отправляются',
      other: '{count} истёкших cookie всё ещё отправляются',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'Срок этих cookie в прошлом, но запрос их нёс — хранилище вскоре их отбросит.',
  'panel.inspector.cookies.insights.oversized.title': 'Заголовок Cookie — {bytes}B (больше обычного лимита 4KB)',
  'panel.inspector.cookies.insights.oversized.detail':
    'Серверы и посредники ограничивают размер заголовков; слишком большие полезные нагрузки Cookie могут вызывать 4xx / 5xx без внятной ошибки.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Установлен {count} сторонний cookie',
      few: 'Установлено {count} сторонних cookie',
      many: 'Установлено {count} сторонних cookie',
      other: 'Установлено {count} сторонних cookie',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: 'Установлен {count} сторонний cookie от',
      few: 'Установлено {count} сторонних cookie от',
      many: 'Установлено {count} сторонних cookie от',
      other: 'Установлено {count} сторонних cookie от',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Современные браузеры могут блокировать их в межсайтовых контекстах, если они не подключаются к CHIPS через атрибут Partitioned.',
} as const satisfies Catalog;
