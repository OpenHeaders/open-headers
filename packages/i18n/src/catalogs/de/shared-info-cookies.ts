/**
 * Shared info-popover corpus — Set-Cookie attributes — German. Mirrors
 * `catalogs/en/shared-info-cookies.ts` key for key. Attribute names
 * (Domain / Path / Expires / Max-Age / SameSite / Strict / Lax / None /
 * Secure / Low / Medium / High) are wire vocabulary and ride raw.
 * Cookie = das Cookie (n., de mint); cookie jar = „Cookie-Glas“ (n.);
 * cross-site = websiteübergreifend (German Chrome vocabulary).
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Set-Cookie-Attribut',
  'shared.info.cookie.fallbackSummary': 'Dieses Attribut ist in unserem Register nicht dokumentiert.',
  'shared.info.cookie.fallbackDescription':
    'Es kann eine anbieterspezifische oder experimentelle Set-Cookie-Erweiterung sein; Browser ignorieren ' +
    'Attribute, die sie nicht erkennen.',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary':
    'Der Host, an den das Cookie gesendet wird — einschließlich Subdomains, wenn gesetzt.',
  'shared.info.cookie.domain.body':
    'Ohne Domain ist das Cookie auf genau den antwortenden Host beschränkt, Subdomains ausgenommen.',
  'shared.info.cookie.path.summary':
    'Das URL-Pfadpräfix, das vorhanden sein muss, damit der Browser das Cookie sendet.',
  'shared.info.cookie.expires.summary': 'Absolutes Ablaufdatum — das Cookie bleibt bis zu diesem Zeitpunkt bestehen.',
  'shared.info.cookie.expires.body':
    'Ohne Expires oder Max-Age ist das Cookie ein Sitzungscookie und wird verworfen, wenn die Browser-Sitzung endet.',
  'shared.info.cookie.maxAge.summary':
    'Lebensdauer in Sekunden ab Empfang; hat Vorrang vor Expires, wenn beide vorhanden sind.',
  'shared.info.cookie.maxAge.body':
    'Null oder ein negativer Wert lässt das Cookie sofort ablaufen — der Standardweg, eines zu löschen.',
  'shared.info.cookie.secure.summary': 'Das Cookie wird nur über HTTPS-Verbindungen gesendet.',
  'shared.info.cookie.secure.body':
    'Erforderlich für SameSite=None-Cookies — Browser lehnen websiteübergreifende Cookies ohne es ab.',
  'shared.info.cookie.httponly.summary':
    'Das Cookie ist für das JavaScript der Seite unsichtbar (document.cookie) — es wird nur mit Anfragen gesendet.',
  'shared.info.cookie.httponly.body': 'Standardschutz gegen den Diebstahl von Sitzungstokens durch Skript-Injektion.',
  'shared.info.cookie.samesite.summary':
    'Steuert, ob das Cookie websiteübergreifende Anfragen begleitet: Strict, Lax oder None.',
  'shared.info.cookie.samesite.body':
    'Strict: nur gleiche Website. Lax (der Standard): zusätzlich Top-Level-Navigationen. None: überall, ' +
    'erfordert aber Secure.',
  'shared.info.cookie.partitioned.summary':
    'Speichert das Cookie pro Top-Level-Website (CHIPS) — ein Drittanbieter-Cookie, das nicht über Websites ' +
    'hinweg tracken kann.',
  'shared.info.cookie.priority.summary':
    'Chromium-spezifischer Verdrängungshinweis (Low / Medium / High) für den Fall, dass das Cookie-Glas voll ist.',
} as const satisfies Catalog;
