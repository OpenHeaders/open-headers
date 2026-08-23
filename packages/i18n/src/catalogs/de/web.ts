/**
 * Web namespace — German. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, `daemon` (der Daemon, m.), the
 * `ohd show-token` command, URLs and the `oh-license.` key prefix stay
 * raw. Mints: seat = Platz (m.), individual seat = Einzelplatz (m.);
 * email = E-Mail-Adresse (f., `E-Mail` on placeholders); pairing token
 * = Kopplungstoken (m.); reverse proxy = Reverse-Proxy raw (m.);
 * Workbench = die Workbench (f.).
 */

import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Bei diesem Server anmelden',
  'web.gate.titlePair': 'Mit diesem Server koppeln',
  'web.gate.introSso': 'Melde dich mit {provider} an oder füge unten einen Kopplungstoken ein.',
  'web.gate.introPassword':
    'Melde dich mit der E-Mail-Adresse und dem Passwort an, die der Server-Admin für dich festgelegt hat, oder ' +
    'füge unten einen Kopplungstoken ein.',
  'web.gate.introTokenPrefix':
    'Dieser Server von OpenHeaders verlangt einen Kopplungstoken. Erzeuge einen auf der Maschine, auf der er läuft, mit',
  'web.gate.introTokenSuffix': 'und füge ihn unten ein.',
  'web.gate.ssoButton': 'Mit {provider} anmelden',
  'web.gate.or': 'oder',
  'web.gate.emailPlaceholder': 'E-Mail',
  'web.gate.passwordPlaceholder': 'Passwort',
  'web.gate.signIn': 'Anmelden',
  'web.gate.tokenPlaceholder': 'Kopplungstoken',
  'web.gate.connect': 'Verbinden',
  'web.gate.workLocally': 'Überspringen — lokal arbeiten',
  'web.gate.errorTokenRejected': 'Der Server hat diesen Token abgelehnt. Prüfe ihn und versuche es erneut.',
  'web.gate.errorTokenOffline': 'Der Server hat nicht geantwortet. Prüfe, ob er läuft, und versuche es erneut.',
  'web.gate.errorPasswordRefused':
    'Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort und versuche es erneut.',
  'web.gate.errorSessionRefused': 'Der Server hat die Sitzung nicht akzeptiert. Versuche es erneut.',
  'web.gate.seatIntroPrefix':
    'Du hast einen Einzelplatz? Füge seinen Schlüssel ein, um dich anzumelden, ohne auf einen freien Team-Platz ' +
    'zu warten — er lässt die E-Mail-Adresse zu, mit der er gekauft wurde. Hol dir einen unter',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Einzelplatz-Schlüssel (oh-license.…)',
  'web.gate.seatSignIn': 'Mit Einzelplatz anmelden',
  'web.overlay.signingIn': 'Du wirst angemeldet…',
  'web.overlay.takingYouTo': 'Weiter zu {provider}…',
  'web.oidcError.unknownUser':
    'Angemeldet, aber dieser Server hat keinen Benutzer für deine E-Mail-Adresse. Bitte den Server-Admin, dich ' +
    'hinzuzufügen.',
  'web.oidcError.userDeactivated':
    'Angemeldet, aber dein Benutzer auf diesem Server ist deaktiviert. Wende dich an den Server-Admin.',
  'web.oidcError.emailUnverified':
    'Dein Identitätsanbieter meldet die E-Mail-Adresse als unbestätigt. Bestätige sie und versuche es erneut.',
  'web.oidcError.providerUnavailable': 'Der Identitätsanbieter war nicht erreichbar. Versuche es gleich noch einmal.',
  'web.oidcError.seatLimitReached':
    'Angemeldet, aber dieser Server hat keine freien Plätze für einen neuen Benutzer. Wende dich an den ' +
    'Server-Admin — oder komm jetzt mit deinem eigenen Einzelplatz hinein.',
  'web.oidcError.personalSeatsDisabled':
    'Einzelplätze sind auf diesem Server deaktiviert. Frag den Server-Admin nach einem Platz.',
  'web.oidcError.personalLicenseInvalid':
    'Dieser Einzelplatz-Schlüssel ist nicht nutzbar — er ist ungültig, abgelaufen oder kein Einzelplatz. Prüfe ' +
    'den Schlüssel und versuche es erneut.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'Dieser Einzelplatz gehört zu einer anderen E-Mail-Adresse. Er lässt nur die Adresse zu, mit der er gekauft wurde.',
  'web.oidcError.personalLicenseNoIdentity':
    'Deine Anmeldung enthielt keine E-Mail-Adresse, die mit dem Einzelplatz abgeglichen werden konnte. Wende ' +
    'dich an den Server-Admin.',
  'web.oidcError.failed':
    'Single Sign-on fehlgeschlagen. Versuche es erneut oder verbinde dich stattdessen mit einem Kopplungstoken.',
  'web.insecure.title': 'Diese Seite braucht eine sichere Verbindung',
  'web.insecure.intro':
    'Dieser Tab führt die gesamte Workbench aus, keine dünne Sicht auf den Server, und muss daher eine Identität ' +
    'für dieses Gerät erzeugen — was Browser nur auf einem sicheren Origin erlauben.',
  'web.insecure.optionLocal': 'Auf dem Server selbst:',
  'web.insecure.optionTls': 'Von hier über HTTPS — stelle einen TLS-terminierenden Reverse-Proxy davor.',
  'web.insecure.optionClients': 'Von hier ohne TLS — die Erweiterung und die Desktop-App verbinden sich direkt mit',
} as const satisfies Catalog;
