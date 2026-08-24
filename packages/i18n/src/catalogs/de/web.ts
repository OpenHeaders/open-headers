/**
 * Web namespace — German. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, URLs and the `oh-license.` key prefix stay
 * raw. Mints: seat = Platz (m.), individual seat = Einzelplatz (m.);
 * email = E-Mail-Adresse (f., `E-Mail` on placeholders); pairing =
 * Kopplung (f.); setup code = Einrichtungscode (m.); reverse proxy =
 * Reverse-Proxy raw (m.); Workbench = die Workbench (f.).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Bei diesem Server anmelden',
  'web.gate.titleSetup': 'Diesen Server einrichten',
  'web.gate.introSso': 'Melde dich mit {provider} an, um zu diesem Server von OpenHeaders zu gelangen.',
  'web.gate.introPassword':
    'Melde dich mit der E-Mail-Adresse und dem Passwort an, die der Server-Admin für dich festgelegt hat.',
  'web.gate.introSetup':
    'Dieser Server von OpenHeaders wurde noch nicht eingerichtet. Lege das erste Konto an — es verwaltet den ' +
    'Server und besitzt alles, was schon darauf liegt.',
  'web.gate.introNoLogin':
    'Auf diesem Server kann sich kein Browser anmelden: Single Sign-on ist nicht eingerichtet, und kein Konto ' +
    'darauf hat ein Passwort. Bitte die Person, die den Server betreibt, dir eines zu setzen.',
  'web.gate.ssoButton': 'Mit {provider} anmelden',
  'web.gate.emailPlaceholder': 'E-Mail',
  'web.gate.passwordPlaceholder': 'Passwort',
  'web.gate.signIn': 'Anmelden',
  'web.gate.setupNamePlaceholder': 'Dein Name',
  'web.gate.setupConfirmPlaceholder': 'Passwort bestätigen',
  'web.gate.setupPasswordHint':
    'Mindestens {min} Zeichen. Es gibt kein Zurücksetzen des Passworts — bewahre es sicher auf.',
  'web.gate.setupCodePlaceholder': 'Einrichtungscode (optional)',
  'web.gate.setupCodeHint':
    'Nur nötig, wenn dieser Browser nicht auf dem Server selbst läuft. Der Server gibt den Code beim Start aus, ' +
    'und bei jedem Neustart ersetzt ihn ein neuer.',
  'web.gate.setupSubmit': 'Konto anlegen',
  'web.gate.setupDoneTitle': 'Dieser Server ist eingerichtet',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        'Bei der Einrichtung wurde {count} gekoppeltes Gerät entkoppelt, damit es den Server nicht an deinem ' +
        'neuen Konto vorbei weiterverwalten kann. Kopple es in den Einstellungen erneut.',
      other:
        'Bei der Einrichtung wurden {count} gekoppelte Geräte entkoppelt, damit sie den Server nicht an deinem ' +
        'neuen Konto vorbei weiterverwalten können. Kopple sie in den Einstellungen erneut.',
    }),
  'web.gate.setupDoneContinue': 'Weiter',
  'web.gate.setupDoneReload': 'Neu laden',
  'web.gate.setupErrorDisplayName': 'Gib den Namen für das Konto ein.',
  'web.gate.setupErrorEmail': 'Gib die E-Mail-Adresse für die Anmeldung ein.',
  'web.gate.setupErrorPasswordShort': 'Verwende mindestens {min} Zeichen.',
  'web.gate.setupErrorPasswordMismatch': 'Die beiden Passwörter stimmen nicht überein.',
  'web.gate.setupErrorMalformed':
    'Der Server konnte das Formular nicht lesen. Lade die Seite neu und versuche es erneut.',
  'web.gate.setupErrorRefused':
    'Der Server hat die Einrichtung abgelehnt. Vielleicht ist er schon eingerichtet, oder der Einrichtungscode ' +
    'ist falsch oder stammt von einem früheren Start — bei jedem Neustart gibt der Server einen neuen aus.',
  'web.gate.setupErrorSessionRefused':
    'Das Konto wurde angelegt, aber dieser Tab konnte keine Sitzung öffnen. Lade die Seite neu und melde dich damit an.',
  'web.gate.clientsIntro':
    'Dieser Tab ist nicht der einzige Client. Die Erweiterung und die Desktop-App erreichen diesen Server direkt unter',
  'web.gate.clientsExtension': 'Erweiterung holen',
  'web.gate.clientsDesktop': 'Desktop-App holen',
  'web.gate.errorServerOffline': 'Der Server hat nicht geantwortet. Prüfe, ob er läuft, und versuche es erneut.',
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
    'Single Sign-on fehlgeschlagen. Versuche es erneut oder bitte die Person, die den Server betreibt, den ' +
    'Anbieter zu prüfen.',
  'web.access.title': 'Noch kein Workspace zugewiesen',
  'web.access.intro':
    'Du bist bei {org} angemeldet, aber dir wurde dort noch kein Workspace zugewiesen. Ein Administrator muss ' +
    'dir Zugriff auf einen Workspace geben.',
  'web.access.introNoOrg':
    'Du bist bei diesem Server angemeldet, aber dir wurde dort noch kein Workspace zugewiesen. Ein Administrator ' +
    'muss dir Zugriff auf einen Workspace geben.',
  'web.access.signedInAs': 'Angemeldet als {name}',
  'web.access.signedInAsWithEmail': 'Angemeldet als {name} ({email})',
  'web.access.waiting': 'Diese Ansicht aktualisiert sich, sobald der Zugriff erteilt wird — kein Neuladen nötig.',
  'web.access.signOut': 'Abmelden',
  'web.insecure.title': 'Diese Seite braucht eine sichere Verbindung',
  'web.insecure.intro':
    'Dieser Tab führt die gesamte Workbench aus, keine dünne Sicht auf den Server, und muss daher eine Identität ' +
    'für dieses Gerät erzeugen — was Browser nur auf einem sicheren Origin erlauben.',
  'web.insecure.optionLocal': 'Auf dem Server selbst:',
  'web.insecure.optionTls': 'Von hier über HTTPS — stelle einen TLS-terminierenden Reverse-Proxy davor.',
  'web.insecure.optionClients': 'Von hier ohne TLS — die Erweiterung und die Desktop-App verbinden sich direkt mit',
} as const satisfies Catalog;
