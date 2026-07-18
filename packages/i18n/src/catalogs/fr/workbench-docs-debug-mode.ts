/**
 * Workbench Docs panel — the Debug Mode section body — French. Mirrors
 * `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI labels the
 * prose references copy the shipped `shared-chrome.ts` fr strings
 * verbatim (`Attacher à`, `Où DevTools est ouvert`, `L'onglet actif`,
 * `Les deux`, `Inclure cet onglet du navigateur`, `Onglets attachés`,
 * `Onglet hors périmètre`, `État du système`); the browser banner
 * quote rides verbatim inside « ». Raw by design: the `● Debug mode`
 * pill chip and `fetch` / `XHR` code chips composed by the section
 * body, `CSP`, worker/cross-origin vocabulary per the panel parity
 * laws.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'Le mode débogage',
  'workbench.docs.body.debugMode.intro1':
    'attache Open Headers au protocole de débogage du navigateur, pour inspecter et modifier un trafic que les API ' +
    "d'extension ordinaires ne peuvent pas atteindre. C'est la même machinerie que les propres outils de " +
    "développement du navigateur — c'est pourquoi, tant qu'il est actif, un bandeau",
  'workbench.docs.body.debugMode.introBanner': '« OH started debugging this browser »',
  'workbench.docs.body.debugMode.intro1Suffix': "s'affiche dans le navigateur.",
  'workbench.docs.body.debugMode.intro2':
    'Le mode standard (mode débogage désactivé) couvre déjà la plupart des règles — en-tête, blocage, redirection, ' +
    'paramètres de requête, et les règles de corps / réponse / injection en contexte de page. Le mode débogage est ' +
    "la mise à niveau opt-in pour ce qu'elles ne peuvent pas atteindre : navigations, workers, cadres cross-origin " +
    "et changements d'environnement à l'échelle de l'onglet.",
  'workbench.docs.body.debugMode.controlHeading': 'Où le contrôler',
  'workbench.docs.body.debugMode.control1Prefix': 'La pastille',
  'workbench.docs.body.debugMode.control1Middle': 'se trouve dans le pied de page de chaque surface, juste à gauche de',
  'workbench.docs.body.debugMode.systemStatusLink': 'État du système',
  'workbench.docs.body.debugMode.control1Suffix':
    ". L'interrupteur intégré l'active et le désactive, le point coloré suit sa santé, et le point + libellé " +
    'ouvrent un popover avec tout le reste — périmètre, épingles par onglet et liste des onglets actuellement ' +
    'attachés.',
  'workbench.docs.body.debugMode.surfaceCaption':
    "L'interrupteur intégré l'active ; le point + libellé ouvrent le popover pour tout le reste.",
  'workbench.docs.body.debugMode.scopeHeading': 'Choisir quoi inspecter',
  'workbench.docs.body.debugMode.scope1Prefix': 'La liste déroulante',
  'workbench.docs.body.debugMode.attachTo': 'Attacher à',
  'workbench.docs.body.debugMode.scope1Middle': "détermine à quels onglets le mode débogage s'attache —",
  'workbench.docs.body.debugMode.scopeDevtools': 'Où DevTools est ouvert',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '(seuls les onglets où le panneau Open Headers est ouvert ; la valeur par défaut la plus restreinte),',
  'workbench.docs.body.debugMode.scopeFocused': "L'onglet actif",
  'workbench.docs.body.debugMode.scope1FocusedParen': "(suit l'onglet au premier plan à mesure que vous changez), ou",
  'workbench.docs.body.debugMode.scopeBoth': 'Les deux',
  'workbench.docs.body.debugMode.scope1BothParen': "(l'union des deux).",
  'workbench.docs.body.debugMode.consent1Prefix': 'Choisir un périmètre',
  'workbench.docs.body.debugMode.consentIs': 'est',
  'workbench.docs.body.debugMode.consent1Middle':
    "le consentement pour le bandeau du navigateur — il n'y a pas d'invite séparée. Quand l'onglet courant n'est " +
    'pas déjà couvert par le périmètre, une épingle',
  'workbench.docs.body.debugMode.includeTabPin': 'Inclure cet onglet du navigateur',
  'workbench.docs.body.debugMode.consent1Suffix':
    'apparaît, pour attacher ce seul onglet sans élargir le périmètre pour tout le reste.',
  'workbench.docs.body.debugMode.attached1Prefix': 'La liste',
  'workbench.docs.body.debugMode.attachedTabs': 'Onglets attachés',
  'workbench.docs.body.debugMode.attached1Suffix':
    'montre chaque onglet que le mode débogage pilote actuellement, chacun avec une action pour y accéder. ' +
    "L'ensemble attaché est toujours recalculé à partir de votre périmètre, de vos épingles et des panneaux " +
    'ouverts — il reflète le présent, jamais un instantané périmé.',
  'workbench.docs.body.debugMode.scopeCaption':
    "L'ensemble attaché est dérivé à chaque fois — se rattacher le rejoue, rien n'est stocké.",
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'Le bandeau est global au navigateur',
  'workbench.docs.body.debugMode.banner1Prefix':
    'Tant que le mode débogage est actif, le bandeau du navigateur « OH started debugging this browser » ' +
    "s'affiche sur",
  'workbench.docs.body.debugMode.bannerEvery': 'chaque',
  'workbench.docs.body.debugMode.banner1Suffix':
    "onglet — pas seulement ceux auxquels il est attaché. C'est le comportement du navigateur lui-même ; " +
    'désactiver le mode débogage le retire immédiatement.',
  'workbench.docs.body.debugMode.unlocksHeading': 'Ce que ça débloque',
  'workbench.docs.body.debugMode.unlocksIntro':
    'Sur un onglet attaché, les règles et les commandes dépassent le contexte de page :',
  'workbench.docs.body.debugMode.anyRequestLead': "N'importe quelle requête, n'importe quel contexte.",
  'workbench.docs.body.debugMode.anyRequest1':
    'Mockez ou réécrivez les navigations de premier niveau, les requêtes des workers et les iframes cross-origin — ' +
    'pas seulement les',
  'workbench.docs.body.debugMode.anyRequest2':
    ' de la page. Les corps de requête et de réponse peuvent être lus et transformés dans ces mêmes contextes, et ' +
    "les défis d'authentification HTTP résolus automatiquement pour les proxys de dev et le staging.",
  'workbench.docs.body.debugMode.injectionLead': 'Injection renforcée.',
  'workbench.docs.body.debugMode.injection1':
    "L'injection de script devient sans situation de course et insensible à la CSP, et atteint l'intérieur des " +
    'workers et des cadres cross-origin que la voie standard du contexte de page ne peut pas toucher.',
  'workbench.docs.body.debugMode.tabEnvLead': "Environnement de l'onglet.",
  'workbench.docs.body.debugMode.tabEnv1':
    'Désactivation exacte du cache, limitation réseau / hors ligne, et substitutions user-agent / locale / fuseau ' +
    "horaire / média — réglées par onglet depuis la barre d'outils du panneau et depuis",
  'workbench.docs.body.debugMode.overrides': 'Substitutions',
  'workbench.docs.body.debugMode.tabEnv2': '(la surface dédiée).',
  'workbench.docs.body.debugMode.reachCaption':
    'Le mode standard couvre les fetch / XHR de la page ; un onglet attaché étend les mêmes règles à tout le reste.',
  'workbench.docs.body.debugMode.silentHeading': "Les règles n'échouent jamais en silence",
  'workbench.docs.body.debugMode.silent1Prefix':
    'Une règle qui a besoin du mode débogage pour produire son plein effet affiche un badge',
  'workbench.docs.body.debugMode.badgeOff': 'Mode débogage désactivé',
  'workbench.docs.body.debugMode.silent1Middle': "dans la liste des règles tant qu'il est désactivé, et une note",
  'workbench.docs.body.debugMode.badgeOutOfScope': 'Onglet hors périmètre',
  'workbench.docs.body.debugMode.silent1Middle2':
    "dans le panneau quand il est actif mais que l'onglet est hors périmètre. La règle exécute quand même tout ce " +
    "qu'elle",
  'workbench.docs.body.debugMode.silentCan': 'peut',
  'workbench.docs.body.debugMode.silent1Suffix':
    "par la voie standard du contexte de page — armer le mode débogage ne fait qu'étendre la même règle aux " +
    "contextes que l'injection de page ne peut pas atteindre.",
  'workbench.docs.body.debugMode.colorsHeading': "Couleurs d'état",
  'workbench.docs.body.debugMode.colors1Prefix': 'Le point reflète la ligne',
  'workbench.docs.body.debugMode.colors1Suffix': ':',
  'workbench.docs.body.debugMode.statesCaption': 'Gris quand désactivé ; vert / jaune / rouge une fois activé.',
  'workbench.docs.body.debugMode.stateGreenLabel': 'vert',
  'workbench.docs.body.debugMode.stateOn': 'Activé',
  'workbench.docs.body.debugMode.stateOnRest':
    'et attaché proprement. (Quand il est désactivé, le point est simplement gris.)',
  'workbench.docs.body.debugMode.stateYellowLabel': 'jaune',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'Un onglet',
  'workbench.docs.body.debugMode.stateYellowTerm': "est retombé sur l'heuristique",
  'workbench.docs.body.debugMode.stateYellowSuffix':
    '— généralement parce que le bandeau de débogage du navigateur a été fermé ; cet onglet revient alors à ' +
    "l'observation standard.",
  'workbench.docs.body.debugMode.stateRedLabel': 'rouge',
  'workbench.docs.body.debugMode.stateRedPrefix': 'Un onglet',
  'workbench.docs.body.debugMode.stateRedTerm': "n'a pas pu s'attacher",
  'workbench.docs.body.debugMode.stateRedSuffix': "— le protocole de débogage n'a pas pu être engagé pour lui.",
  'workbench.docs.body.debugMode.chromiumTitle': 'Chromium uniquement',
  'workbench.docs.body.debugMode.chromium1':
    'Le mode débogage repose sur un protocole de débogage que seuls les navigateurs basés sur Chromium exposent ' +
    'aux extensions. Sur Firefox et Safari, la pastille reste masquée ; les règles du mode standard ci-dessus ' +
    'fonctionnent partout.',
} as const satisfies Catalog;
