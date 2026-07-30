/**
 * Workbench live/workflows station — French. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Reuses the live
 * register shipped in fr/workbench-variables + fr/shared-components:
 * Refresh = `Actualiser`, Override = `substitution`, stale =
 * `périmée`, needs re-run = `réexécution requise`, tier = `palier`;
 * `workflow` and `backoff` stay dev loanwords (m.), `Live` rides raw.
 * Technical plane stays raw inside keyed sentences: `{{live.NAME}}`
 * syntax, policy kind ids (expires-in / expires-at), `lead` /
 * `dependsOn` / oh.* field tokens, step ids / capture names, code
 * examples, MV3, AND/OR/OPEN, server error text ({error}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'au repos',
  'workbench.editors.live.circuit.idleHint': 'Aucun cache pour le moment — lancez une actualisation pour alimenter.',
  'workbench.editors.live.circuit.pausedLabel': 'suspendu',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        'Le circuit est ouvert après {count} échec consécutif. Le nouvel essai automatique est différé. ' +
        'Cliquez sur Réessayer maintenant pour contourner le backoff.',
      many:
        'Le circuit est ouvert après {count} échecs consécutifs. Le nouvel essai automatique est différé. ' +
        'Cliquez sur Réessayer maintenant pour contourner le backoff.',
      other:
        'Le circuit est ouvert après {count} échecs consécutifs. Le nouvel essai automatique est différé. ' +
        'Cliquez sur Réessayer maintenant pour contourner le backoff.',
    }),
  'workbench.editors.live.circuit.probingLabel': 'sondage…',
  'workbench.editors.live.circuit.probingHint': 'Tentative de sonde en vol — un seul succès referme le circuit.',
  'workbench.editors.live.circuit.retryLabel': 'tentative {attempt} sur 3',
  'workbench.editors.live.circuit.retryHint':
    'Palier de nouvelles tentatives avant disjonction — essais rapides avec un backoff de 5–10s entre ' +
    "tentatives. Le circuit s'ouvre après 3 échecs consécutifs.",
  'workbench.editors.live.circuit.healthyLabel': 'sain',
  'workbench.editors.live.circuit.healthyHint': 'Circuit fermé, aucun échec récent.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': 'dernière actualisation {when}',
  'workbench.editors.live.schedule.manualOnly': 'actualisation manuelle uniquement',
  'workbench.editors.live.schedule.autoRefresh': 'actualisation auto {when}',
  'workbench.editors.live.schedule.expires': 'expire {when}',
  'workbench.editors.live.policy.interval': 'toutes les {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in depuis {source} (avance {lead}s)',
  'workbench.editors.live.policy.expiresAt': 'expires-at depuis {source} (avance {lead}s)',
  'workbench.editors.live.policy.manual': 'actualisation manuelle',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': 'Terminée à la dernière exécution',
  'workbench.editors.live.stepRun.failed': 'La dernière exécution a échoué à cette étape',
  'workbench.editors.live.stepRun.extractFailed': "Récupérée, mais un extracteur de capture n'a pas correspondu",
  'workbench.editors.live.stepRun.skipped': "Sautée par sa condition d'exécution à la dernière exécution",
  'workbench.editors.live.stepRun.notRun': "Pas encore partie d'une exécution réussie",
  'workbench.editors.live.maskEmpty': '(vide)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': 'Nom',
  'workbench.editors.live.form.descriptionPlaceholder': 'Description (facultative)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'Source introuvable.',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': 'Désactivée',
  'workbench.editors.live.variable.overrideTag': 'substitution',
  'workbench.editors.live.variable.refresh': 'Actualiser',
  'workbench.editors.live.variable.valueLabel': 'Valeur',
  'workbench.editors.live.variable.neverRefreshed': '(jamais actualisée)',
  'workbench.editors.live.variable.nameLabel': 'Nom',
  'workbench.editors.live.variable.nameHint': 'Référencez-la comme {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': 'Description',
  'workbench.editors.live.variable.bindingSection': 'Liaison',
  'workbench.editors.live.variable.workflowLabel': 'Workflow',
  'workbench.editors.live.variable.stepLabel': 'Étape',
  'workbench.editors.live.variable.captureLabel': 'Capture',
  'workbench.editors.live.variable.selectWorkflow': 'Sélectionner un workflow',
  'workbench.editors.live.variable.selectStep': 'Sélectionner une étape',
  'workbench.editors.live.variable.selectCapture': 'Sélectionner une capture',
  'workbench.editors.live.variable.stepOption': '{id} ({count} captures)',
  'workbench.editors.live.variable.openFlow': 'Ouvrir le flux',
  'workbench.editors.live.variable.overrideSection': 'Substitution manuelle',
  'workbench.editors.live.variable.overrideValuePlaceholder': 'Valeur fixe de substitution',
  'workbench.editors.live.variable.overrideExpiresLabel': 'Expire (ms)',
  'workbench.editors.live.variable.overrideExpiresHint':
    "Epoch ms à l'horloge — laissez vide pour une substitution permanente",
  'workbench.editors.live.variable.applyOverride': 'Appliquer la substitution',
  'workbench.editors.live.variable.clearOverride': 'Effacer',
  'workbench.editors.live.variable.setOverride': 'Définir une substitution manuelle',
  'workbench.editors.live.variable.overrideNote':
    "Le résolveur sert la valeur épinglée ; le planificateur continue d'actualiser le workflow sous-jacent.",
  'workbench.editors.live.variable.deletedElsewhere': 'La source a été supprimée depuis un autre onglet',
  'workbench.editors.live.variable.saveFailed': "Impossible d'enregistrer la variable live",
  'workbench.editors.live.variable.refreshFailed': "Échec de l'actualisation : {error}",
  'workbench.editors.live.variable.refreshed': 'Actualisée',
  'workbench.editors.live.variable.overrideSaveFailed': "Échec de l'enregistrement de la substitution.",
  'workbench.editors.live.variable.overrideApplied': 'Substitution appliquée',
  'workbench.editors.live.variable.overrideCleared': 'Substitution effacée',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': 'Nouvelle variable Live',
  'workbench.editors.live.create.namePlaceholder': 'Nom (p. ex. accessToken)',
  'workbench.editors.live.create.referenceAs': 'Référencez-la comme {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'Créer un workflow',
  'workbench.editors.live.create.noWorkflows': 'Aucun workflow pour le moment.',
  'workbench.editors.live.create.nameRequired': 'Le nom est requis',
  'workbench.editors.live.create.bindingRequired': 'Sélectionnez un workflow, une étape et une capture',
  'workbench.editors.live.create.createFailed': 'Impossible de créer la variable live',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': 'Activée',
  'workbench.editors.live.toggles.enabledTooltip':
    'Quand désactivé, les références {{live.NAME}} cessent de se résoudre dans les règles et les requêtes.',
  'workbench.editors.live.toggles.waitForFresh': 'Attendre une valeur fraîche',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    "Avant d'appliquer les règles, attend que le workflow sous-jacent termine une actualisation (jusqu'à " +
    "~5s). Désactivé : les règles utilisent la dernière valeur en cache et l'actualisation se fait en " +
    "arrière-plan — plus rapide, mais la valeur peut être brièvement périmée après le réveil de l'extension.",

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': 'Manuelle uniquement',
  'workbench.editors.live.refreshPolicy.interval': 'Intervalle fixe',
  'workbench.editors.live.refreshPolicy.expiresIn': 'Expire dans N secondes (relatif)',
  'workbench.editors.live.refreshPolicy.expiresAt': "Expire à l'epoch ms (absolu)",
  'workbench.editors.live.refreshPolicy.leadUnit': 'avance s',
  'workbench.editors.live.refreshPolicy.selectCapture': 'Sélectionner la capture',
  'workbench.editors.live.refreshPolicy.noCaptures': 'Aucune capture définie pour le moment.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    "Les intervalles sous la minute butent sur le plancher d'alarme MV3 et brûlent le quota rapidement. À " +
    "n'utiliser qu'en cas de nécessité.",
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix':
    'Valeur de capture = secondes avant expiration (p. ex. OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': "). L'actualisation se déclenche `lead` secondes avant",
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'Valeur de capture = epoch unix absolu en',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'millisecondes',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix':
    "). L'actualisation se déclenche `lead` secondes avant ce moment.",
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    "Ajoutez d'abord une capture au workflow pour que le calcul d'expiration ait une source.",

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': 'Éditeur',
  'workbench.editors.live.workflow.viewPreview': 'Aperçu',
  'workbench.editors.live.workflow.refresh': 'Actualiser',
  'workbench.editors.live.workflow.disabledTag': 'Désactivé',
  'workbench.editors.live.workflow.notFound': 'Workflow introuvable.',
  'workbench.editors.live.workflow.deletedElsewhere': 'Le workflow a été supprimé depuis un autre onglet',
  'workbench.editors.live.workflow.saveFailed': "Impossible d'enregistrer le workflow",
  'workbench.editors.live.workflow.createFailed': 'Impossible de créer le workflow',
  'workbench.editors.live.workflow.refreshed': 'Actualisé',
  'workbench.editors.live.workflow.refreshFailed': "Échec de l'actualisation : {error}",
  'workbench.editors.live.workflow.defaultName': 'Workflow',
  'workbench.editors.live.workflow.newDraftName': 'Nouveau workflow',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'Le workflow a des problèmes structurels',
  'workbench.editors.live.form.stepsTitle': 'Étapes ({count})',
  'workbench.editors.live.form.addStepButton': 'Étape',
  'workbench.editors.live.form.noSteps':
    'Aucune étape pour le moment — ajoutez-en une pour brancher une requête + une extraction dans ce workflow.',
  'workbench.editors.live.form.enabledAria': 'Workflow activé',
  'workbench.editors.live.form.enabled': 'Activé',
  'workbench.editors.live.form.disabled': 'Désactivé',
  'workbench.editors.live.form.parallelLabel': 'Exécuter les étapes indépendantes en parallèle',
  'workbench.editors.live.form.parallelTooltip':
    "Séquentiel uniquement en v1. L'exécution parallèle arrivera dans une prochaine version.",
  'workbench.editors.live.form.refreshPolicySection': "Politique d'actualisation",

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'Étape {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': 'nom',
  'workbench.editors.live.step.typeTooltip':
    "Type d'étape — Foreach et Composite arriveront dans une prochaine version.",
  'workbench.editors.live.step.typeRequest': 'Requête',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "s'exécute si {count} condition",
      many: "s'exécute si {count} conditions",
      other: "s'exécute si {count} conditions",
    }),
  'workbench.editors.live.step.priorityTag': 'priorité : {ref}',
  'workbench.editors.live.step.scriptsTag': 'scripts',
  'workbench.editors.live.step.selectRequest': 'Sélectionner une requête',
  'workbench.editors.live.step.descriptionPlaceholder': "Description facultative de l'étape",
  'workbench.editors.live.step.capturesHeader': 'CAPTURES ({count})',
  'workbench.editors.live.step.addCapture': '+ Capture',
  'workbench.editors.live.step.captureRequired':
    "Au moins une capture est requise avant qu'une LV puisse se lier à cette étape.",
  'workbench.editors.live.step.removeCaptureAria': 'Retirer la capture {name}',
  'workbench.editors.live.step.exposeAria': 'Exposer la capture {name} comme variable live',
  'workbench.editors.live.step.exposeAs': 'Exposer comme',
  'workbench.editors.live.step.exposeTooltip':
    "Quand activé, l'enregistrement du workflow crée une variable Live qui résout `{{live.<name>}}` depuis " +
    "cette capture. Désactivez pour n'utiliser la capture qu'à l'intérieur de ce workflow (p. ex. via " +
    '{{step.<stepId>.<captureName>}}).',
  'workbench.editors.live.step.afterChip': '↳ après {parents}',
  'workbench.editors.live.step.implicitMark': '(implicite)',
  'workbench.editors.live.step.implicitTooltip':
    "Dépendance implicite sur l'étape précédente (aucun dependsOn explicite déclaré). Définissez un dependsOn " +
    'explicite pour verrouiller la relation.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Dépend de',
  'workbench.editors.live.sections.dependsOnImplicit': '(implicite — étape précédente)',
  'workbench.editors.live.sections.dependsOnRoot': '(racine)',
  'workbench.editors.live.sections.dependsOnPlaceholder': 'Sélectionner la ou les étapes ancêtres — vide = racine',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    "Aucun dependsOn explicite — dépend implicitement de l'étape précédente dans l'ordre déclaré.",
  'workbench.editors.live.sections.dependsOnRootHint': "Racine explicite — s'exécute dès le démarrage du workflow.",
  'workbench.editors.live.sections.useImplicit': "Utiliser l'implicite",
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "L'étape attend que {count} ancêtre se termine ou saute.",
      many: "L'étape attend que {count} ancêtres se terminent ou sautent.",
      other: "L'étape attend que {count} ancêtres se terminent ou sautent.",
    }),
  'workbench.editors.live.sections.reset': 'Réinitialiser',
  'workbench.editors.live.sections.runCondition': "Condition d'exécution",
  'workbench.editors.live.sections.none': '(aucune)',
  'workbench.editors.live.sections.priority': 'Priorité',
  'workbench.editors.live.sections.priorityStepPlaceholder': 'Étape ancêtre',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'Nom de la capture',
  'workbench.editors.live.sections.sortNumeric': 'Numérique',
  'workbench.editors.live.sections.sortLexicographic': 'Lexicographique',
  'workbench.editors.live.sections.priorityTooltip':
    "Quand plusieurs étapes peuvent s'exécuter ensuite, celle avec la valeur de priorité la plus basse part " +
    'en premier. Les valeurs manquantes se classent en dernier.',
  'workbench.editors.live.sections.clear': 'Effacer',
  'workbench.editors.live.sections.retryPolicy': 'Politique de nouvelles tentatives',
  'workbench.editors.live.sections.retrySummary': '({count} tentatives)',
  'workbench.editors.live.sections.retrySummaryExponential': '({count} tentatives, exponentiel)',
  'workbench.editors.live.sections.attemptsPlaceholder': 'Tentatives',
  'workbench.editors.live.sections.attemptsPrefix': 'tentatives',
  'workbench.editors.live.sections.delayPrefix': 'délai ms',
  'workbench.editors.live.sections.backoffFixed': 'Fixe',
  'workbench.editors.live.sections.backoffExponential': 'Exponentiel',
  'workbench.editors.live.sections.retryOnNetwork': 'Erreurs réseau uniquement',
  'workbench.editors.live.sections.retryOn5xx': 'Réseau + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Réseau + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Réseau + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Personnalisé (modifié comme données)',
  'workbench.editors.live.sections.retryTooltip':
    "Les échecs réseau (DNS, connexion, délai dépassé) réessaient toujours tant qu'il reste des tentatives. " +
    'Ajouter une correspondance de statut réessaie aussi les réponses correspondantes ; les erreurs ' +
    "d'extraction ne réessaient jamais. Videz le champ tentatives pour désactiver les nouvelles tentatives.",
  'workbench.editors.live.sections.timeout': "Délai d'expiration",
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'Aucun délai',
  'workbench.editors.live.sections.timeoutTooltip':
    "Par tentative — la requête (lecture du corps incluse) s'interrompt au-delà de ce plafond. Une étape qui " +
    'réessaie dispose du délai complet à chaque tentative. Videz le champ pour aucun plafond.',
  'workbench.editors.live.sections.scripts': 'Scripts',
  'workbench.editors.live.sections.scriptsOn': '(activés)',
  'workbench.editors.live.sections.scriptsOff': '(désactivés)',
  'workbench.editors.live.sections.runScriptsAria': 'Exécuter les scripts de la requête à cette étape',
  'workbench.editors.live.sections.runScriptsLabel': 'Exécuter les scripts pré-requête / post-réponse de la requête',
  'workbench.editors.live.sections.scriptsTooltip':
    "S'exécute à chaque tentative de la chaîne. Les scripts d'étape reçoivent une surface oh.* en lecture " +
    'seule (oh.sendRequest et oh.variables.set sont rejetés). Une erreur de script ou une assertion oh.test ' +
    "échouée fait échouer l'étape, si bien que les dernières bonnes valeurs sont préservées — les assertions " +
    "conditionnent ce que ce workflow publie. Nécessite un runtime capable d'exécuter des scripts ; sur les " +
    "hôtes qui en sont dépourvus, l'étape s'exécute sans scripts.",

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'Statut',
  'workbench.editors.live.gate.kindCaptureExists': 'La capture existe',
  'workbench.editors.live.gate.kindCaptureEquals': 'La capture égale',
  'workbench.editors.live.gate.kindCaptureMatches': 'La capture correspond',
  'workbench.editors.live.gate.kindNumericCompare': 'Comparaison numérique de capture',
  'workbench.editors.live.gate.kindInList': 'Capture dans une liste',
  'workbench.editors.live.gate.kindHeaderContains': "L'en-tête contient",
  'workbench.editors.live.gate.futureNumericCompare': 'Comparaison numérique — dans une prochaine version.',
  'workbench.editors.live.gate.futureInList': 'Correspondance en liste — dans une prochaine version.',
  'workbench.editors.live.gate.futureHeaderContains': "« L'en-tête contient » — dans une prochaine version.",
  'workbench.editors.live.gate.status2xx': '2xx (tout succès)',
  'workbench.editors.live.gate.status3xx': '3xx (redirection)',
  'workbench.editors.live.gate.status4xx': '4xx (erreur client)',
  'workbench.editors.live.gate.status5xx': '5xx (erreur serveur)',
  'workbench.editors.live.gate.statusEquals': 'égale…',
  'workbench.editors.live.gate.statusNotEquals': 'différent de…',
  'workbench.editors.live.gate.statusOneOf': 'parmi…',
  'workbench.editors.live.gate.allAnd': 'Toutes (AND)',
  'workbench.editors.live.gate.anyOr': 'Au moins une (OR)',
  'workbench.editors.live.gate.orTooltip':
    "La logique OR arrivera dans une prochaine version. Utilisez pour l'instant plusieurs étapes avec des " +
    'conditions mutuellement exclusives.',
  'workbench.editors.live.gate.matchModesAria': 'À propos des modes de correspondance',
  'workbench.editors.live.gate.noConditions':
    "Aucune condition — l'étape s'exécute dès que ses dépendances se terminent.",
  'workbench.editors.live.gate.conditionCount': '{count} condition(s)',
  'workbench.editors.live.gate.addCondition': 'Ajouter une condition',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'Étape',
  'workbench.editors.live.gate.capturePlaceholder': 'Nom de la capture',
  'workbench.editors.live.gate.equalsPlaceholder': "Valeur d'égalité",
  'workbench.editors.live.gate.removeClauseAria': 'Retirer la clause {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Correspond à tout statut de la classe (p. ex. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': 'Le statut de {stepId} est {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': "Le statut de {stepId} n'est pas {value}",
  'workbench.editors.live.graph.clauseStatusIn': 'Le statut de {stepId} est dans [{list}]',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} existe',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} correspond à /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': 'Ajouter une étape',
  'workbench.editors.live.graph.menuEditStep': "Modifier l'étape",
  'workbench.editors.live.graph.menuDeleteStep': "Supprimer l'étape",
  'workbench.editors.live.graph.connectTitle': 'Glissez vers une autre étape pour ajouter une dépendance',
  'workbench.editors.live.graph.removeDependency': 'Retirer la dépendance',
  'workbench.editors.live.graph.zoomIn': 'Zoom avant',
  'workbench.editors.live.graph.zoomOut': 'Zoom arrière',
  'workbench.editors.live.graph.recenter': 'Recentrer',
  'workbench.editors.live.graph.legendClick': 'clic',
  'workbench.editors.live.graph.legendSelect': 'sélectionner',
  'workbench.editors.live.graph.legendEditKeys': '2×clic / ⏎',
  'workbench.editors.live.graph.legendEdit': 'modifier',
  'workbench.editors.live.graph.legendDelete': 'supprimer',
  'workbench.editors.live.graph.legendConnectKeys': 'glisser ○',
  'workbench.editors.live.graph.legendConnect': 'connecter',
  'workbench.editors.live.graph.legendRightClick': 'clic droit',
  'workbench.editors.live.graph.legendMenu': 'menu',
  'workbench.editors.live.graph.legendDragNode': 'glisser le nœud',
  'workbench.editors.live.graph.legendMove': 'déplacer',
  'workbench.editors.live.graph.legendDragBg': 'glisser le fond',
  'workbench.editors.live.graph.legendPan': 'panoramique',
  'workbench.editors.live.graph.legendScroll': 'défilement',
  'workbench.editors.live.graph.legendZoom': 'zoom',
  'workbench.editors.live.graph.editStepInForm': "Modifier l'étape dans le formulaire",
  'workbench.editors.live.graph.requestNotFound': 'Requête introuvable',
  'workbench.editors.live.graph.noRequestSelected': 'Aucune requête sélectionnée',
  'workbench.editors.live.graph.noCaptures': 'Aucune capture',
  'workbench.editors.live.graph.orderedBy': 'Ordonné par {ref}',
  'workbench.editors.live.graph.exposedAs': 'Exposée comme {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending':
    'Exposée comme {{live.{name}}} — en attente de la première exécution',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'Statut des workflows',
  'workbench.editors.live.status.noEnvironment': 'Aucun environnement',
  'workbench.editors.live.status.unknownEnv': 'Env inconnu',
  'workbench.editors.live.status.activeSuffix': '(actif)',
  'workbench.editors.live.status.pillPaused': 'SUSPENDU',
  'workbench.editors.live.status.pillProbing': 'SONDAGE',
  'workbench.editors.live.status.pillRetrying': 'NOUVEL ESSAI',
  'workbench.editors.live.status.pillHealthy': 'SAIN',
  'workbench.editors.live.status.summaryHealthy': '{count} sains',
  'workbench.editors.live.status.summaryRetrying': '{count} en nouvel essai',
  'workbench.editors.live.status.summaryProbing': '{count} en sondage',
  'workbench.editors.live.status.summaryPaused': '{count} suspendus',
  'workbench.editors.live.status.loading': 'Chargement…',
  'workbench.editors.live.status.empty':
    'Aucune exécution de workflow pour le moment. Créez un workflow et cliquez sur Actualiser pour alimenter.',
  'workbench.editors.live.status.failuresCount': 'échecs : {count}',
  'workbench.editors.live.status.failuresTooltip': 'Échecs consécutifs depuis la dernière actualisation réussie.',
  'workbench.editors.live.status.openingsCount': 'ouvertures : {count}',
  'workbench.editors.live.status.openingsTooltip':
    'Nombre de passages du circuit à OPEN dans le cycle courant. Divisé par deux après une récupération bien ' +
    'installée, décrémenté de un après une récupération récente.',
  'workbench.editors.live.status.nextAttempt': 'prochaine tentative {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    "Heure à laquelle la prochaine sonde automatique s'exécutera. Cliquez sur Actualiser maintenant pour la " +
    'court-circuiter.',
  'workbench.editors.live.status.refreshNow': 'Actualiser maintenant',
  'workbench.editors.live.status.resetCircuit': 'Réinitialiser le circuit',
  'workbench.editors.live.status.resetCircuitTooltip':
    "Efface les compteurs d'échec + le backoff en attente. N'exécute pas de sonde.",
  'workbench.editors.live.status.circuitReset': 'Circuit réinitialisé',
  'workbench.editors.live.status.resetFailed': 'Échec de la réinitialisation : {error}',
  'workbench.editors.live.status.dragToResize': 'Glisser pour redimensionner',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'liée : {count} variable',
      many: 'liées : {count} variables',
      other: 'liées : {count} variables',
    }),
  'workbench.editors.live.status.needsReRun': 'réexécution requise',
  'workbench.editors.live.status.needsReRunTooltip':
    "Le workflow ou une entrée qu'il résout a changé depuis l'extraction de cette valeur — lancez Actualiser " +
    'pour ré-extraire.',
  'workbench.editors.live.status.neverRunForEnv': 'jamais exécuté pour cet env — cliquez sur Actualiser pour alimenter',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': "valeurs préservées d'une exécution antérieure",
  'workbench.editors.live.runOverlay.responseBytes': 'réponse {bytes} octets',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': 'Créer un workflow depuis « {name} »',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Créer le workflow ({count} étape)',
      many: 'Créer le workflow ({count} étapes)',
      other: 'Créer le workflow ({count} étapes)',
    }),
  'workbench.editors.live.fromRequests.empty': "Ce conteneur n'a aucune requête pour construire un workflow.",
  'workbench.editors.live.fromRequests.hint':
    "Chaque requête sélectionnée devient une étape du workflow, dans l'ordre affiché.",

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'groupe',
  'workbench.editors.live.extractor.groupBody': 'Corps de la réponse',
  'workbench.editors.live.extractor.groupResponse': 'Réponse',
  'workbench.editors.live.extractor.wholeBody': 'Corps entier',
  'workbench.editors.live.extractor.jsonPath': 'Chemin JSON',
  'workbench.editors.live.extractor.regex': 'Regex',
  'workbench.editors.live.extractor.header': 'En-tête',
  'workbench.editors.live.extractor.statusCode': 'Code de statut',
} as const satisfies Catalog;
