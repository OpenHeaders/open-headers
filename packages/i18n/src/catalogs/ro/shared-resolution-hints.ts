/**
 * Resolution-hint family — Romanian. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key; see that file
 * for the core mirror contract and the raw plane (`{{name}}` reference
 * syntax, namespace ids, `requestDomains` / sha256 / punycode). The
 * quoted OH navigation labels are MINTED here and quoted verbatim by
 * every later ro file: „Medii” = Environments, „Variabile de spațiu de
 * lucru” = Workspace Variables, „Variabile Live” = Live Variables,
 * Vault raw with secțiunea as head noun. Mints: nume de gazdă simplu =
 * bare hostname; schemă = scheme; metacaracter = wildcard; curățare =
 * sanitization; managerul de secrete = secret manager; en lowercase
 * `vault` stays lowercase (the S94 case-faithful law).
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': 'Referința este goală. Folosiți {{name}} sau {{namespace.name}}.',
  'shared.resolutionHint.unknownNamespace':
    'Spațiu de nume necunoscut. Spații de nume valide: env, vault, collection, workspace, file, live, step, dynamic.',
  'shared.resolutionHint.unset.envActive':
    'Setați această variabilă în „Medii” → mediul activ (sau în mediul implicit, ca rezervă).',
  'shared.resolutionHint.unset.envNoActive':
    'Niciun mediu activ nu este selectat. Selectați unul în „Medii” sau setați un mediu implicit.',
  'shared.resolutionHint.unset.vault': 'Setați acest secret în secțiunea Vault.',
  'shared.resolutionHint.unset.collection': 'Setați această variabilă în colecția curentă.',
  'shared.resolutionHint.unset.workspace': 'Setați această variabilă în „Variabile de spațiu de lucru”.',
  'shared.resolutionHint.unset.file': 'Referiți acest fișier prin hash-ul său sha256.',
  'shared.resolutionHint.unset.live':
    'Nu există nicio variabilă Live cu acest nume. Creați una în „Variabile Live” sau așteptați prima ei reîmprospătare.',
  'shared.resolutionHint.unset.step':
    'Id-ul pasului sau numele capturii nu a fost găsit în această rulare a fluxului de lucru. Verificați configurația pasului.',
  'shared.resolutionHint.unset.dynamic':
    'Nu există niciun generator încorporat cu acest nume. Alegeți unul din lista de sugestii ({{dynamic.uuid}}, {{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': 'Nu este setată în această sferă.',
  'shared.resolutionHint.stepOutOfContext':
    'Referințele la pași ({{step.<stepId>.<captureName>}}) sunt valide doar în interiorul unui pas de flux de lucru Live.',
  'shared.resolutionHint.unresolved':
    'Nu a fost găsită nici în vault, nici în mediu, colecție sau spațiul de lucru. Definiți-o în una dintre aceste sfere.',
  'shared.resolutionHint.secretAuthorizationRequired':
    'Managerul de secrete care deține această intrare necesită autorizare. Deblocați sau aprobați accesul în manager, apoi reîncercați.',
  'shared.resolutionHint.secretNotFound':
    'Managerul de secrete nu a găsit niciun secret la această referință. Verificați câmpurile referinței în intrarea Vault.',
  'shared.resolutionHint.secretUnavailable':
    'Managerul de secrete pentru această intrare nu este disponibil pe acest dispozitiv. Instalați-l sau configurați-l, apoi reîncercați.',
  'shared.resolutionHint.invalidDomain.whitespace':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — conține spații (separați numele de gazdă prin virgule). Folosiți nume de gazdă simple, separate prin virgule.',
  'shared.resolutionHint.invalidDomain.scheme':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — conține o schemă — eliminați prefixul de protocol. Folosiți nume de gazdă simple, separate prin virgule.',
  'shared.resolutionHint.invalidDomain.wildcard':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — conține un metacaracter — requestDomains potrivește automat subdomeniile. Folosiți nume de gazdă simple, separate prin virgule.',
  'shared.resolutionHint.invalidDomain.port':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — conține un port — requestDomains potrivește doar după numele de gazdă. Folosiți nume de gazdă simple, separate prin virgule.',
  'shared.resolutionHint.invalidDomain.uppercase':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — conține majuscule — requestDomains este ASCII cu minuscule. Folosiți nume de gazdă simple, separate prin virgule.',
  'shared.resolutionHint.invalidDomain.nonAscii':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — conține caractere pe care Chrome le respinge (folosiți punycode pentru numele IDN). Folosiți nume de gazdă simple, separate prin virgule.',
  'shared.resolutionHint.invalidDomain.empty':
    'Variabila s-a rezolvat la o valoare pe care Chrome o respinge în acest câmp — este goală după curățare. Folosiți nume de gazdă simple, separate prin virgule.',
} as const satisfies Catalog;
