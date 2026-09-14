/**
 * Shared conflicts family — Romanian. Mirrors
 * `catalogs/en/shared-conflicts.ts` key for key; schema paths, entity
 * uids, {name}/{step}/{uid} wire data and identifier leaf labels
 * (dependsOn, runIf, priorityFrom, id, timeout — de / ko precedent)
 * stay raw; `seed` rides raw (S67/S75 + de precedent); `Depozit
 * Cookie` = the capitalized en `Cookie jar` label (the case-exact
 * glossary trap — depozitul de cookie-uri stays the prose form).
 * Mints: modificare externă = external change; Păstrare a mea = keep
 * mine / Utilizare salvată = use saved (the noun-label register, the
 * plural rows Păstrare toate ale mele / Utilizare toate salvate);
 * Editarea dvs. = your edit; Revizuire modificări = review changes;
 * specificație carried; bodies stay Corp cerere / Corp răspuns;
 * Autorizare = the Authorization FIELD label (the raw header name
 * Authorization stays raw — Păstrare antet Authorization); captură
 * carried; extractor raw (extractorul); politică de reîncercare =
 * retry policy; frază de acces = passphrase; acreditări carried;
 * Emitent = issuer (carried from trusted roots). THE SETTINGS-KNOB
 * SCALAR TWINS live here and editors-request quotes them verbatim:
 * Versiune TLS minimă / Versiune TLS maximă / Suite de cifrare TLS /
 * Nume de server SNI / Versiune HTTP / Rezolvare la adresa / Certificat
 * de client / Mod proxy / Adresă URL proxy / Acreditări proxy / Socket
 * Unix / Depozit Cookie / Timp de așteptare cerere / Limită dimensiune
 * răspuns / Redirecționări maxime / Păstrare metodă HTTP originală /
 * Păstrare antet Authorization / Mod acreditări / Urmărire
 * redirecționări / Verificare SSL / Script pre-cerere / Script
 * post-răspuns. The `{noun}` and `{scope}`-style holes take a colon
 * frame (no agreeing verb); `{set}s — order changed` drops the en
 * plural onto the hole's own label (`{set} — ordinea s-a schimbat`);
 * the aside dash keeps.
 */

import type { Catalog } from '../../types';

