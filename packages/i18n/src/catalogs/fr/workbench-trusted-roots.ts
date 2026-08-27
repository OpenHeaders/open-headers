/**
 * Trusted-certificates family — the TrustedRootsEditor singleton tab
 * (`workbench/components/trusted-roots/`): the row table, the
 * paste → summary → Add flow and its refusals, the remove confirm.
 *
 * Raw by design inside keyed sentences: PEM / CA / PKI / TLS / SHA-256
 * vocabulary (glossary duty), {count} chain lengths, {message} parser
 * text.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': 'Certificats de confiance',
  'workbench.trustedRoots.description':
    'Autorités de certification auxquelles chaque connexion TLS de ce workspace fait confiance, en plus des racines intégrées. Matériel public — synchronisé avec le workspace, jamais un secret.',
  'workbench.trustedRoots.count': 'CERTIFICATS ({count})',
  'workbench.trustedRoots.empty': 'Aucun certificat de confiance pour l’instant',
  'workbench.trustedRoots.emptyHint':
    'Ajoutez la racine de votre CA privée pour joindre les serveurs et brokers derrière votre propre PKI sans désactiver la vérification.',
  'workbench.trustedRoots.add': 'Ajouter un certificat',
  'workbench.trustedRoots.header.name': 'Nom',
  'workbench.trustedRoots.header.subject': 'Sujet',
  'workbench.trustedRoots.header.fingerprint': 'Empreinte SHA-256',
  'workbench.trustedRoots.header.expires': 'Expire le',
  'workbench.trustedRoots.row.chain': 'Chaîne de {count}',
  'workbench.trustedRoots.row.expired': 'Expiré',
  'workbench.trustedRoots.row.copyFingerprint': 'Copier l’empreinte',
  'workbench.trustedRoots.row.copied': 'Copié',
  'workbench.trustedRoots.row.remove': 'Retirer',
  'workbench.trustedRoots.row.removeTitle': 'Retirer ce certificat ?',
  'workbench.trustedRoots.row.removeDescription':
    'Les connexions qui en dépendaient échoueront à la vérification dès la prochaine requête.',
  'workbench.trustedRoots.add.pemLabel': 'Certificat (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'Collez un certificat ou une chaîne PEM',
  'workbench.trustedRoots.add.nameLabel': 'Nom',
  'workbench.trustedRoots.add.namePlaceholder': 'CA racine interne',
  'workbench.trustedRoots.add.summary.subject': 'Sujet',
  'workbench.trustedRoots.add.summary.issuer': 'Émetteur',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': 'Valide du',
  'workbench.trustedRoots.add.summary.validUntil': 'Valide jusqu’au',
  'workbench.trustedRoots.add.summary.chain': 'Chaîne',
  'workbench.trustedRoots.add.parsing': 'Lecture du certificat…',
  'workbench.trustedRoots.add.invalid': 'Pas un certificat : {message}',
  'workbench.trustedRoots.add.notCa':
    'Ceci est un certificat serveur, pas une autorité de certification. Ajoutez plutôt la racine ou l’intermédiaire qui l’a émis.',
  'workbench.trustedRoots.add.confirm': 'Ajouter',
  'workbench.trustedRoots.add.cancel': 'Annuler',
  'workbench.trustedRoots.added': 'Certificat ajouté',
  'workbench.trustedRoots.addFailed': 'L’ajout du certificat a échoué',
  'workbench.trustedRoots.removed': 'Certificat retiré',
  'workbench.trustedRoots.removeFailed': 'Le retrait du certificat a échoué',
  'workbench.trustedRoots.settings.label': 'Certificats de confiance',
  'workbench.trustedRoots.settings.count': '{count} de cet espace de travail',
  'workbench.trustedRoots.settings.none': 'Aucun de cet espace de travail',
  'workbench.trustedRoots.settings.manage': 'Gérer',
  'workbench.trustedRoots.settings.help':
    'Autorités de certification auxquelles cet espace de travail fait confiance en plus des racines intégrées — appliquées à chaque connexion TLS établie par le runtime de l’application, une racine par ligne. Ajoutez ici une CA privée plutôt que de désactiver la vérification.',
  'workbench.trustedRoots.settings.browserNote':
    'Le navigateur vérifie avec son propre magasin de confiance ; les certificats ajoutés à cet espace de travail ne s’appliquent que lorsque le runtime de l’application envoie.',
} as const satisfies Catalog;
