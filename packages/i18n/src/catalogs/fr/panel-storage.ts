/**
 * DevTools panel — storage tool window — French. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose, example-card payloads, char / byte /
 * MB figures, the Key / Value input placeholders, and data-plane
 * not-sent reasons riding as holes.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': 'Type de stockage',
  'panel.storage.nav.local': 'Stockage local',
  'panel.storage.nav.session': 'Stockage de session',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Utilisation',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} correspondance',
      many: '{count} correspondances',
      other: '{count} correspondances',
    }),
  'panel.storage.filterAria': 'Filtrer les entrées de stockage',
  'panel.storage.revealedHidden': 'La ligne révélée est masquée par le filtre actif',
  'panel.storage.addCookieTitle': 'Ajouter un cookie à la réserve du navigateur (y compris HttpOnly)',
  'panel.storage.addCookieAria': 'Ajouter un cookie',
  'panel.storage.addEntryTitle': 'Ajouter une entrée',
  'panel.storage.addEntryAria': 'Ajouter une entrée de stockage',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB est en lecture seule ici',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage est en lecture seule ici',
  'panel.storage.addReadOnly.quota': "L'utilisation est en lecture seule",
  'panel.storage.refreshTitle': 'Actualiser',
  'panel.storage.refreshAria': 'Actualiser le stockage',
  'panel.storage.originAria': 'Origine du stockage',
  'panel.storage.partitionedChip': 'partitionné',
  'panel.storage.partitionedTitle':
    'Stockage partitionné — les données de cette origine sont ici indexées sous {site}.\nClé de stockage : {raw}',
  'panel.storage.partitionFallback': 'une partition',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} élément', many: '{count} éléments', other: '{count} éléments' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} élément',
      many: '{count} éléments',
      other: '{count} éléments',
    });
    return `${String(shown)} sur ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cookie', many: '{count} cookies', other: '{count} cookies' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} cookie',
      many: '{count} cookies',
      other: '{count} cookies',
    });
    return `${String(shown)} sur ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} base de données',
      many: '{count} bases de données',
      other: '{count} bases de données',
    }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cache', many: '{count} caches', other: '{count} caches' }),
  'panel.storage.count.quotaUsed': '{used} sur {total} utilisés',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} section correspond',
      many: '{count} sections correspondent',
      other: '{count} sections correspondent',
    }),
  'panel.storage.note.writeFailed': "échec d'écriture",
  'panel.storage.note.deleteFailed': 'échec de suppression',
  'panel.storage.note.readFailed': 'échec de lecture — affichage des dernières données',
  'panel.storage.note.truncated': 'liste tronquée',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Effacer le stockage local',
  'panel.storage.clear.label.session': 'Effacer le stockage de session',
  'panel.storage.clear.label.cookies': 'Effacer les cookies',
  'panel.storage.clear.label.indexeddb': 'Effacer IndexedDB',
  'panel.storage.clear.label.cachestorage': 'Effacer Cache Storage',
  'panel.storage.clear.title.local': 'Effacer chaque entrée localStorage',
  'panel.storage.clear.title.session': 'Effacer chaque entrée sessionStorage',
  'panel.storage.clear.title.cookies': 'Effacer chaque cookie de la réserve de ce site',
  'panel.storage.clear.title.indexeddb': 'Effacer chaque base de données IndexedDB',
  'panel.storage.clear.title.cachestorage': 'Effacer chaque cache',
  'panel.storage.clear.armedTitle.local': 'Supprime chaque entrée localStorage pour cette origine',
  'panel.storage.clear.armedTitle.session': 'Supprime chaque entrée sessionStorage pour cette origine',
  'panel.storage.clear.armedTitle.cookies': 'Supprime chaque cookie de la réserve de ce site pour cette origine',
  'panel.storage.clear.armedTitle.indexeddb': 'Supprime chaque base de données IndexedDB pour cette origine',
  'panel.storage.clear.armedTitle.cachestorage': 'Supprime chaque cache pour cette origine',
  'panel.storage.confirmClear': "Confirmer l'effacement ?",
  'panel.storage.confirmDelete': 'Confirmer la suppression ?',
  'panel.storage.confirmSuffixAria': '{action} — cliquez à nouveau pour confirmer',
  'panel.storage.cleared': '✓ effacé',
  'panel.storage.clearFailed': "échec de l'effacement",
  // Empty / error states.
  'panel.storage.empty.loading': 'Chargement…',
  'panel.storage.empty.notAvailableTitle': "L'inspection du stockage n'est pas disponible ici",
  'panel.storage.empty.notAvailableSub': "Cet hôte n'expose pas le stockage applicatif de l'onglet inspecté.",
  'panel.storage.empty.noOriginsTitle': 'Aucune origine inspectable',
  'panel.storage.empty.noOriginsDomSub':
    "Cet onglet n'a aucun cadre http(s) avec du stockage DOM — les pages internes du navigateur ne peuvent pas " +
    'être inspectées.',
  'panel.storage.empty.noOriginsSub':
    "Cet onglet n'a aucun cadre http(s) — les pages internes du navigateur ne peuvent pas être inspectées.",
  'panel.storage.empty.noOriginsCookiesSub':
    "Cet onglet n'a aucun cadre http(s) — les pages internes du navigateur ne portent aucun cookie de site.",
  'panel.storage.empty.unavailableTitle': 'Stockage indisponible',
  'panel.storage.empty.unavailableSub':
    'Le cadre pour {origin} ne peut pas être lu pour le moment — il a peut-être navigué ailleurs.',
  'panel.storage.thisOrigin': 'cette origine',
  'panel.storage.empty.noItems': 'Aucun élément dans {area} pour {origin}.',
  'panel.storage.empty.noItemsMatch': 'Aucun élément ne correspond à votre filtre.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Les cookies ne sont pas disponibles ici',
  'panel.storage.empty.cookiesUnavailableSub': "Cet hôte n'expose pas la réserve de cookies du navigateur.",
  'panel.storage.empty.noCookies': 'Aucun cookie pour {origin}.',
  'panel.storage.empty.noCookiesMatch': 'Aucun cookie ne correspond à votre filtre.',
  // Jar cookie grid column headers — parity-shaped headers stay raw.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': 'Entrées de stockage',
  'panel.storage.grid.clipped': 'tronqué ({length})',
  'panel.storage.grid.editTitle': 'Modifier cette entrée',
  'panel.storage.grid.editAria': 'Modifier {key}',
  'panel.storage.grid.deleteTitle': 'Supprimer cette entrée',
  'panel.storage.grid.deleteAria': 'Supprimer {key}',
  'panel.storage.grid.newKeyAria': 'Clé de la nouvelle entrée',
  'panel.storage.grid.newValueAria': 'Valeur de la nouvelle entrée',
  'panel.storage.grid.keyAria': "Clé de l'entrée",
  'panel.storage.grid.valueAria': "Valeur de l'entrée",
  'panel.storage.grid.addSaveHint': 'Écrire la nouvelle entrée dans le stockage',
  'panel.storage.grid.editSaveHint': "Réécrire l'entrée modifiée dans le stockage",
  'panel.storage.grid.emptyKeyHint': 'La clé ne peut pas être vide',
  'panel.storage.grid.cancelTitle': 'Annuler',
  'panel.storage.grid.cancelAddAria': "Annuler l'ajout",
  'panel.storage.grid.cancelEditAria': 'Annuler la modification',
  'panel.storage.grid.tooLarge':
    "Trop volumineux pour être modifié ici — la valeur complète dépasse le plafond d'édition.",
  'panel.storage.grid.fetchFailed': 'La valeur complète ne peut pas être lue pour le moment.',
  'panel.storage.grid.loadingFullValue': 'Chargement de la valeur complète…',
  'panel.storage.save.label': 'Enregistrer',
  'panel.storage.save.noChanges': 'Aucune modification à enregistrer',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'Non envoyé à cette page — {reason}',
  'panel.storage.cookieRow.notSentAria': "Le Cookie {name} n'est pas envoyé à cette page : {reason}",
  'panel.storage.cookieRow.partitionedUnder': 'Partitionné sous {key}',
  'panel.storage.cookieRow.editTitle': 'Modifier ce cookie dans la réserve du navigateur',
  'panel.storage.cookieRow.editAria': 'Modifier le cookie {name}',
  'panel.storage.cookieRow.deleteTitle': 'Supprimer ce cookie de la réserve du navigateur',
  'panel.storage.cookieRow.deleteAria': 'Supprimer le cookie {name}',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB ne peut pas être lu',
  'panel.storage.idb.cantReadSub':
    "Ce cadre n'expose pas ses bases de données pour le moment — il a peut-être navigué ailleurs.",
  'panel.storage.idb.noDatabases': 'Aucune base de données IndexedDB pour cette origine.',
  'panel.storage.idb.versionTitle': 'Version de la base de données {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} magasin', many: '{count} magasins', other: '{count} magasins' }),
  'panel.storage.idb.metaKeyPath': 'clé : {path}',
  'panel.storage.idb.metaAutoIncrement': 'clés auto-incrémentées',
  'panel.storage.idb.metaOutOfLine': 'clés out-of-line',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} index', many: '{count} index', other: '{count} index' }),
  'panel.storage.idb.deleteDbTitle': 'Supprimer la base de données {name}',
  'panel.storage.idb.deleteDbConfirmTitle':
    "Supprime {name} et chaque magasin qu'elle contient — une page qui la garde ouverte bloque la suppression",
  'panel.storage.idb.deleteDbAria': 'Supprimer la base de données {name}',
  'panel.storage.idb.openStoreTitle': 'Ouvrir {database} › {store}',
  'panel.storage.idb.clearStoreTitle': 'Effacer tous les enregistrements de {store}',
  'panel.storage.idb.clearStoreConfirmTitle': 'Supprime chaque enregistrement de {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Effacer le magasin {store}',
  'panel.storage.idb.noStores': "aucun magasin d'objets",
  'panel.storage.idb.backTitle': 'Retour aux bases de données',
  'panel.storage.idb.cursorAria': 'Curseur des enregistrements',
  'panel.storage.idb.cursorTitle':
    "Lire le magasin à travers l'un de ses index — la colonne Key devient la clé de l'index",
  'panel.storage.idb.primaryKeyOption': 'clé primaire',
  'panel.storage.idb.indexOption': 'index : {name}',
  'panel.storage.idb.noRecords': 'Aucun enregistrement dans {store}.',
  'panel.storage.idb.noRecordsPage': 'Aucun enregistrement dans {store} sur cette page.',
  'panel.storage.idb.noRecordsMatch': 'Aucun enregistrement ne correspond à votre filtre.',
  'panel.storage.idb.gridAria': 'Enregistrements IndexedDB',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': "Ouvrir cet enregistrement dans l'éditeur",
  'panel.storage.idb.keyCellTitle': 'Clé : {key}\nClé primaire : {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Supprimer cet enregistrement',
  'panel.storage.idb.deleteRecordAria': "Supprimer l'enregistrement {key}",
  'panel.storage.pager.prevTitle': 'Page précédente',
  'panel.storage.pager.nextTitle': 'Page suivante',
  'panel.storage.pager.page': 'page {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage ne peut pas être lu',
  'panel.storage.cache.cantReadSub':
    "L'API n'existe que dans les contextes sécurisés (https) — ou ce cadre ne peut pas être lu pour le moment.",
  'panel.storage.cache.noCaches': 'Aucun cache pour cette origine.',
  'panel.storage.cache.noCachesMatch': 'Aucun cache ne correspond à votre filtre.',
  'panel.storage.cache.openTitle': 'Ouvrir le cache {name}',
  'panel.storage.cache.deleteTitle': 'Supprimer le cache {name}',
  'panel.storage.cache.deleteConfirmTitle': "Supprime {name} et chaque entrée qu'il contient",
  'panel.storage.cache.deleteAria': 'Supprimer le cache {name}',
  'panel.storage.cache.backTitle': 'Retour aux caches',
  'panel.storage.cache.noEntries': 'Aucune entrée dans {name}.',
  'panel.storage.cache.noEntriesPage': 'Aucune entrée dans {name} sur cette page.',
  'panel.storage.cache.noEntriesMatch': 'Aucune entrée ne correspond à votre filtre.',
  'panel.storage.cache.gridAria': 'Entrées de cache',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Supprimer cette entrée',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Supprime la réponse stockée — cliquez à nouveau pour confirmer',
  'panel.storage.cache.deleteEntryAria': "Supprimer l'entrée {url}",
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': "L'utilisation ne peut pas être lue",
  'panel.storage.quota.cantReadSub':
    "L'API n'existe que dans les contextes sécurisés (https) — ou ce cadre ne peut pas être lu pour le moment.",
  'panel.storage.quota.used': '{size} utilisés',
  'panel.storage.quota.ofTotal': 'sur {size} ({percent} %)',
  'panel.storage.quota.type.serviceWorkers': 'Service workers',
  'panel.storage.quota.type.fileSystems': 'Systèmes de fichiers',
  'panel.storage.quota.type.other': 'Autre',
  'panel.storage.quota.noBreakdown': 'Aucune utilisation par type signalée pour cette origine.',
  'panel.storage.quota.debugHint': 'Activez le mode débogage pour voir la répartition par type.',
  'panel.storage.quota.sessionNote':
    "Le stockage de session est par onglet — ceci efface le cadre de l'onglet inspecté",
  'panel.storage.quota.targetsCaption': 'Cibles de « Tout effacer »',
  'panel.storage.quota.targetsTitle':
    'Tout effacer (en haut à droite) supprime exactement les types de données cochés pour cette origine',
  'panel.storage.quota.simulateLabel': 'Simuler un quota personnalisé',
  'panel.storage.quota.simulateTitle':
    'Faire signaler et appliquer au navigateur un quota plus petit pour cette origine — pour tester le ' +
    "comportement de la page quand le stockage s'épuise",
  'panel.storage.quota.simulateSave': 'Enregistrer',
  'panel.storage.quota.simulateCancel': 'Annuler',
  'panel.storage.quota.simulateReset': 'Réinitialiser',
  'panel.storage.quota.simulateResetTitle': 'Retirer le quota simulé',
  'panel.storage.quota.simulateRange': 'saisissez 0–{max} MB',
  'panel.storage.quota.simulateFailed': 'échec de la simulation',
  'panel.storage.quota.clearEverything': 'Tout effacer',
  'panel.storage.quota.clearArmedTitle': 'Supprime les types de données cochés pour cette origine',
  'panel.storage.quota.clearTitle': 'Effacer les types de données cochés pour cette origine',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': "Exemple d'écriture",
  'panel.storage.domCol.key.summary':
    "Le nom de l'entrée — une chaîne sensible à la casse, unique dans le {area} de cette origine. Écrire une " +
    'clé existante écrase sa valeur.',
  'panel.storage.domCol.key.description':
    "Renommer une entrée ici écrit d'abord la nouvelle clé, puis retire l'ancienne — une écriture échouée ne " +
    "perd jamais l'original.",
  'panel.storage.domCol.value.summary':
    'La charge utile stockée — toujours une chaîne ; les pages gardent les données structurées sérialisées, ' +
    'généralement en JSON.',
  'panel.storage.domCol.value.description':
    "La grille montre un aperçu d'une ligne et tronque les valeurs très longues — ouvrir ou modifier une " +
    "entrée récupère le texte complet. Cliquez sur une ligne pour l'ouvrir comme onglet d'éditeur ; le " +
    'double-clic (ou le crayon) modifie en ligne.',
  'panel.storage.cookieCol.name.summary':
    "L'identifiant du cookie. Les navigateurs indexent sur (name, domain, path) — le même nom avec une autre " +
    'portée est un cookie distinct.',
  'panel.storage.cookieCol.name.description':
    "Un triangle d'avertissement marque un cookie de la réserve du site que le navigateur n'attacherait PAS à " +
    'une requête vers la page inspectée — survolez-le pour la raison (chemin limité ailleurs, Secure-only sur ' +
    'http, limité à un sous-domaine, …).',
  'panel.storage.cookieCol.value.summary':
    "La charge utile du cookie — ce que le navigateur renvoie dans l'en-tête Cookie.",
  'panel.storage.cookieCol.value.description':
    "Cliquez sur une ligne pour ouvrir le cookie comme onglet d'éditeur avec la valeur complète et les vues " +
    'analysées ; le crayon modifie en ligne.',
  'panel.storage.cookieCol.scope.summary':
    'Où le navigateur attache ce cookie — son Domain plus, quand il est plus étroit que /, son Path.',
  'panel.storage.cookieCol.scope.description':
    "Un cookie à l'échelle du domaine (stocké avec un point de tête) coule aussi vers les sous-domaines ; un " +
    'cookie host-only est épinglé exactement à son hôte. Le chemin est un préfixe — /api signifie que seules ' +
    'les requêtes sous /api le portent.',
  'panel.storage.cookieCol.expires.summary':
    'Quand le navigateur supprime le cookie, affiché relativement à maintenant — survolez pour la date absolue.',
  'panel.storage.cookieCol.expires.description':
    'Session signifie pas de Expires / Max-Age — le navigateur jette le cookie à la fin de la session.',
  'panel.storage.cacheCol.exampleCaption': "Exemple d'entrée",
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· stocké',
  'panel.storage.cacheCol.request.summary':
    "L'URL de la requête stockée — la clé contre laquelle le cache fait correspondre les fetch.",
  'panel.storage.cacheCol.request.description':
    'Survoler une ligne ajoute un aperçu borné des en-têtes de la requête stockée. Cliquez sur une ligne pour ' +
    "ouvrir la réponse stockée comme onglet d'éditeur ; la grille ne garde que les métadonnées.",
  'panel.storage.cacheCol.method.summary':
    "La méthode HTTP de la requête stockée — partie de la clé de cache avec l'URL.",
  'panel.storage.cacheCol.method.description':
    "Presque toujours GET : l'API Cache rejette put / add pour les autres méthodes.",
  'panel.storage.cacheCol.size.summary': 'La taille de la réponse stockée, lue depuis son en-tête content-length.',
  'panel.storage.cacheCol.size.description':
    'Un tiret cadratin signifie que la réponse stockée ne porte pas de content-length — le corps est toujours ' +
    "là, dans l'onglet d'éditeur de l'entrée.",
  'panel.storage.cacheCol.time.summary': 'Quand la réponse a été stockée dans le cache.',
  'panel.storage.cacheCol.time.description':
    "Dérivable uniquement sur les onglets attachés — un tiret cadratin signifie que l'hôte n'a pas pu le lire " +
    'pour cette portée.',
  'panel.storage.idbCol.exampleCaption': "Exemple d'enregistrement",
  'panel.storage.idbCol.key.summary':
    "La clé de l'enregistrement sous le curseur courant — la clé primaire du magasin par défaut ; choisir un " +
    "index dans le fil d'Ariane lit à travers lui, et cette colonne devient la clé d'index.",
  'panel.storage.idbCol.key.description':
    'Survoler une ligne montre les deux clés (clé du curseur et clé primaire). Les clés peuvent être des ' +
    'nombres, des chaînes, des dates ou des tableaux de ceux-ci.',
  'panel.storage.idbCol.value.summary':
    "Un aperçu d'une ligne de la valeur structured-clone de l'enregistrement, sérialisée dans la page.",
  'panel.storage.idbCol.value.description':
    "Cliquez sur une ligne pour ouvrir l'enregistrement complet comme onglet d'éditeur avec l'arbre " +
    "déployable ; la grille ne garde que l'aperçu.",
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Révéler dans Storage',
  'panel.storage.doc.refreshConfirm': 'Abandonne vos modifications — cliquez à nouveau pour actualiser',
  'panel.storage.doc.discardEdits': 'Abandonner mes modifications',
  'panel.storage.doc.openMergeView': 'Ouvrir la vue de fusion',
  'panel.storage.doc.preview': 'Aperçu',
  'panel.storage.doc.source': 'Source',
  'panel.storage.doc.formatAria': 'Format du texte source',
  'panel.storage.doc.formatted': 'Formaté',
  'panel.storage.doc.raw': 'Brut',
  'panel.storage.doc.formattedTitle': 'Formaté pour la lecture — Enregistrer conserve le format stocké',
  'panel.storage.doc.rawTitle': 'Le texte stocké exact',
  'panel.storage.doc.formatUnavailable': "La vue formatée n'est disponible que pour les valeurs de forme JSON",
  'panel.storage.doc.formatInfoTitle': 'Vue formatée',
  'panel.storage.doc.formatInfoSummary':
    'Formaté est une vue de lecture — seule la mise en forme des espaces change. Le texte stocké reste inchangé.',
  'panel.storage.doc.formatInfoDescription':
    "Les modifications faites en mode Formaté sont réencodées dans le format stocké d'origine, et Enregistrer écrit ce texte — sans modification, Enregistrer écrit exactement les octets d'origine. Brut est les octets eux-mêmes.",
  'panel.storage.doc.formatInfoViewOnly':
    'Ce document est en lecture seule — Brut est les octets stockés exacts, et Formaté ne les modifie jamais.',
  'panel.storage.doc.unavailableSub':
    "L'élément a peut-être été supprimé, ou le cadre ne peut pas être lu pour le moment — Actualiser réessaie.",
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '… ({count} caractère de plus)',
      many: '… ({count} caractères de plus)',
      other: '… ({count} caractères de plus)',
    }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    "Un cookie avec ce nom, ce domaine et ce chemin existe déjà — enregistrer l'écraserait. Choisissez une " +
    'autre identité.',
  'panel.storage.doc.cookie.saveFailed.write':
    "Échec de l'enregistrement — la réserve du navigateur a rejeté l'écriture.",
  'panel.storage.doc.cookie.saveFailed.remove':
    "Le nouveau cookie a été écrit mais l'original n'a pas pu être retiré — les deux existent. Actualiser " +
    'relit la réserve.',
  'panel.storage.doc.cookie.saveHint': 'Réécrire le cookie modifié dans la réserve du navigateur',
  'panel.storage.doc.cookie.blockedHint': 'Le formulaire est incomplet ou une référence ne se résout pas',
  'panel.storage.doc.cookie.refreshTitle': 'Relire le cookie',
  'panel.storage.doc.cookie.refreshAria': 'Actualiser le cookie',
  'panel.storage.doc.cookie.revealTitle': "Ouvrir Cookies dans la fenêtre d'outil Storage",
  'panel.storage.doc.cookie.readOnlyNote':
    'La réserve de cookies de cet hôte est en lecture seule — le document reflète la réserve mais ne peut pas ' +
    'y écrire.',
  'panel.storage.doc.cookie.goneNote':
    'Ce cookie a été supprimé dans le navigateur — vos modifications non enregistrées sont conservées. ' +
    'Enregistrer le réécrit.',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie disparu de la réserve',
  'panel.storage.doc.cookie.unavailableSub':
    'Il a peut-être été supprimé ou a expiré, ou la réserve ne peut pas être lue sur cet hôte — Actualiser ' +
    'réessaie.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    "Une entrée avec cette clé existe déjà — enregistrer l'écraserait. Choisissez une autre clé.",
  'panel.storage.doc.dom.saveFailed.gone':
    "L'entrée est injoignable — elle a peut-être été supprimée. Actualiser revérifie.",
  'panel.storage.doc.dom.saveFailed.quota':
    "Échec de l'enregistrement — le quota de stockage a été dépassé. L'entrée d'origine est inchangée.",
  'panel.storage.doc.dom.saveFailed.write': "Échec de l'enregistrement — l'écriture a été rejetée.",
  'panel.storage.doc.dom.modeAria': "Mode de vue de l'entrée",
  'panel.storage.doc.dom.previewTitle': 'Arbre repliable sur la valeur analysée',
  'panel.storage.doc.dom.previewNeedsJson': "L'aperçu nécessite une valeur JSON",
  'panel.storage.doc.dom.sourceTitle': 'Vue de la valeur brute',
  'panel.storage.doc.dom.saveHint': "Réécrire l'entrée modifiée dans le stockage",
  'panel.storage.doc.dom.blockedHint': 'La clé ne peut pas être vide',
  'panel.storage.doc.dom.refreshTitle': "Relire l'entrée",
  'panel.storage.doc.dom.refreshAria': "Actualiser l'entrée",
  'panel.storage.doc.dom.revealTitle': "Ouvrir {area} dans la fenêtre d'outil Storage",
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': "Clé de l'entrée",
  'panel.storage.doc.dom.conflictNote': 'La valeur a changé dans le navigateur pendant que vous modifiiez.',
  'panel.storage.doc.dom.mergeToast': "Fusion appliquée au brouillon — Enregistrer l'écrit dans le navigateur",
  'panel.storage.doc.dom.goneNote':
    'Cette entrée a été supprimée dans le navigateur — vos modifications non enregistrées sont conservées. ' +
    'Enregistrer la réécrit.',
  'panel.storage.doc.dom.unavailableTitle': "L'entrée n'est plus disponible",
  'panel.storage.doc.dom.tooLargeTitle': 'Trop volumineux pour être ouvert',
  'panel.storage.doc.dom.tooLargeSub': "La valeur dépasse le plafond de l'éditeur et reste en lecture seule.",
  'panel.storage.doc.dom.previewAria': "Arbre de la valeur de l'entrée",
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'JSON invalide — corrigez la syntaxe et enregistrez à nouveau.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    "La clé a changé — enregistrer créerait un nouvel enregistrement. Restaurez la clé d'origine.",
  'panel.storage.doc.idb.saveFailed.gone':
    "L'enregistrement est injoignable — il a peut-être été supprimé. Actualiser revérifie.",
  'panel.storage.doc.idb.saveFailed.write': "Échec de l'enregistrement — l'écriture a été rejetée.",
  'panel.storage.doc.idb.modeAria': "Mode de vue de l'enregistrement",
  'panel.storage.doc.idb.previewTitle': "Arbre repliable sur la valeur de l'enregistrement",
  'panel.storage.doc.idb.previewNeedsDoc': "L'aperçu nécessite un document bien formé",
  'panel.storage.doc.idb.sourceTitle': 'Vue source du document complet',
  'panel.storage.doc.idb.saveHint': "Réécrire la valeur modifiée dans l'enregistrement",
  'panel.storage.doc.idb.refreshTitle': "Relire l'enregistrement",
  'panel.storage.doc.idb.refreshAria': "Actualiser l'enregistrement",
  'panel.storage.doc.idb.revealTitle': "Ouvrir {database} › {store} dans la fenêtre d'outil Storage",
  'panel.storage.doc.idb.truncatedNote': 'Tronqué au plafond de taille — lecture seule.',
  'panel.storage.doc.idb.nonJsonNote':
    'Contient des types non-JSON (Date, Map, binaire, …) — affiché comme un rendu en lecture seule.',
  'panel.storage.doc.idb.conflictNote': "L'enregistrement a changé dans le navigateur pendant que vous modifiiez.",
  'panel.storage.doc.idb.mergeToast': "Fusion appliquée au brouillon — Enregistrer l'écrit dans l'enregistrement",
  'panel.storage.doc.idb.goneNote':
    'Cet enregistrement a été supprimé ou a changé de forme dans le navigateur — vos modifications non ' +
    'enregistrées sont conservées. Enregistrer les réécrit.',
  'panel.storage.doc.idb.unavailableTitle': "L'enregistrement n'est plus disponible",
  'panel.storage.doc.idb.previewAria': "Arbre de la valeur de l'enregistrement",
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Supprimer cette entrée du cache',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Supprime la réponse stockée — cliquez à nouveau pour confirmer',
  'panel.storage.doc.cache.deleteAria': "Supprimer l'entrée de cache",
  'panel.storage.doc.cache.refreshTitle': 'Relire la réponse stockée',
  'panel.storage.doc.cache.refreshAria': "Actualiser l'entrée de cache",
  'panel.storage.doc.cache.revealTitle': "Ouvrir le cache {cache} dans la fenêtre d'outil Storage",
  'panel.storage.doc.cache.deleteFailed': "Échec de la suppression — l'entrée est peut-être déjà partie.",
  'panel.storage.doc.cache.unavailableTitle': "L'entrée de cache n'est plus disponible",
  'panel.storage.doc.cache.truncatedNote': 'Corps tronqué au plafond de taille — {size} stockés.',
  'panel.storage.doc.cache.headersSummary': 'En-têtes de réponse ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Filtrer les en-têtes',
  'panel.storage.doc.cache.filterAria': 'Filtrer les en-têtes de réponse',
  'panel.storage.doc.cache.noHeaders': 'Aucun en-tête stocké.',
  'panel.storage.doc.cache.noHeadersMatch': 'Aucun en-tête ne correspond à votre filtre.',
  'panel.storage.doc.cache.bodySummary': 'Corps de la réponse',
  'panel.storage.doc.cache.imageAria': 'Corps image stocké',
  'panel.storage.doc.cache.imageAlt': 'Corps de la réponse stockée pour {url}',
  'panel.storage.doc.cache.binaryBody': 'Corps binaire — {size} stockés.',
  'panel.storage.doc.cache.emptyBody': 'Corps vide.',
} as const satisfies Catalog;
