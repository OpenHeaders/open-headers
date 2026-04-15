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
import { useCallback, useEffect, useState } from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface KeybindingFieldProps {
  def: SettingDef;
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

function chordFromEvent(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = e.key.toLowerCase();
  // Ignore pure modifier presses — wait until a real key is struck.
  if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta' || key === 'cmd') {
    return null;
  }
  parts.push(key);
  return parts.join('+');
}

const KeybindingField: React.FC<KeybindingFieldProps> = ({ def }) => {
  const { token } = theme.useToken();
  const [value, setValue] = useUntypedSetting(def.key);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setRecording(false);
        return;
      }
      const chord = chordFromEvent(e);
      if (!chord) return;
      e.preventDefault();
      setValue(chord);
      setRecording(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [recording, setValue]);

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
        <Button size="small" onClick={() => setRecording((r) => !r)}>
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
