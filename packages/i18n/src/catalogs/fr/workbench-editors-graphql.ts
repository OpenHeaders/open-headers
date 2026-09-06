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
  'workbench.editors.graphql.variables.title': 'Variables',
  'workbench.editors.graphql.variables.generate': 'Générer les variables',
  'workbench.editors.graphql.variables.generateHint':
    'Remplir les variables à partir des définitions de variables de l’opération sélectionnée.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'L’opération sélectionnée ne déclare aucune variable.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Chaque opération GraphQL envoie l’enveloppe {query, variables, operationName} en JSON. Ajoutez votre propre ligne Content-Type pour la remplacer.',
  'workbench.editors.graphql.schema.sourceLabel': 'Source du schéma',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Sélectionnez une source de schéma',
  'workbench.editors.graphql.schema.or': 'OU',
  'workbench.editors.graphql.schema.hint':
    'Le schéma alimente l’explorateur, la complétion et la validation — introspecté depuis le serveur via l’authentification et les paramètres de cette requête, lié depuis une spec GraphQL, ou importé depuis un fichier SDL ou d’introspection.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Avant la requête',
  'workbench.editors.graphql.scripts.afterResponse': 'Après la réponse',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Cette requête GraphQL a été supprimée dans un autre onglet.',
  'workbench.editors.graphql.toast.updateFailed': 'L’enregistrement de la requête GraphQL a échoué',
  'workbench.editors.graphql.toast.updateFailedDetail': 'L’enregistrement de la requête GraphQL a échoué : {message}',
  'workbench.editors.graphql.explorer.needsUrl': 'Saisissez d’abord l’URL du point de terminaison.',
  'workbench.editors.graphql.explorer.introspecting': 'Introspection…',
  'workbench.editors.graphql.explorer.search': 'Rechercher des types et des champs',
  'workbench.editors.graphql.explorer.noResults': 'Rien ne correspond à « {term} ».',
  'workbench.editors.graphql.explorer.back': 'Retour',
  'workbench.editors.graphql.explorer.fields': 'Champs',
  'workbench.editors.graphql.explorer.arguments': 'Arguments',
  'workbench.editors.graphql.explorer.values': 'Valeurs',
  'workbench.editors.graphql.explorer.inputFields': 'Champs d’entrée',
  'workbench.editors.graphql.explorer.implements': 'Implémente',
  'workbench.editors.graphql.explorer.possibleTypes': 'Types possibles',
  'workbench.editors.graphql.explorer.returns': 'Retourne',
  'workbench.editors.graphql.explorer.specifiedBy': 'Spécifié par',
  'workbench.editors.graphql.explorer.deprecated': 'Obsolète : {reason}',
  'workbench.editors.graphql.explorer.insert': 'Insérer au curseur',
  'workbench.editors.graphql.explorer.insertHint':
    'Ajoute le champ au document à la position du curseur — ses arguments obligatoires en variables, un jeu de sélection vide s’il retourne un objet. À sens unique : le document reste le vôtre.',
  'workbench.editors.graphql.schema.source.introspection': 'Introspection GraphQL',
  'workbench.editors.graphql.schema.source.spec': 'Spec GraphQL liée',
  'workbench.editors.graphql.schema.refresh': 'Actualiser',
  'workbench.editors.graphql.schema.fetchedAt': 'Introspecté le {when}',
  'workbench.editors.graphql.schema.notIntrospected':
    'Pas encore introspecté — le schéma se charge depuis le point de terminaison avec l’authentification, les en-têtes et les paramètres de cette requête.',
  'workbench.editors.graphql.schema.introspectFailed': 'L’introspection a échoué : {message}',
  'workbench.editors.graphql.schema.specLabel': 'Spec GraphQL',
  'workbench.editors.graphql.schema.specPlaceholder': 'Sélectionnez une spec GraphQL',
  'workbench.editors.graphql.schema.specMissing': 'La spec liée n’existe plus dans cet espace de travail.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} type', many: '{count} types', other: '{count} types' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} problème de schéma',
      many: '{count} problèmes de schéma',
      other: '{count} problèmes de schéma',
    }),
  'workbench.editors.graphql.schema.importReadFailed': 'La lecture du fichier a échoué : {message}',
  'workbench.editors.graphql.schema.importFailed': 'L’import du schéma a échoué',
  'workbench.editors.graphql.schema.imported': '« {name} » importé comme spec GraphQL et lié.',
  'workbench.editors.graphql.explorer.title': 'Explorateur de schéma',
  'workbench.editors.graphql.explorer.hide': 'Masquer l’explorateur',
  'workbench.editors.graphql.explorer.show': 'Afficher l’explorateur',
  'workbench.editors.graphql.explorer.showDescriptions': 'Afficher les descriptions',
  'workbench.editors.graphql.explorer.hideDescriptions': 'Masquer les descriptions',
  'workbench.editors.graphql.builder.broken':
    'Corrigez le document pour utiliser le constructeur — il ne s’analyse pas.',
  'workbench.editors.graphql.builder.otherOperation':
    'L’opération du document est une {operation} — seuls ses champs racine peuvent être sélectionnés ici.',
  'workbench.editors.graphql.builder.expand': 'Développer',
  'workbench.editors.graphql.builder.collapse': 'Réduire',
  'workbench.editors.graphql.builder.fragmentReadOnly':
    'Les fragments sont en lecture seule ici — modifiez-les dans le document.',
  'workbench.editors.graphql.builder.argumentPlaceholder': 'valeur ou $variable',
  'workbench.editors.graphql.builder.invalidValue': 'Ce n’est pas une valeur GraphQL.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} problème', many: '{count} problèmes', other: '{count} problèmes' }),
} as const satisfies Catalog;
