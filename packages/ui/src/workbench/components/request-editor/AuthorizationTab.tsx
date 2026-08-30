/**
 * AuthorizationTab — the HTTP request's auth block on the shared
 * `auth-layout` anatomy: left rail auth-type picker + contextual note,
 * right pane the type's form.
 *
 * The wire-level `credentialsMode` (cookie-jar policy) lives under
 * the Settings tab now — this tab focuses purely on how the
 * Authorization header is assembled.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { findOAuth2Preset, OAUTH2_PROVIDER_PRESETS } from '@openheaders/core/oauth';
import type { AuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Select, Typography } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type { RequestAncestry } from '../request-container/ancestry';
import {
  AUTH_FIELD_DEFAULT_MAX_WIDTH as FIELD_DEFAULT_MAX_WIDTH,
  AuthEmptyState,
  AuthForm,
  AuthLabeledRow as LabeledRow,
  AuthRailNote,
  AuthSecretField as SecretField,
  AuthTabShell,
  AuthTypeLabel,
} from './auth-layout';
import {
  AUTH_TYPE_OPTIONS,
  authTypeLabelKey,
  buildInheritedGroup,
  type InheritedAuthAttribution,
  InheritedAuthEmptyState,
  inheritSelectValue,
  inheritSourceLabel,
  parseInheritSelectValue,
} from './inherited-auth';
import OAuth2AuthEditor from './OAuth2AuthEditor';
import { TemplateInput } from '../template-input';

const { Text } = Typography;

type AuthKind = AuthConfig['type'];

/** The level the tab edits — the transparent choice reads differently
 *  at each: a request inherits from its parents, a folder from the
 *  collection, a collection has no parent (its transparent choice is
 *  "No default"). */
export type AuthLevel = 'request' | 'collection' | 'folder';

