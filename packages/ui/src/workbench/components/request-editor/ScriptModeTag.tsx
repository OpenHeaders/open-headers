/**
 * ScriptModeTag — the request editor's always-visible script-execution
 * marker, a small icon chip inline in the Scripts tab's label (after
 * the text, before the has-content dot) so the mode reads in the
 * context it governs. Shield = Safe mode, code glyph = Developer mode;
 * the chip's click-popover IS the chooser, so the mode is one click
 * away instead of buried behind Settings. Chip clicks never bubble to
 * the tab node — opening the chooser doesn't switch tabs.
 *
 * Renders only where the answering host actually runs scripts:
 *   - `scriptRuntime` capability (the desktop): interactive — the two
 *     mode cards rewrite the same per-workspace, host-local
 *     `OH.scriptExecutionModes` slot the Settings tab's chooser row
 *     drives; both surfaces stay in sync through the storage
 *     subscription inside `useScriptExecutionMode`.
 *   - `remoteScriptRuntime` reported Safe (a served web tab): the
 *     shield chip with an informational popover — forwarded sends only
 *     ever ride Safe, so there is nothing to choose.
 * Hosts with neither capability (the extension's browser runtime, a
 * runtime-less daemon) render nothing.
 */

import { CodeOutlined, SafetyOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import type { ScriptExecutionMode } from '@openheaders/core/scripts';
import { Popover, Radio, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useScriptExecutionMode } from './use-script-execution-mode';

const { Text } = Typography;

interface ScriptModeTagProps {
  /** Editing-scope workspace; `null` resolves the host's active one —
   *  the same target the executor's slot read uses. */
  workspaceId: string | null;
}

const ScriptModeTag: React.FC<ScriptModeTagProps> = ({ workspaceId }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const control = useScriptExecutionMode(workspaceId);
  const remoteSafe = getCapability('remoteScriptRuntime')?.() === 'safe';

  if (!control.available && !remoteSafe) return null;

  const mode: ScriptExecutionMode = control.available ? control.mode : 'safe';
  const modeLabel =
    mode === 'safe'
      ? t('workbench.editors.request.settings.scriptModeSafe')
      : t('workbench.editors.request.settings.scriptModeDeveloper');

  // One selectable mode card — radio + icon + name (+ Recommended pill
  // on Safe, trust warning on Developer) over a one-line description.
  // Picking a card writes the slot immediately; the popover stays open
  // so the radio visibly moves (an outside click or chip re-click
  // closes, the toolbar-popover convention).
  const modeCard = (target: ScriptExecutionMode) => {
    const selected = mode === target;
    const accent = target === 'safe' ? token.colorSuccess : token.colorWarning;
    return (
      <div
        role="radio"
        aria-checked={selected}
        data-testid={`oh-script-mode-option-${target}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 12px',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${selected ? accent : token.colorBorderSecondary}`,
          cursor: 'pointer',
        }}
        onClick={() => control.setMode(target)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio checked={selected} style={{ marginRight: 0, pointerEvents: 'none' }} />
          {target === 'safe' ? (
            <SafetyOutlined style={{ fontSize: 15, color: accent }} />
          ) : (
            <CodeOutlined style={{ fontSize: 15, color: accent }} />
          )}
          <Text strong style={{ fontSize: 13 }}>
            {target === 'safe'
              ? t('workbench.editors.request.settings.scriptModeSafe')
              : t('workbench.editors.request.settings.scriptModeDeveloper')}
          </Text>
          {target === 'safe' && (
            <Text
              style={{
                fontSize: 11,
                color: token.colorSuccess,
                background: token.colorSuccessBg,
                borderRadius: token.borderRadiusSM,
                padding: '0 6px',
                lineHeight: '18px',
              }}
            >
              {t('workbench.editors.request.settings.scriptModeRecommended')}
            </Text>
          )}
        </div>
        {target === 'developer' && (
          <Text
            style={{
              fontSize: 11,
              color: token.colorWarning,
              background: token.colorWarningBg,
              borderRadius: token.borderRadiusSM,
              padding: '1px 6px',
              alignSelf: 'flex-start',
            }}
          >
            {t('workbench.editors.request.settings.scriptModeDeveloperTrust')}
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
          {target === 'safe'
            ? t('workbench.editors.request.settings.scriptModeSafeCard')
            : t('workbench.editors.request.settings.scriptModeDeveloperCard')}
        </Text>
      </div>
    );
  };

  const popoverContent = control.available ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 470 }}>
      <Text strong style={{ fontSize: 13 }}>
        {t('workbench.editors.request.settings.scriptMode')}
      </Text>
      {modeCard('safe')}
      {modeCard('developer')}
      <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.4 }}>
        {t('workbench.editors.request.settings.scriptModeScopeNote')}
      </Text>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 470 }}>
      <Text strong style={{ fontSize: 13 }}>
        {t('workbench.editors.request.settings.scriptMode')}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
        {t('workbench.editors.request.settings.managed.scriptsSafeForwardedDesc')}
      </Text>
    </div>
  );

  return (
    // The chip lives inside a Tabs tab label — swallow the click so
    // opening the chooser never doubles as a tab switch.
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomLeft"
        arrow={false}
        content={popoverContent}
      >
        <Tooltip title={modeLabel} placement="top" mouseEnterDelay={0.3} open={open ? false : undefined}>
          <span
            role="button"
            tabIndex={0}
            aria-label={t('workbench.editors.request.settings.scriptModeTagAria', { mode: modeLabel })}
            data-testid="oh-script-mode-tag"
            // Neutral chrome — the glyph names the mode (tooltip spells
            // it out); the grey hover wash is the clickability cue.
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: token.borderRadiusSM,
              background: hovered || open ? token.colorBgTextHover : 'transparent',
              color: token.colorTextSecondary,
              fontSize: 12,
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {mode === 'safe' ? <SafetyOutlined /> : <CodeOutlined />}
          </span>
        </Tooltip>
      </Popover>
    </span>
  );
};

export default ScriptModeTag;
