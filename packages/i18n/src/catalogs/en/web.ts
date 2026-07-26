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
  'web.gate.titleSignIn': 'Sign in to this Team Server',
  'web.gate.titlePair': 'Pair with this Team Server',
  'web.gate.introSso': 'Sign in with {provider}, or paste a pairing token below.',
  'web.gate.introPassword':
    'Sign in with the email and password the Team Server admin set for you, or paste a pairing token below.',
  'web.gate.introTokenPrefix':
    'This OpenHeaders Team Server requires a pairing token. Mint one on the machine running it with',
  'web.gate.introTokenSuffix': 'and paste it below.',
  'web.gate.ssoButton': 'Sign in with {provider}',
  'web.gate.or': 'or',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Password',
  'web.gate.signIn': 'Sign in',
  'web.gate.tokenPlaceholder': 'Pairing token',
  'web.gate.connect': 'Connect',
  'web.gate.workLocally': 'Skip — work locally',
  'web.gate.errorTokenRejected': 'The Team Server rejected this token. Check it and try again.',
  'web.gate.errorTokenOffline': 'The Team Server did not answer. Check that it is running and try again.',
  'web.gate.errorPasswordRefused': 'Sign-in failed. Check the email and password and try again.',
  'web.gate.errorSessionRefused': 'The Team Server did not accept the session. Try again.',
  'web.gate.seatIntroPrefix':
    'Have an individual seat? Paste its key to sign in without waiting on a free team seat — it admits the email it ' +
    'was purchased with. Get one at',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Individual seat key (oh-license.…)',
  'web.gate.seatSignIn': 'Sign in with individual seat',
  'web.overlay.signingIn': 'Signing you in…',
  'web.overlay.takingYouTo': 'Taking you to {provider}…',
  'web.oidcError.unknownUser':
    'Signed in, but this Team Server has no user for your email. Ask the Team Server admin to add you.',
  'web.oidcError.userDeactivated':
    'Signed in, but your user on this Team Server is deactivated. Ask the Team Server admin.',
  'web.oidcError.emailUnverified': 'Your identity provider reports the email as unverified. Verify it and try again.',
  'web.oidcError.providerUnavailable': 'The identity provider could not be reached. Try again in a moment.',
  'web.oidcError.seatLimitReached':
    'Signed in, but this Team Server has no free seats for a new user. Ask the Team Server admin — or get in now with your own ' +
    'individual seat.',
  'web.oidcError.personalSeatsDisabled':
    'Individual seats are disabled on this Team Server. Ask the Team Server admin about a seat.',
  'web.oidcError.personalLicenseInvalid':
    'That individual seat key is not usable — it is invalid, expired, or not an individual seat. Check the key and ' +
    'try again.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'That individual seat belongs to a different email. It only admits the address it was purchased with.',
  'web.oidcError.personalLicenseNoIdentity':
    'Your sign-in carried no email to match the individual seat against. Ask the Team Server admin.',
  'web.oidcError.failed': 'Single sign-on failed. Try again, or connect with a pairing token instead.',
  'web.insecure.title': 'This page needs a secure connection',
  'web.insecure.intro':
    "The OpenHeaders Workbench keeps all of its data in this browser profile and needs the browser's cryptography " +
    'APIs, which are only available on secure origins.',
  'web.insecure.waysIn': 'Open it one of these ways instead:',
  'web.insecure.httpsPrefix':
    "Over HTTPS — put the Team Server behind a TLS reverse proxy (see “Behind a reverse proxy” in the Team Server's README) " +
    'and open',
  'web.insecure.httpsSuffix': '.',
  'web.insecure.loopbackPrefix': "On the Team Server's own machine at",
  'web.insecure.loopbackSuffix': '.',
} as const satisfies Catalog;
