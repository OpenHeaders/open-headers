/**
 * Shared info-popover corpus — Set-Cookie attributes, Romanian. Mirrors
 * `catalogs/en/shared-info-cookies.ts` key for key; attribute names
 * (Domain / Path / Expires / Max-Age / Secure / SameSite / Strict / Lax
 * / None / CHIPS) ride raw as wire vocabulary. Mints: cookie de sesiune
 * = session cookie; cross-site raw as the web term (cereri cross-site);
 * navigări de nivel superior = top-level navigations; terț = third-party;
 * depozitul de cookie-uri = cookie jar; evacuare = eviction.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Atribut Set-Cookie',
  'shared.info.cookie.fallbackSummary': 'Acest atribut nu este documentat în registrul nostru.',
  'shared.info.cookie.fallbackDescription':
    'Poate fi o extensie Set-Cookie specifică unui furnizor sau experimentală; browserele ignoră atributele pe care nu le recunosc.',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary':
    'Gazda către care este trimis cookie-ul — inclusiv subdomeniile, când este setat.',
  'shared.info.cookie.domain.body':
    'Fără Domain, cookie-ul este limitat exact la gazda care a răspuns, fără subdomenii.',
  'shared.info.cookie.path.summary':
    'Prefixul de cale din adresa URL care trebuie să fie prezent pentru ca browserul să trimită cookie-ul.',
  'shared.info.cookie.expires.summary': 'Data absolută de expirare — cookie-ul persistă până în acel moment.',
  'shared.info.cookie.expires.body':
    'Fără Expires sau Max-Age, cookie-ul este un cookie de sesiune, eliminat la încheierea sesiunii de browser.',
  'shared.info.cookie.maxAge.summary':
    'Durata de viață în secunde de la primire; are prioritate față de Expires când sunt prezente ambele.',
  'shared.info.cookie.maxAge.body':
    'Zero sau o valoare negativă expiră cookie-ul imediat — modul standard de a șterge unul.',
  'shared.info.cookie.secure.summary': 'Cookie-ul este trimis doar prin conexiuni HTTPS.',
  'shared.info.cookie.secure.body':
    'Obligatoriu pentru cookie-urile SameSite=None — browserele resping cookie-urile cross-site fără el.',
  'shared.info.cookie.httponly.summary':
    'Cookie-ul este invizibil pentru JavaScript din pagină (document.cookie) — trimis doar cu cererile.',
  'shared.info.cookie.httponly.body':
    'Apărare standard împotriva furtului tokenului de sesiune prin injectare de script.',
  'shared.info.cookie.samesite.summary':
    'Controlează dacă cookie-ul însoțește cererile cross-site: Strict, Lax sau None.',
  'shared.info.cookie.samesite.body':
    'Strict: doar același site. Lax (implicit): plus navigările de nivel superior. None: oriunde, dar necesită Secure.',
  'shared.info.cookie.partitioned.summary':
    'Stochează cookie-ul per site de nivel superior (CHIPS) — un cookie terț care nu poate urmări între site-uri.',
  'shared.info.cookie.priority.summary':
    'Indiciu de evacuare specific Chromium (Low / Medium / High) pentru când depozitul de cookie-uri este plin.',
} as const satisfies Catalog;
