/**
 * Resolution-hint family — French. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key; the en side is
 * byte-faithful to core's `buildHint` — never edit it from here.
 * `{{…}}` reference syntax, namespace ids, `requestDomains` / sha256 /
 * punycode vocabulary stay raw.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': 'La référence est vide. Utilisez {{name}} ou {{namespace.name}}.',
  'shared.resolutionHint.unknownNamespace':
    'Espace de noms inconnu. Espaces de noms valides : env, vault, collection, workspace, file, live, step, ' +
    'dynamic.',
  'shared.resolutionHint.unset.envActive':
    "Définissez cette variable dans Environnements → environnement actif (ou dans l'environnement par défaut " +
    'comme repli).',
  'shared.resolutionHint.unset.envNoActive':
    "Aucun environnement actif n'est sélectionné. Sélectionnez-en un dans Environnements, ou définissez un " +
    'environnement par défaut.',
  'shared.resolutionHint.unset.vault': 'Définissez ce secret dans le Vault.',
  'shared.resolutionHint.unset.collection': 'Définissez cette variable dans la collection actuelle.',
  'shared.resolutionHint.unset.workspace': "Définissez cette variable dans les variables d'espace de travail.",
  'shared.resolutionHint.unset.file':
    'Téléversez ce fichier dans Paramètres → Fichiers (ou référencez-le par son empreinte sha256).',
  'shared.resolutionHint.unset.live':
    'Aucune variable Live de ce nom. Créez-en une dans les variables Live, ou attendez son premier ' +
    'rafraîchissement.',
  'shared.resolutionHint.unset.step':
    "Id d'étape ou nom de capture introuvable dans cette exécution du workflow. Vérifiez la configuration des " +
    'étapes du workflow.',
  'shared.resolutionHint.unset.dynamic':
    'Aucun générateur intégré de ce nom. Choisissez-en un dans la liste de suggestions ({{dynamic.uuid}}, ' +
    '{{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': 'Non définie dans cette portée.',
  'shared.resolutionHint.stepOutOfContext':
    "Les références d'étape ({{step.<stepId>.<captureName>}}) ne sont valides qu'à l'intérieur d'une étape de " +
    'Live Workflow.',
  'shared.resolutionHint.unresolved':
    "Introuvable dans le vault, l'environnement, la collection ou l'espace de travail. Définissez-la dans " +
    'une de ces portées.',
  'shared.resolutionHint.secretAuthorizationRequired':
    'Le gestionnaire de secrets qui détient cette entrée nécessite une autorisation. Déverrouillez ou ' +
    "approuvez l'accès dans le gestionnaire, puis réessayez.",
  'shared.resolutionHint.secretNotFound':
    "Le gestionnaire de secrets n'a trouvé aucun secret à cette référence. Vérifiez les champs de " +
    "référence dans l'entrée du vault.",
  'shared.resolutionHint.secretUnavailable':
    "Le gestionnaire de secrets de cette entrée n'est pas disponible sur cet appareil. Installez-le ou " +
    'configurez-le, puis réessayez.',
  'shared.resolutionHint.invalidDomain.whitespace':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle contient des espaces (séparez ' +
    "les noms d'hôte par des virgules). Utilisez des noms d'hôte nus séparés par des virgules.",
  'shared.resolutionHint.invalidDomain.scheme':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle contient un schéma — retirez ' +
    "le préfixe de protocole. Utilisez des noms d'hôte nus séparés par des virgules.",
  'shared.resolutionHint.invalidDomain.wildcard':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle contient un joker — ' +
    "requestDomains couvre automatiquement les sous-domaines. Utilisez des noms d'hôte nus séparés par des " +
    'virgules.',
  'shared.resolutionHint.invalidDomain.port':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle contient un port — ' +
    "requestDomains ne compare que le nom d'hôte. Utilisez des noms d'hôte nus séparés par des virgules.",
  'shared.resolutionHint.invalidDomain.uppercase':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle contient des majuscules — ' +
    "requestDomains est en ASCII minuscule. Utilisez des noms d'hôte nus séparés par des virgules.",
  'shared.resolutionHint.invalidDomain.nonAscii':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle contient des caractères que ' +
    "Chrome rejette (utilisez punycode pour les noms IDN). Utilisez des noms d'hôte nus séparés par des virgules.",
  'shared.resolutionHint.invalidDomain.empty':
    'La variable se résout en une valeur que Chrome rejette à cet endroit — elle est vide après ' +
    "assainissement. Utilisez des noms d'hôte nus séparés par des virgules.",
} as const satisfies Catalog;
