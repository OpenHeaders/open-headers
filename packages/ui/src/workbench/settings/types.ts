/**
 * Type surface for the settings architecture.
 *
 * `SettingsMap` is the central type-union of every registered setting
 * key → its value type. Each schema file augments this interface via
 * TypeScript declaration merging:
 *
 *     declare module '@openheaders/ui/workbench/settings/types' {
 *       interface SettingsMap {
 *         'appearance.theme': 'light' | 'dark' | 'auto';
 *       }
 *     }
 *
 * After augmentation, `useSetting('appearance.theme')` is fully typed
 * and `useSetting('typo')` is a compile error. `SettingKey` is the
 * union of all registered keys.
 *
 * `SettingDef` is the runtime metadata for one setting. `CategoryDef`
 * is metadata for one category in the left nav.
 */

import type { ComponentType, ReactNode } from 'react';
import type * as v from 'valibot';
import type { SettingScope } from './storage/adapter';

// ── The type-level registry ───────────────────────────────────────────
//
// Each schema file extends this interface with its own keys. The empty
// marker property exists to keep the interface non-empty under `exactly`
// tooling and give IDEs something to hover when no schemas are loaded.

// biome-ignore lint/suspicious/noEmptyInterface: populated via declaration merging in schema files
export interface SettingsMap {}

export type SettingKey = keyof SettingsMap & string;

// ── Field type variants ──────────────────────────────────────────────

export type SettingType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'enum'
  | 'multi-select'
  | 'keybinding'
  | 'code'
  | 'keyvalue'
  | 'color'
  | 'action'
  | 'info'
  | 'files-browser';

// ── Per-type option shapes ───────────────────────────────────────────

export interface EnumOption<T> {
  value: T;
  label: string;
  description?: string;
}

export interface NumberRange {
  min?: number;
  max?: number;
  step?: number;
  /** 'input' renders an InputNumber, 'slider' renders a Slider. Default 'input'. */
  control?: 'input' | 'slider';
}

export interface ActionSpec {
  label: string;
  run: () => void | Promise<void>;
  /** Render the button in danger style (destructive). */
  danger?: boolean;
}

// ── Setting definition ───────────────────────────────────────────────

/**
 * Runtime metadata for one setting. One of these is produced per entry
 * in a schema file and registered via `registerSetting`.
 *
 * Generic parameter `K` is the setting key (typed). `SettingsMap[K]` is
 * the value type, so every field on the def that traffics in values
 * (default, schema, enumOptions, etc.) is type-checked against it.
 */
export interface SettingDef<K extends SettingKey = SettingKey> {
  key: K;
  type: SettingType;
  default: SettingsMap[K];
  /** valibot schema used to validate values at read and write time. */
  schema: v.BaseSchema<SettingsMap[K], SettingsMap[K], v.BaseIssue<unknown>>;

  label: string;
  description: string;
  category: string;
  subcategory?: string;
  /** Extra keywords the search indexer considers alongside label/description/key. */
  tags?: readonly string[];

  scope: SettingScope;

  /**
   * Conditional visibility. Receives a type-safe getter for any other
   * setting value. Returning false hides the row from the shell but
   * keeps the value in storage (so toggling the gating setting back on
   * restores it unchanged).
   */
  when?: (get: <GK extends SettingKey>(k: GK) => SettingsMap[GK]) => boolean;

  /**
   * Mark as experimental. The shell renders a flask icon and the search
   * supports `@experimental` to filter for these.
   */
  experimental?: boolean;

  requiresConnection?: boolean;

  /**
   * Mark as deprecated. The `replacement` key, if provided, is auto-read
   * when the deprecated key is set, so renames are transparent.
   */
  deprecated?: {
    message: string;
    replacement?: SettingKey;
  };

  // ── Type-specific options ──────────────────────────────────────────

  /**
   * enum / multi-select only. For multi-select, the option value is
   * the element type of the array, not the array itself.
   */
  enumOptions?: readonly EnumOption<SettingsMap[K] extends readonly (infer U)[] ? U : SettingsMap[K]>[];
  /** number only. */
  numberRange?: NumberRange;
  /** code only — syntax highlighting hint. */
  language?: 'json' | 'regex' | 'javascript' | 'plaintext';
  /** action only — the button handler. */
  action?: ActionSpec;
  /** info only — read-only display resolver. */
  infoValue?: () => ReactNode;
}

// ── Category definition ──────────────────────────────────────────────

export interface SubcategoryDef {
  id: string;
  label: string;
  /** Lower = earlier in the nav. */
  order: number;
}

export interface CategoryPaneProps {
  category: CategoryDef;
  defs: readonly SettingDef[];
}

export interface CategoryDef {
  id: string;
  label: string;
  icon: ReactNode;
  /** Lower = earlier in the left nav. */
  order: number;
  description?: string;
  subcategories?: readonly SubcategoryDef[];
  /**
   * Optional custom renderer for the right-hand pane. When omitted the
   * default `CategoryPane` (rows-in-cards) is used. Categories with
   * UX requirements beyond a flat field list register their own —
   * e.g. the Backend category uses {@link BackendPane} so users pick
   * a hosting scenario before the relevant config surfaces.
   */
  renderPane?: ComponentType<CategoryPaneProps>;
}
