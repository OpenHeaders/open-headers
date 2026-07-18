/**
 * Web namespace — French. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, « daemon », the `ohd show-token` command,
 * URLs and the `oh-license.` key prefix stay raw.
 */

import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Se connecter à ce daemon',
  'web.gate.titlePair': "S'associer à ce daemon",
  'web.gate.introSso': "Connectez-vous avec {provider}, ou collez un jeton d'association ci-dessous.",
  'web.gate.introPassword':
    "Connectez-vous avec l'email et le mot de passe définis pour vous par l'admin du daemon, ou collez un jeton " +
    "d'association ci-dessous.",
  'web.gate.introTokenPrefix':
    "Ce daemon OpenHeaders exige un jeton d'association. Générez-en un sur la machine qui l'exécute avec",
  'web.gate.introTokenSuffix': 'et collez-le ci-dessous.',
  'web.gate.ssoButton': 'Se connecter avec {provider}',
  'web.gate.or': 'ou',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Mot de passe',
  'web.gate.signIn': 'Se connecter',
  'web.gate.tokenPlaceholder': "Jeton d'association",
  'web.gate.connect': 'Connecter',
  'web.gate.workLocally': 'Passer — travailler en local',
  'web.gate.errorTokenRejected': 'Le daemon a rejeté ce jeton. Vérifiez-le et réessayez.',
  'web.gate.errorTokenOffline': "Le daemon n'a pas répondu. Vérifiez qu'il est lancé et réessayez.",
  'web.gate.errorPasswordRefused': "Échec de la connexion. Vérifiez l'email et le mot de passe et réessayez.",
  'web.gate.errorSessionRefused': "Le daemon n'a pas accepté la session. Réessayez.",
  'web.gate.seatIntroPrefix':
    "Vous avez un siège individuel ? Collez sa clé pour vous connecter sans attendre un siège d'équipe libre — " +
    "il admet l'email avec lequel il a été acheté. Obtenez-en un sur",
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Clé de siège individuel (oh-license.…)',
  'web.gate.seatSignIn': 'Se connecter avec un siège individuel',
  'web.overlay.signingIn': 'Connexion en cours…',
  'web.overlay.takingYouTo': 'Redirection vers {provider}…',
  'web.oidcError.unknownUser':
    "Connecté, mais ce daemon n'a aucun utilisateur pour votre email. Demandez à l'admin du daemon de vous " +
    'ajouter.',
  'web.oidcError.userDeactivated':
    "Connecté, mais votre utilisateur sur ce daemon est désactivé. Voyez avec l'admin du daemon.",
  'web.oidcError.emailUnverified':
    "Votre fournisseur d'identité signale l'email comme non vérifié. Vérifiez-le et réessayez.",
  'web.oidcError.providerUnavailable': "Le fournisseur d'identité est injoignable. Réessayez dans un instant.",
  'web.oidcError.seatLimitReached':
    "Connecté, mais ce daemon n'a aucun siège libre pour un nouvel utilisateur. Demandez à l'admin du daemon — " +
    'ou entrez dès maintenant avec votre propre siège individuel.',
  'web.oidcError.personalSeatsDisabled':
    "Les sièges individuels sont désactivés sur ce daemon. Demandez un siège à l'admin du daemon.",
  'web.oidcError.personalLicenseInvalid':
    "Cette clé de siège individuel n'est pas utilisable — elle est invalide, expirée, ou n'est pas un siège " +
    'individuel. Vérifiez la clé et réessayez.',
  'web.oidcError.personalLicenseIdentityMismatch':
    "Ce siège individuel appartient à un autre email. Il n'admet que l'adresse avec laquelle il a été acheté.",
  'web.oidcError.personalLicenseNoIdentity':
    "Votre connexion ne portait aucun email à confronter au siège individuel. Voyez avec l'admin du daemon.",
  'web.oidcError.failed':
    "Échec de l'authentification unique. Réessayez, ou connectez-vous plutôt avec un jeton d'association.",
  'web.insecure.title': 'Cette page nécessite une connexion sécurisée',
  'web.insecure.intro':
    'Le Workbench OpenHeaders conserve toutes ses données dans ce profil de navigateur et a besoin des API de ' +
    'cryptographie du navigateur, disponibles uniquement sur les origines sécurisées.',
  'web.insecure.waysIn': "Ouvrez-la plutôt d'une de ces façons :",
  'web.insecure.httpsPrefix':
    'Via HTTPS — placez le daemon derrière un reverse proxy TLS (voir « Behind a reverse proxy » dans le README ' +
    'du daemon) et ouvrez',
  'web.insecure.httpsSuffix': '.',
  'web.insecure.loopbackPrefix': 'Sur la machine du daemon elle-même à',
  'web.insecure.loopbackSuffix': '.',
} as const satisfies Catalog;
