import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from '@openheaders/i18n';
import { describe, expect, it } from 'vitest';
import { buildLocaleMessages, localeDirectory, MANIFEST_DESCRIPTION_LIMIT } from '@/bundling/locale-messages';

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/_locales');

describe('locale messages', () => {
  const messages = buildLocaleMessages();

  it('emits one directory per real locale, Chrome-spelled', () => {
    const expected = LOCALES.filter((locale) => !locale.synthetic).map((locale) => localeDirectory(locale.code));
    expect([...messages.keys()]).toEqual(expected);
    expect(messages.has('en')).toBe(true);
    expect(messages.has('zh_CN')).toBe(true);
    expect(messages.has('zh-CN')).toBe(false);
    expect(messages.has('pseudo')).toBe(false);
  });

  it('keeps the brand raw and every description within the store limit', () => {
    for (const [dir, locale] of messages) {
      expect(locale.extName.message, dir).toBe('Open Headers');
      expect(locale.extDesc.message.length, dir).toBeLessThanOrEqual(MANIFEST_DESCRIPTION_LIMIT);
      expect(locale.extActionDesc.message, dir).toContain('Open Headers');
    }
  });

  it('translates the description and the action description per locale', () => {
    const english = messages.get('en');
    expect(english?.extDesc.message).toMatch(/^Open Source DevToolkit/);
    expect(english?.extActionDesc.message).toBe('Open Open Headers popup');
    for (const dir of ['de', 'es', 'fr', 'ja', 'ko', 'ro', 'ru', 'zh_CN']) {
      expect(messages.get(dir)?.extDesc.message, dir).not.toBe(english?.extDesc.message);
      expect(messages.get(dir)?.extActionDesc.message, dir).not.toBe(english?.extActionDesc.message);
    }
  });

  // The committed `public/_locales` files are what Vite copies into every
  // browser's dist. A catalog edit under `extension.manifest.*` without a
  // `pnpm run locales` in the same commit fails here.
  it('matches the committed public/_locales files', () => {
    expect(fs.readdirSync(localesDir).sort()).toEqual([...messages.keys()].sort());
    for (const [dir, locale] of messages) {
      const committed = fs.readFileSync(path.resolve(localesDir, dir, 'messages.json'), 'utf8');
      expect(committed, dir).toBe(`${JSON.stringify(locale, null, 2)}\n`);
    }
  });
});
