/**
 * The settings shell's opening page. A deep link wins — the setting's
 * own category over an explicit category id — and an untargeted open
 * lands on the page the shell last showed; before any page was shown
 * it lands nowhere and the shell falls back to the first leaf.
 */

import {
  __resetLastSettingsCategoryForTests,
  initialSettingsCategory,
  recallSettingsCategory,
  rememberSettingsCategory,
} from '@openheaders/ui/workbench/settings/last-category';
import { beforeEach, describe, expect, it } from 'vitest';

const categoryOf = (key: string): string | undefined => (key === 'git.fetchCadence' ? 'gitAutomation' : undefined);

beforeEach(() => {
  __resetLastSettingsCategoryForTests();
});

describe('initialSettingsCategory', () => {
  it('lands nowhere on a fresh session without a target', () => {
    expect(recallSettingsCategory()).toBeNull();
    expect(initialSettingsCategory({}, categoryOf)).toBeNull();
  });

  it('reopens on the page the shell last showed', () => {
    rememberSettingsCategory('gitLog');
    expect(initialSettingsCategory({}, categoryOf)).toBe('gitLog');
  });

  it('remembers the latest page, not the first', () => {
    rememberSettingsCategory('appearance');
    rememberSettingsCategory('gitLog');
    expect(recallSettingsCategory()).toBe('gitLog');
  });

  it('lets an explicit category win over the memory', () => {
    rememberSettingsCategory('gitLog');
    expect(initialSettingsCategory({ categoryId: 'updates' }, categoryOf)).toBe('updates');
  });

  it("lets a setting's own category win over an explicit category and the memory", () => {
    rememberSettingsCategory('gitLog');
    expect(initialSettingsCategory({ settingKey: 'git.fetchCadence', categoryId: 'updates' }, categoryOf)).toBe(
      'gitAutomation',
    );
  });

  it('falls past an unknown setting key to the explicit category, then the memory', () => {
    expect(initialSettingsCategory({ settingKey: 'nope.missing', categoryId: 'updates' }, categoryOf)).toBe('updates');
    rememberSettingsCategory('gitLog');
    expect(initialSettingsCategory({ settingKey: 'nope.missing' }, categoryOf)).toBe('gitLog');
  });
});
