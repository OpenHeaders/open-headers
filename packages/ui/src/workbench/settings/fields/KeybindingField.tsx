/**
 * KeybindingField — records a keyboard chord and stores it as a
 * normalized string like "mod+shift+k".
 *
 * Minimal first pass: click the button to enter record mode, press
 * the chord, and the field captures and commits. Escape cancels
 * record mode without writing.
 */

import { CloseOutlined } from '@ant-design/icons';
import { Button, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useUntypedSetting } from '../hooks';
import type { ResolvedSettingDef } from '../types';
import FieldRow from './FieldRow';
import { useChordCapture } from './use-chord-capture';

interface KeybindingFieldProps {
  def: ResolvedSettingDef;
}

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

function formatChord(chord: string): string {
  if (!IS_MAC) return chord;
  return chord
    .replace(/\bmod\b/g, '⌘')
    .replace(/\bshift\b/g, '⇧')
    .replace(/\balt\b/g, '⌥')
    .replace(/\bctrl\b/g, '⌃')
    .replace(/\+/g, '')
    .toUpperCase();
}

const KeybindingField: React.FC<KeybindingFieldProps> = ({ def }) => {
  const { token } = theme.useToken();
  const [value, setValue] = useUntypedSetting(def.key);
  const { recording, toggle } = useChordCapture(setValue);

  const clear = useCallback(() => setValue(''), [setValue]);
  const display = typeof value === 'string' && value.length > 0 ? formatChord(value) : '—';

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {recording ? (
          <Tag color="processing" style={{ fontFamily: 'system-ui, sans-serif' }}>
            Press a key combo…
          </Tag>
        ) : (
          <Tag
            style={{
              fontFamily: 'system-ui, sans-serif',
              background: token.colorBgContainer,
              color: token.colorText,
              border: `1px solid ${token.colorBorderSecondary}`,
              padding: '2px 10px',
            }}
          >
            {display}
          </Tag>
        )}
        <Button size="small" onClick={toggle}>
          {recording ? 'Cancel' : 'Record'}
        </Button>
        {typeof value === 'string' && value.length > 0 && (
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={clear} />
        )}
      </div>
    </FieldRow>
  );
};

export default KeybindingField;