interface AuthorizationTabProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  /** Defaults to `'request'`. */
  level?: AuthLevel;
  /** Request level only — the Inherit empty state names what the
   *  request actually sends with. Absent = unknown (a scratch draft). */
  inheritedFrom?: InheritedAuthAttribution;
  /** Request level only — the ancestor chain behind the select's
   *  Inherited group (default + every named pool entry). Absent = the
   *  flat select (a scratch draft, or a container level). */
  ancestry?: RequestAncestry | null;
  /** The request's URL — host-scoped entries resolve against it for
   *  the Default option's label. */
  url?: string;
  /** Container entry editing only — `false` drops the transparent
   *  choice from the select (a named pool entry is always concrete;
   *  removing it is the entries list's gesture). */
  allowTransparent?: boolean;
  /** Opens the supplying container's Authorization section — the
   *  Inherit empty state's "Edit in …" button. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
}

function transparentLabelKey(level: AuthLevel): MessageKey {
  switch (level) {
    case 'collection':
      return 'workbench.editors.requestContainer.auth.noDefault';
    case 'folder':
      return 'workbench.editors.requestContainer.auth.inheritFromCollection';
    default:
      return 'workbench.editors.request.auth.type.inherit';
  }
}

const AuthorizationTab: React.FC<AuthorizationTabProps> = ({
  auth,
  onChange,
  level = 'request',
  inheritedFrom,
  ancestry,
  url = '',
  allowTransparent = true,
  onOpenContainerAuth,
}) => {
  const t = useT();
  // With ancestry the transparent option grows into the Inherited
  // group — the default plus every named ancestor entry; without it
  // (a scratch draft, a container level) the flat list stands.
  const grouped = level === 'request' && ancestry !== undefined;
  const authOptions = useMemo(() => {
    const own = AUTH_TYPE_OPTIONS.filter((o) => o.value !== 'inherit').map((o): { value: string; label: string } => ({
      value: o.value,
      label: t(o.labelKey),
    }));
    if (grouped) {
      return [
        buildInheritedGroup({
          t,
          kind: 'http',
          ancestry: ancestry ?? null,
          url,
          ...(auth.type === 'inherit' && auth.authUid !== undefined ? { currentAuthUid: auth.authUid } : {}),
        }),
        ...own,
      ];
    }
    if (!allowTransparent) return own;
    return [{ value: 'inherit', label: t(transparentLabelKey(level)) }, ...own];
  }, [t, level, grouped, ancestry, url, allowTransparent, auth]);

  // The transparent choice's copy per level: the rail note states the
  // fact, the empty state says what to do about it — and at the
  // request level names the level that supplies the auth.
  const transparent = useMemo(() => {
    if (level === 'collection') {
      return {
        note: t('workbench.editors.requestContainer.auth.noDefaultNote'),
        detail: t('workbench.editors.requestContainer.auth.noDefaultDetail'),
      };
    }
    if (level === 'folder') {
      return {
        note: t('workbench.editors.requestContainer.auth.inheritFromCollectionNote'),
        detail: t('workbench.editors.requestContainer.auth.inheritFromCollectionDetail'),
      };
    }
    if (inheritedFrom === undefined) {
      return {
        note: t('workbench.editors.request.auth.inheritNote'),
        detail: t('workbench.editors.request.auth.inheritDetail'),
      };
    }
    if (inheritedFrom.source === null) {
      return {
        note: t('workbench.editors.request.auth.inheritNote'),
        detail: t('workbench.editors.request.auth.inheritedNone'),
      };
    }
    return {
      note: t('workbench.editors.request.auth.inheritNote'),
      detail: t('workbench.editors.request.auth.inheritedFrom', {
        type: t(authTypeLabelKey(inheritedFrom.auth.type)),
        source: inheritSourceLabel(t, inheritedFrom.source),
      }),
    };
  }, [t, level, inheritedFrom]);

  // A pick from the Inherited group writes the pick (the default or a
  // named entry uid), carrying a suspended state along; a concrete
  // type routes through the seeding switch below.
  const handleSelect = (value: string) => {
    const pick = parseInheritSelectValue(value);
    if (pick !== null) {
      onChange({
        type: 'inherit',
        ...(pick.authUid !== undefined ? { authUid: pick.authUid } : {}),
        ...(auth.type === 'inherit' && auth.disabled === true ? { disabled: true } : {}),
      });
      return;
    }
    const own = AUTH_TYPE_OPTIONS.find((o) => o.value === value);
    if (own !== undefined) switchType(own.value);
  };

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
    } else if (type === 'aws-sigv4') {
      onChange({ type: 'aws-sigv4', accessKeyId: '', secretAccessKey: '', service: '', region: '' });
    } else if (type === 'digest') {
      onChange({ type: 'digest', username: '', password: '' });
    } else if (type === 'oauth1') {
      onChange({
        type: 'oauth1',
        consumerKey: '',
        consumerSecret: '',
        signatureMethod: 'HMAC-SHA1',
        paramsLocation: 'header',
      });
    }
  };

  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeLabel>{t('workbench.editors.request.auth.typeLabel')}</AuthTypeLabel>
          <Select
            size="middle"
            data-testid="oh-auth-type"
            value={inheritSelectValue(auth)}
            onChange={handleSelect}
            options={authOptions}
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{transparent.note}</AuthRailNote>}
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'oauth2' && <OAuth2LeftRailControls auth={auth} onChange={onChange} />}
        </>
      }
    >
      {auth.type === 'none' && (
        <AuthEmptyState
          glyph="—"
          title={t('workbench.editors.request.auth.type.none')}
          note={t('workbench.editors.request.auth.noneNote')}
        />
      )}

      {auth.type === 'inherit' &&
        (level === 'request' ? (
          <InheritedAuthEmptyState
            title={t(transparentLabelKey(level))}
            detail={transparent.detail}
            inheritedFrom={inheritedFrom}
            onOpenContainerAuth={onOpenContainerAuth}
            testId="oh-auth-transparent-state"
          />
        ) : (
          <AuthEmptyState
            title={t(transparentLabelKey(level))}
            note={transparent.detail}
            testId="oh-auth-transparent-state"
          />
        ))}

      {auth.type === 'basic' && (
        <AuthForm>
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
        </AuthForm>
      )}

      {auth.type === 'bearer' && (
        <AuthForm>
          <LabeledRow label={t('workbench.editors.request.auth.token')}>
            <SecretField
              value={auth.token}
              // The executor prepends the scheme — a pasted
              // `Bearer <token>` sheds its prefix here so the wire
              // header never reads `Bearer Bearer …` (same rule as
              // the Headers tab's inline auth row).
              onChange={(next) => onChange({ ...auth, token: next.replace(/^Bearer\s+/i, '') })}
              placeholder={t('workbench.editors.request.auth.tokenPlaceholder')}
            />
          </LabeledRow>
        </AuthForm>
      )}

      {auth.type === 'api-key' && (
        <AuthForm>
          <LabeledRow label={t('workbench.editors.request.auth.key')}>
            <TemplateInput
              size="small"
              value={auth.key}
              onChange={(next) => onChange({ ...auth, key: next })}
              placeholder={t('workbench.editors.request.auth.keyPlaceholder')}
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
        </AuthForm>
      )}

      {auth.type === 'aws-sigv4' && <AwsSigV4Editor auth={auth} onChange={onChange} />}

      {auth.type === 'digest' && <DigestEditor auth={auth} onChange={onChange} />}

      {auth.type === 'oauth1' && <OAuth1Editor auth={auth} onChange={onChange} />}

      {auth.type === 'oauth2' && <OAuth2AuthEditor auth={auth} onChange={onChange} />}
    </AuthTabShell>
  );
};

// ── AWS Signature v4 editor ────────────────────────────────────────
//
// Plain credential + scope fields; the signature itself is derived at
// send time over the final wire shape, so there is nothing else to
// configure. An emptied Session Token persists ABSENT (optional field
// — the empty string never lands on disk).

const AwsSigV4Editor: React.FC<{
  auth: Extract<AuthConfig, { type: 'aws-sigv4' }>;
  onChange: (auth: AuthConfig) => void;
}> = ({ auth, onChange }) => {
  const t = useT();
  const setSessionToken = (next: string) => {
    if (next) {
      onChange({ ...auth, sessionToken: next });
    } else {
      const { sessionToken: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  return (
    <AuthForm>
      <LabeledRow label={t('workbench.editors.request.auth.awsAccessKey')}>
        <TemplateInput
          size="small"
          value={auth.accessKeyId}
          onChange={(next) => onChange({ ...auth, accessKeyId: next })}
          placeholder={t('workbench.editors.request.auth.awsAccessKeyPlaceholder')}
          style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.awsSecretKey')}>
        <SecretField
          value={auth.secretAccessKey}
          onChange={(next) => onChange({ ...auth, secretAccessKey: next })}
          placeholder={t('workbench.editors.request.auth.awsSecretKeyPlaceholder')}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.awsSessionToken')}>
        <SecretField
          value={auth.sessionToken ?? ''}
          onChange={setSessionToken}
          placeholder={t('workbench.editors.request.auth.awsSessionTokenPlaceholder')}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.awsService')}>
        <TemplateInput
          size="small"
          value={auth.service}
          onChange={(next) => onChange({ ...auth, service: next })}
          placeholder={t('workbench.editors.request.auth.awsServicePlaceholder')}
          style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.awsRegion')}>
        <TemplateInput
          size="small"
          value={auth.region}
          onChange={(next) => onChange({ ...auth, region: next })}
          placeholder={t('workbench.editors.request.auth.awsRegionPlaceholder')}
          style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
    </AuthForm>
  );
};

// ── HTTP digest editor ─────────────────────────────────────────────
//
// Only the credentials are configuration — realm, nonce, algorithm,
// and qop all arrive on the server's 401 challenge at send time. The
// challenge/response exchange runs on node-runtime hosts (desktop,
// CLI/daemon); browser-runtime surfaces can't drive the second leg,
// so the form carries a note there and the target's 401 is the
// signal.

const DigestEditor: React.FC<{
  auth: Extract<AuthConfig, { type: 'digest' }>;
  onChange: (auth: AuthConfig) => void;
}> = ({ auth, onChange }) => {
  const t = useT();
  const browserRuntime = (getCapability('requestRuntime')?.() ?? 'browser') === 'browser';
  return (
    <AuthForm>
      {browserRuntime && (
        <Text type="secondary" style={{ fontSize: 12, maxWidth: FIELD_DEFAULT_MAX_WIDTH }}>
          {t('workbench.editors.request.auth.digestBrowserNote')}
        </Text>
      )}
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
    </AuthForm>
  );
};

// ── OAuth 1.0a editor ──────────────────────────────────────────────
//
// Credential + signing fields; the oauth_* protocol params (signature,
// nonce, timestamp) are derived at send time over the final wire
// shape, so nothing else is configuration. The token pair is optional
// — one-legged calls have neither — and an emptied Token / Token
// Secret / Realm persists ABSENT (the empty string never lands on
// disk, the Session Token pattern).

const OAuth1Editor: React.FC<{
  auth: Extract<AuthConfig, { type: 'oauth1' }>;
  onChange: (auth: AuthConfig) => void;
}> = ({ auth, onChange }) => {
  const t = useT();
  const setOptional = (field: 'token' | 'tokenSecret' | 'realm') => (next: string) => {
    if (next) {
      onChange({ ...auth, [field]: next });
    } else {
      const { [field]: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  return (
    <AuthForm>
      <LabeledRow label={t('workbench.editors.request.auth.oauth1ConsumerKey')}>
        <TemplateInput
          size="small"
          value={auth.consumerKey}
          onChange={(next) => onChange({ ...auth, consumerKey: next })}
          placeholder={t('workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder')}
          style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.oauth1ConsumerSecret')}>
        <SecretField
          value={auth.consumerSecret}
          onChange={(next) => onChange({ ...auth, consumerSecret: next })}
          placeholder={t('workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder')}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.oauth1Token')}>
        <TemplateInput
          size="small"
          value={auth.token ?? ''}
          onChange={setOptional('token')}
          placeholder={t('workbench.editors.request.auth.oauth1TokenPlaceholder')}
          style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.oauth1TokenSecret')}>
        <SecretField
          value={auth.tokenSecret ?? ''}
          onChange={setOptional('tokenSecret')}
          placeholder={t('workbench.editors.request.auth.oauth1TokenSecretPlaceholder')}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.oauth1SignatureMethod')}>
        <Select
          size="small"
          data-testid="oh-auth-oauth1-signature-method"
          value={auth.signatureMethod}
          onChange={(next: 'HMAC-SHA1' | 'PLAINTEXT') => onChange({ ...auth, signatureMethod: next })}
          options={[
            { value: 'HMAC-SHA1', label: 'HMAC-SHA1' },
            { value: 'PLAINTEXT', label: 'PLAINTEXT' },
          ]}
          style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
      <LabeledRow label={t('workbench.editors.request.auth.addTo')}>
        <Select
          size="small"
          data-testid="oh-auth-oauth1-params-location"
          value={auth.paramsLocation}
          onChange={(next: 'header' | 'query') => onChange({ ...auth, paramsLocation: next })}
          options={[
            { value: 'header', label: t('workbench.editors.request.auth.addToHeader') },
            { value: 'query', label: t('workbench.editors.request.auth.addToQuery') },
          ]}
          style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
        />
      </LabeledRow>
      {auth.paramsLocation === 'header' && (
        <LabeledRow label={t('workbench.editors.request.auth.oauth1Realm')}>
          <TemplateInput
            size="small"
            value={auth.realm ?? ''}
            onChange={setOptional('realm')}
            placeholder={t('workbench.editors.request.auth.oauth1RealmPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      )}
    </AuthForm>
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

export default AuthorizationTab;
