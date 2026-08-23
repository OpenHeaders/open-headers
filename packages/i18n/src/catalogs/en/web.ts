/**
 * Web namespace — strings owned by the web tab's shell outside the
 * Workbench tree: the daemon login gate, the boot transition overlay,
 * and the insecure-context notice. The gate renders inside
 * LocaleProvider and keys through `useT`; the pre-provider surfaces
 * (the SSO-landing overlay beat, the insecure notice) resolve a
 * translator from `navigator.languages` directly. Brand ('OpenHeaders'),
 * the `ohd show-token` command, URLs, and the `oh-license.` key prefix
 * ride raw — prefix/suffix fragments split around those islands.
 */

import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Sign in to this server',
  'web.gate.titlePair': 'Pair with this server',
  'web.gate.introSso': 'Sign in with {provider}, or paste a pairing token below.',
  'web.gate.introPassword':
    'Sign in with the email and password the server admin set for you, or paste a pairing token below.',
  'web.gate.introTokenPrefix':
    'This OpenHeaders Server requires a pairing token. Mint one on the machine running it with',
  'web.gate.introTokenSuffix': 'and paste it below.',
  'web.gate.ssoButton': 'Sign in with {provider}',
  'web.gate.or': 'or',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Password',
  'web.gate.signIn': 'Sign in',
  'web.gate.tokenPlaceholder': 'Pairing token',
  'web.gate.connect': 'Connect',
  'web.gate.workLocally': 'Skip — work locally',
  'web.gate.errorTokenRejected': 'The server rejected this token. Check it and try again.',
  'web.gate.errorTokenOffline': 'The server did not answer. Check that it is running and try again.',
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
  'web.oidcError.failed': 'Single sign-on failed. Try again, or connect with a pairing token instead.',
  'web.insecure.title': 'This page needs a secure connection',
  'web.insecure.intro':
    'This tab runs the whole Workbench, not a thin view of the server, so it has to create an identity for this ' +
    'device — and browsers only allow that on a secure origin.',
  'web.insecure.optionLocal': 'On the server itself:',
  'web.insecure.optionTls': 'From here over HTTPS — put a TLS-terminating reverse proxy in front.',
  'web.insecure.optionClients': 'From here without TLS — the extension and the desktop app connect straight to',
} as const satisfies Catalog;
