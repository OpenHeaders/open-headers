/**
 * Workbench settings — the app-side setting-definition corpus —
 * French. Mirrors `catalogs/en/workbench-settings-defs.ts` key for
 * key. Brand and platform vocabulary rides raw (S48): browser names,
 * font names (Inter, JetBrains Mono, Press Start 2P, SF Pro/Mono,
 * Segoe UI, Roboto, Consolas, …), wire tokens (`Cache-Control:
 * no-cache`, declarativeNetRequest, INVALID_ARGUMENT, sha256,
 * IndexedDB, `{{env.X}}` syntax), panel-parity names (Network tab,
 * DevTools). Debug-mode scope options reuse the
 * fr/workbench-docs-debug-mode mints verbatim (`Où DevTools est
 * ouvert`, `L'onglet actif`, `Les deux`); the diagnostic-log label
 * matches the fr/workbench-docs-system-status path mint (`Exporter
 * le journal de diagnostic`). Theme variant names translate as
 * product vocabulary (`Tamisé`, `Minuit`, `Forêt`, `Arctique`).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.bindAddress.label': 'Synchroniser avec les appareils de votre réseau',
  'workbench.settings.def.backend.bindAddress.description':
    'Permet aux autres ordinateurs et navigateurs du même réseau de se connecter à cette application et de ' +
    'partager ses espaces de travail. Désactivé par défaut — seul cet ordinateur peut la joindre.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'Loopback uniquement (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description':
    'Seule cette machine peut se connecter. Par défaut.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'Toutes les interfaces (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    "Les autres appareils du réseau local peuvent se connecter. Nécessite le jeton d'authentification de U3.2.",
  'workbench.settings.def.backend.bindPort.label': 'Port du daemon',
  'workbench.settings.def.backend.bindPort.description':
    'Le port sur lequel cette application écoute pour que navigateurs et autres appareils se connectent. Ne ' +
    'le changez que si autre chose utilise déjà le port par défaut. Les clients doivent viser le même port.',
  'workbench.settings.def.backend.serveWebApp.label': "Servir l'application web",
  'workbench.settings.def.backend.serveWebApp.description':
    "Sert le Workbench comme page web sur le port du daemon, pour qu'un onglet de navigateur puisse l'ouvrir " +
    'directement depuis cette application — aucune extension requise. Quiconque atteint le port voit la ' +
    'grille de connexion ; un jeton appairé reste requis pour accéder aux données.',
  'workbench.settings.def.backend.allowPeerExecute.label': 'Autoriser les appareils connectés à envoyer des requêtes',
  'workbench.settings.def.backend.allowPeerExecute.description':
    'Laisse les navigateurs et appareils appairés envoyer des requêtes API via cette application — leur ' +
    "Envoyer du workbench s'exécute sur cette machine, avec son accès réseau. Désactivé par défaut ; chaque " +
    "envoi exige toujours que l'expéditeur ait l'accès en écriture à l'espace de travail.",
  'workbench.settings.def.backend.reconnectDelayMs.label': 'Délai de reconnexion initial',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    'Combien de temps attendre (ms) avant la première tentative de reconnexion après une déconnexion.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': 'Délai de reconnexion maximum',
  'workbench.settings.def.backend.maxReconnectDelayMs.description':
    'Borne supérieure (ms) du backoff exponentiel entre les tentatives de reconnexion.',
  'workbench.settings.def.backend.pingIntervalMs.label': 'Intervalle de keep-alive',
  'workbench.settings.def.backend.pingIntervalMs.description':
    'À quelle fréquence (ms) envoyer un ping pour que le WebSocket reste ouvert derrière les proxys stricts.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': 'Pastille en cas de déconnexion',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    "Affiche une pastille rouge sur l'icône de la barre d'outils quand le lien back-end est coupé.",
  'workbench.settings.def.backend.showDiagrams.label': 'Afficher les diagrammes back-end',
  'workbench.settings.def.backend.showDiagrams.description':
    'Affiche les panneaux illustrés de paliers et de flux de données dans les réglages Backend.',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': 'Activer le serveur MCP',
  'workbench.settings.def.mcp.enabled.description':
    "Répond aux clients MCP sur le port du daemon de cette application. Tant que c'est désactivé, le point " +
    "d'accès n'existe pas. Activé, les agents munis d'un jeton d'accès peuvent lire vos espaces de travail.",
  'workbench.settings.def.mcp.allowWrite.label': "Autoriser les outils d'écriture",
  'workbench.settings.def.mcp.allowWrite.description':
    'Les agents peuvent créer, modifier et supprimer règles, requêtes, environnements, variables et ' +
    "workflows. Chaque changement atterrit dans le Flux d'activité et peut être annulé.",
  'workbench.settings.def.mcp.allowExecute.label': "Autoriser les outils d'exécution",
  'workbench.settings.def.mcp.allowExecute.description':
    'Les agents peuvent envoyer des requêtes enregistrées et exécuter des workflows — du vrai trafic réseau ' +
    'quitte cette machine pour leur compte.',
  'workbench.settings.def.mcp.allowSecrets.label': 'Autoriser la révélation des secrets',
  'workbench.settings.def.mcp.allowSecrets.description':
    "Les agents peuvent lire les valeurs des secrets du vault en clair. Tant que c'est désactivé, chaque " +
    'secret reste masqué.',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': 'Langue',
  'workbench.settings.def.general.language.description':
    "Langue d'affichage de l'interface. S'applique immédiatement à toutes les surfaces ouvertes — sans " +
    "rechargement. Le vocabulaire technique (noms d'en-têtes, méthodes HTTP, termes de protocole) reste en " +
    'anglais dans toutes les langues.',
  'workbench.settings.def.general.language.option.auto.label': 'Suivre le système',
  'workbench.settings.def.general.language.option.auto.description':
    "Suivre la langue de votre navigateur ou de votre système d'exploitation",
  'workbench.settings.def.general.language.option.pseudo.description':
    'Anglais accentué et allongé pour repérer les textes non traduits ou tronqués',
  'workbench.settings.def.general.confirmOnDelete.label': 'Confirmer avant de supprimer',
  'workbench.settings.def.general.confirmOnDelete.description':
    'Affiche une boîte de confirmation avant de supprimer règles, dossiers ou collections.',
  'workbench.settings.def.general.showEmptyStateHints.label': "Afficher les conseils d'état vide",
  'workbench.settings.def.general.showEmptyStateHints.description':
    "Affiche des indications et des conseils dans les panneaux vides et les zones d'accueil.",
  'workbench.settings.def.terminal.profiles.label': 'Profils',
  'workbench.settings.def.terminal.profiles.description':
    "Shells avec lesquels le terminal peut ouvrir un onglet. Les nouveaux onglets utilisent le profil par défaut ; la flèche à côté du + dans la barre d'onglets choisit un profil précis.",
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': "Confirmer la fermeture d'un processus en cours",
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    'Demander avant de fermer un onglet de terminal dont le shell exécute encore un processus. Les shells ' +
    'inactifs se ferment toujours sans confirmation.',
  'workbench.settings.def.general.restoreTabsOnStartup.label': 'Restaurer les onglets au démarrage',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    "Rouvre les onglets d'éditeur qui étaient ouverts à la fin de la session précédente.",
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': "Changement d'environnement par collection",
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    "Comment l'environnement actif change quand vous vous déplacez entre les collections et les entités " +
    "qu'elles contiennent (règles, requêtes, dossiers). S'applique aux collections de règles comme aux " +
    'collections de requêtes API. Les collections peuvent porter un environnement par défaut et épingler une ' +
    "courte liste d'environnements recommandés ; ce réglage contrôle si ces défauts prennent la main " +
    'automatiquement.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label':
    "Garder l'environnement sélectionné",
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    'Ce que vous avez sélectionné (y compris aucun environnement) reste sélectionné pendant que vous ' +
    "naviguez entre les collections et leurs sous-dossiers, règles ou requêtes. Le défaut d'une collection ne " +
    "s'applique que si aucun environnement n'est sélectionné.",
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label':
    'Appliquer les défauts des collections',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    "Le défaut d'une collection prend la main tant que vous êtes dedans (ou dans un sous-dossier, une règle " +
    "ou une requête à l'intérieur). Votre dernier choix manuel est l'environnement de base — restauré dès " +
    'que vous quittez une collection ou entrez dans une collection sans défaut. Aucune mémoire par collection.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': 'Suivre chaque collection',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    "Ouvrir une collection (ou un sous-dossier, une règle ou une requête à l'intérieur) dotée d'un " +
    'environnement par défaut bascule vers ce défaut. Les choix faits dans une collection sont mémorisés pour ' +
    'cette collection. Les collections sans défaut ne basculent pas automatiquement.',
  'workbench.settings.def.general.settingsOpenMode.label': "Mode d'ouverture des réglages",
  'workbench.settings.def.general.settingsOpenMode.description':
    "Comment la page Paramètres s'ouvre depuis la barre d'outils, le popup ou la palette de commandes.",
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'Modale',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description':
    'Superposition centrée sur la page courante',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'Modale (maximisée)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    "Superposition qui remplit l'essentiel de la fenêtre",
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': "Onglet d'éditeur",
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    "Ouvre comme un onglet d'éditeur plein dans l'espace de travail",
  'workbench.settings.def.general.settingsShowCategoryLabels.label':
    'Afficher les noms de catégories dans la barre latérale des réglages',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    'Affiche des libellés texte à côté des icônes de catégories dans la barre latérale des Paramètres. Clic ' +
    'droit sur la barre latérale pour basculer. Désactivez pour un rail compact, icônes seules.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'Thème de couleurs',
  'workbench.settings.def.appearance.theme.description': "Contrôle le thème de couleurs global de l'application.",
  'workbench.settings.def.appearance.theme.option.light.label': 'Clair',
  'workbench.settings.def.appearance.theme.option.dark.label': 'Sombre',
  'workbench.settings.def.appearance.theme.option.auto.label': 'Suivre le système',
  'workbench.settings.def.appearance.theme.option.auto.description': "Suivre votre système d'exploitation",
  'workbench.settings.def.appearance.lightVariant.label': 'Variante du thème clair',
  'workbench.settings.def.appearance.lightVariant.description':
    'Palette utilisée quand le thème de couleurs résolu est clair.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'Par défaut',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    'Thème clair neutre et équilibré pour un usage quotidien.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'Contraste élevé',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    'Lisibilité maximale — surfaces blanc pur, texte quasi noir, contraste AAA.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Chaud',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    'Surfaces façon papier aux neutres chauds avec un accent ambre — plus doux pour les yeux sur les longues ' +
    'sessions.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Froid',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'Thème clair teinté bleu ardoise — surfaces nettes avec un accent bleu acier.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'Surfaces rosées douces avec un accent magenta — une chaleur délicate sans le ton ambre de Chaud.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sépia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    'Palette parchemin saturée au texte brun profond — la variante claire la plus teintée, idéale pour la ' +
    'lecture prolongée.',
  'workbench.settings.def.appearance.darkVariant.label': 'Variante du thème sombre',
  'workbench.settings.def.appearance.darkVariant.description':
    'Palette utilisée quand le thème de couleurs résolu est sombre.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'Par défaut',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    'Thème sombre neutre et équilibré pour un usage quotidien.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'Contraste élevé',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    'Lisibilité maximale — surfaces noir véritable, texte lumineux, contraste AAA.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Tamisé',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    "Surfaces bleu ardoise douces avec moins d'éblouissement — plus reposant en faible lumière.",
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Minuit',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    'Surfaces bleu nuit profond avec un accent bleu vif — plus riche et plus saturé que Tamisé.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forêt',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'Surfaces sombres teintées de vert avec un accent émeraude — palette calme et végétale.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctique',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    'Thème sombre gris-bleu froid avec un accent cyan givré — plus plat et moins saturé que Tamisé ou Minuit.',
  'workbench.settings.def.appearance.uiScale.label': "Échelle de l'interface",
  'workbench.settings.def.appearance.uiScale.description':
    "Met à l'échelle tout le chrome — boutons, texte, marges, contrôles — sans changer la taille de police de " +
    "l'éditeur.",
  'workbench.settings.def.appearance.uiScale.option.0.7.label': 'Minuscule (70%)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    "La disposition la plus dense — utile avec la police d'interface Press Start 2P, qui rend " +
    'inhabituellement haute et large.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'Compacte (80%)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    'Chrome resserré qui garde des cibles de clic confortables.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': 'Petite (90%)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    "Légèrement plus serrée que la normale — fait tenir plus à l'écran.",
  'workbench.settings.def.appearance.uiScale.option.1.label': 'Normale (100%)',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'Taille de chrome par défaut.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': 'Grande (110%)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description':
    'Légèrement agrandie pour une lecture plus facile.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': 'Très grande (125%)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description':
    "Échelle de chrome maximale — idéale pour l'accessibilité.",
  'workbench.settings.def.appearance.fontFamilyPreset.label': "Famille de police de l'interface",
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    "Piles sans-serif sélectionnées pour le chrome de l'application. Par défaut Inter sur Windows / Linux " +
    'pour la cohérence multiplateforme, et System Sans sur macOS pour garder le dimensionnement optique natif ' +
    "de SF Pro. Chaque option est embarquée avec l'extension. Les surfaces d'édition ont leur propre réglage " +
    'de police.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    "Sans d'interface embarquée conçue pour les écrans — rend identiquement sur tous les systèmes, si bien " +
    "que l'application a le même aspect sur macOS, Windows et Linux.",
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    "Sans d'interface par défaut du système — San Francisco sur macOS, Segoe UI sur Windows, Roboto sur " +
    "Linux. Choisissez-la si vous préférez l'aspect natif au prix de la cohérence multiplateforme.",
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    'Sans conçue pour la lisibilité en basse vision — des lettres distinctives réduisent les confusions de ' +
    'caractères. Embarquée — toujours disponible.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    "Interface monospace assortie à la police du terminal intégré — un look d'outil de développement dans " +
    'tout le chrome. Embarquée — toujours disponible.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    "La police d'affichage façon pixels livrée avec l'application. Embarquée — toujours disponible. Un choix " +
    'fantaisie : lisible mais haute et large ; les marges du chrome paraîtront généreuses.',
  'workbench.settings.def.appearance.density.label': "Densité de l'interface",
  'workbench.settings.def.appearance.density.description':
    'Le mode compact réduit les marges dans les listes, tableaux et formulaires.',
  'workbench.settings.def.appearance.density.option.comfortable.label': 'Confortable',
  'workbench.settings.def.appearance.density.option.compact.label': 'Compacte',
  'workbench.settings.def.appearance.editorHeaderPosition.label': "Position de l'en-tête d'éditeur",
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    "Où chaque éditeur ancre sa rangée titre-et-actions (nom, interrupteur d'activation, Enregistrer). En " +
    "bas allège le haut de l'éditeur et garde les actions principales près du contenu que vous modifiez.",
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': 'En haut',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    "Placement classique au-dessus du contenu de l'éditeur.",
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': 'En bas',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    "Ancrée sous le contenu de l'éditeur, au-dessus de la barre d'état.",
  'workbench.settings.def.appearance.clockFormat.label': "Format de l'heure",
  'workbench.settings.def.appearance.clockFormat.description':
    "Comment les horodatages s'affichent dans l'application (notifications, journaux). Explicite car la " +
    'locale du navigateur suit la langue du navigateur, pas le format régional de votre système.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24 heures',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12 heures',
  'workbench.settings.def.appearance.accentColor.label': "Couleur d'accent",
  'workbench.settings.def.appearance.accentColor.description':
    "La couleur principale des boutons, liens et surbrillances actives. Ne s'applique qu'aux variantes Par " +
    'défaut — les variantes à contraste élevé et teintées fixent leur propre accent.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'Afficher la version dans le pied de page',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    "Affiche le numéro de version de l'extension dans la barre d'état de l'espace de travail.",
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label':
    'Afficher le sélecteur de thème dans le pied de page',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    "Affiche le menu de thème clair/sombre/auto dans la barre d'état de l'espace de travail.",
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label':
    'Afficher les boutons de panneaux dans la barre supérieure',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'Affiche les icônes de bascule des panneaux gauche / inférieur / droit dans la barre supérieure de ' +
    "l'espace de travail.",
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label':
    'Afficher le menu de disposition dans la barre supérieure',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    "Affiche le menu de disposition (panneau inférieur pleine largeur, noms des fenêtres d'outils, " +
    "disposition de la barre d'activité) dans la barre supérieure de l'espace de travail.",
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': 'Alignement du panneau inférieur',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    "Où se place le panneau inférieur dans le shell. Gauche/droite l'aligne sous une barre latérale + " +
    "l'éditeur ; centré l'imbrique dans la colonne du milieu ; justifié couvre toute la largeur de la fenêtre.",
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': 'Centré',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    'Panneau inférieur imbriqué dans la colonne du milieu',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': 'Gauche',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    "Le panneau inférieur couvre la barre latérale gauche + l'éditeur",
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': 'Droite',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    "Le panneau inférieur couvre l'éditeur + la barre latérale droite",
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': 'Justifié',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    'Le panneau inférieur couvre toute la largeur de la fenêtre',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': "Afficher les noms des fenêtres d'outils",
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    "Affiche des libellés texte à côté des icônes de la barre d'activité et des onglets de dock. Désactivez " +
    'pour un shell compact, icônes seules.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': "Largeur de la barre d'activité gauche",
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    "Largeur de la barre d'activité gauche quand les noms des fenêtres d'outils sont visibles. Verrouillée à " +
    '36px en mode icônes seules.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': "Largeur de la barre d'activité droite",
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    "Largeur de la barre d'activité droite quand les noms des fenêtres d'outils sont visibles. Verrouillée à " +
    '36px en mode icônes seules.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': "Disposition de la barre d'activité",
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    "Comment la barre d'activité répartit les groupes de fenêtres d'outils du haut et du bas.",
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': 'Proportionnelle',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    "Les groupes du haut et du bas se partagent la barre d'activité 50/50",
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'Compacte',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    'Le groupe du haut se dimensionne au contenu ; celui du bas est épinglé en bas',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': 'Empilée',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'Tous les groupes regroupés en haut avec des séparateurs entre eux',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': 'Dynamique',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'Les groupes de puces suivent les hauteurs des panneaux adjacents. Les docks fermés se replient au ' +
    "contenu et les voisins actifs absorbent l'espace.",

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'Mode débogage',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'Inspectez et modifiez les requêtes avec la même profondeur que les outils de développement intégrés de ' +
    'votre navigateur — chargements de page, workers et iframes, pas seulement les fetch au niveau de la ' +
    "page. Le navigateur affiche un bandeau de débogage sur chaque onglet attaché tant que c'est activé ; " +
    "c'est activé par défaut dans Chrome et Edge, et vous pouvez le désactiver à tout moment.",
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'Le mode débogage est disponible dans Chrome et Edge.',
  'workbench.settings.def.inspection.cdpScope.label': 'Attacher à quels onglets',
  'workbench.settings.def.inspection.cdpScope.description':
    "À quels onglets le mode débogage s'attache tant qu'il est activé. « Où DevTools est ouvert » s'attache " +
    "aux onglets du navigateur dont les outils de développement sont ouverts. « L'onglet actif » suit " +
    "l'onglet actif du navigateur sans exiger les outils de développement — passer à un nouvel onglet ou à " +
    "une page interne laisse l'onglet précédent attaché plutôt que de balloter. « Les deux » combine les " +
    'deux. Des onglets individuels peuvent aussi être épinglés depuis le pied de page quel que soit ce choix.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    'Le mode débogage est disponible dans Chrome et Edge.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'Où DevTools est ouvert',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description':
    'Les onglets du navigateur dont les outils de développement sont ouverts.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': "L'onglet actif",
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    "L'onglet actif du navigateur, suivant le focus — aucun outil de développement requis.",
  'workbench.settings.def.inspection.cdpScope.option.both.label': 'Les deux',
  'workbench.settings.def.inspection.cdpScope.option.both.description': "Les onglets DevTools et l'onglet actif.",

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'Taille de police',
  'workbench.settings.def.editor.fontSize.description': "Taille de police en pixels des surfaces d'édition.",
  'workbench.settings.def.editor.fontFamilyPreset.label': 'Famille de police',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    "Piles monospace sélectionnées pour l'éditeur. Chaque option est embarquée avec l'extension — aucune " +
    'installation système requise. Par défaut JetBrains Mono sur Windows / Linux pour la cohérence ' +
    'multiplateforme, et System Mono sur macOS pour garder le rendu natif de SF Mono.',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'Monospace par défaut du système — SF Mono sur macOS, Consolas sur Windows, Liberation Mono sur Linux.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'Monospace avec ligatures de programmation. Embarquée — toujours disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'Monospace conçue pour les éditeurs, avec ligatures. Embarquée — toujours disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'Monospace avec ligatures de programmation. Embarquée — toujours disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Monospace Adobe conçue pour le code. Embarquée — toujours disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    "La police d'affichage façon pixels livrée avec l'application. Embarquée — toujours disponible. Un choix " +
    'fantaisie : lisible mais haute et large.',
  'workbench.settings.def.editor.fontLigatures.label': 'Ligatures de police',
  'workbench.settings.def.editor.fontLigatures.description':
    'Active les ligatures de programmation — combine des séquences comme `=>` ou `!=` en glyphes uniques. ' +
    'Nécessite une police avec ligatures (p. ex. Fira Code, JetBrains Mono).',
  'workbench.settings.def.editor.lineHeight.label': 'Hauteur de ligne',
  'workbench.settings.def.editor.lineHeight.description':
    "Hauteur de ligne de l'éditeur en pixels. 0 laisse l'éditeur choisir une hauteur proportionnelle à la " +
    'taille de police ; les valeurs de 8 et plus sont interprétées comme des pixels explicites.',
  'workbench.settings.def.editor.tabSize.label': 'Taille de tabulation',
  'workbench.settings.def.editor.tabSize.description': "Nombre de colonnes qu'occupe un caractère de tabulation.",
  'workbench.settings.def.editor.insertSpaces.label': 'Insérer des espaces',
  'workbench.settings.def.editor.insertSpaces.description':
    'Insère des espaces au lieu de caractères de tabulation quand vous appuyez sur Tab.',
  'workbench.settings.def.editor.wordWrap.label': 'Retour à la ligne',
  'workbench.settings.def.editor.wordWrap.description':
    "Si les lignes longues passent à la ligne suivante dans l'éditeur.",
  'workbench.settings.def.editor.wordWrap.option.off.label': 'Désactivé',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'Largeur de la fenêtre',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': 'Colonne bornée',
  'workbench.settings.def.editor.wordWrapColumn.label': 'Colonne de retour à la ligne',
  'workbench.settings.def.editor.wordWrapColumn.description':
    'Colonne à laquelle les lignes se replient quand le retour à la ligne est réglé sur Colonne bornée.',
  'workbench.settings.def.editor.lineNumbers.label': 'Numéros de ligne',
  'workbench.settings.def.editor.lineNumbers.description': 'Affiche les numéros de ligne dans la gouttière gauche.',
  'workbench.settings.def.editor.renderWhitespace.label': 'Afficher les espaces',
  'workbench.settings.def.editor.renderWhitespace.description': "Rend visibles les caractères d'espacement.",
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'Aucun',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': 'Limites uniquement',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'Tous',
  'workbench.settings.def.editor.formatOnSave.label': "Formater à l'enregistrement",
  'workbench.settings.def.editor.formatOnSave.description':
    "Formate automatiquement le contenu de l'éditeur quand vous enregistrez une règle ou un modèle.",
  'workbench.settings.def.editor.bracketPairColorization.label': 'Coloration des paires de crochets',
  'workbench.settings.def.editor.bracketPairColorization.description':
    'Met en évidence les crochets correspondants dans des couleurs différentes.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.responseBodyCapMB.label': 'Limite du corps de réponse (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    "Quelle part d'un corps de réponse l'exécuteur garde pour l'affichage. Les corps plus gros sont tronqués " +
    'à cette limite — la taille complète est toujours mesurée et rapportée. Monter la limite augmente la ' +
    'mémoire utilisée par onglet de requête ouvert.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'Événements SSE : plus récents en premier',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Ordre de la liste des Server-Sent Events — les événements les plus récents en haut. Désactivez pour ' +
    "lire du plus ancien au plus récent. La barre d'outils de la liste change ce même réglage.",
  'workbench.settings.def.requests.sseEventsGroupByName.label': "Événements SSE : grouper par nom d'événement",
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    "Regroupe la liste des Server-Sent Events sous des en-têtes repliables par nom d'événement, l'ordre " +
    "d'arrivée conservé dans chaque groupe. La barre d'outils de la liste change ce même réglage.",
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'Événements SSE : lignes par groupe',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    "En groupant par nom d'événement, n'affiche que ce nombre des événements les plus récents de chaque " +
    'groupe — la fenêtre glisse à mesure que de nouveaux événements arrivent, si bien que plusieurs groupes ' +
    "restent observables à la fois. 0 affiche tous les événements. La barre d'outils de la liste change ce " +
    'même réglage.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'Messages gRPC : plus récents en premier',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'Ordre de la chronologie des messages gRPC — les messages les plus récents en haut. Désactivez pour lire ' +
    "du plus ancien au plus récent. La barre d'outils de la chronologie change ce même réglage.",
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'Messages gRPC : afficher les types de messages',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'Étiquette chaque ligne de la chronologie avec son type de message protobuf déclaré. Désactivé par ' +
    "défaut — les types d'un rpc sont fixes par direction, donc le badge de direction distingue déjà les " +
    "lignes. La barre d'outils de la chronologie change ce même réglage.",
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'Messages gRPC : grouper par type de message',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    "Regroupe la chronologie des messages gRPC sous des en-têtes repliables par type de message, l'ordre " +
    "d'arrivée conservé dans chaque groupe. La barre d'outils de la chronologie change ce même réglage.",
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'Messages gRPC : lignes par groupe',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    "En groupant par type de message, n'affiche que ce nombre des messages les plus récents de chaque groupe " +
    '— la fenêtre glisse à mesure que de nouveaux messages arrivent, si bien que plusieurs groupes restent ' +
    "observables à la fois. 0 affiche tous les messages. La barre d'outils de la chronologie change ce même " +
    'réglage.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'Messages WebSocket : plus récents en premier',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'Ordre de la chronologie des messages WebSocket — les messages les plus récents en haut. Désactivez pour ' +
    "lire du plus ancien au plus récent. La barre d'outils de la chronologie change ce même réglage.",
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'gRPC : envoyer les messages invalides',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    "Quand le message gRPC n'est pas du JSON valide, invoquer quand même avec un message vide et laisser le " +
    "serveur répondre — généralement INVALID_ARGUMENT. Désactivé par défaut : l'invocation échoue avant le " +
    "fil avec l'erreur d'analyse exacte.",

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': "Suspendre l'exécution des règles",
  'workbench.settings.def.rulesEngine.paused.description':
    "Cesse d'appliquer les règles aux requêtes réseau en direct. Les règles restent modifiables.",
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': "Stratégie d'évaluation",
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    'Comment le moteur choisit entre les règles quand plusieurs correspondent à la même requête.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': 'Première correspondance',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    "Utiliser la première règle dans l'ordre de priorité",
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': 'Correspondance la plus proche',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    'Préférer la règle correspondante la plus spécifique',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'Toutes les correspondances',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    "Appliquer chaque règle correspondante dans l'ordre",
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': 'Debounce des mises à jour',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'Délai (ms) avant que les modifications de règles soient poussées vers declarativeNetRequest.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': 'Règles actives maximum',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    'Nombre maximum de règles compilées à la fois dans le jeu de règles dynamique.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': 'Types de ressources visibles',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    'Quels types de ressources de requête apparaissent dans la vue Cette page du popup. Tout est toujours ' +
    "collecté ; ceci ne change que ce que l'interface montre. La rangée de puces en ligne du popup écrit " +
    'dans le même réglage.',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': "Afficher les avertissements d'occultation",
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    "Met en évidence les règles dont l'effet est occulté par une règle de priorité supérieure (blocage, " +
    "redirection, mock, délai ou conflit d'empilement d'en-têtes).",
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': 'Avertir sur les grands jeux de règles',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'Fait remonter un avertissement quand le nombre de règles actives approche le plafond du navigateur.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': 'Seuil de grand jeu de règles',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description':
    "Nombre de règles actives à partir duquel l'avertissement se déclenche.",
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Mode règles en direct',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    'Injecte Cache-Control: no-cache sur chaque requête qui correspond à une de vos règles, forçant la ' +
    "revalidation auprès du serveur pour que l'effet de la règle s'applique toujours à frais. Empêche des " +
    "réponses en cache périmées de masquer une règle — utile quand la valeur d'une règle change (comme un " +
    "jeton d'authentification) mais que la page continue de servir l'ancienne réponse depuis le cache.",
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'Contourner le cache HTTP',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    "Ajoute Cache-Control: no-cache à chaque requête de l'onglet inspecté — force la revalidation auprès du " +
    'serveur. Le périmètre est le cache HTTP uniquement ; le Disable Cache de Chrome (onglet Network) ' +
    'contourne aussi le cache mémoire du moteur de rendu. Les requêtes correspondant à une règle sont ' +
    'toujours gardées fraîches automatiquement par le mode règles en direct.',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': 'Autocomplétion des variables',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    'Suggère les références `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / ' +
    "`{{collection.X}}` / `{{step.X.Y}}` pendant la saisie. S'ouvre sur `{{` dans tout champ de valeur de " +
    'règle et dans les éditeurs de corps JSON/GraphQL/XML/texte brut. Désactivez si vous préférez la saisie ' +
    'en texte brut.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': "Stratégie d'URL des brouillons",
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    "Comment les règles préremplies depuis l'Inspector des DevTools transforment une URL capturée en motif " +
    "url-filter. Exacte (par défaut) garde l'URL telle quelle pour que la règle ne corresponde qu'à la " +
    'requête inspectée. Joker de chemin remplace le dernier segment du chemin par * pour que les ressources ' +
    'voisines correspondent. Hôte seul élargit à tout le domaine.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': 'URL exacte',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'Correspond à cette URL telle quelle, normalisée (recommandé)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'Joker de chemin',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    'Met un joker sur le dernier segment du chemin',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'Hôte seul',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description':
    "Correspond à chaque requête de l'hôte",
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': 'URL brute',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description':
    'Correspond à cette URL telle quelle, sans normalisation',

  // ── Workspace Sharing category defs ────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label':
    "Afficher la stratégie de fusion sur les lignes de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    "Quand activé, chaque ligne d'entité dans la barre latérale gauche de l'aperçu d'import affiche la " +
    'stratégie de fusion choisie (Ajouter comme nouveau, Remplacer, Ignorer, …) à côté des comptes de ' +
    'lignes. Désactivez pour libérer de la largeur sur les volets étroits.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': "Visionneuse de diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    'Rend cible et entrant côte à côte ou empilés en ligne. Bascule automatiquement en unifié quand le volet ' +
    'de diff est trop étroit.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': 'Côte à côte',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': 'Unifié',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label':
    "Traitement des espaces dans le diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    'Si le diff traite les changements limités aux espaces comme des modifications ou les masque.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': 'Ne pas ignorer',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': 'Ignorer les espaces',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label':
    "Replier les régions inchangées dans le diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    'Masque les suites de lignes inchangées et les remplace par un talon cliquable pour développer.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label':
    "Afficher les caractères d'espacement dans le diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    'Rend les espaces et tabulations comme des glyphes visibles (·, →) dans le diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label':
    "Afficher les numéros de ligne dans le diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    'Affiche la colonne des numéros de ligne à côté de chaque côté du diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label':
    "Afficher les guides d'indentation dans le diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    "Rend des guides d'indentation verticaux pour parcourir plus facilement l'imbrication YAML.",
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label':
    "Replier les lignes longues dans le diff de l'aperçu d'import",
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    'Replie les lignes longues sur la ligne visuelle suivante au lieu de défiler horizontalement.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'Niveau de journalisation',
  'workbench.settings.def.data.logLevel.description':
    "Verbosité du journaliseur de l'extension. Les niveaux supérieurs incluent chaque niveau au-dessus d'eux.",
  'workbench.settings.def.data.logLevel.option.error.label': 'Error',
  'workbench.settings.def.data.logLevel.option.error.description': 'Échecs uniquement',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Warn',
  'workbench.settings.def.data.logLevel.option.warn.description': 'Anomalies et nouvelles tentatives',
  'workbench.settings.def.data.logLevel.option.info.label': 'Info',
  'workbench.settings.def.data.logLevel.option.info.description': 'Événements opérationnels',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Debug',
  'workbench.settings.def.data.logLevel.option.debug.description': 'Détails internes verbeux',
  'workbench.settings.def.data.exportSettings.label': 'Exporter les réglages',
  'workbench.settings.def.data.exportSettings.description': 'Télécharge tous les réglages en fichier JSON.',
  'workbench.settings.def.data.exportSettings.action.label': 'Exporter',
  'workbench.settings.def.data.importSettings.label': 'Importer les réglages',
  'workbench.settings.def.data.importSettings.description':
    'Charge les réglages depuis un fichier JSON exporté précédemment.',
  'workbench.settings.def.data.importSettings.action.label': 'Importer…',
  'workbench.settings.def.data.exportObservabilityLog.label': 'Exporter le journal de diagnostic',
  'workbench.settings.def.data.exportObservabilityLog.description':
    'Télécharge les 500 derniers événements structurés (recompilations de règles, erreurs de requêtes, ' +
    "changements d'espace de travail) en JSON. Local uniquement ; rien ne quitte l'appareil sauf si vous " +
    'joignez vous-même le fichier à un rapport de bogue.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'Exporter le journal',
  'workbench.settings.def.data.clearObservabilityLog.label': 'Effacer le journal de diagnostic',
  'workbench.settings.def.data.clearObservabilityLog.description':
    "Supprime chaque événement en mémoire tampon. N'affecte ni les règles, ni les requêtes, ni aucune donnée " +
    "d'espace de travail.",
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'Effacer',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    'Effacer le journal de diagnostic ? Cela supprime chaque événement en mémoire tampon.',
  'workbench.settings.def.data.exportImportReports.label': "Exporter les rapports d'import",
  'workbench.settings.def.data.exportImportReports.description':
    "Télécharge les rapports structurés d'abandons/transformations de chaque import (curl aujourd'hui ; HAR " +
    '/ Postman / Insomnia ensuite) en JSON. Vit par espace de travail — les 50 imports les plus récents par ' +
    "espace de travail. Ne quitte jamais l'appareil sauf si vous joignez le fichier.",
  'workbench.settings.def.data.exportImportReports.action.label': 'Exporter les rapports',
  'workbench.settings.def.data.clearImportReports.label': "Effacer les rapports d'import",
  'workbench.settings.def.data.clearImportReports.description':
    "Supprime chaque rapport d'import de l'espace de travail actif. N'affecte pas les requêtes elles-mêmes — " +
    "seulement le journal d'audit de ce qui a été abandonné/transformé pendant l'import.",
  'workbench.settings.def.data.clearImportReports.action.label': 'Effacer',
  'workbench.settings.def.data.clearImportReports.confirm':
    "Effacer les rapports d'import de cet espace de travail ? Cette action est irréversible.",
  'workbench.settings.def.data.uploadFile.label': 'Téléverser un fichier',
  'workbench.settings.def.data.uploadFile.description':
    "Ajoute un fichier à l'espace de travail actif pour les corps multipart et les références `{{file.X}}`. " +
    'Les fichiers sont adressés par contenu (sha256), donc re-téléverser les mêmes octets reste un seul ' +
    "blob. Le stockage est l'IndexedDB local ; rien ne quitte l'appareil.",
  'workbench.settings.def.data.uploadFile.action.label': 'Téléverser…',
  'workbench.settings.def.data.exportFilesManifest.label': 'Exporter le manifeste des fichiers',
  'workbench.settings.def.data.exportFilesManifest.description':
    "Télécharge la liste des fichiers de l'espace de travail actif (nom, hachage, taille, type MIME) en " +
    "JSON. Les octets ne sont PAS inclus — c'est un manifeste pour l'audit et le re-téléversement par des " +
    'coéquipiers, pas une sauvegarde du contenu.',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'Exporter le manifeste',
  'workbench.settings.def.data.filesBrowser.label': 'Fichiers',
  'workbench.settings.def.data.filesBrowser.description':
    "Chaque blob téléversé dans l'espace de travail actif. Téléchargez les octets, copiez le hachage court " +
    'ou supprimez. Les métadonnées de fichier (nom, taille, type MIME, hachage) sont cherchables dans ' +
    "l'index des réglages.",
  'workbench.settings.def.data.clearAllFiles.label': 'Effacer tous les fichiers',
  'workbench.settings.def.data.clearAllFiles.description':
    "Supprime chaque blob de fichier de l'espace de travail actif. Les requêtes qui référencent ces fichiers " +
    "via des parties multipart échoueront à l'exécution ; vous devrez re-téléverser les fichiers ou " +
    'modifier ces requêtes.',
  'workbench.settings.def.data.clearAllFiles.action.label': 'Tout effacer',
  'workbench.settings.def.data.clearAllFiles.confirm':
    'Supprimer chaque fichier de cet espace de travail ? Les parties multipart qui les référencent ' +
    "échoueront à l'envoi.",
  'workbench.settings.def.data.resetAllSettings.label': 'Réinitialiser tous les réglages',
  'workbench.settings.def.data.resetAllSettings.description':
    'Ramène chaque réglage de chaque catégorie à sa valeur par défaut.',
  'workbench.settings.def.data.resetAllSettings.action.label': 'Rétablir les valeurs par défaut',
  'workbench.settings.def.data.resetAllSettings.confirm':
    'Réinitialiser chaque réglage à sa valeur par défaut ? Cette action est irréversible.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'Mise à jour logicielle',
  'workbench.settings.def.updates.state.description':
    "Statut de mise à jour actuel. Le téléchargement et l'installation exigent toujours votre clic explicite.",
  'workbench.settings.def.updates.check.label': 'Rechercher les mises à jour',
  'workbench.settings.def.updates.check.description':
    'Cherche de nouvelles versions une fois par jour et affiche un point de notification quand une est ' +
    "disponible. La vérification ne télécharge rien et n'envoie rien sur vous ni sur cette installation — " +
    'elle lit une liste publique de versions et compare localement. « Correctifs de sécurité uniquement » ' +
    'reste silencieux sauf si une version corrige un problème de sécurité affectant la version que vous ' +
    'exécutez. Les mises à jour ne sont jamais installées sans votre action explicite.',
  'workbench.settings.def.updates.check.option.all.label': 'Toutes les versions',
  'workbench.settings.def.updates.check.option.security-only.label': 'Correctifs de sécurité uniquement',
  'workbench.settings.def.updates.check.option.off.label': 'Désactivé',
  'workbench.settings.def.updates.channel.label': 'Canal de mise à jour',
  'workbench.settings.def.updates.channel.description':
    'Quelle ligne de versions les vérifications suivent. Bêta reçoit les nouveautés plus tôt mais peut être ' +
    "moins poli. Revenir à Stable ne rétrograde jamais — vous gardez la version installée jusqu'à ce que la " +
    'prochaine version stable la dépasse. Les avis de sécurité suivent toujours la ligne stable sur les deux ' +
    'canaux.',
  'workbench.settings.def.updates.channel.option.stable.label': 'Stable',
  'workbench.settings.def.updates.channel.option.beta.label': 'Bêta',
  'workbench.settings.def.updates.showWhatsNew.label': 'Afficher les nouveautés après une mise à jour',
  'workbench.settings.def.updates.showWhatsNew.description':
    'Ouvre un onglet avec les points forts de la version à la première ouverture du workbench après une ' +
    "version majeure. Les correctifs ne l'ouvrent jamais — ils restent dans la chronologie des " +
    "notifications. Les notes sont livrées dans l'application ; rien n'est téléchargé.",
  'workbench.settings.def.updates.autoDownload.label': 'Télécharger les mises à jour automatiquement',
  'workbench.settings.def.updates.autoDownload.description':
    "Quand une mise à jour est trouvée, la récupère aussitôt en arrière-plan pour que l'installation ne soit " +
    "qu'un redémarrage — utile si vous voulez les correctifs prêts au plus vite. Désactivé, vous cliquez " +
    "vous-même sur Télécharger. Dans les deux cas, rien ne s'installe tant que vous ne redémarrez pas " +
    "l'application ou ne le décidez pas.",

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'Version',
  'workbench.settings.def.about.version.description': "La version de l'extension actuellement installée.",
  'workbench.settings.def.about.build.label': 'Build',
  'workbench.settings.def.about.build.description': 'Numéro et date de build.',
  'workbench.settings.def.about.commit.label': 'Commit',
  'workbench.settings.def.about.commit.description': 'Commit git dont ce build a été produit.',
  'workbench.settings.def.about.protocol.label': 'Protocole',
  'workbench.settings.def.about.protocol.description':
    "Version du protocole de câblage que cette extension parle avec l'application de bureau. Les pairs " +
    'désaccordés sont rejetés avec une invite de mise à jour claire.',
  'workbench.settings.def.about.browser.label': 'Navigateur',
  'workbench.settings.def.about.browser.description': 'Navigateur et plateforme détectés.',
} as const satisfies Catalog;
