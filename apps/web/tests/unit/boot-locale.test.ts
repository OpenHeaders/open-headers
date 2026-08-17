/**
 * Pre-provider locale resolution — the translator the SSO-landing
 * overlay and the insecure-context notice use before SettingsProvider
 * mounts. Resolves `auto` from `navigator.languages`; byte-asserts the
 * shell strings those surfaces render through it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootTranslator } from '@/boot-locale';

describe('bootTranslator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves English from a matching browser preference list', () => {
    vi.stubGlobal('navigator', { languages: ['en-GB', 'en'] });
    expect(bootTranslator().locale).toBe('en');
  });

  it('falls back to the default locale when no preference matches', () => {
    vi.stubGlobal('navigator', { languages: ['xx-XX'] });
    expect(bootTranslator().locale).toBe('en');
  });

  it('never auto-resolves the synthetic pseudo locale', () => {
    vi.stubGlobal('navigator', { languages: ['pseudo'] });
    expect(bootTranslator().locale).toBe('en');
  });

  it('renders the boot-beat shell strings byte-exact in English', () => {
    vi.stubGlobal('navigator', { languages: ['en-US'] });
    const t = bootTranslator();
    expect(t('web.overlay.signingIn')).toBe('Signing you in…');
    expect(t('web.overlay.takingYouTo', { provider: 'ACME SSO' })).toBe('Taking you to ACME SSO…');
    expect(t('web.insecure.title')).toBe('This page needs a secure connection');
    expect(t('web.insecure.intro')).toBe(
      "The OpenHeaders Workbench keeps all of its data in this browser profile and needs the browser's cryptography APIs, which are only available on secure origins.",
    );
    expect(t('web.insecure.waysIn')).toBe('Open it one of these ways instead:');
    expect(t('web.insecure.httpsPrefix')).toBe(
      "Over HTTPS — put the server behind a TLS reverse proxy (see “Behind a reverse proxy” in the server's README) and open",
    );
    expect(t('web.insecure.loopbackPrefix')).toBe("On the server's own machine at");
  });

  it('renders gate copy byte-exact, recomposed around the raw islands', () => {
    vi.stubGlobal('navigator', { languages: ['en'] });
    const t = bootTranslator();
    expect(t('web.gate.titleSignIn')).toBe('Sign in to this server');
    expect(t('web.gate.titlePair')).toBe('Pair with this server');
    expect(t('web.gate.introSso', { provider: 'ACME SSO' })).toBe(
      'Sign in with ACME SSO, or paste a pairing token below.',
    );
    expect(`${t('web.gate.introTokenPrefix')} ohd show-token ${t('web.gate.introTokenSuffix')}`).toBe(
      'This OpenHeaders Server requires a pairing token. Mint one on the machine running it with ohd show-token and paste it below.',
    );
    expect(`${t('web.gate.seatIntroPrefix')} openheaders.io/pricing${t('web.gate.seatIntroSuffix')}`).toBe(
      'Have an individual seat? Paste its key to sign in without waiting on a free team seat — it admits the email it was purchased with. Get one at openheaders.io/pricing.',
    );
    expect(t('web.gate.workLocally')).toBe('Skip — work locally');
    expect(t('web.gate.errorTokenRejected')).toBe('The server rejected this token. Check it and try again.');
    expect(t('web.gate.errorTokenOffline')).toBe('The server did not answer. Check that it is running and try again.');
    expect(t('web.gate.errorPasswordRefused')).toBe('Sign-in failed. Check the email and password and try again.');
    expect(t('web.gate.errorSessionRefused')).toBe('The server did not accept the session. Try again.');
  });
});
