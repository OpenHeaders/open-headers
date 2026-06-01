/**
 * SettingRow — type → field-component resolver.
 *
 * This is the ONE place in the codebase that switches on SettingType.
 * Adding a new field type means adding a file under fields/ and one
 * case here. Every schema entry flows through this resolver without
 * any change to the shell or category layer.
 *
 * Conditional visibility (`def.when`) is evaluated here so the nav
 * and search stay blind to it — a hidden setting still exists, it
 * just isn't rendered.
 */

import type React from 'react';
import { useSettingsReady } from '../hooks';
import { get as storeGet } from '../store';
import type { SettingDef, SettingKey, SettingsMap } from '../types';
import ActionField from './ActionField';
import BooleanField from './BooleanField';
import CodeField from './CodeField';
import ColorField from './ColorField';
import EnumField from './EnumField';
import FilesBrowserField from './FilesBrowserField';
import FontFamilyPresetField, { isFontFamilyPresetKey } from './FontFamilyPresetField';
import InfoField from './InfoField';
import KeybindingField from './KeybindingField';
import KeyValueField from './KeyValueField';
import MultiSelectField from './MultiSelectField';
import NumberField from './NumberField';
import StringField from './StringField';

interface SettingRowProps {
  def: SettingDef;
}

const SettingRow: React.FC<SettingRowProps> = ({ def }) => {
  // Re-evaluate `when` on every render — cheap, and guarantees we
  // react to any upstream setting change because that triggers a
  // re-render on the parent when subscribed.
  useSettingsReady();
  if (def.when && !def.when(<K extends SettingKey>(k: K): SettingsMap[K] => storeGet(k))) {
    return null;
  }

  // A def-level customEditor takes priority over type-based dispatch.
  // Used by settings whose write needs guardrails the generic field
  // can't enforce (e.g. backend.mode runs a reachability + auth probe
  // and a switching overlay before committing).
  if (def.customEditor) {
    const Editor = def.customEditor;
    return <Editor def={def} />;
  }

  // Font-family preset enums get their own field component so each
  // option can carry a live "installed" / "falls back" badge based on
  // `document.fonts.check()`. The component dispatches on the setting
  // key to pick the right preset table (monospace for editor,
  // proportional sans for appearance).
  if (isFontFamilyPresetKey(def.key)) {
    return <FontFamilyPresetField def={def} />;
  }

  switch (def.type) {
    case 'boolean':
      return <BooleanField def={def} />;
    case 'enum':
      return <EnumField def={def} />;
    case 'string':
      return <StringField def={def} />;
    case 'number':
      return <NumberField def={def} />;
    case 'action':
      return <ActionField def={def} />;
    case 'info':
      return <InfoField def={def} />;
    case 'color':
      return <ColorField def={def} />;
    case 'multi-select':
      return <MultiSelectField def={def} />;
    case 'keyvalue':
      return <KeyValueField def={def} />;
    case 'keybinding':
      return <KeybindingField def={def} />;
    case 'code':
      return <CodeField def={def} />;
    case 'files-browser':
      return <FilesBrowserField def={def} />;
    default:
      return null;
  }
};

export default SettingRow;
