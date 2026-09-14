/**
 * Trusted-certificates family — Romanian. Mirrors
 * `catalogs/en/workbench-trusted-roots.ts` key for key; PEM / CA / PKI /
 * TLS / SHA-256 ride raw. Mints: certificate de încredere = trusted
 * certificates; autoritate de certificare = certificate authority (CA
 * raw as the acronym); fixare / fixat = pin / pinned; depozitul de
 * încredere = trust store; amprentă = fingerprint; Subiect / Emitent =
 * Subject / Issuer; lanț = chain; CA privată = private CA. The
 * `Internal Root CA` sample name copies verbatim.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': 'Certificate de încredere',
  'workbench.trustedRoots.description':
    'Autoritățile de certificare în care are încredere fiecare conexiune TLS din acest spațiu de lucru, pe lângă rădăcinile încorporate. Material public — sincronizat cu spațiul de lucru, niciodată un secret.',
  'workbench.trustedRoots.count': 'CERTIFICATE ({count})',
  'workbench.trustedRoots.empty': 'Niciun certificat de încredere încă',
  'workbench.trustedRoots.emptyHint':
    'Adăugați rădăcina CA privată pentru a ajunge la serverele și brokerii din spatele propriei PKI fără a dezactiva verificarea.',
  'workbench.trustedRoots.add': 'Adăugare certificat',
  'workbench.trustedRoots.header.name': 'Nume',
  'workbench.trustedRoots.header.subject': 'Subiect',
  'workbench.trustedRoots.header.fingerprint': 'Amprentă SHA-256',
  'workbench.trustedRoots.header.expires': 'Expiră',
  'workbench.trustedRoots.row.chain': 'Lanț de {count}',
  'workbench.trustedRoots.row.expired': 'Expirat',
  'workbench.trustedRoots.row.copyFingerprint': 'Copiere amprentă',
  'workbench.trustedRoots.row.copied': 'Copiat',
  'workbench.trustedRoots.row.remove': 'Eliminare',
  'workbench.trustedRoots.row.rename': 'Redenumire',
  'workbench.trustedRoots.add.pemLabel': 'Certificat (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'Lipiți un certificat sau un lanț PEM',
  'workbench.trustedRoots.add.nameLabel': 'Nume',
  'workbench.trustedRoots.add.namePlaceholder': 'Internal Root CA',
  'workbench.trustedRoots.add.summary.subject': 'Subiect',
  'workbench.trustedRoots.add.summary.issuer': 'Emitent',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': 'Valabil de la',
  'workbench.trustedRoots.add.summary.validUntil': 'Valabil până la',
  'workbench.trustedRoots.add.summary.chain': 'Lanț',
  'workbench.trustedRoots.add.parsing': 'Se citește certificatul…',
  'workbench.trustedRoots.add.invalid': 'Nu este un certificat: {message}',
  'workbench.trustedRoots.add.notCa':
    'Acesta este un certificat de server, nu o autoritate de certificare. Adăugați în schimb rădăcina sau certificatul intermediar care l-a emis.',
  'workbench.trustedRoots.add.confirm': 'Adăugare',
  'workbench.trustedRoots.add.cancel': 'Anulare',
  'workbench.trustedRoots.saveFailed': 'Salvarea certificatelor de încredere a eșuat',
  'workbench.trustedRoots.saveFailedDetail': 'Salvarea certificatelor de încredere a eșuat: {message}',
  'workbench.trustedRoots.settings.label': 'Certificate de încredere (CA)',
  'workbench.trustedRoots.settings.count': '{count} din acest spațiu de lucru',
  'workbench.trustedRoots.settings.none': 'Niciunul din acest spațiu de lucru',
  'workbench.trustedRoots.settings.manage': 'Gestionare certificate de încredere',
  'workbench.trustedRoots.settings.empty': 'Niciun certificat de încredere în acest spațiu de lucru încă.',
  'workbench.trustedRoots.settings.browserStore': 'Depozitul browserului',
  'workbench.trustedRoots.settings.help':
    'Autoritățile de certificare în care are încredere acest spațiu de lucru pe lângă rădăcinile încorporate — aplicate fiecărei conexiuni TLS pe care o deschide runtime-ul aplicației, o rădăcină pe rând. Adăugați aici o CA privată în loc să dezactivați verificarea.',
  'workbench.trustedRoots.settings.deviceCount': '{count} pe acest dispozitiv',
  'workbench.trustedRoots.settings.groupWorkspace': 'Acest spațiu de lucru',
  'workbench.trustedRoots.settings.groupDevice': 'Acest dispozitiv',
  'workbench.trustedRoots.device.count': 'FIXATE PE ACEST DISPOZITIV ({count})',
  'workbench.trustedRoots.device.empty': 'Niciun certificat fixat pe acest dispozitiv',
  'workbench.trustedRoots.device.emptyHint':
    'Fixările se adaugă de obicei dintr-o trimitere eșuată — aveți încredere în certificatul prezentat de server, doar pe acest computer. Lipiți unul aici pentru a-l fixa manual.',
  'workbench.trustedRoots.settings.browserNote':
    'Browserul verifică folosind propriul depozit de încredere; certificatele adăugate în acest spațiu de lucru se aplică doar când trimite runtime-ul aplicației.',
  'workbench.trustedRoots.systemTrust.count':
    '{count} certificate din depozitul de încredere al acestui computer se aplică fiecărei conexiuni TLS pe care o deschide runtime-ul aplicației',
  'workbench.trustedRoots.systemTrust.off': 'Doar rădăcinile încorporate și certificatele de mai sus sunt de încredere',
  'workbench.trustedRoots.systemTrust.unsupported':
    'Acest runtime nu poate citi depozitul de încredere al sistemului — este necesar Node 22.15 sau mai nou',
  'workbench.trustedRoots.systemTrust.browser': 'Browserul verifică folosind propriul depozit de încredere',
} as const satisfies Catalog;
