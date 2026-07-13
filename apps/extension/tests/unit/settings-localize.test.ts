/**
 * Resolver layer for localizable settings-registry text (Phase C
 * registry idiom): entries carry either raw English strings or
 * `workbench.settings.*` MessageKeys; the localize helpers fold the
 * pair into plain strings for rendering and search.
 */

import { getTranslator } from '@openheaders/i18n';
import {
  capabilityUnavailableHint,
  categoryNavLabel,
  resolveLabel,
  resolveOptionalDescription,
  resolveSettingDef,
  translateEnglish,
} from '@openheaders/ui/workbench/settings/localize';
import type { CategoryDef, SettingDef, SubcategoryDef } from '@openheaders/ui/workbench/settings/types';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'general.testLocalize': string;
  }
}

function keyedDef(): SettingDef<'general.testLocalize'> {
  return {
    key: 'general.testLocalize',
    type: 'enum',
    default: 'auto',
    schema: v.string(),
    labelKey: 'workbench.settings.def.general.language.label',
    descriptionKey: 'workbench.settings.def.general.language.description',
    category: 'general',
    scope: 'user',
    enumOptions: [
      {
        value: 'auto',
        labelKey: 'workbench.settings.def.general.language.option.auto.label',
        descriptionKey: 'workbench.settings.def.general.language.option.auto.description',
      },
      { value: 'raw', label: 'Raw option', description: 'Raw description' },
    ],
  };
}

describe('settings localize resolvers', () => {
  it('resolves keyed label/description through the catalog', () => {
    const resolved = resolveSettingDef(keyedDef(), translateEnglish);
    expect(resolved.label).toBe('Language');
    expect(resolved.description).toContain('Display language for the interface');
  });

  it('materializes enum options, keyed and raw alike', () => {
    const resolved = resolveSettingDef(keyedDef(), translateEnglish);
    expect(resolved.enumOptions?.[0]).toEqual({
      value: 'auto',
      label: 'Follow system',
      description: 'Match your browser or operating system language',
    });
    expect(resolved.enumOptions?.[1]).toEqual({
      value: 'raw',
      label: 'Raw option',
      description: 'Raw description',
    });
  });

  it('keeps raw-string defs unchanged', () => {
    const raw: SettingDef<'general.testLocalize'> = {
      key: 'general.testLocalize',
      type: 'string',
      default: '',
      schema: v.string(),
      label: 'Plain Label',
      description: 'Plain description.',
      category: 'general',
      scope: 'user',
    };
    const resolved = resolveSettingDef(raw, translateEnglish);
    expect(resolved.label).toBe('Plain Label');
    expect(resolved.description).toBe('Plain description.');
  });

  it('renders keyed text in the active locale', () => {
    const pseudo = getTranslator('pseudo');
    const resolved = resolveSettingDef(keyedDef(), pseudo);
    expect(resolved.label).not.toBe('Language');
    expect(resolved.label).toContain('⟦');
  });

  it('categoryNavLabel prefers navLabelKey, then navLabel, then the label pair', () => {
    const base = { id: 'x', icon: null, order: 1 };
    const keyedNav: CategoryDef = {
      ...base,
      labelKey: 'workbench.settings.category.devpanelNetwork.label',
      navLabelKey: 'workbench.settings.category.devpanelNetwork.navLabel',
    };
    expect(categoryNavLabel(keyedNav, translateEnglish)).toBe('Network');
    const rawNav: CategoryDef = { ...base, label: 'Full Label', navLabel: 'Short' };
    expect(categoryNavLabel(rawNav, translateEnglish)).toBe('Short');
    const noNav: CategoryDef = { ...base, labelKey: 'workbench.settings.category.general.label' };
    expect(categoryNavLabel(noNav, translateEnglish)).toBe('General');
    expect(resolveOptionalDescription(noNav, translateEnglish)).toBeUndefined();
  });

  it('resolveLabel covers subcategories', () => {
    const sub: SubcategoryDef = { id: 's', order: 1, labelKey: 'workbench.settings.category.backend.sub.lan-peers' };
    expect(resolveLabel(sub, translateEnglish)).toBe('LAN peers');
  });

  it('capabilityUnavailableHint prefers the key over the raw hint', () => {
    expect(
      capabilityUnavailableHint(
        {
          capabilityUnavailableHint: 'Raw hint',
          capabilityUnavailableHintKey: 'workbench.settings.row.capabilityUnavailable',
        },
        translateEnglish,
      ),
    ).toBe('This browser doesn’t support this setting.');
    expect(capabilityUnavailableHint({ capabilityUnavailableHint: 'Raw hint' }, translateEnglish)).toBe('Raw hint');
    expect(capabilityUnavailableHint({}, translateEnglish)).toBeUndefined();
  });
});
