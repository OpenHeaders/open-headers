/**
 * Shared info-popover corpus — HTTP status codes — Russian. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes, canonical
 * reason phrases and header names (Location, Range, WWW-Authenticate,
 * …) stay raw — only prose translates. Mints: фраза причины = reason
 * phrase (carried from panel-network); перенаправление = redirection;
 * шлюз = gateway; вышестоящий сервер = upstream server; ограничение
 * частоты = rate limit; портал авторизации = captive portal (the ru
 * router / hotspot convention — decided over перехватывающий портал);
 * представление = representation (content negotiation); условный
 * запрос = conditional request; согласование содержимого = content
 * negotiation; промежуточный ответ = interim response; the Body /
 * Authorization tab names ride raw with вкладка as head noun (de / ko
 * precedent). Every raw header name takes заголовок as head noun
 * (заголовок ответа Location, заголовок запроса Range), the протокол /
 * соединение head nouns cover HTTP/2 and WebSocket, and the lowercase-en
 * `cookie` of 431 stays Latin per the ledger.
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'HTTP-статус · {range}',
  'shared.info.status.undocumented':
    'Именно этот код не описан в нашем реестре — диапазон выше даёт его стандартное значение.',
  'shared.info.status.serverPhrase': 'Сервер отправил фразу причины «{statusText}».',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx Информационные',
  'shared.info.status.range1xx.fallback':
    'Промежуточный ответ — обмен ещё продолжается, окончательный статус последует.',
  'shared.info.status.range2xx.kicker': '2xx Успех',
  'shared.info.status.range2xx.fallback': 'Запрос получен, понят и принят.',
  'shared.info.status.range3xx.kicker': '3xx Перенаправление',
  'shared.info.status.range3xx.fallback':
    'Для завершения запроса нужны дальнейшие действия — посмотрите заголовок ответа Location.',
  'shared.info.status.range4xx.kicker': '4xx Ошибка клиента',
  'shared.info.status.range4xx.fallback':
    'Сервер отклонил запрос в том виде, в каком он отправлен, — что-то в запросе нужно изменить.',
  'shared.info.status.range5xx.kicker': '5xx Ошибка сервера',
  'shared.info.status.range5xx.fallback':
    'Сервер не смог выполнить, по-видимому, корректный запрос — проблема на стороне сервера.',
  'shared.info.status.rangeOther.kicker': 'Нестандартный',
  'shared.info.status.rangeOther.fallback': 'Этот код вне стандартных диапазонов HTTP-статусов.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    'Промежуточный ответ — сервер получил заголовки запроса, и клиенту следует перейти к отправке тела.',
  'shared.info.status.s101.summary':
    'Сервер согласился сменить протокол, как запрошено через заголовок Upgrade (например, на WebSocket).',
  'shared.info.status.s102.summary': 'Промежуточный ответ WebDAV — сервер принял запрос, но ещё не завершил его.',
  'shared.info.status.s103.summary':
    'Промежуточный ответ с заголовками (обычно предзагрузки Link) до окончательного ответа.',
  'shared.info.status.s200.summary': 'Запрос выполнен успешно, результат — в теле ответа.',
  'shared.info.status.s201.summary': 'Запрос выполнен успешно, создан новый ресурс.',
  'shared.info.status.s201.body': 'Заголовок ответа Location обычно указывает на новый ресурс.',
  'shared.info.status.s202.summary': 'Запрос принят в обработку, но обработка ещё не завершена.',
  'shared.info.status.s202.body':
    'Обычно для асинхронных задач — результат нужно запросить позже, часто по URL-адресу статуса из тела.',
  'shared.info.status.s203.summary': 'Ответ успешен, но изменён преобразующим прокси между сервером и клиентом.',
  'shared.info.status.s204.summary': 'Запрос выполнен успешно, и тело ответа намеренно отсутствует.',
  'shared.info.status.s204.body': 'Пустая вкладка Body здесь ожидаема, это не ошибка.',
  'shared.info.status.s205.summary':
    'Запрос выполнен успешно, и клиенту следует сбросить отправившее его представление (например, очистить форму).',
  'shared.info.status.s206.summary': 'Сервер вернул только диапазон байтов, запрошенный через заголовок запроса Range.',
  'shared.info.status.s206.body': 'Content-Range описывает, какой фрагмент полного ресурса содержит это тело.',
  'shared.info.status.s207.summary': 'Пакетный ответ WebDAV — тело содержит отдельный статус для каждой подоперации.',
  'shared.info.status.s208.summary': 'WebDAV — этот элемент уже был перечислен ранее в том же мультистатусном ответе.',
  'shared.info.status.s226.summary':
    'Ответ — это разница (манипуляция экземпляром) относительно предыдущей версии, а не полный ресурс.',
  'shared.info.status.s300.summary': 'Доступно более одного представления, и сервер не выбирает ни одно из них.',
  'shared.info.status.s301.summary': 'Ресурс окончательно перемещён на URL-адрес из заголовка Location.',
  'shared.info.status.s301.body': 'Клиенты и кеши это запоминают; обновите URL-адрес запроса на новый адрес.',
  'shared.info.status.s302.summary': 'Ресурс временно находится по URL-адресу из заголовка Location.',
  'shared.info.status.s302.body':
    'Браузеры при переходе обычно меняют метод на GET — используйте 307, чтобы сохранить метод.',
  'shared.info.status.s303.summary':
    'Результат находится по URL-адресу из Location, и его следует запросить методом GET.',
  'shared.info.status.s303.body': 'Типично после POST — перенаправление на созданную или результирующую страницу.',
  'shared.info.status.s304.summary': 'Кешированная копия всё ещё актуальна — сервер намеренно не отправил тело.',
  'shared.info.status.s304.body': 'Отправляется в ответ на условные запросы (If-None-Match / If-Modified-Since).',
  'shared.info.status.s305.summary':
    'Устарел — к ресурсу нужно обращаться через прокси из Location. Современные клиенты его игнорируют.',
  'shared.info.status.s307.summary':
    'Временно по URL-адресу из Location; при переходе метод и тело должны сохраняться.',
  'shared.info.status.s308.summary':
    'Окончательно по URL-адресу из Location; при переходе метод и тело должны сохраняться.',
  'shared.info.status.s400.summary': 'Сервер не смог разобрать или принять запрос в том виде, в каком он отправлен.',
  'shared.info.status.s400.body':
    'Проверьте синтаксис тела, параметры запроса и обязательные заголовки — тело ответа часто называет проблемное поле.',
  'shared.info.status.s401.summary': 'В запросе нет действительных учётных данных для аутентификации.',
  'shared.info.status.s401.body':
    'Заголовок ответа WWW-Authenticate называет ожидаемую схему. Проверьте вкладку Authorization / свежесть токена.',
  'shared.info.status.s402.summary':
    'Зарезервированный код; некоторые API используют его для квот или лимитов биллинга.',
  'shared.info.status.s403.summary': 'Сервер понял запрос и учётные данные, но отказывается его разрешить.',
  'shared.info.status.s403.body':
    'В отличие от 401, повторная аутентификация не поможет — у этой учётной записи нет прав на этот ресурс.',
  'shared.info.status.s404.summary': 'По этому URL-адресу нет ресурса (или сервер скрывает, существует ли он).',
  'shared.info.status.s404.body':
    'Проверьте путь и идентификаторы в нём; некоторые API возвращают 404 вместо 403, чтобы не раскрывать существование ресурса.',
  'shared.info.status.s405.summary': 'Ресурс существует, но не для этого HTTP-метода.',
  'shared.info.status.s405.body': 'Заголовок ответа Allow перечисляет методы, которые принимает этот URL-адрес.',
  'shared.info.status.s406.summary': 'Сервер не может выдать представление, соответствующее заголовкам запроса Accept.',
  'shared.info.status.s407.summary':
    'Прокси между вами и сервером требует учётные данные (схему называет Proxy-Authenticate).',
  'shared.info.status.s408.summary': 'Сервер перестал ждать остаток запроса и закрыл обмен.',
  'shared.info.status.s409.summary': 'Запрос конфликтует с текущим состоянием ресурса.',
  'shared.info.status.s409.body':
    'Типично для одновременных правок или повторного создания — перечитайте ресурс и повторите попытку.',
  'shared.info.status.s410.summary': 'Ресурс существовал, но был намеренно и окончательно удалён.',
  'shared.info.status.s411.summary':
    'Сервер требует заголовок Content-Length и отклоняет тела по частям или без указанного размера.',
  'shared.info.status.s412.summary':
    'Условный заголовок (If-Match, If-Unmodified-Since, …) не выполнился, и сервер отказался действовать.',
  'shared.info.status.s413.summary': 'Тело запроса превышает то, что принимает сервер.',
  'shared.info.status.s414.summary':
    'URL-адрес запроса превышает предел сервера — обычно это данные строки запроса, которым место в теле.',
  'shared.info.status.s415.summary': 'Сервер отклоняет формат тела.',
  'shared.info.status.s415.body': 'Сверьте заголовок запроса Content-Type с тем, чего ожидает API.',
  'shared.info.status.s416.summary': 'Заголовок запроса Range запрашивает байты за пределами ресурса.',
  'shared.info.status.s417.summary':
    'Сервер не может выполнить заголовок запроса Expect (обычно Expect: 100-continue).',
  'shared.info.status.s418.summary': 'Первоапрельский код из RFC; некоторые API используют его как шутливый отказ.',
  'shared.info.status.s421.summary':
    'Запрос попал на сервер, который не настроен отвечать за этот authority (обычно при переиспользовании соединений HTTP/2).',
  'shared.info.status.s422.summary': 'Тело синтаксически корректно, но семантически неверно — валидация не пройдена.',
  'shared.info.status.s422.body': 'Тело ответа обычно перечисляет ошибки валидации по полям.',
  'shared.info.status.s423.summary': 'WebDAV — ресурс заблокирован другой операцией.',
  'shared.info.status.s424.summary':
    'WebDAV — действие не выполнено, потому что не выполнилось более раннее действие, от которого оно зависело.',
  'shared.info.status.s425.summary':
    'Сервер отказывается обрабатывать запрос, который может быть воспроизведён повторно (ранние данные TLS).',
  'shared.info.status.s426.summary': 'Сервер настаивает на другом протоколе — его называет заголовок ответа Upgrade.',
  'shared.info.status.s428.summary':
    'Сервер требует условный заголовок (обычно If-Match), чтобы предотвратить потерю обновлений.',
  'shared.info.status.s429.summary': 'Достигнуто ограничение частоты — сбавьте темп.',
  'shared.info.status.s429.body':
    'Заголовок ответа Retry-After (если есть) говорит, сколько ждать; многие API также отправляют заголовки RateLimit-*.',
  'shared.info.status.s431.summary':
    'Заголовок запроса (или все вместе) превышает предел размера сервера — часто это слишком большой cookie.',
  'shared.info.status.s451.summary':
    'Сервер отказывает в доступе по юридическим причинам (цензура, судебное решение, удаление по GDPR).',
  'shared.info.status.s500.summary': 'Сервер столкнулся с непредвиденной ситуацией — сбой на стороне сервера.',
  'shared.info.status.s500.body':
    'Повтор может помочь, если сбой временный; иначе исправление ищите в журналах сервера, а не в запросе.',
  'shared.info.status.s501.summary':
    'Сервер не поддерживает требуемую функциональность — часто это нераспознанный метод.',
  'shared.info.status.s502.summary': 'Шлюз или прокси получил недопустимый ответ от вышестоящего сервера.',
  'shared.info.status.s502.body': 'Исходный сервер за прокси не работает или недоступен — обычно временно.',
  'shared.info.status.s503.summary': 'Сервер временно не может обработать запрос (перегрузка или обслуживание).',
  'shared.info.status.s503.body': 'Retry-After (если есть) говорит, когда повторить попытку.',
  'shared.info.status.s504.summary': 'Шлюз или прокси не дождался ответа от вышестоящего сервера.',
  'shared.info.status.s505.summary': 'Сервер отклоняет версию протокола HTTP, использованную в запросе.',
  'shared.info.status.s506.summary':
    'Ошибка конфигурации сервера при согласовании содержимого — выбранный вариант согласует сам себя.',
  'shared.info.status.s507.summary': 'WebDAV — сервер не может сохранить то, чего требует запрос.',
  'shared.info.status.s508.summary': 'WebDAV — сервер обнаружил бесконечный цикл при обработке запроса.',
  'shared.info.status.s510.summary': 'Запросу нужно дополнительное расширение, чтобы сервер мог его выполнить.',
  'shared.info.status.s511.summary':
    'Сеть (обычно портал авторизации) требует аутентификации, прежде чем предоставить доступ.',
} as const satisfies Catalog;
