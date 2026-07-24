/**
 * Shared namespace — French. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Enregistrer',
  'shared.action.cancel': 'Annuler',
  'shared.action.close': 'Fermer',
  'shared.action.copy': 'Copier',
  'shared.action.remove': 'Retirer',
  'shared.toast.copiedToClipboard': 'Copié dans le presse-papiers',
  'shared.toast.copyFailed': 'Accès au presse-papiers refusé — copiez la valeur manuellement',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} règle', many: '{count} règles', other: '{count} règles' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': 'Une erreur est survenue',
  'shared.errorBoundary.subtitle': 'Le chargement du popup a échoué. Fermez-le puis rouvrez-le.',
  'shared.errorBoundary.reload': 'Recharger',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Open Headers a été mis à jour ou rechargé',
  'shared.contextInvalidated.body': 'Fermez puis rouvrez DevTools pour continuer.',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': 'Connexion OK',
  'shared.probe.reachableDescription': '{label} est joignable.',
  'shared.probe.notReachable': 'Injoignable',
  'shared.probe.title.authRequired': 'Joignable, mais authentification requise',
  'shared.probe.title.workspaceUnknown': "Joignable, mais l'espace de travail n'est pas partagé",
  'shared.probe.title.versionMismatch': 'Joignable, mais versions incompatibles',
  'shared.probe.title.notReady': 'Joignable, mais pas prêt',
  'shared.probe.fail.invalidUrl': 'URL invalide.',
  'shared.probe.fail.invalidUrlDetail': 'URL invalide. {detail}',
  'shared.probe.fail.timeout': "Délai d'attente dépassé — le back-end est-il lancé ?",
  'shared.probe.fail.closedBeforeWelcome':
    "Connexion fermée avant la négociation — le back-end n'est probablement pas lancé sur ce port.",
  'shared.probe.fail.openFailed': "Impossible d'ouvrir la connexion WebSocket.",
  'shared.probe.fail.openFailedDetail': "Impossible d'ouvrir la connexion WebSocket : {detail}.",
  'shared.probe.fail.protocolMismatch':
    'Joignable, mais les versions de protocole sont incompatibles — mettez à jour les deux applications.',
  'shared.probe.fail.workspaceUnknown':
    "Joignable — le back-end est actif mais ne partage pas encore cet espace de travail. Changer d'espace associera les deux.",
  'shared.probe.fail.protocolTooOld':
    'Joignable — mais cette application est plus ancienne que le back-end. Mettez à jour ce côté.',
  'shared.probe.fail.protocolTooNew':
    'Joignable — mais le back-end est plus ancien que cette application. Mettez à jour le back-end.',
  'shared.probe.fail.authRequired':
    "Joignable — mais cet appareil n'est pas encore authentifié. Associez-le avec un code ou collez un jeton ci-dessus, puis changez d'espace.",
  'shared.probe.fail.rejected': 'Rejeté : {reason}',
  'shared.probe.fail.rejectedUnknown': 'Rejeté : raison inconnue',
  'shared.probe.fail.malformedWelcome': 'Un serveur a répondu, mais il ne parle pas le protocole Open Headers.',
  'shared.probe.fail.generic': 'Échec du test de connexion.',
} as const satisfies Catalog;
