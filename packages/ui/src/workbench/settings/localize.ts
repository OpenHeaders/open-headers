/**
 * Localization resolvers for the settings registry.
 *
 * Registry entries carry their user-facing text either as raw English
 * strings (schema files not yet extracted) or as `MessageKey`s into the
 * `workbench.settings.*` catalog namespace (see `types.ts`). These
 * helpers are the single place that folds the pair into a plain string,
 * so render surfaces and the search indexer never branch on which form
 * an entry uses.
 *
 * `resolveSettingDef` materializes a whole def for the field layer:
 * SettingRow resolves once and the field components below it only see
 * definite strings (`ResolvedSettingDef`).
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type {
  ActionSpec,
  CategoryDef,
  DescribedText,
  EnumOption,
  LabeledText,
  OptionalDescribedText,
  ResolvedActionSpec,
  ResolvedEnumOption,
  ResolvedSettingDef,
  SettingDef,
  SettingKey,
} from './types';

/**
 * English resolution regardless of the active locale — the search
 * indexer scores English text alongside the rendered text so queries
 * keep matching in any locale.
 */
export const translateEnglish: Translate = getTranslator(DEFAULT_LOCALE);

/** Label of any registry entry (setting def, category, subcategory, enum option). */
export function resolveLabel(entry: LabeledText, t: Translate): string {
  return entry.labelKey !== undefined ? t(entry.labelKey) : entry.label;
}

/** Required description (setting defs). */
export function resolveDescription(entry: DescribedText, t: Translate): string {
  return entry.descriptionKey !== undefined ? t(entry.descriptionKey) : entry.description;
}

/** Optional description (categories, enum options). */
export function resolveOptionalDescription(entry: OptionalDescribedText, t: Translate): string | undefined {
  return entry.descriptionKey !== undefined ? t(entry.descriptionKey) : entry.description;
}

/** Short nav-tree label, falling back to the full category label. */
export function categoryNavLabel(category: CategoryDef, t: Translate): string {
  if (category.navLabelKey !== undefined) return t(category.navLabelKey);
  if (category.navLabel !== undefined) return category.navLabel;
  return resolveLabel(category, t);
}

/** Hint shown on a capability-gated row, in the active locale. */
export function capabilityUnavailableHint(
  def: Pick<SettingDef, 'capabilityUnavailableHint' | 'capabilityUnavailableHintKey'>,
  t: Translate,
): string | undefined {
  return def.capabilityUnavailableHintKey !== undefined
    ? t(def.capabilityUnavailableHintKey)
    : def.capabilityUnavailableHint;
}

function resolveAction(action: ActionSpec, t: Translate): ResolvedActionSpec {
  return {
    run: action.run,
    danger: action.danger,
    label: resolveLabel(action, t),
  };
}

function resolveEnumOption<T>(option: EnumOption<T>, t: Translate): ResolvedEnumOption<T> {
  return {
    value: option.value,
    label: resolveLabel(option, t),
    description: resolveOptionalDescription(option, t),
  };
}

/**
 * Materialize a def for rendering: every localizable text field becomes
 * a definite string in `t`'s locale. Non-text fields carry through
 * untouched, so the result keeps behaving like the registered def for
 * consumers that only read behavior (schema, when, scope, …).
 */
export function resolveSettingDef<K extends SettingKey>(def: SettingDef<K>, t: Translate): ResolvedSettingDef<K> {
  const { enumOptions, action, ...rest } = def;
  return {
    ...rest,
    label: resolveLabel(def, t),
    description: resolveDescription(def, t),
    capabilityUnavailableHint: capabilityUnavailableHint(def, t),
    enumOptions: enumOptions?.map((opt) => resolveEnumOption(opt, t)),
    action: action ? resolveAction(action, t) : undefined,
  };
}
