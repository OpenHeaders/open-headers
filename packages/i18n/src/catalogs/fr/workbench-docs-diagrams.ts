/**
 * Workbench Docs panel — SVG diagram labels — French. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key. Vocabulary is
 * quoted from the shipped fr catalogs: portée = scope, référence nue =
 * bare reference, occulté = shadowed, l'échelle = the ladder, le
 * parcours = the walk (all from `fr/workbench-docs-variables.ts`);
 * sidebar entry names copy `fr/workbench-chrome-sidebar.ts` verbatim
 * (Vault, Variables d'espace de travail, Variables Live); Exposer =
 * expose and Envoyer = Send reuse the shipped editor mints. Monospace
 * wire fragments and `{{ns.*}}` tokens are whole-raw values copied
 * verbatim. Sample identifiers (staging, production, api_host) ride
 * raw.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables : l'échelle de résolution ─────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    "Une référence nue se résout à travers le vault, l'environnement, la collection, puis l'espace de travail — " +
    'la première correspondance gagne. Live, step, file et dynamic ne sont accessibles que par leur préfixe ' +
    "d'espace de noms.",
  'workbench.docs.diagrams.variables.ladder.title': 'Référence nue — la première portée qui la définit gagne',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'secrets · cet appareil uniquement',
  'workbench.docs.diagrams.variables.ladder.environment': 'Environnement',
  'workbench.docs.diagrams.variables.ladder.environmentSub': "l'actif, puis celui par défaut",
  'workbench.docs.diagrams.variables.ladder.collection': 'Collection',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'collection active uniquement',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Espace de travail',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'partagé avec tout le monde',
  'workbench.docs.diagrams.variables.ladder.miss': 'absent',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'ESPACE DE NOMS SEULEMENT',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'accessibles par préfixe seulement —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'jamais dans le parcours nu',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — le préfixe épingle une portée.',

  // ── Variables : carte de création ───────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Plan de la barre latérale — les variables de collection vivent sur la collection, les environnements sous ' +
    "Environnements, et Vault, Variables d'espace de travail et Variables Live sont des entrées de premier niveau",
  'workbench.docs.diagrams.variables.creation.title': 'Où chaque portée se crée',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'ÉQUIPE PAIEMENTS',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Collections',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ API Paiements',
  'workbench.docs.diagrams.variables.creation.variables': 'Variables',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Environnements',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': "Variables d'espace de travail",
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Variables Live',
  'workbench.docs.diagrams.variables.creation.footer1': 'Les collections portent leur propre page Variables ;',
  'workbench.docs.diagrams.variables.creation.footer2': 'tout le reste est une entrée de la barre latérale.',

  // ── Variables : occultation ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    "api_host défini à la fois dans l'environnement et l'espace de travail — la référence nue se résout sur la " +
    "valeur d'environnement ; la forme à espace de noms lit encore la valeur d'espace de travail",
  'workbench.docs.diagrams.variables.shadowing.title': 'Même nom dans deux portées — la plus haute gagne',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ gagne',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'occultée',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Environnement · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Espace de travail',
  'workbench.docs.diagrams.variables.shadowing.footer': "Le préfixe saute l'échelle et lit une portée directement.",

  // ── Variables : cycle de vie Live ───────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Un Live Workflow exécute ses étapes, publie la capture exposée comme variable live, et les règles et ' +
    'requêtes la consomment ; la planification relance le workflow',
  'workbench.docs.diagrams.variables.live.title': 'Une exécution réussie publie la valeur',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': 'Étape 1 · connexion',
  'workbench.docs.diagrams.variables.live.step2': 'Étape 2 · récupérer le token',
  'workbench.docs.diagrams.variables.live.expose': 'exposer : token',
  'workbench.docs.diagrams.variables.live.runSucceeds': "l'exécution réussit",
  'workbench.docs.diagrams.variables.live.publishes': 'publie',
  'workbench.docs.diagrams.variables.live.rules': 'Règles',
  'workbench.docs.diagrams.variables.live.requests': 'Requêtes',
  'workbench.docs.diagrams.variables.live.autoRefresh': "l'actualisation auto relance",
  'workbench.docs.diagrams.variables.live.footer1': "Enregistrer active le workflow — la valeur n'apparaît qu'après",
  'workbench.docs.diagrams.variables.live.footer2':
    'une exécution réussie, et se rafraîchit selon la planification du workflow.',

  // ── Variables : consommateurs ───────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'Une seule valeur à modèle — Authorization: Bearer token — consommée par les règles, requêtes et workflows',
  'workbench.docs.diagrams.variables.consumers.title': 'Définir une fois, référencer partout',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Règles',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'en-têtes, redirection,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'corps, injection',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': "quand une règle s'applique",
  'workbench.docs.diagrams.variables.consumers.requests': 'Requêtes',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, paramètres,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'en-têtes, auth, corps',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': "à l'envoi",
  'workbench.docs.diagrams.variables.consumers.workflows': 'Workflows',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'chaque étape,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'captures chaînées',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'à chaque exécution',
  'workbench.docs.diagrams.variables.consumers.footer1':
    "Les valeurs sont substituées à l'usage — changez la variable une fois,",
  'workbench.docs.diagrams.variables.consumers.footer2': 'et chaque règle, requête et workflow la reprend.',
} as const satisfies Catalog;
