/**
 * Web namespace — French. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, « daemon », URLs and the `oh-license.` key
 * prefix stay raw. Mints: pairing = association (f.); setup code =
 * code d'installation (m.).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Se connecter à ce serveur',
  'web.gate.titleSetup': 'Installer ce serveur',
  'web.gate.introSso': 'Connectez-vous avec {provider} pour accéder à ce serveur OpenHeaders.',
  'web.gate.introPassword': "Connectez-vous avec l'email et le mot de passe définis pour vous par l'admin du serveur.",
  'web.gate.introSetup':
    "Personne n'a encore installé ce serveur OpenHeaders. Créez le premier compte : il administre le serveur et " +
    "devient propriétaire de tout ce qui s'y trouve déjà.",
  'web.gate.introNoLogin':
    "Aucun navigateur ne peut se connecter à ce serveur : l'authentification unique n'est pas configurée et aucun " +
    'compte ne possède de mot de passe. Demandez-en un à la personne qui gère le serveur.',
  'web.gate.ssoButton': 'Se connecter avec {provider}',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Mot de passe',
  'web.gate.signIn': 'Se connecter',
  'web.gate.setupNamePlaceholder': 'Votre nom',
  'web.gate.setupConfirmPlaceholder': 'Confirmer le mot de passe',
  'web.gate.setupPasswordHint':
    'Au moins {min} caractères. Aucune réinitialisation de mot de passe n’existe — gardez-le en lieu sûr.',
  'web.gate.setupCodePlaceholder': "Code d'installation (facultatif)",
  'web.gate.setupCodeHint':
    "Nécessaire uniquement si ce navigateur ne s'exécute pas sur le serveur lui-même. Le serveur affiche le code " +
    'au démarrage, et chaque redémarrage le remplace par un nouveau.',
  'web.gate.setupSubmit': 'Créer le compte',
  'web.gate.setupDoneTitle': 'Ce serveur est installé',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        "L'installation a dissocié {count} appareil, pour qu'il ne continue pas à administrer ce serveur en " +
        'marge de votre nouveau compte. Réassociez-le depuis les Paramètres.',
      many:
        "L'installation a dissocié {count} appareils, pour qu'ils ne continuent pas à administrer ce serveur en " +
        'marge de votre nouveau compte. Réassociez-les depuis les Paramètres.',
      other:
        "L'installation a dissocié {count} appareils, pour qu'ils ne continuent pas à administrer ce serveur en " +
        'marge de votre nouveau compte. Réassociez-les depuis les Paramètres.',
    }),
  'web.gate.setupDoneContinue': 'Continuer',
  'web.gate.setupDoneReload': 'Recharger',
  'web.gate.setupErrorDisplayName': 'Saisissez le nom à porter sur le compte.',
  'web.gate.setupErrorEmail': 'Saisissez l’email de connexion.',
  'web.gate.setupErrorPasswordShort': 'Utilisez au moins {min} caractères.',
  'web.gate.setupErrorPasswordMismatch': 'Les deux mots de passe ne correspondent pas.',
  'web.gate.setupErrorMalformed': "Le serveur n'a pas pu lire le formulaire. Rechargez la page et réessayez.",
  'web.gate.setupErrorRefused':
    "Le serveur a refusé l'installation. Il est peut-être déjà installé, ou le code d'installation est erroné ou " +
    'issu d’un démarrage précédent — le serveur en affiche un nouveau à chaque redémarrage.',
  'web.gate.setupErrorSessionRefused':
    "Le compte a été créé, mais cet onglet n'a pas pu ouvrir de session. Rechargez la page et connectez-vous avec.",
  'web.gate.clientsIntro':
    "Cet onglet n'est pas le seul client. L'extension et l'application de bureau atteignent ce serveur " +
    'directement sur',
  'web.gate.clientsExtension': "Obtenir l'extension",
  'web.gate.clientsDesktop': "Obtenir l'application de bureau",
  'web.gate.errorServerOffline': "Le serveur n'a pas répondu. Vérifiez qu'il est lancé et réessayez.",
  'web.gate.errorPasswordRefused': "Échec de la connexion. Vérifiez l'email et le mot de passe et réessayez.",
  'web.gate.errorSessionRefused': "Le serveur n'a pas accepté la session. Réessayez.",
  'web.gate.seatIntroPrefix':
    "Vous avez un siège individuel ? Collez sa clé pour vous connecter sans attendre un siège d'équipe libre — " +
    "il admet l'email avec lequel il a été acheté. Obtenez-en un sur",
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Clé de siège individuel (oh-license.…)',
  'web.gate.seatSignIn': 'Se connecter avec un siège individuel',
  'web.overlay.signingIn': 'Connexion en cours…',
  'web.overlay.takingYouTo': 'Redirection vers {provider}…',
  'web.oidcError.unknownUser':
    "Connecté, mais ce serveur n'a aucun utilisateur pour votre email. Demandez à l'admin du serveur de vous " +
    'ajouter.',
  'web.oidcError.userDeactivated':
    "Connecté, mais votre utilisateur sur ce serveur est désactivé. Voyez avec l'admin du serveur.",
  'web.oidcError.emailUnverified':
    "Votre fournisseur d'identité signale l'email comme non vérifié. Vérifiez-le et réessayez.",
  'web.oidcError.providerUnavailable': "Le fournisseur d'identité est injoignable. Réessayez dans un instant.",
  'web.oidcError.seatLimitReached':
    "Connecté, mais ce serveur n'a aucun siège libre pour un nouvel utilisateur. Demandez à l'admin du serveur — " +
    'ou entrez dès maintenant avec votre propre siège individuel.',
  'web.oidcError.personalSeatsDisabled':
    "Les sièges individuels sont désactivés sur ce serveur. Demandez un siège à l'admin du serveur.",
  'web.oidcError.personalLicenseInvalid':
    "Cette clé de siège individuel n'est pas utilisable — elle est invalide, expirée, ou n'est pas un siège " +
    'individuel. Vérifiez la clé et réessayez.',
  'web.oidcError.personalLicenseIdentityMismatch':
    "Ce siège individuel appartient à un autre email. Il n'admet que l'adresse avec laquelle il a été acheté.",
  'web.oidcError.personalLicenseNoIdentity':
    "Votre connexion ne portait aucun email à confronter au siège individuel. Voyez avec l'admin du serveur.",
  'web.oidcError.failed':
    "Échec de l'authentification unique. Réessayez, ou demandez à la personne qui gère le serveur de vérifier le " +
    'fournisseur.',
  'web.access.title': 'Aucun workspace accordé pour le moment',
  'web.access.intro':
    'Vous êtes connecté à {org}, mais aucun workspace ne vous y a encore été accordé. Un administrateur doit ' +
    'vous donner accès à un workspace.',
  'web.access.introNoOrg':
    'Vous êtes connecté à ce serveur, mais aucun workspace ne vous y a encore été accordé. Un administrateur ' +
    'doit vous donner accès à un workspace.',
  'web.access.signedInAs': 'Connecté en tant que {name}',
  'web.access.signedInAsWithEmail': 'Connecté en tant que {name} ({email})',
  'web.access.waiting': "Cet écran se met à jour dès que l'accès est accordé — sans recharger.",
  'web.access.signOut': 'Se déconnecter',
  'web.insecure.title': 'Cette page nécessite une connexion sécurisée',
  'web.insecure.intro':
    'Cet onglet exécute tout le Workbench, pas une vue légère du serveur : il doit donc générer une identité pour ' +
    'cet appareil — ce que les navigateurs autorisent uniquement sur une origine sécurisée.',
  'web.insecure.optionLocal': 'Sur le serveur lui-même :',
  'web.insecure.optionTls': 'Depuis ici via HTTPS — placez devant un reverse proxy qui termine TLS.',
  'web.insecure.optionClients':
    "Depuis ici sans TLS — l'extension et l'application desktop se connectent directement à",
} as const satisfies Catalog;
