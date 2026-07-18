/**
 * Shared info-popover corpus — Set-Cookie attributes — Spanish.
 * Mirrors `catalogs/en/shared-info-cookies.ts` key for key. Attribute
 * names (Domain / Path / Expires / Max-Age / SameSite / Strict / Lax /
 * None / Secure / Low / Medium / High) are wire vocabulary and ride
 * raw. Cookie jar = « tarro de cookies » (m., es mint).
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Atributo de Set-Cookie',
  'shared.info.cookie.fallbackSummary': 'Este atributo no está documentado en nuestro registro.',
  'shared.info.cookie.fallbackDescription':
    'Puede ser una extensión de Set-Cookie experimental o específica de un proveedor; los navegadores ignoran ' +
    'los atributos que no reconocen.',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary':
    'El host al que se envía la cookie — incluidos los subdominios cuando está definido.',
  'shared.info.cookie.domain.body':
    'Sin Domain, la cookie queda limitada exactamente al host que respondió, excluidos los subdominios.',
  'shared.info.cookie.path.summary':
    'El prefijo de ruta de URL que debe estar presente para que el navegador envíe la cookie.',
  'shared.info.cookie.expires.summary': 'Fecha de caducidad absoluta — la cookie persiste hasta ese momento.',
  'shared.info.cookie.expires.body':
    'Sin Expires ni Max-Age la cookie es una cookie de sesión, descartada cuando termina la sesión del navegador.',
  'shared.info.cookie.maxAge.summary':
    'Duración en segundos desde la recepción; tiene prioridad sobre Expires cuando ambos están presentes.',
  'shared.info.cookie.maxAge.body': 'Cero o negativo caduca la cookie de inmediato — la forma estándar de eliminarla.',
  'shared.info.cookie.secure.summary': 'La cookie solo se envía por conexiones HTTPS.',
  'shared.info.cookie.secure.body':
    'Obligatorio para las cookies SameSite=None — los navegadores rechazan las cookies entre sitios sin él.',
  'shared.info.cookie.httponly.summary':
    'La cookie es invisible para el JavaScript de la página (document.cookie) — solo se envía en las solicitudes.',
  'shared.info.cookie.httponly.body':
    'Defensa estándar contra el robo de tokens de sesión mediante inyección de scripts.',
  'shared.info.cookie.samesite.summary': 'Controla si la cookie viaja en solicitudes entre sitios: Strict, Lax o None.',
  'shared.info.cookie.samesite.body':
    'Strict: solo mismo sitio. Lax (el valor por defecto): además navegaciones de nivel superior. None: en ' +
    'todas partes, pero requiere Secure.',
  'shared.info.cookie.partitioned.summary':
    'Almacena la cookie por sitio de nivel superior (CHIPS) — una cookie de terceros que no puede rastrear ' +
    'entre sitios.',
  'shared.info.cookie.priority.summary':
    'Sugerencia de expulsión específica de Chromium (Low / Medium / High) para cuando el tarro de cookies ' +
    'está lleno.',
} as const satisfies Catalog;
