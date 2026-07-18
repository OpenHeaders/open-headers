/**
 * Shared info-popover corpus — HTTP status codes — French. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes and canonical
 * reason phrases stay raw — only prose translates.
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'Statut HTTP · {range}',
  'shared.info.status.undocumented':
    "Ce code exact n'est pas documenté dans notre registre — la plage ci-dessus donne son sens standard.",
  'shared.info.status.serverPhrase': 'Le serveur a envoyé la raison « {statusText} ».',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx Information',
  'shared.info.status.range1xx.fallback':
    "Réponse intermédiaire — l'échange est toujours en cours et un statut final suivra.",
  'shared.info.status.range2xx.kicker': '2xx Succès',
  'shared.info.status.range2xx.fallback': 'La requête a été reçue, comprise et acceptée.',
  'shared.info.status.range3xx.kicker': '3xx Redirection',
  'shared.info.status.range3xx.fallback':
    "Une action supplémentaire est nécessaire pour compléter la requête — regardez l'en-tête de réponse Location.",
  'shared.info.status.range4xx.kicker': '4xx Erreur client',
  'shared.info.status.range4xx.fallback':
    'Le serveur a rejeté la requête telle quelle — quelque chose dans la requête doit changer.',
  'shared.info.status.range5xx.kicker': '5xx Erreur serveur',
  'shared.info.status.range5xx.fallback':
    "Le serveur n'a pas réussi à satisfaire une requête apparemment valide — la faute est côté serveur.",
  'shared.info.status.rangeOther.kicker': 'Non standard',
  'shared.info.status.rangeOther.fallback': 'Ce code est en dehors des plages de statut HTTP standard.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    'Réponse intermédiaire — le serveur a reçu les en-têtes de la requête et le client devrait envoyer le corps.',
  'shared.info.status.s101.summary':
    "Le serveur a accepté de changer de protocole comme demandé via l'en-tête Upgrade (p. ex. vers WebSocket).",
  'shared.info.status.s102.summary':
    "Réponse WebDAV intermédiaire — le serveur a accepté la requête mais ne l'a pas encore terminée.",
  'shared.info.status.s103.summary':
    'Réponse intermédiaire portant des en-têtes (typiquement des préchargements Link) avant la réponse finale.',
  'shared.info.status.s200.summary': 'La requête a réussi et la réponse porte le résultat dans son corps.',
  'shared.info.status.s201.summary': 'La requête a réussi et une nouvelle ressource a été créée.',
  'shared.info.status.s201.body': "L'en-tête de réponse Location pointe généralement vers la nouvelle ressource.",
  'shared.info.status.s202.summary': "La requête a été acceptée pour traitement, mais le traitement n'est pas terminé.",
  'shared.info.status.s202.body':
    'Courant pour les travaux asynchrones — le résultat doit être récupéré plus tard, souvent via une URL de ' +
    'statut dans le corps.',
  'shared.info.status.s203.summary':
    'La réponse a réussi mais a été modifiée par un proxy transformant entre le serveur et le client.',
  'shared.info.status.s204.summary': "La requête a réussi et il n'y a délibérément pas de corps de réponse.",
  'shared.info.status.s204.body': 'Un onglet Body vide est attendu ici, pas une erreur.',
  'shared.info.status.s205.summary':
    "La requête a réussi et le client devrait réinitialiser la vue qui l'a envoyée (p. ex. vider le formulaire).",
  'shared.info.status.s206.summary':
    "Le serveur n'a renvoyé que la plage d'octets demandée via l'en-tête de requête Range.",
  'shared.info.status.s206.body': 'Content-Range décrit quelle tranche de la ressource complète est ce corps.',
  'shared.info.status.s207.summary':
    'Réponse groupée WebDAV — le corps porte un statut distinct pour chaque sous-opération.',
  'shared.info.status.s208.summary': 'WebDAV — ce membre a déjà été listé plus tôt dans la même réponse multi-statut.',
  'shared.info.status.s226.summary':
    "La réponse est un diff (manipulation d'instance) par rapport à une version antérieure, pas la ressource " +
    'complète.',
  'shared.info.status.s300.summary': "Plusieurs représentations sont disponibles et le serveur n'en choisit pas une.",
  'shared.info.status.s301.summary': "La ressource a déménagé définitivement vers l'URL de l'en-tête Location.",
  'shared.info.status.s301.body':
    "Les clients et les caches le retiennent ; mettez à jour l'URL de requête vers la nouvelle adresse.",
  'shared.info.status.s302.summary': "La ressource est temporairement à l'URL de l'en-tête Location.",
  'shared.info.status.s302.body':
    'Les navigateurs réécrivent couramment la méthode en GET en la suivant — utilisez 307 pour préserver la ' +
    'méthode.',
  'shared.info.status.s303.summary': "Le résultat se trouve à l'URL de Location et devrait être récupéré avec GET.",
  'shared.info.status.s303.body': 'Typique après un POST, redirigeant vers la page créée ou résultante.',
  'shared.info.status.s304.summary':
    "La copie en cache est toujours valide — le serveur n'a volontairement pas envoyé de corps.",
  'shared.info.status.s304.body': 'Envoyé en réponse aux requêtes conditionnelles (If-None-Match / If-Modified-Since).',
  'shared.info.status.s305.summary':
    "Déprécié — la ressource doit être accédée via le proxy de Location. Les clients modernes l'ignorent.",
  'shared.info.status.s307.summary':
    "Temporairement à l'URL de Location ; la méthode et le corps doivent être préservés en la suivant.",
  'shared.info.status.s308.summary':
    "Définitivement à l'URL de Location ; la méthode et le corps doivent être préservés en la suivant.",
  'shared.info.status.s400.summary': "Le serveur n'a pas pu analyser ou accepter la requête telle quelle.",
  'shared.info.status.s400.body':
    'Vérifiez la syntaxe du corps, les paramètres de requête et les en-têtes requis — le corps de la réponse ' +
    'nomme souvent le champ fautif.',
  'shared.info.status.s401.summary': "La requête manque d'identifiants d'authentification valides.",
  'shared.info.status.s401.body':
    "L'en-tête de réponse WWW-Authenticate nomme le schéma attendu. Vérifiez l'onglet Authorization / la " +
    'fraîcheur du jeton.',
  'shared.info.status.s402.summary':
    'Code réservé, utilisé par certaines API pour les limites de quota ou de facturation.',
  'shared.info.status.s403.summary': "Le serveur a compris la requête et les identifiants, mais refuse de l'autoriser.",
  'shared.info.status.s403.body':
    "Contrairement au 401, se ré-authentifier n'aidera pas — cette identité n'a pas la permission pour cette " +
    'ressource.',
  'shared.info.status.s404.summary': "Aucune ressource n'existe à cette URL (ou le serveur cache son existence).",
  'shared.info.status.s404.body':
    "Vérifiez le chemin et les identifiants qu'il contient ; certaines API renvoient aussi 404 au lieu de 403 " +
    "pour ne pas révéler l'existence.",
  'shared.info.status.s405.summary': 'La ressource existe mais pas pour cette méthode HTTP.',
  'shared.info.status.s405.body': "L'en-tête de réponse Allow liste les méthodes que cette URL accepte.",
  'shared.info.status.s406.summary':
    'Le serveur ne peut pas produire une représentation correspondant aux en-têtes Accept de la requête.',
  'shared.info.status.s407.summary':
    'Un proxy entre vous et le serveur exige des identifiants (Proxy-Authenticate nomme le schéma).',
  'shared.info.status.s408.summary': "Le serveur a renoncé à attendre le reste de la requête et a clos l'échange.",
  'shared.info.status.s409.summary': "La requête entre en conflit avec l'état actuel de la ressource.",
  'shared.info.status.s409.body':
    'Typique des modifications concurrentes ou des créations en double — relisez la ressource et réessayez.',
  'shared.info.status.s410.summary': 'La ressource existait mais a été intentionnellement et définitivement supprimée.',
  'shared.info.status.s411.summary':
    'Le serveur exige un en-tête Content-Length et refuse les corps chunked ou sans taille.',
  'shared.info.status.s412.summary':
    "Un en-tête conditionnel (If-Match, If-Unmodified-Since, …) ne tenait pas, donc le serveur a refusé d'agir.",
  'shared.info.status.s413.summary': 'Le corps de la requête dépasse ce que le serveur accepte.',
  'shared.info.status.s414.summary':
    "L'URL de la requête dépasse la limite du serveur — généralement des données de chaîne de requête qui ont " +
    'leur place dans un corps.',
  'shared.info.status.s415.summary': 'Le serveur rejette le format du corps.',
  'shared.info.status.s415.body': "Vérifiez l'en-tête de requête Content-Type par rapport à ce que l'API attend.",
  'shared.info.status.s416.summary': "L'en-tête de requête Range demande des octets en dehors de la ressource.",
  'shared.info.status.s417.summary':
    "Le serveur ne peut pas satisfaire l'en-tête de requête Expect (typiquement Expect: 100-continue).",
  'shared.info.status.s418.summary': "Code RFC du 1er avril ; certaines API l'utilisent comme refus humoristique.",
  'shared.info.status.s421.summary':
    "La requête a atteint un serveur qui n'est pas configuré pour répondre pour cette autorité (courant avec " +
    'les connexions HTTP/2 réutilisées).',
  'shared.info.status.s422.summary':
    'Le corps est syntaxiquement valide mais sémantiquement faux — la validation a échoué.',
  'shared.info.status.s422.body': 'Le corps de la réponse liste généralement les erreurs de validation par champ.',
  'shared.info.status.s423.summary': 'WebDAV — la ressource est verrouillée par une autre opération.',
  'shared.info.status.s424.summary':
    "WebDAV — cette action a échoué parce qu'une action antérieure dont elle dépendait a échoué.",
  'shared.info.status.s425.summary':
    'Le serveur refuse de traiter une requête qui pourrait être rejouée (données TLS précoces).',
  'shared.info.status.s426.summary':
    "Le serveur insiste sur un protocole différent — l'en-tête de réponse Upgrade le nomme.",
  'shared.info.status.s428.summary':
    'Le serveur exige un en-tête conditionnel (généralement If-Match) pour éviter les mises à jour perdues.',
  'shared.info.status.s429.summary': 'Limite de débit atteinte — ralentissez.',
  'shared.info.status.s429.body':
    "L'en-tête de réponse Retry-After (quand présent) dit combien de temps attendre ; beaucoup d'API envoient " +
    'aussi des en-têtes RateLimit-*.',
  'shared.info.status.s431.summary':
    'Un en-tête de requête (ou leur ensemble) dépasse la limite de taille du serveur — souvent un cookie ' +
    'trop gros.',
  'shared.info.status.s451.summary':
    "Le serveur refuse l'accès pour des raisons légales (censure, décision de justice, retrait RGPD).",
  'shared.info.status.s500.summary':
    'Le serveur a rencontré une condition inattendue — la défaillance est côté serveur.',
  'shared.info.status.s500.body':
    'Réessayer peut fonctionner si la faute est transitoire ; sinon le correctif est dans les journaux du ' +
    'serveur, pas dans la requête.',
  'shared.info.status.s501.summary':
    'Le serveur ne prend pas en charge la fonctionnalité requise — souvent une méthode non reconnue.',
  'shared.info.status.s502.summary': 'Une passerelle ou un proxy a reçu une réponse invalide du serveur amont.',
  'shared.info.status.s502.body':
    "L'origine derrière le proxy est défaillante ou injoignable — généralement transitoire.",
  'shared.info.status.s503.summary':
    'Le serveur est temporairement incapable de traiter la requête (surcharge ou maintenance).',
  'shared.info.status.s503.body': 'Retry-After (quand présent) dit quand réessayer.',
  'shared.info.status.s504.summary': 'Une passerelle ou un proxy a expiré en attendant le serveur amont.',
  'shared.info.status.s505.summary': 'Le serveur refuse la version du protocole HTTP utilisée dans la requête.',
  'shared.info.status.s506.summary':
    'Mauvaise configuration du serveur dans la négociation de contenu — la variante choisie se négocie elle-même.',
  'shared.info.status.s507.summary': 'WebDAV — le serveur ne peut pas stocker ce que la requête exige.',
  'shared.info.status.s508.summary': 'WebDAV — le serveur a rencontré une boucle infinie en traitant la requête.',
  'shared.info.status.s510.summary':
    'La requête nécessite une extension supplémentaire pour que le serveur puisse la satisfaire.',
  'shared.info.status.s511.summary':
    "Le réseau (typiquement un portail captif) exige une authentification avant d'accorder l'accès.",
} as const satisfies Catalog;
