/**
 * Shared info-popover corpus — Set-Cookie attributes — French. Mirrors
 * `catalogs/en/shared-info-cookies.ts` key for key; attribute names
 * (Domain / Path / Expires / …) are wire vocabulary and stay raw.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Attribut Set-Cookie',
  'shared.info.cookie.fallbackSummary': "Cet attribut n'est pas documenté dans notre registre.",
  'shared.info.cookie.fallbackDescription':
    'Il peut être une extension Set-Cookie propre à un fournisseur ou expérimentale ; les navigateurs ignorent ' +
    "les attributs qu'ils ne reconnaissent pas.",

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary':
    "L'hôte auquel le cookie est envoyé — sous-domaines compris quand il est défini.",
  'shared.info.cookie.domain.body':
    "Sans Domain, le cookie est limité à exactement l'hôte qui a répondu, sous-domaines exclus.",
  'shared.info.cookie.path.summary':
    "Le préfixe de chemin d'URL qui doit être présent pour que le navigateur envoie le cookie.",
  'shared.info.cookie.expires.summary': "Date d'expiration absolue — le cookie persiste jusqu'à ce moment.",
  'shared.info.cookie.expires.body':
    'Sans Expires ni Max-Age, le cookie est un cookie de session, jeté à la fin de la session du navigateur.',
  'shared.info.cookie.maxAge.summary':
    'Durée de vie en secondes à compter de la réception ; prime sur Expires quand les deux sont présents.',
  'shared.info.cookie.maxAge.body':
    'Zéro ou négatif expire le cookie immédiatement — la façon standard de le supprimer.',
  'shared.info.cookie.secure.summary': "Le cookie n'est envoyé que sur des connexions HTTPS.",
  'shared.info.cookie.secure.body':
    'Requis pour les cookies SameSite=None — les navigateurs rejettent les cookies inter-sites sans lui.',
  'shared.info.cookie.httponly.summary':
    'Le cookie est invisible pour le JavaScript de la page (document.cookie) — envoyé sur les requêtes uniquement.',
  'shared.info.cookie.httponly.body': 'Défense standard contre le vol de jeton de session par injection de script.',
  'shared.info.cookie.samesite.summary':
    'Contrôle si le cookie accompagne les requêtes inter-sites : Strict, Lax ou None.',
  'shared.info.cookie.samesite.body':
    'Strict : même site uniquement. Lax (le défaut) : plus les navigations de premier niveau. None : partout, ' +
    'mais exige Secure.',
  'shared.info.cookie.partitioned.summary':
    'Stocke le cookie par site de premier niveau (CHIPS) — un cookie tiers qui ne peut pas pister entre les sites.',
  'shared.info.cookie.priority.summary':
    "Indication d'éviction propre à Chromium (Low / Medium / High) quand la réserve de cookies est pleine.",
} as const satisfies Catalog;
