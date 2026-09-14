/**
 * Workbench variables station — Romanian. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * stays raw inside keyed sentences: `{{live.NAME}}` / `{{…}}`
 * reference syntax (composed as code chips at the render site), TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, secret-manager
 * product names (1Password / Bitwarden / AWS Secrets Manager / Azure
 * Key Vault / HashiCorp Vault) and their `Vault` field (the product's
 * own noun, raw), variable / workflow names ({name}), server error
 * text ({message}); lowercase-en `vault` rides raw and lowercase
 * (secretele din vault, sferele de mediu și vault, propriul vault)
 * while the capitalized `Vault` keeps the capital (folosiți Vault,
 * Secretele din Vault) — the case law both ways, per key. Quotes the
 * shipped ro mints: the scoping nouns (Vault raw / Mediu / Colecție /
 * Spațiu de lucru / Live — workbench-chrome's varScope block, the
 * sidebar entries Variabile de spațiu de lucru / Variabile Live), În
 * sferă / Toate sferele = In scope / All scopes (minted in
 * workbench-docs-variables), referință fără prefix = bare reference
 * (docs), Setare ca activ / Setare ca implicit / Anulare implicit (the
 * sidebar env rows), Deschidere certificate de încredere (the command
 * palette), frază de acces / emitent / cheie privată
 * (shared-conflicts), managerul de secrete (shared-components),
 * `{digits} cifre · {period}s` (the templateInput TOTP preview),
 * Reîmprospătare / suprascriere / ciornă / legare / captură / flux de
 * lucru carried, keychain-ul (settings panes), criptată în repaus (the
 * proxy trust pane), rezolvator = resolver (workbench-live). MINTS:
 * sensibilă = sensitive (a row mark — Marcare ca sensibilă, agreeing
 * with variabilă); Depozitul de acreditări al sistemului de operare =
 * OS credential store; cheia de stocare = the at-rest key; a sigilat /
 * sigilate = sealed (the chrome's Sigilare…); probleme de rezolvare =
 * resolution issues; the reason chips (nerezolvată / în afara sferei /
 * spațiu de nume necunoscut / referință la pas în afara sferei / goală
 * / valoare nevalidă / necesită autorizare / secret negăsit / manager
 * indisponibil). The scopeInfo title restructures to `{qualifier} din
 * sfera „{label}”` (Variabilă din sfera „Mediu” — the en `{label}
 * {qualifier}` order does not carry) and its sandwich reads `Scrieți`
 * + [chip] + `doar așa — nu ca` + [chip] + `.` / `sau doar` + [chip];
 * the bare row `Referință fără prefix` + [chip] + `se rezolvă după
 * prioritate:` accepts the dangling code chip as ja / ko / ru do.
 * Counts take colon frames (șiruri: {strings}; rezolvate:
 * {resolved}/{total}; nerezolvate: {count}); the `{noun}` hole takes a
 * parenthesis frame (în elementul curent ({noun})).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': 'Variabilă',
  'workbench.variables.table.headerSecret': 'Secret',
  'workbench.variables.table.headerValue': 'Valoare',
  'workbench.variables.table.namePlaceholder': 'Nume',
  'workbench.variables.table.valuePlaceholder': 'Valoare',
  'workbench.variables.table.addVariable': 'Adăugare variabilă…',
  'workbench.variables.table.addSecret': 'Adăugare secret…',
  'workbench.variables.table.enableRow': 'Activare variabilă',
  'workbench.variables.table.disableRow': 'Dezactivare variabilă',
  'workbench.variables.table.markSensitive': 'Marcare ca sensibilă',
  'workbench.variables.table.unmarkSensitive': 'Anulare marcaj „sensibilă”',
  'workbench.variables.table.showValue': 'Afișare valoare',
  'workbench.variables.table.hideValue': 'Ascundere valoare',
  'workbench.variables.table.kindText': 'Text',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': 'Certificat',
  'workbench.variables.table.kindSecretManager': 'Manager de secrete',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': 'Depozitul de acreditări al sistemului de operare',
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': 'Furnizor',
  'workbench.variables.table.smField.vault': 'Vault',
  'workbench.variables.table.smField.item': 'Element',
  'workbench.variables.table.smField.field': 'Câmp',
  'workbench.variables.table.smField.account': 'Cont',
  'workbench.variables.table.smField.secretId': 'ID secret',
  'workbench.variables.table.smField.service': 'Serviciu',
  'workbench.variables.table.smField.name': 'Nume',
  'workbench.variables.table.smField.stage': 'Etapă',
  'workbench.variables.table.smField.region': 'Regiune',
  'workbench.variables.table.smField.profile': 'Profil',
  'workbench.variables.table.smField.vaultUrl': 'Adresă URL Vault',
  'workbench.variables.table.smField.version': 'Versiune',
  'workbench.variables.table.smField.mount': 'Punct de montare',
  'workbench.variables.table.smField.path': 'Cale',
  'workbench.variables.table.smField.key': 'Cheie',
  'workbench.variables.table.smField.serverUrl': 'Adresă URL server',
  'workbench.variables.table.smFieldOptional': '{label} (opțional)',
  'workbench.variables.table.smStatus.available': 'Disponibil',
  'workbench.variables.table.smStatus.notInstalled': 'Indisponibil pe acest dispozitiv',
  'workbench.variables.table.smStatus.integrationDisabled': 'Integrare dezactivată',
  'workbench.variables.table.smStatus.noCredentials': 'Nicio acreditare configurată',
  'workbench.variables.table.smStatus.locked': 'Blocat',
  'workbench.variables.table.smStatus.unreachable': 'Inaccesibil',
  'workbench.variables.table.certPlaceholder': 'Certificat (PEM)',
  'workbench.variables.table.certKeyPlaceholder': 'Cheie privată (PEM)',
  'workbench.variables.table.passphrasePlaceholder': 'Frază de acces a cheii (opțional)',
  'workbench.variables.table.showCertificate': 'Afișare certificat',
  'workbench.variables.table.hideCertificate': 'Ascundere certificat',
  'workbench.variables.table.seedPlaceholder': 'Sămânță Base32',
  'workbench.variables.table.showSeed': 'Afișare sămânță',
  'workbench.variables.table.hideSeed': 'Ascundere sămânță',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} cifre · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} cifre · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': 'Emitent',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': 'VARIABILE ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': 'Variabile de spațiu de lucru',
  'workbench.variables.workspace.description':
    'Partajate în fiecare mediu din acest spațiu de lucru. Prioritate minimă — suprascrise de sferele de colecție, de mediu și vault.',
  'workbench.variables.workspace.saveFailed': 'Salvarea variabilelor de spațiu de lucru a eșuat',
  'workbench.variables.workspace.saveFailedDetail': 'Salvarea variabilelor de spațiu de lucru a eșuat: {message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': 'Mediul nu a fost găsit.',
  'workbench.variables.environment.activeTag': 'Activ',
  'workbench.variables.environment.defaultTag': 'Implicit',
  'workbench.variables.environment.defaultTooltip':
    'Rezolvatorul revine aici când mediului activ îi lipsește o variabilă.',
  'workbench.variables.environment.setActive': 'Setare ca activ',
  'workbench.variables.environment.setDefault': 'Setare ca implicit',
  'workbench.variables.environment.unsetDefault': 'Anulare implicit',
  'workbench.variables.environment.setDefaultTooltip':
    'Setare ca implicit — rezolvatorul revine aici când mediului activ îi lipsește o variabilă.',
  'workbench.variables.environment.unsetDefaultTooltip':
    'Anulare implicit — rezolvatorul nu va mai reveni la acest mediu.',
  'workbench.variables.environment.deletedElsewhere': 'Mediul a fost șters din altă filă',
  'workbench.variables.environment.updateFailed': 'Actualizarea mediului a eșuat',
  'workbench.variables.environment.updateFailedDetail': 'Actualizarea mediului a eșuat: {message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'Colecția nu a fost găsită.',
  'workbench.variables.collection.title': '{name} · Variabile',
  'workbench.variables.collection.descriptionRule':
    'Variabile disponibile fiecărei reguli din această colecție. Suprascrise de sferele de mediu și vault; suprascriu sfera de spațiu de lucru. Stocate în text clar — folosiți Vault pentru secrete.',
  'workbench.variables.collection.descriptionRequest':
    'Variabile disponibile fiecărei cereri din această colecție. Suprascrise de sferele de mediu și vault; suprascriu sfera de spațiu de lucru. Stocate în text clar — folosiți Vault pentru secrete.',
  'workbench.variables.collection.descriptionTemplate':
    'Variabile disponibile fiecărui șablon din această colecție. Suprascrise de sferele de mediu și vault; suprascriu sfera de spațiu de lucru. Stocate în text clar — folosiți Vault pentru secrete.',
  'workbench.variables.collection.deletedElsewhere': 'Colecția a fost ștearsă din altă filă',
  'workbench.variables.collection.saveFailed': 'Salvarea variabilelor de colecție a eșuat',
  'workbench.variables.collection.saveFailedDetail': 'Salvarea variabilelor de colecție a eșuat: {message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Secretele din Vault sunt criptate în repaus, nu părăsesc niciodată acest dispozitiv și au prioritate față de orice altă sferă.',
  'workbench.variables.vault.trustedRootsNote':
    'Căutați certificate CA? Certificatele de încredere sunt date de spațiu de lucru, nu secrete — au propria lor filă.',
  'workbench.variables.vault.trustedRootsLink': 'Deschidere certificate de încredere',
  'workbench.variables.vault.cipherLocked':
    'Stocarea secretelor este blocată — sistemul a refuzat accesul la keychain-ul său, așa că secretele din vault nu pot fi citite sau salvate în această sesiune.',
  'workbench.variables.vault.cipherLockedRelaunch': 'Repornire aplicație',
  'workbench.variables.vault.lockedTitle': 'Vault blocat — cheia de stocare pierdută',
  'workbench.variables.vault.lockedDescription':
    'Secretele acestui vault sunt încă stocate pe acest dispozitiv, dar nu mai pot fi decriptate: cheia de stocare care le-a sigilat a dispărut (date de browser șterse, un profil nou sau o cheie de extensie resetată). Editarea este dezactivată pentru ca o intrare nouă să nu suprascrie datele sigilate. Reintroduceți secretele pentru a debloca acest vault — intrările existente vor fi înlocuite.',
  'workbench.variables.vault.secretsCount':
    'SECRETE (șiruri: {strings} · TOTP: {totps} · certificate: {certs} · manager de secrete: {refs})',
  'workbench.variables.vault.saveFailed': 'Salvarea în vault a eșuat',
  'workbench.variables.vault.saveFailedDetail': 'Salvarea în vault a eșuat: {message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Variabile Live',
  'workbench.variables.live.newVariable': 'Variabilă live nouă',
  'workbench.variables.live.descriptionPrefix':
    'Fiecare legare mapează un nume la o captură dintr-un flux de lucru (un lanț de cereri programat). Referențiată în reguli și cereri ca',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': 'Nume',
  'workbench.variables.live.headerValue': 'Valoare',
  'workbench.variables.live.headerWorkflow': 'Flux de lucru',
  'workbench.variables.live.empty':
    'Nicio variabilă live încă. Creați una pentru a lega un nume de valoarea capturată a unui flux de lucru.',
  'workbench.variables.live.draftMarker': 'ciornă',
  'workbench.variables.live.offMarker': 'oprită',
  'workbench.variables.live.overrideMarker': 'suprascriere',
  'workbench.variables.live.clickEyeToReveal': 'Apăsați ochiul pentru a dezvălui',
  'workbench.variables.live.showValue': 'Afișare valoare',
  'workbench.variables.live.hideValue': 'Ascundere valoare',
  'workbench.variables.live.notCapturedYet': 'necapturată încă',
  'workbench.variables.live.missingWorkflow': 'flux de lucru lipsă',
  'workbench.variables.live.refreshNow': 'Reîmprospătare flux de lucru acum',
  'workbench.variables.live.refreshAria': 'Reîmprospătare {name}',
  'workbench.variables.live.editBinding': 'Editare legare (nume / activare / suprascriere)',
  'workbench.variables.live.editAria': 'Editare {name}',
  'workbench.variables.live.delete': 'Ștergere',
  'workbench.variables.live.deleteAria': 'Ștergere {name}',
  'workbench.variables.live.deleteFailed': 'Ștergerea variabilei „{name}” a eșuat',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': 'Mediu',
  'workbench.variables.panel.scope.collection': 'Colecție',
  'workbench.variables.panel.scope.workspace': 'Spațiu de lucru',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': 'În sferă',
  'workbench.variables.panel.inContextTitleNamed': 'În sferă: {name}',
  'workbench.variables.panel.inContextSummary':
    'Variabilele la care face referire regula, cererea sau șablonul activ — fiecare rezolvată prin toate sferele, ca să vedeți exact valoarea care se va aplica. Gol până când deschideți una.',
  'workbench.variables.panel.allScopesTitle': 'Toate sferele',
  'workbench.variables.panel.allScopesSummary':
    'Fiecare variabilă definită în toate sferele, grupate după prioritatea de rezolvare. Deschideți (i)-ul unei sfere pentru cum se face referire la ea și unde se clasează.',
  'workbench.variables.panel.sectionAboutAria': 'Despre {title}',
  'workbench.variables.panel.scopeAboutAria': 'Despre variabilele din sfera {scope}',
  'workbench.variables.panel.scopeSummary.vault':
    'Secrete per utilizator, stocate în propriul vault și niciodată sincronizate.',
  'workbench.variables.panel.scopeSummary.environment': 'Variabile din mediul activ, cu revenire la mediul implicit.',
  'workbench.variables.panel.scopeSummary.collection': 'Variabile limitate la colecția activă.',
  'workbench.variables.panel.scopeSummary.workspace': 'Variabile partajate în tot spațiul de lucru.',
  'workbench.variables.panel.scopeSummary.live':
    'O valoare susținută de un flux de lucru, rezolvată din ultima rulare.',
  'workbench.variables.panel.scopeInfo.title': '{qualifier} din sfera „{label}”',
  'workbench.variables.panel.scopeInfo.qualifierSecret': 'Secret',
  'workbench.variables.panel.scopeInfo.qualifierVariable': 'Variabilă',
  'workbench.variables.panel.scopeInfo.writePrefix': 'Scrieți',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': 'doar așa — nu ca',
  'workbench.variables.panel.scopeInfo.orJustMiddle': 'sau doar',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': 'Referință fără prefix',
  'workbench.variables.panel.scopeInfo.bareSuffix': 'se rezolvă după prioritate:',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live stă în afara acestei ordini.',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · implicit: {default}',
  'workbench.variables.panel.env.subtitleNoneDefault': 'Fără mediu · implicit: {default}',
  'workbench.variables.panel.env.subtitleNone': 'Fără mediu',
  'workbench.variables.panel.env.editTooltip': 'Deschidere editor de variabile de mediu',
  'workbench.variables.panel.env.createTooltip': 'Creați primul dvs. mediu',
  'workbench.variables.panel.env.selectTooltip': 'Alegeți mediul activ',
  'workbench.variables.panel.collection.noneActive': 'Nicio colecție activă',
  'workbench.variables.panel.live.resolvedCount': 'rezolvate: {resolved}/{total}',
  'workbench.variables.panel.live.noneDefined': 'nicio variabilă live definită',
  'workbench.variables.panel.action.edit': 'Editare',
  'workbench.variables.panel.action.editTooltip': 'Deschidere editor de variabile din sfera {scope}',
  'workbench.variables.panel.action.create': 'Creare',
  'workbench.variables.panel.action.select': 'Selectare',
  'workbench.variables.panel.emptyScopeSecrets': 'Niciun secret definit.',
  'workbench.variables.panel.emptyScopeVariables': 'Nicio variabilă definită.',
  'workbench.variables.panel.openHint':
    'Deschideți o cerere sau o regulă pentru a vedea variabilele la care face referire.',
  'workbench.variables.panel.noneReferenced': 'Nicio variabilă referențiată în elementul curent ({noun}).',
  'workbench.variables.panel.noun.rule': 'regulă',
  'workbench.variables.panel.noun.request': 'cerere',
  'workbench.variables.panel.noun.template': 'șablon',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Toate variabilele sunt rezolvate ({count})',
      few: 'Toate variabilele sunt rezolvate ({count})',
      other: 'Toate variabilele sunt rezolvate ({count})',
    }),
  'workbench.variables.panel.unresolvedCount': 'nerezolvate: {count}',
  'workbench.variables.panel.valueUnresolved': 'nerezolvată',
  'workbench.variables.panel.valueEmpty': '(gol)',
  'workbench.variables.panel.showValue': 'Afișare valoare',
  'workbench.variables.panel.hideValue': 'Ascundere valoare',
  'workbench.variables.panel.copyValue': 'Copiere valoare',
  'workbench.variables.panel.copied': 'Copiat',
  'workbench.variables.panel.errors.title': 'Probleme de rezolvare ({count})',
  'workbench.variables.panel.errors.referenceTooltip': 'Referința brută din interiorul {{…}}',
  'workbench.variables.panel.errors.reason.unresolved': 'nerezolvată',
  'workbench.variables.panel.errors.reason.unsetInScope': 'în afara sferei',
  'workbench.variables.panel.errors.reason.unknownNamespace': 'spațiu de nume necunoscut',
  'workbench.variables.panel.errors.reason.stepOutOfContext': 'referință la pas în afara sferei',
  'workbench.variables.panel.errors.reason.empty': 'goală',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': 'valoare nevalidă',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': 'necesită autorizare',
  'workbench.variables.panel.errors.reason.secretNotFound': 'secret negăsit',
  'workbench.variables.panel.errors.reason.secretUnavailable': 'manager indisponibil',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Copiere cod',
  'workbench.totpPreview.copied': 'Copiat',
  'workbench.totpPreview.refreshesTooltip': 'Se reîmprospătează în {seconds}s',
  'workbench.totpPreview.refreshesAria': 'Codul TOTP se reîmprospătează în {seconds} secunde',
} as const satisfies Catalog;
