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
    // The cause is the tab's own identity mint, not where data lives —
    // this page is the one place a reader learns that, so the wording
    // is pinned.
    expect(t('web.insecure.intro')).toBe(
      'This tab runs the whole Workbench, not a thin view of the server, so it has to create an identity for this device — and browsers only allow that on a secure origin.',
    );
    expect(t('web.insecure.optionLocal')).toBe('On the server itself:');
    expect(t('web.insecure.optionTls')).toBe(
      'From here over HTTPS — put a TLS-terminating reverse proxy in front.',
    );
    expect(t('web.insecure.optionClients')).toBe(
      'From here without TLS — the extension and the desktop app connect straight to',
    );
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
    expect(`${t('web.gate.clientsIntro')} ws://openheaders.io:8137`).toBe(
      'This tab is not the only client. With the same pairing token, the extension and the desktop app connect straight to ws://openheaders.io:8137',
    );
    expect(t('web.gate.clientsExtension')).toBe('Get the extension');
    expect(t('web.gate.clientsDesktop')).toBe('Get the desktop app');
    expect(t('web.gate.errorTokenRejected')).toBe('The server rejected this token. Check it and try again.');
    expect(t('web.gate.errorTokenOffline')).toBe('The server did not answer. Check that it is running and try again.');
    expect(t('web.gate.errorPasswordRefused')).toBe('Sign-in failed. Check the email and password and try again.');
    expect(t('web.gate.errorSessionRefused')).toBe('The server did not accept the session. Try again.');
  });
});
