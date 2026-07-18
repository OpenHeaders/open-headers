/**
 * TUI translation surface — locale resolution from the environment and
 * the typed translator over the shared tui.* catalog.
 */

import { describe, expect, it } from 'vitest';
import { createTuiTranslator, resolveTuiLocale } from '../../../src/tui/i18n';

describe('tui i18n', () => {
  it('resolves the message locale LC_ALL → LC_MESSAGES → LANG, empty falls through', () => {
    expect(resolveTuiLocale({ LC_ALL: 'fr_FR.UTF-8', LANG: 'en_US.UTF-8' })).toBe('fr');
    expect(resolveTuiLocale({ LC_ALL: '', LC_MESSAGES: 'es_ES.UTF-8' })).toBe('es');
    expect(resolveTuiLocale({ LANG: 'en_US.UTF-8' })).toBe('en');
    expect(resolveTuiLocale({})).toBe('en');
  });

  it('serves tui.* keys with interpolation', () => {
    const t = createTuiTranslator({ LANG: 'en_US.UTF-8' });
    expect(t.locale).toBe('en');
    expect(t('tui.pane.rules')).toBe('Rules');
    expect(t('tui.header.synced', { ago: '4s' })).toBe('synced 4s ago');
  });

  it('renders English for locales without a tui catalog yet', () => {
    const t = createTuiTranslator({ LC_ALL: 'de_DE.UTF-8' });
    expect(t('tui.footer.quit')).toBe('quit');
  });
});
