/**
 * Shared info-popover corpus — Set-Cookie attributes, Russian. Mirrors
 * `catalogs/en/shared-info-cookies.ts` key for key; attribute names
 * (Domain / Path / Expires / Max-Age / SameSite / Secure …) ride raw
 * with атрибут as head noun where a case ending would follow. Mints:
 * файл cookie / cookie = the prose cookie (Latin lowercase, Chrome's
 * ru convention; `Cookie` the header stays raw); хранилище cookie =
 * cookie jar; межсайтовый = cross-site; навигация верхнего уровня =
 * top-level navigation; сторонний = third-party; сеансовый cookie =
 * session cookie.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Атрибут Set-Cookie',
  'shared.info.cookie.fallbackSummary': 'Этот атрибут не описан в нашем реестре.',
  'shared.info.cookie.fallbackDescription':
    'Возможно, это нестандартное или экспериментальное расширение Set-Cookie; браузеры игнорируют атрибуты, ' +
    'которые не распознают.',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary': 'Хост, которому отправляется cookie — включая поддомены, если атрибут задан.',
  'shared.info.cookie.domain.body': 'Без атрибута Domain cookie ограничен строго ответившим хостом, без поддоменов.',
  'shared.info.cookie.path.summary': 'Префикс URL-пути, который должен присутствовать, чтобы браузер отправил cookie.',
  'shared.info.cookie.expires.summary': 'Абсолютная дата истечения — cookie сохраняется до этого момента.',
  'shared.info.cookie.expires.body':
    'Без атрибута Expires или Max-Age cookie является сеансовым и удаляется по окончании сеанса браузера.',
  'shared.info.cookie.maxAge.summary':
    'Время жизни в секундах с момента получения; имеет приоритет над Expires, если заданы оба.',
  'shared.info.cookie.maxAge.body':
    'Ноль или отрицательное значение удаляет cookie немедленно — стандартный способ его удаления.',
  'shared.info.cookie.secure.summary': 'Cookie отправляется только по HTTPS-соединениям.',
  'shared.info.cookie.secure.body':
    'Обязателен для cookie с SameSite=None — без него браузеры отклоняют межсайтовые cookie.',
  'shared.info.cookie.httponly.summary':
    'Cookie невидим для JavaScript страницы (document.cookie) — отправляется только с запросами.',
  'shared.info.cookie.httponly.body': 'Стандартная защита от кражи сеансового токена через внедрение скрипта.',
  'shared.info.cookie.samesite.summary':
    'Определяет, отправляется ли cookie с межсайтовыми запросами: Strict, Lax или None.',
  'shared.info.cookie.samesite.body':
    'Strict: только в пределах сайта. Lax (по умолчанию): плюс навигации верхнего уровня. None: везде, но требует ' +
    'Secure.',
  'shared.info.cookie.partitioned.summary':
    'Хранит cookie отдельно для каждого сайта верхнего уровня (CHIPS) — сторонний cookie, который не может ' +
    'отслеживать между сайтами.',
  'shared.info.cookie.priority.summary':
    'Подсказка Chromium для вытеснения (Low / Medium / High), когда хранилище cookie заполнено.',
} as const satisfies Catalog;
