/**
 * AuthorizationTab — two-column layout. Left rail: auth-type picker +
 * contextual note. Right pane: auth-type-specific form.
 *
 * The wire-level `credentialsMode` (cookie-jar policy) lives under
 * the Settings tab now — this tab focuses purely on how the
 * Authorization header is assembled.
 */

import { findOAuth2Preset, OAUTH2_PROVIDER_PRESETS } from '@openheaders/core/oauth';
import type { AuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import OAuth2AuthEditor from './OAuth2AuthEditor';
import { type GripResizeXEvent, TemplateInput } from '../template-input';
import { useValueEditAction } from '../value-editors';

const { Text } = Typography;

type AuthKind = AuthConfig['type'];

interface AuthOption {
  value: AuthKind;
  labelKey: MessageKey;
}

const AUTH_OPTIONS: AuthOption[] = [
  { value: 'inherit', labelKey: 'workbench.editors.request.auth.type.inherit' },
  { value: 'none', labelKey: 'workbench.editors.request.auth.type.none' },
  { value: 'basic', labelKey: 'workbench.editors.request.auth.type.basic' },
  { value: 'bearer', labelKey: 'workbench.editors.request.auth.type.bearer' },
  { value: 'api-key', labelKey: 'workbench.editors.request.auth.type.apiKey' },
  { value: 'oauth2', labelKey: 'workbench.editors.request.auth.type.oauth2' },
];

interface AuthorizationTabProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}

// Draggable rail bounds — narrow enough to reclaim space for long
// credentials, wide enough that every auth-type label stays readable.
const RAIL_MIN = 160;
const RAIL_MAX = 420;
const RAIL_DEFAULT = 210;