export const sharedConflicts = {
  // ── Entity banner ──────────────────────────────────────────────────
  'shared.conflicts.banner.changedExternally': 'Modificare externă în timpul editării: {noun}.',
  'shared.conflicts.banner.fieldsNoun': 'câmpuri',
  'shared.conflicts.banner.review': 'Revizuire modificări',
  'shared.conflicts.banner.keepAllMine': 'Păstrare toate ale mele',
  'shared.conflicts.banner.useAllSaved': 'Utilizare toate salvate',

  // ── Merge-dialog shim ──────────────────────────────────────────────
  'shared.conflicts.dialog.title': 'Rezolvare modificări externe',

  // ── Per-leaf diff chip ─────────────────────────────────────────────
  'shared.conflicts.chip.trigger': 'Modificare externă disponibilă — apăsați pentru rezolvare',
  'shared.conflicts.chip.externalChange': 'Modificare externă',
  'shared.conflicts.chip.savedValue': 'Valoare salvată',
  'shared.conflicts.chip.yourEdit': 'Editarea dvs.',
  'shared.conflicts.chip.keepMine': 'Păstrare a mea',
  'shared.conflicts.chip.useSaved': 'Utilizare salvată',
  'shared.conflicts.chip.lastSyncedValue': 'Ultima valoare sincronizată',
  'shared.conflicts.chip.empty': '(gol)',

  // ── Set-row removal chip ───────────────────────────────────────────
  'shared.conflicts.rowChip.trigger': 'Versiunea salvată a eliminat acest rând — apăsați pentru rezolvare',
  'shared.conflicts.rowChip.removedExternally': 'Rând eliminat extern',
  'shared.conflicts.rowChip.lastSyncedRow': 'Ultimul rând sincronizat',
  'shared.conflicts.rowChip.useSavedRemove': 'Utilizare salvată (eliminare)',

  // ── Adapter label plane: field-tree walker fallback ────────────────
  'shared.conflicts.label.walker.orderChanged': '{set} — ordinea s-a schimbat',

  // ── Adapter label plane: action entities (rule + template) ─────────
  'shared.conflicts.label.action.set.requestHeader': 'Antet de cerere',
  'shared.conflicts.label.action.set.responseHeader': 'Antet de răspuns',
  'shared.conflicts.label.action.set.queryParam': 'Parametru de interogare',
  'shared.conflicts.label.action.set.param': 'Parametru',
  'shared.conflicts.label.action.set.condition': 'Condiție',
  'shared.conflicts.label.action.orderChanged': '{set} — ordinea s-a schimbat',
  'shared.conflicts.label.action.setRowNamed': '{kind} {name}',
  'shared.conflicts.label.action.name': 'Nume',
  'shared.conflicts.label.action.conditionLeafLabel': 'Condiție: {leaf}',
  'shared.conflicts.label.action.requestHeaderLeafNamed': 'Antet de cerere {name} ({leaf})',
  'shared.conflicts.label.action.requestHeaderLeaf': 'Antet de cerere ({leaf})',
  'shared.conflicts.label.action.responseHeaderLeafNamed': 'Antet de răspuns {name} ({leaf})',
  'shared.conflicts.label.action.responseHeaderLeaf': 'Antet de răspuns ({leaf})',
  'shared.conflicts.label.action.queryParamLeafNamed': 'Parametru de interogare {name} ({leaf})',
  'shared.conflicts.label.action.queryParamLeaf': 'Parametru de interogare ({leaf})',
  'shared.conflicts.label.action.headerLeaf.value': 'valoare',
  'shared.conflicts.label.action.headerLeaf.name': 'nume',
  'shared.conflicts.label.action.headerLeaf.operation': 'operație',
  'shared.conflicts.label.action.headerLeaf.mergeSeparator': 'separator de îmbinare',
  'shared.conflicts.label.action.paramLeaf.value': 'valoare',
  'shared.conflicts.label.action.paramLeaf.name': 'nume',
  'shared.conflicts.label.action.paramLeaf.operation': 'operație',
  'shared.conflicts.label.action.conditionLeaf.values': 'valori',
  'shared.conflicts.label.action.conditionLeaf.type': 'tip',
  'shared.conflicts.label.action.conditionLeaf.headerName': 'nume antet',
  'shared.conflicts.label.action.scalar.redirectTo': 'Adresă URL de redirecționare',
  'shared.conflicts.label.action.scalar.delayMs': 'Întârziere (ms)',
  'shared.conflicts.label.action.scalar.injectType': 'Tip de injectare',
  'shared.conflicts.label.action.scalar.source': 'Sursă de injectare',
  'shared.conflicts.label.action.scalar.code': 'Cod de injectare',
  'shared.conflicts.label.action.scalar.sourceUrl': 'Adresă URL sursă de injectare',
  'shared.conflicts.label.action.scalar.position': 'Poziție de injectare',
  'shared.conflicts.label.action.scalar.requestBody': 'Corp cerere',
  'shared.conflicts.label.action.scalar.bodyType': 'Tip de corp',
  'shared.conflicts.label.action.scalar.resourceType': 'Tip de resursă',
  'shared.conflicts.label.action.scalar.statusCode': 'Cod de stare răspuns',
  'shared.conflicts.label.action.scalar.responseBody': 'Corp răspuns',
  'shared.conflicts.label.action.scalar.contentType': 'Tip de conținut răspuns',
  'shared.conflicts.label.action.scalar.operation': 'Operație',
  'shared.conflicts.label.action.scalar.direction': 'Direcție',
  'shared.conflicts.label.action.scalar.eventName': 'Nume eveniment',
  'shared.conflicts.label.action.scalar.payload': 'Conținut util mesaj',
  'shared.conflicts.label.action.scalar.injectTrigger': 'Declanșator de injectare',
  'shared.conflicts.label.action.messageFilter.matchType': 'Tip filtru de mesaje',
  'shared.conflicts.label.action.messageFilter.value': 'Valoare filtru de mesaje',

  // ── Adapter label plane: variables ─────────────────────────────────
  'shared.conflicts.label.variable.row': 'Variabilă',
  'shared.conflicts.label.variable.rowNamed': 'Variabila {name}',
  'shared.conflicts.label.variable.leafNamed': 'Variabila {name} ({label})',
  'shared.conflicts.label.variable.leaf': 'Variabilă ({label})',
  'shared.conflicts.label.variable.orderChanged': 'Variabile — ordinea s-a schimbat',
  'shared.conflicts.label.variable.field.name': 'nume',
  'shared.conflicts.label.variable.field.value': 'valoare',
  'shared.conflicts.label.variable.field.type': 'tip',
  'shared.conflicts.label.variable.field.enabled': 'activată',

  // ── Adapter label plane: vault secrets ─────────────────────────────
  'shared.conflicts.label.vault.row': 'Secret',
  'shared.conflicts.label.vault.rowNamed': 'Secretul {name}',
  'shared.conflicts.label.vault.leafNamed': 'Secretul {name} ({label})',
  'shared.conflicts.label.vault.leaf': 'Secret ({label})',
  'shared.conflicts.label.vault.orderChanged': 'Secrete — ordinea s-a schimbat',
  'shared.conflicts.label.vault.field.name': 'nume',
  'shared.conflicts.label.vault.field.kind': 'fel',
  'shared.conflicts.label.vault.field.value': 'valoare',
  'shared.conflicts.label.vault.field.seed': 'seed',
  'shared.conflicts.label.vault.field.algorithm': 'algoritm',
  'shared.conflicts.label.vault.field.digits': 'cifre',
  'shared.conflicts.label.vault.field.period': 'perioadă',
  'shared.conflicts.label.vault.field.issuer': 'emitent',
  'shared.conflicts.label.vault.field.cert': 'certificat',
  'shared.conflicts.label.vault.field.key': 'cheie privată',
  'shared.conflicts.label.vault.field.passphrase': 'frază de acces',

  // ── Adapter label plane: live variables ────────────────────────────
  'shared.conflicts.label.liveVariable.leaf': 'Variabilă Live ({label})',
  'shared.conflicts.label.liveVariable.field.name': 'nume',
  'shared.conflicts.label.liveVariable.field.description': 'descriere',
  'shared.conflicts.label.liveVariable.field.enabled': 'activată',
  'shared.conflicts.label.liveVariable.field.requireFreshOnRuleBuild': 'așteptare valoare proaspătă',
  'shared.conflicts.label.liveVariable.field.workflowUid': 'flux de lucru',
  'shared.conflicts.label.liveVariable.field.stepId': 'pas',
  'shared.conflicts.label.liveVariable.field.captureName': 'captură',

  // ── Adapter label plane: live workflows ────────────────────────────
  'shared.conflicts.label.workflow.leaf': 'Flux de lucru ({label})',
  'shared.conflicts.label.workflow.stepLeaf': 'Pasul {step} ({leaf})',
  'shared.conflicts.label.workflow.captureLeaf': 'Pasul {step} → {capture} ({leaf})',
  'shared.conflicts.label.workflow.stepFallback': 'pasul {uid}',
  'shared.conflicts.label.workflow.captureFallback': 'captura {uid}',
  'shared.conflicts.label.workflow.field.name': 'nume',
  'shared.conflicts.label.workflow.field.description': 'descriere',
  'shared.conflicts.label.workflow.field.enabled': 'activat',
  'shared.conflicts.label.workflow.field.refreshKind': 'fel de reîmprospătare',
  'shared.conflicts.label.workflow.field.refreshSeconds': 'interval de reîmprospătare',
  'shared.conflicts.label.workflow.field.refreshStepId': 'pas de reîmprospătare',
  'shared.conflicts.label.workflow.field.refreshCaptureName': 'captură de reîmprospătare',
  'shared.conflicts.label.workflow.field.refreshLeadSeconds': 'secunde de avans la reîmprospătare',
  'shared.conflicts.label.workflow.stepField.id': 'id',
  'shared.conflicts.label.workflow.stepField.description': 'descriere',
  'shared.conflicts.label.workflow.stepField.requestUid': 'cerere',
  'shared.conflicts.label.workflow.stepField.dependsOn': 'dependsOn',
  'shared.conflicts.label.workflow.stepField.runIf': 'runIf',
  'shared.conflicts.label.workflow.stepField.priorityFrom': 'priorityFrom',
  'shared.conflicts.label.workflow.stepField.retry': 'politică de reîncercare',
  'shared.conflicts.label.workflow.stepField.timeoutMs': 'timeout',
  'shared.conflicts.label.workflow.stepField.runScripts': 'rulare scripturi',
  'shared.conflicts.label.workflow.captureField.name': 'nume',
  'shared.conflicts.label.workflow.captureField.extractor': 'extractor',

  // ── Adapter label plane: specs ─────────────────────────────────────
  'shared.conflicts.label.spec.leaf': 'Specificație ({label})',
  'shared.conflicts.label.spec.field.name': 'nume',
  'shared.conflicts.label.spec.field.description': 'descriere',
  'shared.conflicts.label.spec.field.format': 'format',
  'shared.conflicts.label.spec.field.rootFileUid': 'fișier rădăcină',
  'shared.conflicts.label.spec.fileRow': 'Fișier de specificație',
  'shared.conflicts.label.spec.fileRowNamed': 'Fișierul de specificație {name}',
  'shared.conflicts.label.spec.fileLeafNamed': 'Fișierul de specificație {name} ({label})',
  'shared.conflicts.label.spec.fileLeaf': 'Fișier de specificație ({label})',
  'shared.conflicts.label.spec.fileField.fileName': 'nume fișier',
  'shared.conflicts.label.spec.fileField.content': 'conținut',

  // ── Adapter label plane: requests ──────────────────────────────────
  'shared.conflicts.label.request.set.header': 'Antet',
  'shared.conflicts.label.request.set.queryParam': 'Parametru de interogare',
  'shared.conflicts.label.request.orderChanged': '{set} — ordinea s-a schimbat',
  'shared.conflicts.label.request.setRowNamed': '{kind} {name}',
  'shared.conflicts.label.request.unionAuth': 'Tip de autorizare',
  'shared.conflicts.label.request.unionBody': 'Tip de corp',
  'shared.conflicts.label.request.headerLeafNamed': 'Antetul {name} ({leaf})',
  'shared.conflicts.label.request.headerLeaf': 'Antet ({leaf})',
  'shared.conflicts.label.request.queryParamLeafNamed': 'Parametrul de interogare {name} ({leaf})',
  'shared.conflicts.label.request.queryParamLeaf': 'Parametru de interogare ({leaf})',
  'shared.conflicts.label.request.authTail': 'Autorizare · {path}',
  'shared.conflicts.label.request.bodyTail': 'Corp · {path}',
  'shared.conflicts.label.request.headerField.key': 'nume',
  'shared.conflicts.label.request.headerField.value': 'valoare',
  'shared.conflicts.label.request.headerField.description': 'descriere',
  'shared.conflicts.label.request.headerField.enabled': 'activat',
  'shared.conflicts.label.request.paramField.key': 'nume',
  'shared.conflicts.label.request.paramField.value': 'valoare',
  'shared.conflicts.label.request.paramField.description': 'descriere',
  'shared.conflicts.label.request.paramField.enabled': 'activat',
  'shared.conflicts.label.request.paramField.hasEquals': 'separator',
  'shared.conflicts.label.request.scalar.name': 'Nume',
  'shared.conflicts.label.request.scalar.description': 'Descriere',
  'shared.conflicts.label.request.scalar.url': 'URL',
  'shared.conflicts.label.request.scalar.method': 'Metodă',
  'shared.conflicts.label.request.scalar.auth': 'Autorizare',
  'shared.conflicts.label.request.scalar.body': 'Corp',
  'shared.conflicts.label.request.scalar.credentialsMode': 'Mod acreditări',
  'shared.conflicts.label.request.scalar.followRedirects': 'Urmărire redirecționări',
  'shared.conflicts.label.request.scalar.sslVerification': 'Verificare SSL',
  'shared.conflicts.label.request.scalar.tlsMinVersion': 'Versiune TLS minimă',
  'shared.conflicts.label.request.scalar.tlsMaxVersion': 'Versiune TLS maximă',
  'shared.conflicts.label.request.scalar.tlsCipherSuites': 'Suite de cifrare TLS',
  'shared.conflicts.label.request.scalar.sniServerName': 'Nume de server SNI',
  'shared.conflicts.label.request.scalar.httpVersion': 'Versiune HTTP',
  'shared.conflicts.label.request.scalar.resolveToAddress': 'Rezolvare la adresa',
  'shared.conflicts.label.request.scalar.clientCertificateRef': 'Certificat de client',
  'shared.conflicts.label.request.scalar.proxyMode': 'Mod proxy',
  'shared.conflicts.label.request.scalar.proxyUrl': 'Adresă URL proxy',
  'shared.conflicts.label.request.scalar.proxyCredentialRef': 'Acreditări proxy',
  'shared.conflicts.label.request.scalar.unixSocketPath': 'Socket Unix',
  'shared.conflicts.label.request.scalar.cookieJar': 'Depozit Cookie',
  'shared.conflicts.label.request.scalar.timeoutMs': 'Timp de așteptare cerere',
  'shared.conflicts.label.request.scalar.maxResponseBytes': 'Limită dimensiune răspuns',
  'shared.conflicts.label.request.scalar.maxRedirects': 'Redirecționări maxime',
  'shared.conflicts.label.request.scalar.followOriginalHttpMethod': 'Păstrare metodă HTTP originală',
  'shared.conflicts.label.request.scalar.followAuthorizationHeader': 'Păstrare antet Authorization',
  'shared.conflicts.label.request.scalar.preRequestScript': 'Script pre-cerere',
  'shared.conflicts.label.request.scalar.postResponseScript': 'Script post-răspuns',
} as const satisfies Catalog;
