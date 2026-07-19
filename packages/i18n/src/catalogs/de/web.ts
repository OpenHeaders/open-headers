/**
 * Web namespace — German. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, `daemon` (der Daemon, m.), the
 * `ohd show-token` command, URLs and the `oh-license.` key prefix stay
 * raw. Mints: seat = Platz (m.), individual seat = Einzelplatz (m.);
 * email = E-Mail-Adresse (f., `E-Mail` on placeholders); pairing token
 * = Kopplungstoken (m.); reverse proxy = Reverse-Proxy raw (m.);
 * Workbench = die Workbench (f.); quoted README section titles stay
 * raw English inside „…“.
 */

import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Bei diesem Daemon anmelden',
  'web.gate.titlePair': 'Mit diesem Daemon koppeln',
  'web.gate.introSso': 'Melde dich mit {provider} an oder füge unten einen Kopplungstoken ein.',
  'web.gate.introPassword':
    'Melde dich mit der E-Mail-Adresse und dem Passwort an, die der Daemon-Admin für dich festgelegt hat, oder ' +
    'füge unten einen Kopplungstoken ein.',
  'web.gate.introTokenPrefix':
    'Dieser OpenHeaders-Daemon verlangt einen Kopplungstoken. Erzeuge einen auf der Maschine, auf der er läuft, mit',
  'web.gate.introTokenSuffix': 'und füge ihn unten ein.',
  'web.gate.ssoButton': 'Mit {provider} anmelden',
  'web.gate.or': 'oder',
  'web.gate.emailPlaceholder': 'E-Mail',
  'web.gate.passwordPlaceholder': 'Passwort',
  'web.gate.signIn': 'Anmelden',
  'web.gate.tokenPlaceholder': 'Kopplungstoken',
  'web.gate.connect': 'Verbinden',
  'web.gate.workLocally': 'Überspringen — lokal arbeiten',
  'web.gate.errorTokenRejected': 'Der Daemon hat diesen Token abgelehnt. Prüfe ihn und versuche es erneut.',
  'web.gate.errorTokenOffline': 'Der Daemon hat nicht geantwortet. Prüfe, ob er läuft, und versuche es erneut.',
  'web.gate.errorPasswordRefused':
    'Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort und versuche es erneut.',
  'web.gate.errorSessionRefused': 'Der Daemon hat die Sitzung nicht akzeptiert. Versuche es erneut.',
  'web.gate.seatIntroPrefix':
    'Du hast einen Einzelplatz? Füge seinen Schlüssel ein, um dich anzumelden, ohne auf einen freien Team-Platz ' +
    'zu warten — er lässt die E-Mail-Adresse zu, mit der er gekauft wurde. Hol dir einen unter',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Einzelplatz-Schlüssel (oh-license.…)',
  'web.gate.seatSignIn': 'Mit Einzelplatz anmelden',
  'web.overlay.signingIn': 'Du wirst angemeldet…',
  'web.overlay.takingYouTo': 'Weiter zu {provider}…',
  'web.oidcError.unknownUser':
    'Angemeldet, aber dieser Daemon hat keinen Benutzer für deine E-Mail-Adresse. Bitte den Daemon-Admin, dich ' +
    'hinzuzufügen.',
  'web.oidcError.userDeactivated':
    'Angemeldet, aber dein Benutzer auf diesem Daemon ist deaktiviert. Wende dich an den Daemon-Admin.',
  'web.oidcError.emailUnverified':
    'Dein Identitätsanbieter meldet die E-Mail-Adresse als unbestätigt. Bestätige sie und versuche es erneut.',
  'web.oidcError.providerUnavailable': 'Der Identitätsanbieter war nicht erreichbar. Versuche es gleich noch einmal.',
  'web.oidcError.seatLimitReached':
    'Angemeldet, aber dieser Daemon hat keine freien Plätze für einen neuen Benutzer. Wende dich an den ' +
    'Daemon-Admin — oder komm jetzt mit deinem eigenen Einzelplatz hinein.',
  'web.oidcError.personalSeatsDisabled':
    'Einzelplätze sind auf diesem Daemon deaktiviert. Frag den Daemon-Admin nach einem Platz.',
  'web.oidcError.personalLicenseInvalid':
    'Dieser Einzelplatz-Schlüssel ist nicht nutzbar — er ist ungültig, abgelaufen oder kein Einzelplatz. Prüfe ' +
    'den Schlüssel und versuche es erneut.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'Dieser Einzelplatz gehört zu einer anderen E-Mail-Adresse. Er lässt nur die Adresse zu, mit der er gekauft wurde.',
  'web.oidcError.personalLicenseNoIdentity':
    'Deine Anmeldung enthielt keine E-Mail-Adresse, die mit dem Einzelplatz abgeglichen werden konnte. Wende ' +
    'dich an den Daemon-Admin.',
  'web.oidcError.failed':
    'Single Sign-on fehlgeschlagen. Versuche es erneut oder verbinde dich stattdessen mit einem Kopplungstoken.',
  'web.insecure.title': 'Diese Seite braucht eine sichere Verbindung',
  'web.insecure.intro':
    'Die OpenHeaders-Workbench hält alle ihre Daten in diesem Browser-Profil und braucht die Kryptografie-APIs ' +
    'des Browsers, die nur auf sicheren Origins verfügbar sind.',
  'web.insecure.waysIn': 'Öffne sie stattdessen auf einem dieser Wege:',
  'web.insecure.httpsPrefix':
    'Über HTTPS — stelle den Daemon hinter einen TLS-Reverse-Proxy (siehe „Behind a reverse proxy“ im README ' +
    'des Daemons) und öffne',
  'web.insecure.httpsSuffix': '.',
  'web.insecure.loopbackPrefix': 'Auf der Maschine des Daemons selbst unter',
  'web.insecure.loopbackSuffix': '.',
} as const satisfies Catalog;
