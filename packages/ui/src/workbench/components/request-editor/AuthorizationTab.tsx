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
import { Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import OAuth2AuthEditor from './OAuth2AuthEditor';
import { type GripResizeXEvent, TemplateInput } from '../template-input';
import { useJwtEditAction } from '../value-editors';

const { Text } = Typography;

type AuthKind = AuthConfig['type'];

interface AuthOption {
  value: AuthKind;
  label: string;
}

const AUTH_OPTIONS: AuthOption[] = [
  { value: 'inherit', label: 'Inherit auth from parent' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
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
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
          Auth Type
        </Text>
        <Select
          size="middle"
          value={auth.type}
          onChange={switchType}
          options={AUTH_OPTIONS}
          style={{ width: '100%' }}
        />
        {auth.type === 'inherit' && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            The authorization data will be automatically configured based on the parent collection.
          </Text>
        )}
        {auth.type === 'none' && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            This request does not use any authorization.
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
        aria-label="Resize auth-type rail"
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
              No Auth
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              This request does not use any authorization.
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
              Inherit auth from parent
            </Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
              This request is using the authorization helper from its parent collection. Edit the collection's
              Authorization tab to change it.
            </Text>
          </div>
        )}

        {auth.type === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LabeledRow label="Username">
              <TemplateInput
                size="small"
                value={auth.username}
                onChange={(next) => onChange({ ...auth, username: next })}
                placeholder="username"
                style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              />
            </LabeledRow>
            <LabeledRow label="Password">
              <SecretField
                value={auth.password}
                onChange={(next) => onChange({ ...auth, password: next })}
                placeholder="password"
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LabeledRow label="Token">
              <SecretField
                value={auth.token}
                onChange={(next) => onChange({ ...auth, token: next })}
                placeholder="bearer token"
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'api-key' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LabeledRow label="Key">
              <TemplateInput
                size="small"
                value={auth.key}
                onChange={(next) => onChange({ ...auth, key: next })}
                placeholder="e.g. X-API-Key"
                style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              />
            </LabeledRow>
            <LabeledRow label="Value">
              <SecretField
                value={auth.value}
                onChange={(next) => onChange({ ...auth, value: next })}
                placeholder="api key value"
              />
            </LabeledRow>
            <LabeledRow label="Add to">
              <Select
                size="small"
                value={auth.in}
                onChange={(next: 'header' | 'query') => onChange({ ...auth, in: next })}
                options={[
                  { value: 'header', label: 'Header' },
                  { value: 'query', label: 'Query Params' },
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
          Add authorization data to
        </Text>
        <Select
          size="middle"
          value={auth.sendAs ?? 'header'}
          onChange={(next: 'header' | 'query') => onChange({ ...auth, sendAs: next })}
          options={[
            { value: 'header', label: 'Request Headers' },
            { value: 'query', label: 'Request URL' },
          ]}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Provider preset
          </Text>
          <InfoTrigger
            content={{
              title: 'Provider preset',
              summary:
                'Picking a provider pre-fills its authorization/token endpoints, default scopes, and recommended flow. Pick Custom to configure everything manually.',
            }}
          />
        </div>
        <Select
          size="middle"
          value={auth.providerPresetId ?? 'custom'}
          onChange={applyPreset}
          options={[
            { value: 'custom', label: 'Custom (no preset)' },
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
  const { jwtEditProps, jwtModal } = useJwtEditAction(value, onChange);
  return (
    <>
      <TemplateInput
        size="small"
        secret={!revealed}
        onSecretToggle={() => setRevealed((v) => !v)}
        {...jwtEditProps}
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
      {jwtModal}
    </>
  );
};

export default AuthorizationTab;
