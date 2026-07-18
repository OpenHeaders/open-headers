/**
 * Workbench editors — the API spec editor, French. Outline group
 * labels mirror the document's own keywords (`paths:`, `components:`,
 * `schemas:`, AsyncAPI `channels:`/`operations:`, proto
 * `package`/`import`/`service`/`message`/`enum`) and ride raw; `Files`
 * is app grouping and translates. The AsyncAPI Send/Receive badges
 * mirror the document's `action` enum and stay raw — a different
 * referent from the Send button mint `Envoyer`. Add-item actions and
 * running prose translate (« chemin », « canaux », « schémas »).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': 'Spécification introuvable.',
  'workbench.editors.spec.deletedElsewhere': 'Cette spécification a été supprimée dans une autre session.',
  'workbench.editors.spec.saveFailed': "Impossible d'enregistrer la spécification.",
  'workbench.editors.spec.validation.clean': 'Aucun problème détecté',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} erreur', many: '{count} erreurs', other: '{count} erreurs' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} avertissement',
      many: '{count} avertissements',
      other: '{count} avertissements',
    }),
  'workbench.editors.spec.outline.title': "Vue d'ensemble",
  'workbench.editors.spec.outline.show': "Afficher la vue d'ensemble",
  'workbench.editors.spec.outline.hide': "Masquer la vue d'ensemble",
  'workbench.editors.spec.outline.empty': 'Le plan apparaît une fois le document analysé.',
  'workbench.editors.spec.outline.rootBadge': 'RACINE',
  'workbench.editors.spec.outline.makeRoot': 'Marquer comme fichier racine',
  'workbench.editors.spec.outline.fileMenuAria': 'Actions sur le fichier',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.files': 'Fichiers',
  'workbench.editors.spec.outline.streaming.unary': 'Unaire',
  'workbench.editors.spec.outline.streaming.server': 'Streaming serveur',
  'workbench.editors.spec.outline.streaming.client': 'Streaming client',
  'workbench.editors.spec.outline.streaming.bidi': 'Streaming bidirectionnel',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'Ajouter un serveur',
  'workbench.editors.spec.outline.add.tag': 'Ajouter un tag',
  'workbench.editors.spec.outline.add.path': 'Ajouter un chemin',
  'workbench.editors.spec.outline.add.operation': 'Ajouter une opération',
  'workbench.editors.spec.outline.add.schema': 'Ajouter un schéma',
  'workbench.editors.spec.outline.add.securityScheme': 'Ajouter un schéma de sécurité',
  'workbench.editors.spec.outline.add.securityRequirement': 'Ajouter une exigence de sécurité',
  'workbench.editors.spec.generate.button': 'Générer la collection',
  'workbench.editors.spec.generate.collectionsButton': 'Collections',
  'workbench.editors.spec.generate.popoverTitle': 'Collections générées',
  'workbench.editors.spec.generate.modalTitle': 'GÉNÉRER LA COLLECTION',
  'workbench.editors.spec.generate.blurb':
    'Générez une collection à partir de cette spécification. Les opérations deviennent des requêtes sous une ' +
    'variable de collection baseUrl, les tags deviennent des dossiers et les schémas de sécurité se transposent ' +
    'en authentification. La collection reste liée à cette spécification.',
  'workbench.editors.spec.generate.namePlaceholder': 'Nom de la collection',
  'workbench.editors.spec.generate.nameRequired': 'La collection doit avoir un nom',
  'workbench.editors.spec.generate.dirtyHint':
    "Les modifications non enregistrées de l'éditeur ne sont pas incluses — la génération utilise le dernier " +
    'document enregistré.',
  'workbench.editors.spec.generate.parseFailed': "Cette spécification ne s'analyse pas",
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} dossier', many: '{count} dossiers', other: '{count} dossiers' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable de collection',
      many: '{count} variables de collection',
      other: '{count} variables de collection',
    }),
  'workbench.editors.spec.generate.action': 'Générer',
  'workbench.editors.spec.generate.success': '« {name} » générée — {summary}',
  'workbench.editors.spec.generate.failed': 'Impossible de créer la collection.',
  'workbench.editors.spec.generate.linkFailed':
    "La collection a été générée, mais l'enregistrement de son lien vers la spécification a échoué — elle " +
    "n'apparaîtra pas dans cette liste.",
  'workbench.editors.spec.generateProto.blurb':
    'Générez une collection à partir de cette spécification. Les méthodes de service deviennent des requêtes ' +
    "gRPC avec leurs messages d'exemple pré-remplis, groupées dans un dossier par service. La collection reste " +
    'liée à cette spécification.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} requête gRPC',
      many: '{count} requêtes gRPC',
      other: '{count} requêtes gRPC',
    }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} service', many: '{count} services', other: '{count} services' }),
  'workbench.editors.spec.generateProto.empty':
    'Le document ne déclare aucune méthode de service à partir de laquelle générer.',
  'workbench.editors.spec.generateProto.partial': 'Génération incomplète — {created} créées, {failed} en échec.',
  'workbench.editors.spec.update.button': 'Mettre à jour',
  'workbench.editors.spec.update.protoUnavailable':
    "La mise à jour depuis une spécification Protobuf n'est pas encore disponible — générez une nouvelle " +
    'collection pour récupérer les changements.',
  'workbench.editors.spec.update.inSyncBadge': 'Synchronisée avec le document enregistré',
  'workbench.editors.spec.update.driftedBadge': 'La spécification a changé depuis la dernière mise à jour',
  'workbench.editors.spec.update.modalTitle': 'METTRE À JOUR LA COLLECTION',
  'workbench.editors.spec.update.blurb':
    'Passez en revue les différences entre le document enregistré et « {name} », puis appliquez les mises à ' +
    'jour sélectionnées. Les lignes non cochées restent inchangées.',
  'workbench.editors.spec.update.dirtyHint':
    "Les modifications non enregistrées de l'éditeur ne sont pas incluses — la mise à jour utilise le dernier " +
    'document enregistré.',
  'workbench.editors.spec.update.parseFailed': "Cette spécification ne s'analyse pas",
  'workbench.editors.spec.update.inSync':
    'Aucune différence au niveau des requêtes — appliquer marque la collection comme synchronisée avec le ' +
    'document enregistré.',
  'workbench.editors.spec.update.groupAdded': 'Ajoutées ({count})',
  'workbench.editors.spec.update.groupChanged': 'Modifiées ({count})',
  'workbench.editors.spec.update.groupRemoved': 'Retirées de la spécification ({count})',
  'workbench.editors.spec.update.removeHint': 'Les requêtes non cochées restent dans la collection.',
  'workbench.editors.spec.update.groupCollection': 'Collection',
  'workbench.editors.spec.update.variablesRow': 'Variables de collection',
  'workbench.editors.spec.update.authRow': 'Authentification de la collection',
  'workbench.editors.spec.update.field.name': 'nom',
  'workbench.editors.spec.update.field.description': 'description',
  'workbench.editors.spec.update.field.headers': 'en-têtes',
  'workbench.editors.spec.update.field.params': 'paramètres',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'corps',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Appliquer {count} mise à jour',
      many: 'Appliquer {count} mises à jour',
      other: 'Appliquer {count} mises à jour',
    }),
  'workbench.editors.spec.update.markInSync': 'Marquer comme synchronisée',
  'workbench.editors.spec.update.hashNote':
    'Appliquer enregistre cette version du document sur le lien de la collection ; le lien se lit donc comme ' +
    'synchronisé même si des lignes sont restées non cochées.',
  'workbench.editors.spec.update.success': '« {name} » mise à jour — {count} appliquées',
  'workbench.editors.spec.update.partial':
    "{applied} appliquées, {failed} en échec — la collection peut n'être que partiellement mise à jour.",
  'workbench.editors.spec.update.failed': 'Impossible de mettre à jour la collection.',
} as const satisfies Catalog;
