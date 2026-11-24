/**
 * DebugModeSwitch — the bare "Debug mode" label + switch, for a place that
 * points at Debug mode as the way forward (the response notice of a request
 * whose content was never captured). Presentation only: whose Debug mode it
 * drives is the caller's — this browser's own, or a watched browser's.
 *
 * Where the browser cannot drive its debugger (Firefox / Safari) the switch
 * stays visible but disabled, with the tooltip that names where it works —
 * the same posture as the footer control ({@link DebugModePill}).
 */

import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Switch, Tooltip, theme } from 'antd';
import type React from 'react';

export interface DebugModeSwitchProps {
  /** The browser can drive its debugger (Chrome / Edge). */
  available: boolean;
  on: boolean;
  /** A change is on its way to the browser. */
  pending?: boolean;
  onChange: (on: boolean) => void;
  /** Formatted chord for the toggle, where the surface binds one. */
  shortcutLabel?: string;
}

export const DebugModeSwitch: React.FC<DebugModeSwitchProps> = ({ available, on, pending, onChange, shortcutLabel }) => {
  const t = useT();
  const { token } = theme.useToken();
  const title = t('shared.chrome.debug.title');

  if (!available) {
    return (
      <Tooltip title={t('shared.chrome.debug.unavailableHint')}>
        <span
          data-testid="debug-mode-switch"
          aria-label={`${title} — ${t('shared.chrome.debug.unavailableHint')}`}
          aria-disabled
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.45, cursor: 'not-allowed' }}
        >
          <span style={{ color: token.colorTextSecondary }}>{title}</span>
          <Switch size="small" disabled checked={false} aria-label={t('shared.chrome.debug.toggleAria')} />
        </span>
      </Tooltip>
    );
  }

  const action = on ? t('shared.chrome.debug.turnOff') : t('shared.chrome.debug.turnOn');
  return (
    <span data-testid="debug-mode-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: token.colorTextSecondary }}>{title}</span>
      <Tooltip title={shortcutLabel ? <ShortcutHintTitle label={shortcutLabel}>{action}</ShortcutHintTitle> : action}>
        <Switch
          size="small"
          checked={on}
          loading={pending === true}
          onChange={onChange}
          aria-label={t('shared.chrome.debug.toggleAria')}
        />
      </Tooltip>
    </span>
  );
};