const AuthorizationTab: React.FC<AuthorizationTabProps> = ({ auth, onChange }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const authOptions = useMemo(() => AUTH_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);

  const switchType = (type: AuthKind) => {
    if (type === 'none' || type === 'inherit') {
      onChange({ type });
    } else if (type === 'basic') {
      onChange({ type: 'basic', username: '', password: '' });
    } else if (type === 'bearer') {
      onChange({ type: 'bearer', token: '' });
    } else if (type === 'api-key') {
      onChange({ type: 'api-key', key: '', value: '', in: 'header' });
    } else if (type === 'oauth2') {
      const credentialRef = `oauth2-cred-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      onChange({
        type: 'oauth2',
        credentialRef,
        flow: 'authorization-code-pkce',
        tokenEndpoint: '',
        clientId: '',
        scopes: [],
      });
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 320 }}>
      {/* Left rail — sticks to the top of the scroll container so the
          auth-type picker stays visible while the right pane's long
          OAuth 2.0 form scrolls past it. `align-self: start` keeps
          the rail content-sized so `position: sticky` has something
          to anchor against; without it the flex item stretches to the
          row's full height and sticky collapses to a no-op. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: railWidth,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          alignSelf: 'start',
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.request.auth.typeLabel')}
        </Text>
        <Select
          size="middle"
          data-testid="oh-auth-type"
          value={auth.type}
          onChange={switchType}
          options={authOptions}
          style={{ width: '100%' }}
        />
        {auth.type === 'inherit' && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            {t('workbench.editors.request.auth.inheritNote')}
          </Text>
        )}
        {auth.type === 'none' && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            {t('workbench.editors.request.auth.noneNote')}
          </Text>
        )}
        {auth.type === 'oauth2' && <OAuth2LeftRailControls auth={auth} onChange={onChange} />}
      </div>

      {/* Draggable divider — resizes the rail within [RAIL_MIN, RAIL_MAX];
          double-click resets. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-drag-only resize affordance */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('workbench.editors.request.auth.resizeRailAria')}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { startX: e.clientX, startWidth: railWidth };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          const next = drag.startWidth + (e.clientX - drag.startX);
          setRailWidth(Math.min(RAIL_MAX, Math.max(RAIL_MIN, next)));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onDoubleClick={() => setRailWidth(RAIL_DEFAULT)}
        style={{
          width: 9,
          margin: '0 6px',
          flexShrink: 0,
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          touchAction: 'none',
        }}
      >
        <span style={{ width: 1, background: token.colorBorderSecondary }} />
      </div>

      {/* Right pane */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        {auth.type === 'none' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: token.colorTextTertiary,
              gap: 8,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                background: token.colorFillTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: token.colorTextSecondary,
              }}
            >
              —
            </div>
            <Text strong style={{ fontSize: 14 }}>
              {t('workbench.editors.request.auth.type.none')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.editors.request.auth.noneNote')}
            </Text>
          </div>
        )}

        {auth.type === 'inherit' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: token.colorTextTertiary,
              gap: 8,
            }}
          >
            <Text strong style={{ fontSize: 14 }}>
              {t('workbench.editors.request.auth.type.inherit')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
              {t('workbench.editors.request.auth.inheritDetail')}
            </Text>
          </div>
        )}

        {auth.type === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LabeledRow label={t('workbench.editors.request.auth.username')}>
              <TemplateInput
                size="small"
                value={auth.username}
                onChange={(next) => onChange({ ...auth, username: next })}
                placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
                style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              />
            </LabeledRow>
            <LabeledRow label={t('workbench.editors.request.auth.password')}>
              <SecretField
                value={auth.password}
                onChange={(next) => onChange({ ...auth, password: next })}
                placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LabeledRow label={t('workbench.editors.request.auth.token')}>
              <SecretField
                value={auth.token}
                onChange={(next) => onChange({ ...auth, token: next })}
                placeholder={t('workbench.editors.request.auth.tokenPlaceholder')}
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'api-key' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LabeledRow label={t('workbench.editors.request.auth.key')}>
              <TemplateInput
                size="small"
                value={auth.key}
                onChange={(next) => onChange({ ...auth, key: next })}
                placeholder="e.g. X-API-Key"
                style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              />
            </LabeledRow>
            <LabeledRow label={t('workbench.editors.request.auth.value')}>
              <SecretField
                value={auth.value}
                onChange={(next) => onChange({ ...auth, value: next })}
                placeholder={t('workbench.editors.request.auth.valuePlaceholder')}
              />
            </LabeledRow>
            <LabeledRow label={t('workbench.editors.request.auth.addTo')}>
              <Select
                size="small"
                data-testid="oh-auth-apikey-in"
                value={auth.in}
                onChange={(next: 'header' | 'query') => onChange({ ...auth, in: next })}
                options={[
                  { value: 'header', label: t('workbench.editors.request.auth.addToHeader') },
                  { value: 'query', label: t('workbench.editors.request.auth.addToQuery') },
                ]}
                style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'oauth2' && <OAuth2AuthEditor auth={auth} onChange={onChange} />}
      </div>
    </div>
  );
};

// ── OAuth2 left-rail controls ─────────────────────────────────────
//
// When OAuth 2.0 is the active auth type, the rail grows two extra
// selectors below the Auth Type dropdown:
//   • "Add authorization data to" — header (Authorization: Bearer …)
//     vs query (?access_token=…). Query is deprecated per RFC 6750
//     but still honored for legacy providers; a warning surfaces in
//     the right pane when selected.
//   • "Provider preset"           — pre-fills endpoints + default
//     scopes from the core preset library.

const OAuth2LeftRailControls: React.FC<{
  auth: Extract<AuthConfig, { type: 'oauth2' }>;
  onChange: (auth: AuthConfig) => void;
}> = ({ auth, onChange }) => {
  const t = useT();
  const applyPreset = useCallback(
    (presetId: string) => {
      if (presetId === 'custom') {
        onChange({ ...auth, providerPresetId: undefined });
        return;
      }
      const preset = findOAuth2Preset(presetId);
      if (!preset) return;
      onChange({
        ...auth,
        providerPresetId: preset.id,
        authorizationEndpoint: preset.authorizationEndpoint,
        tokenEndpoint: preset.tokenEndpoint,
        deviceAuthorizationEndpoint: preset.deviceAuthorizationEndpoint ?? auth.deviceAuthorizationEndpoint,
        scopes: [...preset.defaultScopes],
        flow: preset.defaultFlow,
      });
    },
    [auth, onChange],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.request.auth.sendAsLabel')}
        </Text>
        <Select
          size="middle"
          value={auth.sendAs ?? 'header'}
          onChange={(next: 'header' | 'query') => onChange({ ...auth, sendAs: next })}
          options={[
            { value: 'header', label: t('workbench.editors.request.auth.sendAsHeaders') },
            { value: 'query', label: t('workbench.editors.request.auth.sendAsUrl') },
          ]}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            {t('workbench.editors.request.auth.presetLabel')}
          </Text>
          <InfoTrigger
            content={{
              title: t('workbench.editors.request.auth.presetLabel'),
              summary: t('workbench.editors.request.auth.presetInfo'),
            }}
          />
        </div>
        <Select
          size="middle"
          value={auth.providerPresetId ?? 'custom'}
          onChange={applyPreset}
          options={[
            { value: 'custom', label: t('workbench.editors.request.auth.presetCustom') },
            ...OAUTH2_PROVIDER_PRESETS.map((p) => ({ value: p.id, label: p.label })),
          ]}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};

// ── Shared row ─────────────────────────────────────────────────────

const LabeledRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'start', gap: 12 }}>
    <Text style={{ fontSize: 13, lineHeight: '24px' }}>{label}</Text>
    <div style={{ minWidth: 0 }}>{children}</div>
  </div>
);

// ── Secret credential field ────────────────────────────────────────
//
// Long secrets (a 500-char JWT) must never force the tab to scroll
// horizontally: collapsed, the field is one masked line with an
// ellipsis; focusing it expands to a textarea-style surface that
// wraps, grows to ~7 lines, then inner-scrolls. The in-field eye
// reveals/masks the literal characters (`{{ref}}` spans are always
// readable either way). The 2D corner grip resizes both axes — the
// field owns its width here (no column split to feed), so X travel
// sets an explicit width; double-click restores the default.

const SECRET_FIELD_MIN_WIDTH = 160;
// Untouched fields cap at the classic form width (the row containers
// are full-pane so a grip drag has room to grow); a manual width
// escapes the cap up to the pane edge.
const FIELD_DEFAULT_MAX_WIDTH = 438;

const SecretField: React.FC<{
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  const [revealed, setRevealed] = useState(false);
  const [manualWidth, setManualWidth] = useState<number | null>(null);
  const widthDragRef = useRef<{ startWidth: number } | null>(null);
  const handleResizeX = useCallback((e: GripResizeXEvent) => {
    if (e.phase === 'reset') {
      widthDragRef.current = null;
      setManualWidth(null);
      return;
    }
    if (e.phase === 'start') {
      const wrapper = e.gripEl.closest('.oh-template-input-wrapper');
      widthDragRef.current = wrapper instanceof HTMLElement ? { startWidth: wrapper.offsetWidth } : null;
      return;
    }
    if (e.phase === 'end') {
      widthDragRef.current = null;
      return;
    }
    const drag = widthDragRef.current;
    if (!drag) return;
    setManualWidth(Math.max(SECRET_FIELD_MIN_WIDTH, drag.startWidth + e.deltaX));
  }, []);
  const { editProps, editorModal } = useValueEditAction(value, onChange);
  return (
    <>
      <TemplateInput
        size="small"
        secret={!revealed}
        onSecretToggle={() => setRevealed((v) => !v)}
        {...editProps}
        expandOnFocus
        maxRows={7}
        resizable
        onResizeX={handleResizeX}
        allowClear
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        // Default caps at the classic form width; a grip-dragged width
        // lifts the cap and the field grows into the pane's free space.
        style={
          manualWidth != null ? { width: manualWidth, minWidth: 0 } : { minWidth: 0, maxWidth: FIELD_DEFAULT_MAX_WIDTH }
        }
      />
      {editorModal}
    </>
  );
};

export default AuthorizationTab;
