/**
 * Workbench editors — the GraphQL client editor, French. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}` envelope
 * names, SDL, introspection) rides raw inside keyed values. « schéma »
 * = schema; « explorateur » = explorer; « variables » stays.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'Requête GraphQL introuvable.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': 'Arrêter',
  'workbench.editors.graphql.query.stopTooltip': 'Arrêter la requête et garder ce qui est arrivé',
  'workbench.editors.graphql.operation.placeholder': 'Opération',
  'workbench.editors.graphql.operation.tooltip':
    'L’opération que Query exécute — le document en contient plusieurs ; le choix voyage sur le fil comme operationName.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} erreur', many: '{count} erreurs', other: '{count} erreurs' }),
  'workbench.editors.graphql.response.errorsTitle': 'Erreurs GraphQL',
  'workbench.editors.graphql.response.errorsSummary':
    'Le serveur a répondu HTTP {status} avec une liste errors[] — un champ a échoué, le document a été refusé, ou l’authentification manquait. Lisez data à côté : partiel, ou null.',
  'workbench.editors.graphql.response.dataNull':
    'data est null — chaque champ racine a remonté, ou la requête a été refusée avant exécution.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'Extensions de la réponse',
  'workbench.editors.graphql.response.extensionsSummary':
    'L’objet extensions du serveur voyage à côté de data — traçage, coût, indices de cache, tout ce qu’il a choisi d’attacher.',
  'workbench.editors.graphql.query.hint': 'Le document — une ou plusieurs opérations, fragments bienvenus.',
  'workbench.editors.graphql.query.prettify': 'Embellir',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': 'Autorisation',
  'workbench.editors.graphql.tab.headers': 'En-têtes',
  'workbench.editors.graphql.tab.schema': 'Schéma',
  'workbench.editors.graphql.tab.scripts': 'Scripts',
  'workbench.editors.graphql.tab.settings': 'Paramètres',
  'workbench.editors.graphql.explorer.emptyTitle': 'Explorer les données disponibles sur le serveur',
  'workbench.editors.graphql.explorer.emptyHint':
    'Saisissez l’URL du serveur pour charger le schéma par introspection.',
  'workbench.editors.graphql.explorer.introspect': 'Utiliser l’introspection GraphQL',
  'workbench.editors.graphql.explorer.useSpec': 'Utiliser une spec GraphQL',
  'workbench.editors.graphql.explorer.importSchema': 'Importer un schéma GraphQL',
  'workbench.editors.graphql.explorer.landsWithSchema': 'Arrive avec la tranche schéma.',
  'workbench.editors.graphql.variables.title': 'Variables',
  'workbench.editors.graphql.variables.generate': 'Générer les variables',
  'workbench.editors.graphql.variables.generateHint':
    'Remplir les variables à partir des définitions de variables de l’opération sélectionnée.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'L’opération sélectionnée ne déclare aucune variable.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Chaque opération GraphQL envoie l’enveloppe {query, variables, operationName} en JSON. Ajoutez votre propre ligne Content-Type pour la remplacer.',
  'workbench.editors.graphql.schema.sourceLabel': 'Source du schéma',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Sélectionnez un schéma ou collez un lien vers celui-ci',
  'workbench.editors.graphql.schema.or': 'OU',
  'workbench.editors.graphql.schema.hint':
    'Le schéma alimente l’explorateur, la complétion et la validation — introspecté depuis le serveur via l’authentification et les paramètres de cette requête, lié depuis une spec GraphQL, ou importé depuis un fichier SDL ou d’introspection.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Avant la requête',
  'workbench.editors.graphql.scripts.afterResponse': 'Après la réponse',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Cette requête GraphQL a été supprimée dans un autre onglet.',
  'workbench.editors.graphql.toast.updateFailed': 'L’enregistrement de la requête GraphQL a échoué',
  'workbench.editors.graphql.toast.updateFailedDetail': 'L’enregistrement de la requête GraphQL a échoué : {message}',
} as const satisfies Catalog;
