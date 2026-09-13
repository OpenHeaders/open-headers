/**
 * Resolution-hint family — Russian. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key (core keeps
 * minting the English fallback; see the en header). `{{…}}` reference
 * syntax, namespace ids, `requestDomains`, sha256, punycode ride raw
 * with a head noun (условие, хеш) where a case ending would follow;
 * `Chrome` reads браузер Chrome. The quoted OH navigation labels are
 * minted here and the later ru files quote them verbatim: Окружения =
 * Environments, Переменные рабочего пространства = Workspace
 * Variables, Переменные Live = Live Variables. Mints: чистое имя хоста
 * = bare hostname; схема = scheme; подстановочный знак = wildcard;
 * очистка = sanitization; авторизация = authorization; менеджер
 * секретов = secret manager.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': 'Ссылка пуста. Используйте {{name}} или {{namespace.name}}.',
  'shared.resolutionHint.unknownNamespace':
    'Неизвестное пространство имён. Допустимые пространства имён: env, vault, collection, workspace, file, live, ' +
    'step, dynamic.',
  'shared.resolutionHint.unset.envActive':
    'Задайте эту переменную в разделе «Окружения» → активное окружение (или в окружении по умолчанию как запасной ' +
    'вариант).',
  'shared.resolutionHint.unset.envNoActive':
    'Активное окружение не выбрано. Выберите его в разделе «Окружения» или задайте окружение по умолчанию.',
  'shared.resolutionHint.unset.vault': 'Задайте этот секрет в разделе Vault.',
  'shared.resolutionHint.unset.collection': 'Задайте эту переменную в текущей коллекции.',
  'shared.resolutionHint.unset.workspace': 'Задайте эту переменную в разделе «Переменные рабочего пространства».',
  'shared.resolutionHint.unset.file': 'Ссылайтесь на этот файл по его хешу sha256.',
  'shared.resolutionHint.unset.live':
    'Переменной Live с таким именем нет. Создайте её в разделе «Переменные Live» или дождитесь первого обновления, ' +
    'которое заполнит значение.',
  'shared.resolutionHint.unset.step':
    'Идентификатор шага или имя захвата не найдены в этом запуске рабочего процесса. Проверьте настройку шага ' +
    'рабочего процесса.',
  'shared.resolutionHint.unset.dynamic':
    'Встроенного генератора с таким именем нет. Выберите его из списка подсказок ({{dynamic.uuid}}, ' +
    '{{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': 'Не задана в этой области.',
  'shared.resolutionHint.stepOutOfContext':
    'Ссылки на шаги ({{step.<stepId>.<captureName>}}) допустимы только внутри шага рабочего процесса Live.',
  'shared.resolutionHint.unresolved':
    'Не найдена ни в vault, ни в окружении, ни в коллекции, ни в рабочем пространстве. Определите её в одной из ' +
    'этих областей.',
  'shared.resolutionHint.secretAuthorizationRequired':
    'Менеджеру секретов, хранящему эту запись, требуется авторизация. Разблокируйте или подтвердите доступ в ' +
    'менеджере, затем повторите попытку.',
  'shared.resolutionHint.secretNotFound':
    'Менеджер секретов не нашёл секрет по этой ссылке. Проверьте поля ссылки в записи Vault.',
  'shared.resolutionHint.secretUnavailable':
    'Менеджер секретов для этой записи недоступен на этом устройстве. Установите или настройте его, затем ' +
    'повторите попытку.',
  'shared.resolutionHint.invalidDomain.whitespace':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — содержит пробелы ' +
    '(разделяйте имена хостов запятыми). Используйте чистые имена хостов через запятую.',
  'shared.resolutionHint.invalidDomain.scheme':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — содержит схему — уберите ' +
    'префикс протокола. Используйте чистые имена хостов через запятую.',
  'shared.resolutionHint.invalidDomain.wildcard':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — содержит подстановочный ' +
    'знак — условие requestDomains само сопоставляет поддомены. Используйте чистые имена хостов через запятую.',
  'shared.resolutionHint.invalidDomain.port':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — содержит порт — условие ' +
    'requestDomains сопоставляет только по имени хоста. Используйте чистые имена хостов через запятую.',
  'shared.resolutionHint.invalidDomain.uppercase':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — содержит заглавные ' +
    'символы — условие requestDomains принимает только строчный ASCII. Используйте чистые имена хостов через ' +
    'запятую.',
  'shared.resolutionHint.invalidDomain.nonAscii':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — содержит символы, ' +
    'которые Chrome не принимает (для IDN-имён используйте punycode). Используйте чистые имена хостов через ' +
    'запятую.',
  'shared.resolutionHint.invalidDomain.empty':
    'Переменная разрешилась в значение, которое браузер Chrome не принимает в этом поле — после очистки оно ' +
    'пусто. Используйте чистые имена хостов через запятую.',
} as const satisfies Catalog;
