/**
 * Script-packages family — French. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key. Raw by
 * design inside keyed sentences: the `oh.require` / `module.exports`
 * API vocabulary (code chips), and {name} holes carrying package
 * names; `package` stays as the dev loanword (m.).
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'Bibliothèque de packages',
  'workbench.scriptPackages.new': 'Nouveau',
  'workbench.scriptPackages.searchPlaceholder': 'Rechercher des packages...',
  'workbench.scriptPackages.emptyNone': 'Aucun package pour le moment',
  'workbench.scriptPackages.emptyNoMatch': 'Aucun package trouvé',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'Réutilisez des scripts entre requêtes avec les packages',
  'workbench.scriptPackages.primer.step1': '1. Créez un package avec du code réutilisable.',
  'workbench.scriptPackages.primer.step2': '2. Exportez les fonctions que vous voulez réutiliser.',
  'workbench.scriptPackages.primer.step3':
    '3. Utilisez oh.require pour charger le package dans vos scripts de requête.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'Nom du package',
  'workbench.scriptPackages.descriptionPlaceholder': 'Description (facultatif)',
  'workbench.scriptPackages.descriptionAria': 'Description du package',
  'workbench.scriptPackages.save': 'Enregistrer',
  'workbench.scriptPackages.deleteTitle': 'Supprimer ce package ?',
  'workbench.scriptPackages.deleteDescription': 'Les scripts qui appellent oh.require dessus commenceront à échouer.',
  'workbench.scriptPackages.delete': 'Supprimer',
  'workbench.scriptPackages.loadFromScriptPrefix': 'Chargez-le depuis un script avec',
  'workbench.scriptPackages.exportViaInfix': '— exportez la surface publique via',
  'workbench.scriptPackages.sourcePlaceholder':
    'Écrivez du JavaScript réutilisable, puis exportez avec module.exports.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': 'Abandonner les modifications non enregistrées ?',
  'workbench.scriptPackages.discardContent':
    'Le package actuel a des modifications non enregistrées. Changer les abandonne.',
  'workbench.scriptPackages.discardOk': 'Abandonner',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': "Le nom du package est requis — c'est la clé oh.require.",
  'workbench.scriptPackages.saved': 'Package enregistré',
  'workbench.scriptPackages.duplicateName': 'Un package nommé « {name} » existe déjà dans cet espace de travail.',
  'workbench.scriptPackages.notFound': 'Package introuvable — il a peut-être été supprimé.',
  'workbench.scriptPackages.saveFailed': "Échec de l'enregistrement",
  'workbench.scriptPackages.deleted': 'Package supprimé',
  'workbench.scriptPackages.deleteFailed': 'Échec de la suppression',
} as const satisfies Catalog;
