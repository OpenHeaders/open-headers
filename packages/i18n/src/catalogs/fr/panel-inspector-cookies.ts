/**
 * DevTools panel — inspector Cookies tab — French. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by design:
 * cookie names/values, Set-Cookie attribute names as titles and field
 * labels (Name / Value / Domain / Path / Expires / SameSite /
 * HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary, `__Host-` /
 * `__Secure-` prefixes, format nouns, and byte figures.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ──────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    'Filtrer — texte, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Filtrer les cookies',
  'panel.inspector.cookies.empty': 'Aucun cookie envoyé ni reçu.',

  // Table column headers — parity-shaped grid headers stay raw.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': '{count} envoyés · {bytes} B',
  'panel.inspector.cookies.footprint.set': '{count} définis · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} seront rejetés',
  'panel.inspector.cookies.footprint.filteredOut': '{count} filtrés',
  'panel.inspector.cookies.footprint.flagged': '{count} signalés',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Substituer les cookies',
  'panel.inspector.cookies.cta.overrideCookiesTitle':
    'Créer une règle qui change les cookies des requêtes correspondantes',
  'panel.inspector.cookies.cta.requestCookies': 'Cookies de requête…',
  'panel.inspector.cookies.cta.requestCookiesTitle': "Remplacer l'en-tête Cookie envoyé sur cette requête",
  'panel.inspector.cookies.cta.responseCookies': 'Cookies de réponse…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Remplacer un en-tête Set-Cookie renvoyé par le serveur',
  'panel.inspector.cookies.cta.noCookies': "N'envoyer aucun cookie…",
  'panel.inspector.cookies.cta.noCookiesTitle':
    "Supprimer entièrement l'en-tête Cookie, pour que le serveur ne voie aucun cookie",
  'panel.inspector.cookies.cta.addCookie': 'Ajouter un cookie',
  'panel.inspector.cookies.cta.addCookieTitle': 'Ajouter un cookie à la réserve du navigateur (y compris HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Substituer les cookies',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Règle',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    "Crée une règle qui réécrit les en-têtes Cookie / Set-Cookie des requêtes correspondantes tant qu'elle " +
    'se déclenche. La réserve de cookies du navigateur reste intacte.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Choix',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Cookies de requête',
  'panel.inspector.cookies.ctaInfo.requestDesc': "Remplacer l'en-tête Cookie que le navigateur envoie.",
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Cookies de réponse',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Remplacer un en-tête Set-Cookie renvoyé par le serveur.',
  'panel.inspector.cookies.ctaInfo.noneLabel': "N'envoyer aucun cookie",
  'panel.inspector.cookies.ctaInfo.noneDesc':
    "Supprimer entièrement l'en-tête Cookie — le serveur voit une requête sans cookies.",
  'panel.inspector.cookies.ctaInfo.addTitle': 'Ajouter un Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Réserve du navigateur',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Écrit un vrai cookie dans la réserve du navigateur — le même magasin que le navigateur montre sous ' +
    'Application → Cookies.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    "Il persiste au-delà de cette requête et le navigateur l'attache partout où son domaine, son chemin et " +
    "ses drapeaux correspondent — sans règle. C'est aussi le moyen de créer des cookies HttpOnly, que les " +
    'scripts de page ne peuvent pas définir. La valeur accepte les références {{variable}}, résolues une fois ' +
    "à l'enregistrement — la réserve garde cet instantané même si la variable change ensuite ; utilisez " +
    'Substituer les cookies quand la valeur doit suivre la variable.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie « {name} » enregistré',
  'panel.inspector.cookies.toast.saveFailed': "Impossible d'enregistrer le cookie « {name} »",
  'panel.inspector.cookies.toast.saveFailedWithError': "Impossible d'enregistrer le cookie « {name} » — {error}",
  'panel.inspector.cookies.toast.deleted': 'Cookie « {name} » supprimé',
  'panel.inspector.cookies.toast.deleteFailed': 'Impossible de supprimer le cookie « {name} »',
  'panel.inspector.cookies.toast.mergeApplied':
    "Fusion appliquée au formulaire — Enregistrer l'écrit dans le navigateur",
  'panel.inspector.cookies.confirmDelete.title': 'Supprimer le cookie « {name} » ?',
  'panel.inspector.cookies.confirmDelete.content':
    "Cela le retire de la réserve de cookies du navigateur. La page cessera de l'envoyer.",
  'panel.inspector.cookies.confirmDelete.ok': 'Supprimer',

  // More filters ▾ / View ▾ — this tab's own menus.
  'panel.inspector.cookies.moreFilters.label': 'Filtres supplémentaires',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Problèmes uniquement',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': 'Tiers uniquement',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Modifiés par une règle uniquement',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Afficher les cookies de requête filtrés',
  'panel.inspector.cookies.view.label': 'Vue',
  'panel.inspector.cookies.view.sort': 'Tri',
  'panel.inspector.cookies.view.sortOriginal': 'Original',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Size',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Relatif',
  'panel.inspector.cookies.view.expiresAbsolute': 'Absolu',
  'panel.inspector.cookies.view.decodeValues': 'Décoder les valeurs URL-encodées',
  'panel.inspector.cookies.view.groupByRole': 'Grouper par rôle (auth / préf / suivi)',
  'panel.inspector.cookies.view.showTags': 'Afficher les étiquettes',
  'panel.inspector.cookies.view.showSuggestions': 'Afficher les suggestions',

  // Section chrome.
  'panel.inspector.cookies.section.responseCookies': 'Cookies de réponse',
  'panel.inspector.cookies.section.requestCookies': 'Cookies de requête',
  'panel.inspector.cookies.section.countOf': '{visible} sur {total}',

  // Role vocabulary — product classifier copy.
  'panel.inspector.cookies.role.chipAuth': 'auth ?',
  'panel.inspector.cookies.role.chipTracking': 'suivi ?',
  'panel.inspector.cookies.role.chipPref': 'préf',
  'panel.inspector.cookies.role.sectionAuth': 'Auth et session',
  'panel.inspector.cookies.role.sectionFunctional': 'Fonctionnels',
  'panel.inspector.cookies.role.sectionPref': 'Préférences',
  'panel.inspector.cookies.role.sectionTracking': 'Analytique et suivi',
  'panel.inspector.cookies.role.nounAuth': 'auth / session',
  'panel.inspector.cookies.role.nounTracking': 'analytique / suivi',
  'panel.inspector.cookies.role.nounPref': 'préférence / consentement',
  'panel.inspector.cookies.role.nounOther': 'cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — cookie {noun}.',
  'panel.inspector.cookies.role.tooltipAuth': "Ressemble à un cookie d'auth / de session (heuristique).",
  'panel.inspector.cookies.role.tooltipTracking': "Ressemble à un cookie d'analytique / de suivi (heuristique).",
  'panel.inspector.cookies.role.tooltipPref': 'Un cookie de préférence utilisateur.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'partitionné',
  'panel.inspector.cookies.chips.partitionedTitle': 'Isolé au site de premier niveau : {key}',
  'panel.inspector.cookies.chips.thirdParty': 'tiers',
  'panel.inspector.cookies.chips.justSet': "défini à l'instant",
  'panel.inspector.cookies.chips.justSetTitle': 'Défini par cette réponse.',
  'panel.inspector.cookies.chips.dropped': 'rejeté',
  'panel.inspector.cookies.chips.droppedTitle': 'Le navigateur rejettera ce Set-Cookie.',
  'panel.inspector.cookies.chips.filteredOut': 'filtré',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'Non envoyé sur cette requête.',
  'panel.inspector.cookies.chips.problemTitle': 'Voir la suggestion ci-dessus.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — envoyé uniquement en HTTPS.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Secure manquant — SameSite=None exige Secure ; le navigateur rejettera ce cookie.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix':
    'Secure manquant — le préfixe __Host- / __Secure- exige Secure.',
  'panel.inspector.cookies.glyphs.secureOff': "Pas d'attribut Secure.",
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — illisible depuis JavaScript.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Lisible depuis JavaScript (pas de HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict — envoyé uniquement sur les navigations same-site.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — envoyé sur les GET cross-site de premier niveau.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None sans Secure — le navigateur rejettera.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — envoyé sur chaque requête cross-site.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite non spécifié.',

  // Row actions + status dots + name/value tooltips.
  'panel.inspector.cookies.row.copyValue': 'Copier la valeur',
  'panel.inspector.cookies.row.copied': 'Copié',
  'panel.inspector.cookies.row.override': 'Substituer',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Créer une règle pour substituer ce Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Créer une règle pour substituer cette valeur de Cookie',
  'panel.inspector.cookies.row.editCookieTitle': 'Modifier ce cookie dans la réserve du navigateur',
  'panel.inspector.cookies.row.editCookieAria': 'Modifier le cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Supprimer ce cookie de la réserve du navigateur',
  'panel.inspector.cookies.row.deleteCookieAria': 'Supprimer le cookie',
  'panel.inspector.cookies.row.ruleDotTitle': "Une règle modifie l'en-tête {header} sur cette requête",
  'panel.inspector.cookies.row.ruleDotAria': 'Règle appliquée',
  'panel.inspector.cookies.row.editedDotTitle': 'Modifié depuis ce panneau',
  'panel.inspector.cookies.row.editedDotAria': 'Modifié',
  'panel.inspector.cookies.row.hostPrefixHint':
    'Le préfixe __Host- verrouille ce cookie sur un seul hôte : le navigateur impose Secure, Path=/ et ' +
    "l'absence d'attribut Domain. Les lignes Set-Cookie qui violent l'une de ces règles sont rejetées.",
  'panel.inspector.cookies.row.securePrefixHint':
    'Le préfixe __Secure- force ce cookie à être Secure (HTTPS uniquement). Les lignes Set-Cookie sans ' +
    'Secure sont rejetées.',
  'panel.inspector.cookies.row.editedValueTitle': 'Modifié — la requête portait : {value}',
  'panel.inspector.cookies.row.valueNoteResponse':
    'Cette réponse a défini : {value} — la valeur de la réserve a changé depuis.',
  'panel.inspector.cookies.row.valueNoteRequest':
    'Cette requête a envoyé : {value} — la valeur de la réserve a changé depuis.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Statut',
  'panel.inspector.cookies.statusRail.summary':
    'Un carré marque les cookies qui ne sont pas dans leur état brut du navigateur.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Couleurs des carrés',
  'panel.inspector.cookies.statusRail.blue': 'bleu',
  'panel.inspector.cookies.statusRail.blueDesc':
    "Une règle déclenchée sur cette requête modifie l'en-tête Cookie / Set-Cookie de cette direction.",
  'panel.inspector.cookies.statusRail.grey': 'gris',
  'panel.inspector.cookies.statusRail.greyDesc': 'Ajouté ou modifié depuis ce panneau au cours de cette session.',

  // Add / edit popover. The SameSite labels stay raw (round-trip
  // vocabulary); the On/Off projection words translate on BOTH sides
  // (rendered and parsed from these same keys).
  'panel.inspector.cookies.edit.editTitle': 'Modifier le cookie',
  'panel.inspector.cookies.edit.valueChanged': 'valeur modifiée',
  'panel.inspector.cookies.edit.goneNote':
    'Ce cookie a été supprimé dans le navigateur pendant que le formulaire était ouvert — Enregistrer le ' + 'réécrit.',
  'panel.inspector.cookies.edit.openInTab': 'Ouvrir dans un nouvel onglet',
  'panel.inspector.cookies.edit.openDirtyTitle':
    "Enregistrez ou annulez d'abord vos modifications — le document s'ouvre depuis la réserve du navigateur",
  'panel.inspector.cookies.edit.openTitle': 'Ouvrir ce cookie comme onglet de document',
  'panel.inspector.cookies.edit.save': 'Enregistrer',
  'panel.inspector.cookies.edit.unresolved': 'Ne se résout pas — créez la variable ou corrigez la référence.',
  'panel.inspector.cookies.edit.writes': 'Écrit : {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'nom du cookie',
  'panel.inspector.cookies.edit.valuePlaceholder': 'valeur ou {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'À la date',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'Activé',
  'panel.inspector.cookies.edit.flagOff': 'Désactivé',
  // Pre-write constraint sentences.
  'panel.inspector.cookies.edit.constraint.hostSecure': 'Les cookies __Host- doivent avoir le drapeau Secure activé.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    "Les cookies __Host- ne peuvent pas porter d'attribut Domain — activez « Host-only ».",
  'panel.inspector.cookies.edit.constraint.hostPath': 'Les cookies __Host- doivent utiliser le chemin « / ».',
  'panel.inspector.cookies.edit.constraint.securePrefix':
    'Les cookies __Secure- doivent avoir le drapeau Secure activé.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite « {label} » exige le drapeau Secure.',
  // Merge parse-back errors.
  'panel.inspector.cookies.edit.merge.invalidJson':
    "Le résultat fusionné n'est pas du JSON valide — corrigez la syntaxe et refaites la fusion.",
  'panel.inspector.cookies.edit.merge.notObject':
    'Le résultat fusionné doit être un objet JSON avec les champs du cookie.',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" doit être présent comme chaîne.',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" doit être "{on}" ou "{off}".',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" doit être parmi {labels}.',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    '"expires" doit être "{session}" ou une date comme 2026-07-09T14:30.',

  // Edit-form field (i) corpus — titles are the raw attribute names.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Exemple de Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Champ de Cookie',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Drapeau de Cookie',
  'panel.inspector.cookies.fieldInfo.templateNote':
    "Accepte les références {{variable}}, résolues une fois à l'enregistrement — la réserve stocke le texte " +
    'résolu.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    "L'identifiant du cookie. Les navigateurs indexent sur (name, domain, path) — le même nom avec une autre " +
    'portée est un cookie distinct.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'Les préfixes sont imposés par le navigateur : __Host- exige Secure, Path=/ et aucun Domain ; __Secure- ' +
    'exige Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    "La charge utile du cookie — ce que le navigateur renvoie dans l'en-tête Cookie.",
  'panel.inspector.cookies.fieldInfo.value.description':
    'La valeur est un instantané : si la variable change ensuite, la réserve garde ce texte — utilisez une ' +
    'règle Substituer les cookies quand la valeur doit suivre la variable.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Quels hôtes reçoivent le cookie.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'Un domaine simple comme openheaders.com inclut ses sous-domaines (le navigateur le stocke avec un point ' +
    'de tête), sauf si Host-only est activé, ce qui épingle le cookie exactement à cet hôte.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    "Préfixe de chemin d'URL que le cookie emprunte — /api signifie que seules les requêtes sous /api le " + 'portent.',
  'panel.inspector.cookies.fieldInfo.path.description': 'Par défaut : /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'Quand le navigateur supprime le cookie.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    "Les cookies de session vivent jusqu'à la fin de la session du navigateur ; À la date fixe une " +
    'expiration absolue (stockée comme attribut Expires).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'Quand les requêtes cross-site peuvent porter le cookie.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Valeurs',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Requêtes same-site uniquement.',
  'panel.inspector.cookies.fieldInfo.samesite.lax':
    'Same-site plus les navigations cross-site de premier niveau (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none': 'Envoyé aussi cross-site — le navigateur exige Secure avec.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': 'Défaut du navigateur (traité comme Lax dans Chrome).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Cache le cookie du JavaScript de la page — document.cookie ne peut ni le lire ni le réécrire.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Seuls les serveurs (Set-Cookie) et cet éditeur peuvent créer des cookies HttpOnly ; les scripts de page ' +
    'ne le peuvent pas. Le durcissement standard des jetons de session.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    "Le cookie ne voyage qu'en HTTPS — les requêtes http simples ne le portent jamais.",
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Requis pour SameSite=None et pour les préfixes de nom __Host- / __Secure-.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    "Épingle le cookie exactement à l'hôte du Domain — les sous-domaines ne le reçoivent pas.",
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Désactivé, le cookie est stocké pour tout le domaine (forme avec point de tête) et coule vers les ' +
    "sous-domaines. Les cookies propres du navigateur sont host-only quand le serveur a omis l'attribut Domain.",

  // Column (i) corpus — column-name titles stay raw.
  'panel.inspector.cookies.columnInfo.name.summary':
    "L'identifiant du cookie. Les navigateurs indexent sur (name, domain, path) — deux cookies de même nom " +
    'mais de portée différente sont distincts.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Les puces à droite exposent des faits absents des colonnes. Elles apparaissent près du nom ; survolez ' +
    "une ligne pour révéler l'action Substituer sur la valeur.",
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Rôle (heuristique)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    "Ressemble à un cookie d'auth / de session — le nom correspond à sess / session / auth / sid / token / " +
    'csrf / xsrf, ou le cookie est HttpOnly avec une longue valeur aléatoire.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    "Ressemble à un cookie d'analytique / de suivi — le nom correspond à un traceur connu (_ga, _gid, _fbp, " +
    'NID, IDE, MUID, _hjid, …), ou le cookie est tiers sans autre classification.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'Un cookie de préférence utilisateur — tz, lang, locale, theme, color-mode, currency, cpu-bucket, ' +
    'font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Cycle de vie',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    "Un Set-Cookie est arrivé sur cette réponse et le navigateur l'a accepté.",
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Un Set-Cookie est arrivé mais le navigateur le rejettera — il enfreint une règle comme SameSite=None ' +
    'sans Secure, violation du préfixe __Host-, préfixe __Secure- sans Secure, ou Partitioned sans Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    "La réserve détient ce cookie mais il n'a pas été envoyé sur cette requête (chemin sans correspondance, " +
    "Secure sur http, expiré, restriction SameSite, …). N'apparaît que quand « Afficher les cookies de " +
    'requête filtrés » est activé.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Contexte',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    "Le domaine du cookie est cross-site par rapport à l'origine du cadre principal de la page.",
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'Isolation de style CHIPS — le cookie est indexé sur le site de premier niveau en plus de sa propre ' +
    'portée. Survolez pour la clé de partition.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    "Ce cookie a déclenché une suggestion (les cartes d'avertissement en haut de l'onglet). Voyez l'encart " +
    'pour savoir pourquoi.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Préfixes (visibles dans le nom)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    "Verrouillé à l'hôte — le navigateur impose Secure, Path=/, aucun Domain. Les violations sont rejetées.",
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'HTTPS uniquement — le navigateur impose Secure. Les violations sont rejetées.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'La charge utile du cookie. Cliquez sur une ligne pour déployer un panneau avec des vues analysées quand ' +
    'la valeur porte une structure.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Formats auto-détectés',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    "Trois segments base64url — l'en-tête et la charge utile sont décodés ; les claims exp / iat / nbf " +
    "s'affichent en temps relatifs.",
  'panel.inspector.cookies.columnInfo.value.jsonDesc':
    "Mis en forme dans le panneau déployé (fonctionne aussi après décodage d'URL).",
  'panel.inspector.cookies.columnInfo.value.b64Desc': 'Base64 simple — corps décodé affiché quand il est imprimable.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Texte percent-encodé — basculez « Décoder les valeurs URL-encodées » dans Vue pour afficher le décodé ' +
    'en ligne.',
  'panel.inspector.cookies.columnInfo.scope.summary':
    'Où le navigateur attachera ce cookie — le Domain + Path combinés.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'Un point de tête sur le domaine (p. ex. `.openheaders.com`) signifie que les sous-domaines sont inclus. ' +
    "Un chemin comme `/api` signifie que le cookie n'est envoyé que sur les requêtes sous ce chemin.",
  'panel.inspector.cookies.columnInfo.expires.summary':
    "Quand le navigateur cessera d'envoyer ce cookie. La couleur suit l'urgence.",
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Lire la couleur',
  'panel.inspector.cookies.columnInfo.expires.red': 'rouge',
  'panel.inspector.cookies.columnInfo.expires.redDesc': "Déjà expiré, ou expire dans moins d'une heure.",
  'panel.inspector.cookies.columnInfo.expires.yellow': 'jaune',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Expire dans les 24 heures.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'neutre',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': "Futur — à plus d'un jour.",
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Pas de Expires / Max-Age — le navigateur le jette à la fin de la session.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Format',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Relatif (défaut)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '« in 7mo », « 30s ago » — relatifs à maintenant. Survolez pour la date absolue.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Absolu',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'Date UTC. Basculez dans Vue → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Taille sérialisée du cookie en octets — longueur de `name=value`, utilisée pour le total de charge par ' +
    'requête.',
  'panel.inspector.cookies.columnInfo.size.description':
    "La plupart des serveurs et intermédiaires plafonnent l'en-tête Cookie combiné à 4 KB. Les charges " +
    'excessives peuvent causer des réponses 4xx / 5xx sans erreur claire.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Sécurité (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Trois glyphes condensent les attributs Secure / HttpOnly / SameSite en une cellule. La couleur porte le ' +
    'sens.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Glyphes',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — envoyé uniquement en HTTPS.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — illisible depuis JavaScript.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'Restriction SameSite (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Couleur',
  'panel.inspector.cookies.columnInfo.sec.green': 'vert',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'Activé / strict — verrouillé.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'jaune',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — envoyé sur les GET cross-site de premier niveau.',
  'panel.inspector.cookies.columnInfo.sec.red': 'rouge',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Manquant là où il est requis (SameSite=None sans Secure, __Host- sans Secure, …) — le navigateur ' + 'rejettera.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'gris',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Désactivé / non spécifié.',

  // Cookie insights (t-fed `computeCookieInsights`).
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie défini avec SameSite=None mais sans Secure',
      many: '{count} cookies définis avec SameSite=None mais sans Secure',
      other: '{count} cookies définis avec SameSite=None mais sans Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Les navigateurs modernes rejettent les cookies SameSite=None qui ne sont pas aussi Secure — ils ne ' +
    'seront pas stockés.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': "Ajouter l'attribut Secure",
  'panel.inspector.cookies.insights.hostPrefix.title': 'Préfixe __Host- violé sur {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    'Les cookies __Host- doivent être Secure, Path=/ et sans attribut Domain. Les navigateurs les rejettent ' +
    'sinon.',
  'panel.inspector.cookies.insights.securePrefix.title': 'Préfixe __Secure- violé sur {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    "Les cookies __Secure- doivent porter l'attribut Secure. Les navigateurs les rejettent sinon.",
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie Partitioned sans Secure',
      many: '{count} cookies Partitioned sans Secure',
      other: '{count} cookies Partitioned sans Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Les cookies Partitioned doivent être Secure.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookies définis en HTTP simple',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    "Ces cookies peuvent être observés et rejoués par n'importe qui sur le chemin. Utilisez HTTPS + " +
    "l'attribut Secure.",
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie expiré encore envoyé',
      many: '{count} cookies expirés encore envoyés',
      other: '{count} cookies expirés encore envoyés',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'Ces cookies ont une expiration dans le passé mais la requête les portait — la réserve les jettera sous ' + 'peu.',
  'panel.inspector.cookies.insights.oversized.title':
    "L'en-tête Cookie fait {bytes}B (au-delà de la limite courante de 4KB)",
  'panel.inspector.cookies.insights.oversized.detail':
    'Serveurs et intermédiaires plafonnent la taille des en-têtes ; des charges Cookie excessives peuvent ' +
    'causer des 4xx / 5xx sans erreur claire.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie tiers défini',
      many: '{count} cookies tiers définis',
      other: '{count} cookies tiers définis',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: '{count} cookie tiers défini par',
      many: '{count} cookies tiers définis par',
      other: '{count} cookies tiers définis par',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    "Les navigateurs modernes peuvent les bloquer dans les contextes cross-site sauf s'ils optent pour CHIPS " +
    "via l'attribut Partitioned.",
} as const satisfies Catalog;
