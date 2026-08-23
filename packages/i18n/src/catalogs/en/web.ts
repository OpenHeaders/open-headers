/**
 * Web namespace — strings owned by the web tab's shell outside the
 * Workbench tree: the daemon login gate, the boot transition overlay,
 * and the insecure-context notice. The gate renders inside
 * LocaleProvider and keys through `useT`; the pre-provider surfaces
 * (the SSO-landing overlay beat, the insecure notice) resolve a
 * translator from `navigator.languages` directly. Brand ('OpenHeaders'),
 * URLs, and the `oh-license.` key prefix ride raw — prefix/suffix
 * fragments split around those islands. No `ohd` command appears here:
 * the gate never shows one to an anonymous visitor.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Sign in to this server',
  'web.gate.titleSetup': 'Set up this server',
  'web.gate.introSso': 'Sign in with {provider} to reach this OpenHeaders Server.',
  'web.gate.introPassword': 'Sign in with the email and password the server admin set for you.',
  'web.gate.introSetup':
    'Nobody has set up this OpenHeaders Server yet. Create the first account — it administers the server and owns ' +
    'everything already on it.',
  'web.gate.introNoLogin':
    'This server has no way for a browser to sign in: single sign-on is not configured, and no account on it has a ' +
    'password. Ask whoever runs the server to set you one.',
  'web.gate.ssoButton': 'Sign in with {provider}',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Password',
  'web.gate.signIn': 'Sign in',
  'web.gate.setupNamePlaceholder': 'Your name',
  'web.gate.setupConfirmPlaceholder': 'Confirm password',
  'web.gate.setupPasswordHint': 'At least {min} characters. There is no password reset — keep it somewhere safe.',
  'web.gate.setupCodePlaceholder': 'Setup code (optional)',
  'web.gate.setupCodeHint':
    'Needed only when this browser is not running on the server itself. The server prints the code as it starts, ' +
    'and a new one replaces it every time it restarts.',
  'web.gate.setupSubmit': 'Create the account',
  'web.gate.setupDoneTitle': 'This server is set up',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        '{count} paired device was unpaired by the setup, so it cannot keep administering this server around ' +
        'your new account. Pair it again from Settings.',
      other:
        '{count} paired devices were unpaired by the setup, so they cannot keep administering this server ' +
        'around your new account. Pair them again from Settings.',
    }),
  'web.gate.setupDoneContinue': 'Continue',
  'web.gate.setupDoneReload': 'Reload',
  'web.gate.setupErrorDisplayName': 'Enter the name to put on the account.',
  'web.gate.setupErrorEmail': 'Enter the email to sign in with.',
  'web.gate.setupErrorPasswordShort': 'Use at least {min} characters.',
  'web.gate.setupErrorPasswordMismatch': 'The two passwords do not match.',
  'web.gate.setupErrorMalformed': 'The server could not read the form. Reload the page and try again.',
  'web.gate.setupErrorRefused':
    'The server refused the setup. It may already be set up, or the setup code may be wrong or left over from an ' +
    'earlier start — the server prints a new one every time it restarts.',
  'web.gate.setupErrorSessionRefused':
    'The account was created, but this tab could not open a session. Reload the page and sign in with it.',
  'web.gate.clientsIntro':
    'This tab is not the only client. The extension and the desktop app reach this server directly at',
  'web.gate.clientsExtension': 'Get the extension',
  'web.gate.clientsDesktop': 'Get the desktop app',
  'web.gate.errorServerOffline': 'The server did not answer. Check that it is running and try again.',
  'web.gate.errorPasswordRefused': 'Sign-in failed. Check the email and password and try again.',
  'web.gate.errorSessionRefused': 'The server did not accept the session. Try again.',
  'web.gate.seatIntroPrefix':
    'Have an individual seat? Paste its key to sign in without waiting on a free team seat — it admits the email it ' +
    'was purchased with. Get one at',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Individual seat key (oh-license.…)',
  'web.gate.seatSignIn': 'Sign in with individual seat',
  'web.overlay.signingIn': 'Signing you in…',
  'web.overlay.takingYouTo': 'Taking you to {provider}…',
  'web.oidcError.unknownUser':
    'Signed in, but this server has no user for your email. Ask the server admin to add you.',
  'web.oidcError.userDeactivated': 'Signed in, but your user on this server is deactivated. Ask the server admin.',
  'web.oidcError.emailUnverified': 'Your identity provider reports the email as unverified. Verify it and try again.',
  'web.oidcError.providerUnavailable': 'The identity provider could not be reached. Try again in a moment.',
  'web.oidcError.seatLimitReached':
    'Signed in, but this server has no free seats for a new user. Ask the server admin — or get in now with your own ' +
    'individual seat.',
  'web.oidcError.personalSeatsDisabled':
    'Individual seats are disabled on this server. Ask the server admin about a seat.',
  'web.oidcError.personalLicenseInvalid':
    'That individual seat key is not usable — it is invalid, expired, or not an individual seat. Check the key and ' +
    'try again.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'That individual seat belongs to a different email. It only admits the address it was purchased with.',
  'web.oidcError.personalLicenseNoIdentity':
    'Your sign-in carried no email to match the individual seat against. Ask the server admin.',
  'web.oidcError.failed': 'Single sign-on failed. Try again, or ask whoever runs the server to check the provider.',
  'web.insecure.title': 'This page needs a secure connection',
  'web.insecure.intro':
    'This tab runs the whole Workbench, not a thin view of the server, so it has to create an identity for this ' +
    'device — and browsers only allow that on a secure origin.',
  'web.insecure.optionLocal': 'On the server itself:',
  'web.insecure.optionTls': 'From here over HTTPS — put a TLS-terminating reverse proxy in front.',
  'web.insecure.optionClients': 'From here without TLS — the extension and the desktop app connect straight to',
} as const satisfies Catalog;
