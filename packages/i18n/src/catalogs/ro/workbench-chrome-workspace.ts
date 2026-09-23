/**
 * Workbench chrome — the workspace plane — Romanian. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values (`{name}` / `{source}` /
 * `{orgs}` / `{place}` / `{hint}`), as do `publicWorkspaces` /
 * `daemon.json` / the → glyph. Reuses mints: spațiu de lucru, Org raw
 * (f. — the shared-workspace header), aplicația desktop, Comutare =
 * Switch, instantaneu = snapshot (panel), comutatorul = the switcher
 * (shared-components' comutatorul de medii), acordare de acces = grant
 * (workbench-chrome). File mints: Duplicare = duplicate / Copie a
 * {name} = copy-of (Copiere stays the copy action); comutatorul de
 * spații de lucru = the workspace switcher; roles Operator de server /
 * proprietar = owner (the members sheet); Părăsire = leave (Părăsire
 * „{name}”?); organizație = organization prose; Copiere în {place} =
 * Copy to <place> (the hole takes the preposition with no ending —
 * „{name}” a fost copiat în {place}); Privat / Intern / Public = the
 * access levels; Partajare publică… = Share publicly… (link public /
 * instantaneu public / Oprire partajare = Stop sharing); Gestionat =
 * Managed; furnizorul de identitate = identity provider; the
 * publicShare category counts take a colon frame (cereri: {count} …
 * fluxuri de lucru live: {count}); `{units}` in the switcher body
 * follows the panel.ts donor tooltip (noile {units}). Confirm questions
 * read as plain infinitive-noun questions (Ștergere „{name}”? /
 * Părăsire „{name}”? / Setare „{name}” ca spațiu de lucru activ?).
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'Spații de lucru',
  'workbench.workspace.newWorkspace': 'Spațiu de lucru nou',
  'workbench.workspace.intro':
    'Fiecare spațiu de lucru își păstrează propriile reguli, colecții, foldere, șabloane, variabile și istoric al rulărilor de test. Trageți pentru a reordona.',
  'workbench.workspace.deleteTitle': 'Ștergere „{name}”?',
  'workbench.workspace.deleteBody':
    'Aceasta șterge definitiv spațiul de lucru și toate regulile, colecțiile, folderele, șabloanele, variabilele și istoricul rulărilor de test ale acestuia. Această acțiune nu poate fi anulată.',
  'workbench.workspace.deleteOk': 'Ștergere',
  'workbench.workspace.deleteFailed': 'Ștergerea spațiului de lucru a eșuat',
  'workbench.workspace.deletedToast': '„{name}” a fost șters',
  'workbench.workspace.leaveTitle': 'Părăsire „{name}”?',
  'workbench.workspace.leaveBody':
    'Renunțați la propriul acces la acest spațiu de lucru — dispare din toate filele dvs. deschise. Toți ceilalți își păstrează accesul, iar un administrator vi-l poate acorda din nou.',
  'workbench.workspace.leaveOk': 'Părăsire',
  'workbench.workspace.leaveFailed': 'Părăsirea spațiului de lucru a eșuat',
  'workbench.workspace.leftToast': 'Ați părăsit „{name}”',
  'workbench.workspace.leaveAria': 'Părăsire spațiu de lucru',
  'workbench.workspace.members.title': 'Membrii spațiului „{name}”',
  'workbench.workspace.members.openAria': 'Gestionare membri',
  'workbench.workspace.members.loadFailed': 'Încărcarea membrilor a eșuat',
  'workbench.workspace.members.updateFailed': 'Actualizarea membrilor a eșuat',
  'workbench.workspace.members.operatorTag': 'Operator de server',
  'workbench.workspace.members.managedTag': 'Gestionat',
  'workbench.workspace.members.managedTooltip':
    'Această acordare de acces este gestionată de furnizorul de identitate.',
  'workbench.workspace.members.removeConfirm': 'Eliminați {name} din acest spațiu de lucru?',
  'workbench.workspace.members.removeOk': 'Eliminare',
  'workbench.workspace.members.removeAria': 'Eliminare membru',
  'workbench.workspace.members.removedToast': '{name} a fost eliminat',
  'workbench.workspace.members.updatedToast': '{name} a fost actualizat',
  'workbench.workspace.members.addedToast': '{name} a fost adăugat',
  'workbench.workspace.members.addPlaceholder': 'Adăugați o persoană sau un cont de serviciu…',
  'workbench.workspace.members.addButton': 'Adăugare',
  'workbench.workspace.members.noneToAdd': 'Toți cei de pe acest server au deja acces.',
  'workbench.workspace.members.readOnlyHint': 'Doar un proprietar al spațiului de lucru poate modifica membrii.',
  'workbench.workspace.members.visibilityLabel': 'Acces',
  'workbench.workspace.members.visibilityPrivate': 'Privat',
  'workbench.workspace.members.visibilityInternal': 'Intern',
  'workbench.workspace.members.visibilityPrivateHint': 'Doar membrii invitați pot vedea acest spațiu de lucru.',
  'workbench.workspace.members.visibilityInternalHint':
    'Fiecare membru al acestui server poate vizualiza acest spațiu de lucru. Doar membrii pe care îi adăugați pot edita.',
  'workbench.workspace.members.visibilityUpdatedToast': 'Accesul la spațiul de lucru a fost actualizat',
  'workbench.workspace.members.visibilityPublic': 'Public',
  'workbench.workspace.members.visibilityPublicHint':
    'Oricine are linkul poate vizualiza un instantaneu partajat, doar în citire, al acestui spațiu de lucru. Doar membrii pe care îi adăugați pot edita.',
  'workbench.workspace.publicShare.heading': 'Link public',
  'workbench.workspace.publicShare.loadFailed': 'Încărcarea stării de partajare publică a eșuat',
  'workbench.workspace.publicShare.disabledHint':
    'Spațiile de lucru publice sunt dezactivate pe acest server. Un operator le poate activa cu publicWorkspaces în daemon.json.',
  'workbench.workspace.publicShare.notShared':
    'Niciun instantaneu partajat încă — linkul devine activ când partajați unul.',
  'workbench.workspace.publicShare.sharedAt': 'Instantaneu partajat {when}',
  'workbench.workspace.publicShare.shareButton': 'Partajare publică…',
  'workbench.workspace.publicShare.updateButton': 'Actualizare copie publică…',
  'workbench.workspace.publicShare.stopButton': 'Oprire partajare',
  'workbench.workspace.publicShare.stopConfirm':
    'Opriți partajarea acestui spațiu de lucru? Linkul public încetează să funcționeze imediat.',
  'workbench.workspace.publicShare.stopOk': 'Oprire partajare',
  'workbench.workspace.publicShare.stoppedToast': 'Linkul public a fost eliminat',
  'workbench.workspace.publicShare.sharedToast': 'Instantaneul public a fost partajat',
  'workbench.workspace.publicShare.copyLink': 'Copiere link',
  'workbench.workspace.publicShare.copiedToast': 'Link copiat',
  'workbench.workspace.publicShare.reviewTitle': 'Partajare publică „{name}”',
  'workbench.workspace.publicShare.reviewIntro':
    'Oricine are linkul vede un instantaneu doar în citire al acestui spațiu de lucru, așa cum este acum. Revizuiți ce se publică înainte de a confirma:',
  'workbench.workspace.publicShare.reviewUpdateNote':
    'Partajarea din nou înlocuiește copia publică de la același link.',
  'workbench.workspace.publicShare.reviewStripped':
    'Niciodată incluse: intrările din vault, tokenurile OAuth, valorile live, conținutul fișierelor și valorile variabilelor de tip secret.',
  'workbench.workspace.publicShare.reviewStrippedCount':
    'Valorile a {count} variabile secrete rămân ascunse — numele lor rămân vizibile.',
  'workbench.workspace.publicShare.reviewContents': 'Cuprins',
  'workbench.workspace.publicShare.reviewEmpty': 'Acest spațiu de lucru este gol — instantaneul publicat va fi la fel.',
  'workbench.workspace.publicShare.reviewVariables': 'Variabile ({count})',
  'workbench.workspace.publicShare.reviewNoVariables': 'Nicio variabilă.',
  'workbench.workspace.publicShare.reviewValueHidden': 'ascunsă',
  'workbench.workspace.publicShare.confirmShare': 'Partajare instantaneu',
  'workbench.workspace.publicShare.previewFailed': 'Pregătirea previzualizării instantaneului a eșuat',
  'workbench.workspace.publicShare.shareFailed': 'Partajarea instantaneului a eșuat',
  'workbench.workspace.publicShare.scope.workspace': 'Spațiu de lucru',
  'workbench.workspace.publicShare.scope.environment': 'Mediu',
  'workbench.workspace.publicShare.scope.collection': 'Colecție',
  'workbench.workspace.publicShare.cat.requests': 'cereri: {count}',
  'workbench.workspace.publicShare.cat.collections': 'colecții: {count}',
  'workbench.workspace.publicShare.cat.folders': 'foldere: {count}',
  'workbench.workspace.publicShare.cat.rules': 'reguli: {count}',
  'workbench.workspace.publicShare.cat.environments': 'medii: {count}',
  'workbench.workspace.publicShare.cat.examples': 'exemple de răspuns: {count}',
  'workbench.workspace.publicShare.cat.specs': 'specificații API: {count}',
  'workbench.workspace.publicShare.cat.scripts': 'pachete de scripturi: {count}',
  'workbench.workspace.publicShare.cat.templates': 'șabloane: {count}',
  'workbench.workspace.publicShare.cat.live': 'fluxuri de lucru live: {count}',
  'workbench.workspace.publicShare.cat.files': 'fișiere: {count}',
  'workbench.workspace.publicView.bannerTag': 'Instantaneu public',
  'workbench.workspace.publicView.banner':
    'Copie publică doar în citire a „{name}”. Editările pe care le faceți aici nu sunt salvate nicăieri.',
  'workbench.workspace.publicView.loadFailed': 'Acest link public de spațiu de lucru nu este disponibil.',
  'workbench.workspace.createOk': 'Creare',
  'workbench.workspace.createFailed': 'Crearea spațiului de lucru a eșuat',
  'workbench.workspace.createdToastPrefix': 'Spațiu de lucru creat:',
  'workbench.workspace.duplicateTitle': 'Duplicare „{name}”',
  'workbench.workspace.duplicateTitleFallback': 'Duplicare spațiu de lucru',
  'workbench.workspace.duplicateOk': 'Duplicare',
  'workbench.workspace.duplicateFailed': 'Duplicarea spațiului de lucru a eșuat',
  'workbench.workspace.duplicatedToast': '„{source}” a fost duplicat → „{name}”',
  'workbench.workspace.publishFailed': 'Copierea spațiului de lucru a eșuat',
  'workbench.workspace.publishedToast': '„{name}” a fost copiat în {place}',
  'workbench.workspace.selectedOrgFallback': 'destinația aleasă',
  'workbench.workspace.editTitle': 'Editare spațiu de lucru',
  'workbench.workspace.saveOk': 'Salvare',
  'workbench.workspace.updatedToast': '„{name}” a fost actualizat',
  'workbench.workspace.deletedElsewhere': 'Acest spațiu de lucru a fost șters dintr-o altă filă',
  'workbench.workspace.updateFailed': 'Actualizarea spațiului de lucru a eșuat',
  'workbench.workspace.updateFailedWithMessage': 'Actualizarea spațiului de lucru a eșuat: {message}',
  'workbench.workspace.otherWorkspaces': 'Alte spații de lucru',
  'workbench.workspace.dragToReorder': 'Trageți pentru a reordona',
  'workbench.workspace.activePill': 'Activ',
  'workbench.workspace.switch': 'Comutare',
  'workbench.workspace.renameAria': 'Redenumire spațiu de lucru',
  'workbench.workspace.duplicateAria': 'Duplicare spațiu de lucru',
  'workbench.workspace.publishAria': 'Copiere spațiu de lucru într-o aplicație desktop sau pe un server',
  'workbench.workspace.deleteAria': 'Ștergere spațiu de lucru',
  'workbench.workspace.prefixLabel': 'Prefix',
  'workbench.workspace.nameLabel': 'Nume',
  'workbench.workspace.nameRequired': 'Numele este obligatoriu',
  'workbench.workspace.nameTooLong': 'Păstrați numele sub 60 de caractere',
  'workbench.workspace.namePlaceholder': 'Spațiul meu de lucru',
  'workbench.workspace.descriptionLabel': 'Descriere (opțional)',
  'workbench.workspace.copyOfName': 'Copie a {name}',
  'workbench.workspace.copyOfPlaceholder': 'Copie a …',
  'workbench.workspace.intoOrg': 'Unde ajunge',
  'workbench.workspace.includeSecrets': 'Includere conținut vault (secrete)',
  'workbench.workspace.includeSecretsHint':
    'Reintroduceți secretele în copie, dacă este necesar. Conexiunile OAuth se reautorizează în ambele cazuri.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': 'Setare „{name}” ca spațiu de lucru activ?',
  'workbench.workspace.makeActiveBody':
    'Fereastra popup, panoul lateral și noile {units} care nu sunt fixate pe un anumit spațiu de lucru vor comuta la „{name}”.',
  'workbench.workspace.makeActiveOk': 'Setare ca activ',
  'workbench.workspace.cancel': 'Anulare',
  'workbench.workspace.nowActiveToast': '„{name}” este acum spațiul de lucru activ',
  'workbench.workspace.switcherAria':
    'Acest element ({unit}) editează spațiul de lucru: {name}. Apăsați pentru a comuta.',

  // ── Workspace: publish modal — "Copy to <place>" to the user ────────
  'workbench.workspace.publishTitle': 'Copiere „{name}”',
  'workbench.workspace.publishTitleFallback': 'Copiere spațiu de lucru',
  'workbench.workspace.publishToOk': 'Copiere în {place}',
  'workbench.workspace.publishOk': 'Copiere',
  'workbench.workspace.publishIntro':
    'O copie a acestui spațiu de lucru ajunge în aplicația desktop sau pe serverul pe care îl alegeți și se sincronizează de acolo. Originalul rămâne aici.',
  'workbench.workspace.toOrg': 'Copiere în',
  'workbench.workspace.pickTargetOrg': 'Alegeți unde ajunge copia',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Siglă',
  'workbench.workspace.org.logoAria': 'Schimbați sigla acestei organizații',
  'workbench.workspace.org.renameButton': 'Redenumire',
  'workbench.workspace.org.renameAria': 'Redenumiți această organizație',
  'workbench.workspace.org.renameTitle': 'Redenumire {hint}',
  'workbench.workspace.org.renameTitleFallback': 'Redenumire',
  'workbench.workspace.org.nameUpdated': 'Numele a fost actualizat',
  'workbench.workspace.org.identityLoading': 'Identitatea se încarcă încă — reîncercați peste puțin timp',
  'workbench.workspace.org.renameExtra':
    'Afișat în comutatorul de spații de lucru și oricui îi partajați spații de lucru.',
  'workbench.workspace.org.nameTooLong': 'Păstrați numele sub {max} caractere',
  'workbench.workspace.org.namePlaceholder': 'Laptopul meu de serviciu',
  'workbench.workspace.org.logoTitle': 'Sigla {hint}',
  'workbench.workspace.org.logoTitleFallback': 'Sigla organizației',
  'workbench.workspace.org.logoAlt': 'Sigla curentă a organizației',
  'workbench.workspace.org.replace': 'Înlocuire…',
  'workbench.workspace.org.upload': 'Încărcare…',
  'workbench.workspace.org.remove': 'Eliminare',
  'workbench.workspace.org.logoUpdated': 'Sigla a fost actualizată',
  'workbench.workspace.org.logoRemoved': 'Sigla a fost eliminată',
  'workbench.workspace.org.fileReadFailed': 'Acel fișier nu a putut fi citit.',
  'workbench.workspace.org.logoHint':
    'PNG, JPEG, WebP sau SVG, de până la {kb} KB. Imaginile pătrate arată cel mai bine. Afișată tuturor celor care se sincronizează cu această organizație.',
  'workbench.workspace.org.logoReject.notImage': 'Acel fișier nu a putut fi citit ca imagine.',
  'workbench.workspace.org.logoReject.corruptImage': 'Acel fișier nu este o imagine validă de tipul declarat.',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'Folosiți un fișier PNG, JPEG, WebP sau SVG.',
  'workbench.workspace.org.logoReject.tooLarge': 'Păstrați sigla sub {kb} KB.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'Acest SVG conține scripturi sau referințe externe — exportați un SVG simplu, de sine stătător.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'Aveți acum acces la un spațiu de lucru',
  'workbench.workspace.grant.arrivedTitle': 'Un spațiu de lucru este acum disponibil',
  'workbench.workspace.grant.open': 'Deschidere spațiu de lucru',
  'workbench.workspace.grant.notifTitleActive': 'Aveți acum acces la {name}',
  'workbench.workspace.grant.notifTitle': 'Spațiul de lucru {name} este acum disponibil',
  'workbench.workspace.grant.notifBodyActive': 'Un administrator v-a acordat acces — lucrați în el acum.',
  'workbench.workspace.grant.notifBody':
    'Un administrator v-a acordat acces — apare în comutatorul de spații de lucru.',
  'workbench.workspace.grant.orgFallback': 'organizația dvs.',
  'workbench.workspace.grant.openServer': 'Deschidere {org}',
  'workbench.workspace.grant.zeroBanner':
    'Conectat la {orgs} — niciun spațiu de lucru nu v-a fost acordat încă. Lucrați într-un spațiu de lucru local; spațiile de lucru acordate apar aici automat odată ce un administrator vă dă acces.',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': 'Culoare {name}',
  'workbench.workspace.picker.searchIcons': 'Căutare pictograme...',
  'workbench.workspace.picker.noIconTooltip': 'Fără pictogramă — afișează doar pătratul de culoare',
  'workbench.workspace.picker.noIconAria': 'Fără pictogramă',
  'workbench.workspace.picker.triggerAria': 'Alegeți prefixul spațiului de lucru (culoare sau pictogramă)',
} as const satisfies Catalog;
