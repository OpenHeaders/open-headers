/**
 * The per-type auth form bodies every auth editor composes — the
 * request's Authorization tab (rail + pane) and the container's pool
 * entry pane (labeled rows) render the SAME fields for a type, so a
 * Bearer form reads identically wherever a bearer config is edited.
 * `seedAuthConfig` is the one seeding rule for a type switch — a fresh
 * empty config of the picked type.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { findOAuth2Preset, OAUTH2_PROVIDER_PRESETS } from '@openheaders/core/oauth';
import type { ConcreteAuthConfig } from '@openheaders/core/types';
import { Checkbox, Select, Typography } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import {
  AUTH_FIELD_DEFAULT_MAX_WIDTH as FIELD_DEFAULT_MAX_WIDTH,
  AuthForm,
  AuthLabeledRow as LabeledRow,
  AuthSecretField as SecretField,
} from './auth-layout';
import OAuth2AuthEditor from './OAuth2AuthEditor';
import { TemplateInput } from '../template-input';

const { Text } = Typography;

export type ConcreteAuthType = ConcreteAuthConfig['type'];

/** A fresh, empty config of `type` — what a type switch seeds. */
export function seedAuthConfig(type: ConcreteAuthType): ConcreteAuthConfig {
  switch (type) {
    case 'none':
      return { type: 'none' };
    case 'basic':
      return { type: 'basic', username: '', password: '' };
    case 'bearer':
      return { type: 'bearer', token: '' };
    case 'api-key':
      return { type: 'api-key', key: '', value: '', in: 'header' };
    case 'oauth2':
      return {
        type: 'oauth2',
        credentialRef: `oauth2-cred-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
        flow: 'authorization-code-pkce',
        tokenEndpoint: '',
        clientId: '',
        scopes: [],
      };
    case 'aws-sigv4':
      return { type: 'aws-sigv4', accessKeyId: '', secretAccessKey: '', service: '', region: '' };
    case 'digest':
      return { type: 'digest', username: '', password: '' };
    case 'oauth1':
      return {
        type: 'oauth1',
        consumerKey: '',
        consumerSecret: '',
        signatureMethod: 'HMAC-SHA1',
        paramsLocation: 'header',
      };
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return { type: 'none' };
    }
  }
}

type FormProps<T extends ConcreteAuthType> = {
  auth: Extract<ConcreteAuthConfig, { type: T }>;
  onChange: (auth: ConcreteAuthConfig) => void;
};

/**
 * The fields of `auth`'s type. `none` renders nothing — the caller
 * owns that empty state (the tab's centered pane, the entry pane's
 * note).
 */
export const AuthConfigFields: React.FC<{
  auth: ConcreteAuthConfig;
  onChange: (auth: ConcreteAuthConfig) => void;
}> = ({ auth, onChange }) => {
  switch (auth.type) {
    case 'none':
      return null;
    case 'basic':
      return <BasicEditor auth={auth} onChange={onChange} />;
    case 'bearer':
      return <BearerEditor auth={auth} onChange={onChange} />;
    case 'api-key':
      return <ApiKeyEditor auth={auth} onChange={onChange} />;
    case 'aws-sigv4':
      return <AwsSigV4Editor auth={auth} onChange={onChange} />;
    case 'digest':
      return <DigestEditor auth={auth} onChange={onChange} />;
    case 'oauth1':
      return <OAuth1Editor auth={auth} onChange={onChange} />;
    case 'oauth2':
      return <OAuth2AuthEditor auth={auth} onChange={onChange} />;
    default: {
      const _exhaustive: never = auth;
      void _exhaustive;
      return null;
    }
  }
};

const BasicEditor: React.FC<FormProps<'basic'>> = ({ auth, onChange }) => {
  const t = useT();
  return (
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
  );
};

const BearerEditor: React.FC<FormProps<'bearer'>> = ({ auth, onChange }) => {
  const t = useT();
  return (
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
  );
};

const ApiKeyEditor: React.FC<FormProps<'api-key'>> = ({ auth, onChange }) => {
  const t = useT();
  return (
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
  );
};

// ── AWS Signature v4 editor ────────────────────────────────────────
//
// Plain credential + scope fields; the signature itself is derived at
// send time over the final wire shape, so there is nothing else to
// configure. An emptied Session Token persists ABSENT (optional field
// — the empty string never lands on disk).

const AwsSigV4Editor: React.FC<FormProps<'aws-sigv4'>> = ({ auth, onChange }) => {
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

const DigestEditor: React.FC<FormProps<'digest'>> = ({ auth, onChange }) => {
  const t = useT();
  const browserRuntime = (getCapability('requestRuntime')?.() ?? 'browser') === 'browser';
  return (
    <AuthForm>
      {browserRuntime && (
        <Text type="secondary" style={{ fontSize: 12, maxWidth: FIELD_DEFAULT_MAX_WIDTH }}>
          {t('workbench.editors.request.auth.digestBrowserNote')}
        </Text>
      )}
      {!browserRuntime && (
        <>
          <Text type="secondary" style={{ fontSize: 12, maxWidth: FIELD_DEFAULT_MAX_WIDTH }}>
            {t('workbench.editors.request.auth.digestRetryNote')}
          </Text>
          <Checkbox
            checked={auth.disableRetry === true}
            data-testid="oh-auth-digest-disable-retry"
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? { ...auth, disableRetry: true }
                  : (({ disableRetry: _omit, ...rest }) => rest)(auth),
              )
            }
            style={{ fontSize: 12 }}
          >
            {t('workbench.editors.request.auth.digestDisableRetry')}
          </Checkbox>
        </>
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
      {!browserRuntime && (
        <Text type="secondary" style={{ fontSize: 12, maxWidth: FIELD_DEFAULT_MAX_WIDTH }}>
          {t('workbench.editors.request.auth.authAutoGeneratedNote')}
        </Text>
      )}
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

const OAuth1Editor: React.FC<FormProps<'oauth1'>> = ({ auth, onChange }) => {
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

// ── OAuth2 delivery + preset controls ─────────────────────────────
//
// When OAuth 2.0 is the active auth type, two selectors ride beside
// the type picker:
//   • "Add authorization data to" — header (Authorization: Bearer …)
//     vs query (?access_token=…). Query is deprecated per RFC 6750
//     but still honored for legacy providers; a warning surfaces in
//     the form when selected.
//   • "Provider preset"           — pre-fills endpoints + default
//     scopes from the core preset library.
// The request tab stacks them in its rail (`layout: 'rail'`); the
// pool entry pane lays them as labeled rows under the type row.

export const OAuth2RailControls: React.FC<{
  auth: Extract<ConcreteAuthConfig, { type: 'oauth2' }>;
  onChange: (auth: ConcreteAuthConfig) => void;
  layout: 'rail' | 'rows';
}> = ({ auth, onChange, layout }) => {
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

  const sendAsSelect = (
    <Select
      size={layout === 'rail' ? 'middle' : 'small'}
      value={auth.sendAs ?? 'header'}
      onChange={(next: 'header' | 'query') => onChange({ ...auth, sendAs: next })}
      options={[
        { value: 'header', label: t('workbench.editors.request.auth.sendAsHeaders') },
        { value: 'query', label: t('workbench.editors.request.auth.sendAsUrl') },
      ]}
      style={{ width: '100%', ...(layout === 'rows' ? { maxWidth: FIELD_DEFAULT_MAX_WIDTH } : {}) }}
    />
  );
  const presetSelect = (
    <Select
      size={layout === 'rail' ? 'middle' : 'small'}
      value={auth.providerPresetId ?? 'custom'}
      onChange={applyPreset}
      options={[
        { value: 'custom', label: t('workbench.editors.request.auth.presetCustom') },
        ...OAUTH2_PROVIDER_PRESETS.map((p) => ({ value: p.id, label: p.label })),
      ]}
      style={{ width: '100%', ...(layout === 'rows' ? { maxWidth: FIELD_DEFAULT_MAX_WIDTH } : {}) }}
    />
  );
  const presetInfo = (
    <InfoTrigger
      content={{
        title: t('workbench.editors.request.auth.presetLabel'),
        summary: t('workbench.editors.request.auth.presetInfo'),
      }}
    />
  );

  if (layout === 'rows') {
    return (
      <>
        <LabeledRow label={t('workbench.editors.request.auth.sendAsLabel')}>{sendAsSelect}</LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.presetLabel')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{presetSelect}</div>
            {presetInfo}
          </div>
        </LabeledRow>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.request.auth.sendAsLabel')}
        </Text>
        {sendAsSelect}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            {t('workbench.editors.request.auth.presetLabel')}
          </Text>
          {presetInfo}
        </div>
        {presetSelect}
      </div>
    </div>
  );
};
