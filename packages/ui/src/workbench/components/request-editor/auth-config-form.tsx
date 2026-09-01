/**
 * The per-type auth form bodies every auth editor composes — the
 * request's Authorization tab (rail + pane) and the container's pool
 * entry pane (labeled rows) render the SAME fields for a type, so a
 * Bearer form reads identically wherever a bearer config is edited.
 * `seedAuthConfig` is the one seeding rule for a type switch — a fresh
 * empty config of the picked type.
 */

import { JWT_ALGORITHMS } from '@openheaders/core/auth-signing';
import { getCapability } from '@openheaders/core/capabilities';
import { findOAuth2Preset, OAUTH2_PROVIDER_PRESETS } from '@openheaders/core/oauth';
import type { ConcreteAuthConfig } from '@openheaders/core/types';
import { Input, InputNumber, Select, Typography } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import AuthFormGroup from './AuthFormGroup';
import {
  AUTH_FIELD_DEFAULT_MAX_WIDTH as FIELD_DEFAULT_MAX_WIDTH,
  AuthCheckboxRow,
  AuthForm,
  AuthFormNote,
  AuthLabeledRow as LabeledRow,
  AuthSecretField as SecretField,
} from './auth-layout';
import { type AuthInfoKey, authRowInfo } from './AuthRowInfo';
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
    case 'hawk':
      return { type: 'hawk', authId: '', authKey: '', algorithm: 'sha256' };
    case 'jwt':
      return { type: 'jwt', algorithm: 'HS256', secret: '', privateKey: '', payload: '', addTo: 'header' };
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
    case 'hawk':
      return <HawkEditor auth={auth} onChange={onChange} />;
    case 'jwt':
      return <JwtEditor auth={auth} onChange={onChange} />;
    case 'oauth2':
      return <OAuth2AuthEditor auth={auth} onChange={onChange} />;
    default: {
      const _exhaustive: never = auth;
      void _exhaustive;
      return null;
    }
  }
};

// ── Sectioned form pieces ──────────────────────────────────────────
//
// Every type's form is sections of labeled rows (the Settings tab's
// group idiom): a section header carries the group's (i) and a dot
// while folded over a set field; every row's (i) opens its slice of
// the type's example (AuthRowInfo). Delivery closes every form that
// has one; the auto-generated note closes the form itself.

const FormGroup = AuthFormGroup;

const isSet = (value: string | undefined): boolean => (value ?? '') !== '';

const BasicEditor: React.FC<FormProps<'basic'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  return (
    <AuthForm>
      <FormGroup auth={auth} group="credentials" modified={isSet(auth.username) || isSet(auth.password)}>
        <LabeledRow label={t('workbench.editors.request.auth.username')} info={info('basicUsername')}>
          <TemplateInput
            size="small"
            value={auth.username}
            onChange={(next) => onChange({ ...auth, username: next })}
            placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.password')} info={info('basicPassword')}>
          <SecretField
            value={auth.password}
            onChange={(next) => onChange({ ...auth, password: next })}
            placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

const BearerEditor: React.FC<FormProps<'bearer'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  return (
    <AuthForm>
      <FormGroup auth={auth} group="token" modified={isSet(auth.token)}>
        <LabeledRow label={t('workbench.editors.request.auth.token')} info={info('bearerToken')}>
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
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

const ApiKeyEditor: React.FC<FormProps<'api-key'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  return (
    <AuthForm>
      <FormGroup auth={auth} group="credentials" modified={isSet(auth.key) || isSet(auth.value)}>
        <LabeledRow label={t('workbench.editors.request.auth.key')} info={info('apiKeyKey')}>
          <TemplateInput
            size="small"
            value={auth.key}
            onChange={(next) => onChange({ ...auth, key: next })}
            placeholder={t('workbench.editors.request.auth.keyPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.value')} info={info('apiKeyValue')}>
          <SecretField
            value={auth.value}
            onChange={(next) => onChange({ ...auth, value: next })}
            placeholder={t('workbench.editors.request.auth.valuePlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup auth={auth} group="delivery" modified={auth.in !== 'header'}>
        <LabeledRow label={t('workbench.editors.request.auth.addTo')} info={info('apiKeyAddTo')}>
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
      </FormGroup>
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
// CLI/daemon) — there the Challenge section carries the retry opt-out;
// browser-runtime surfaces can't drive the second leg, so the form
// carries a note there instead and the target's 401 is the signal.

const DigestEditor: React.FC<FormProps<'digest'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const browserRuntime = (getCapability('requestRuntime')?.() ?? 'browser') === 'browser';
  return (
    <AuthForm>
      {browserRuntime && (
        <AuthFormNote>{t('workbench.editors.request.auth.digestBrowserNote')}</AuthFormNote>
      )}
      <FormGroup auth={auth} group="credentials" modified={isSet(auth.username) || isSet(auth.password)}>
        <LabeledRow label={t('workbench.editors.request.auth.username')} info={info('digestUsername')}>
          <TemplateInput
            size="small"
            value={auth.username}
            onChange={(next) => onChange({ ...auth, username: next })}
            placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.password')} info={info('digestPassword')}>
          <SecretField
            value={auth.password}
            onChange={(next) => onChange({ ...auth, password: next })}
            placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      {!browserRuntime && (
        <FormGroup auth={auth} group="challenge" modified={auth.disableRetry === true}>
          <AuthFormNote>{t('workbench.editors.request.auth.digestRetryNote')}</AuthFormNote>
          <AuthCheckboxRow
            label={t('workbench.editors.request.auth.digestDisableRetry')}
            checked={auth.disableRetry === true}
            testId="oh-auth-digest-disable-retry"
            info={info('digestDisableRetry')}
            onChange={(checked) =>
              onChange(checked ? { ...auth, disableRetry: true } : (({ disableRetry: _omit, ...rest }) => rest)(auth))
            }
          />
        </FormGroup>
      )}
      {!browserRuntime && (
        <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
      )}
    </AuthForm>
  );
};

// ── OAuth 1.0a editor ──────────────────────────────────────────────
//
// Method-first (the credential set follows the family): the HMAC and
// PLAINTEXT families take the consumer/token secret pairs; the RSA
// family signs with the PEM private key ALONE (§3.4.3), so the two
// secrets leave the form. The oauth_* protocol params (signature,
// nonce, timestamp) are derived at send time over the final wire
// shape; the body-hash opt-in covers non-form bodies (PLAINTEXT has
// no digest, so the checkbox hides). Emptied optional fields persist
// ABSENT (the Session Token pattern).

const OAUTH1_SIGNATURE_METHODS = [
  'HMAC-SHA1',
  'HMAC-SHA256',
  'HMAC-SHA512',
  'RSA-SHA1',
  'RSA-SHA256',
  'RSA-SHA512',
  'PLAINTEXT',
] as const;

const OAuth1Editor: React.FC<FormProps<'oauth1'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const rsa = auth.signatureMethod.startsWith('RSA');
  const setOptional = (field: 'token' | 'tokenSecret' | 'privateKey' | 'realm') => (next: string) => {
    if (next) {
      onChange({ ...auth, [field]: next });
    } else {
      const { [field]: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  return (
    <AuthForm>
      <FormGroup
        auth={auth}
        group="signing"
        modified={auth.signatureMethod !== 'HMAC-SHA1' || auth.includeBodyHash === true}
      >
        <LabeledRow
          label={t('workbench.editors.request.auth.oauth1SignatureMethod')}
          info={info('oauth1SignatureMethod')}
        >
          <Select
            size="small"
            data-testid="oh-auth-oauth1-signature-method"
            value={auth.signatureMethod}
            onChange={(next: (typeof OAUTH1_SIGNATURE_METHODS)[number]) => onChange({ ...auth, signatureMethod: next })}
            options={OAUTH1_SIGNATURE_METHODS.map((m) => ({ value: m, label: m }))}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {auth.signatureMethod !== 'PLAINTEXT' && (
          <AuthCheckboxRow
            label={t('workbench.editors.request.auth.oauth1IncludeBodyHash')}
            checked={auth.includeBodyHash === true}
            testId="oh-auth-oauth1-body-hash"
            info={info('oauth1BodyHash')}
            onChange={(checked) =>
              onChange(
                checked ? { ...auth, includeBodyHash: true } : (({ includeBodyHash: _omit, ...rest }) => rest)(auth),
              )
            }
          />
        )}
      </FormGroup>
      <FormGroup
        auth={auth}
        group="consumer"
        modified={isSet(auth.consumerKey) || isSet(auth.consumerSecret) || isSet(auth.privateKey)}
      >
        <LabeledRow label={t('workbench.editors.request.auth.oauth1ConsumerKey')} info={info('oauth1ConsumerKey')}>
          <TemplateInput
            size="small"
            value={auth.consumerKey}
            onChange={(next) => onChange({ ...auth, consumerKey: next })}
            placeholder={t('workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {rsa ? (
          <LabeledRow label={t('workbench.editors.request.auth.oauth1PrivateKey')} info={info('oauth1PrivateKey')}>
            <SecretField
              value={auth.privateKey ?? ''}
              onChange={setOptional('privateKey')}
              placeholder={t('workbench.editors.request.auth.oauth1PrivateKeyPlaceholder')}
            />
          </LabeledRow>
        ) : (
          <LabeledRow
            label={t('workbench.editors.request.auth.oauth1ConsumerSecret')}
            info={info('oauth1ConsumerSecret')}
          >
            <SecretField
              value={auth.consumerSecret}
              onChange={(next) => onChange({ ...auth, consumerSecret: next })}
              placeholder={t('workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder')}
            />
          </LabeledRow>
        )}
      </FormGroup>
      <FormGroup auth={auth} group="token" modified={isSet(auth.token) || isSet(auth.tokenSecret)}>
        <LabeledRow label={t('workbench.editors.request.auth.oauth1Token')} info={info('oauth1Token')}>
          <TemplateInput
            size="small"
            value={auth.token ?? ''}
            onChange={setOptional('token')}
            placeholder={t('workbench.editors.request.auth.oauth1TokenPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {!rsa && (
          <LabeledRow label={t('workbench.editors.request.auth.oauth1TokenSecret')} info={info('oauth1TokenSecret')}>
            <SecretField
              value={auth.tokenSecret ?? ''}
              onChange={setOptional('tokenSecret')}
              placeholder={t('workbench.editors.request.auth.oauth1TokenSecretPlaceholder')}
            />
          </LabeledRow>
        )}
      </FormGroup>
      <FormGroup auth={auth} group="delivery" modified={auth.paramsLocation !== 'header' || isSet(auth.realm)}>
        <LabeledRow label={t('workbench.editors.request.auth.addTo')} info={info('oauth1AddTo')}>
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
          <LabeledRow label={t('workbench.editors.request.auth.oauth1Realm')} info={info('oauth1Realm')}>
            <TemplateInput
              size="small"
              value={auth.realm ?? ''}
              onChange={setOptional('realm')}
              placeholder={t('workbench.editors.request.auth.oauth1RealmPlaceholder')}
              style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            />
          </LabeledRow>
        )}
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

// ── Hawk editor ────────────────────────────────────────────────────
//
// Credential + algorithm fields over the scheme's optional SIGNED
// attributes (ext / app / dlg fold into the MAC when present) and the
// payload-hash opt-in; the timestamp and nonce are minted per send, so
// neither is configuration. The optional attributes persist ABSENT
// when emptied (the Session Token pattern). Both runtimes sign — no
// host gating.

const HawkEditor: React.FC<FormProps<'hawk'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const setOptional = (field: 'ext' | 'app' | 'dlg') => (next: string) => {
    if (next) {
      onChange({ ...auth, [field]: next });
    } else {
      const { [field]: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  return (
    <AuthForm>
      <FormGroup auth={auth} group="credentials" modified={isSet(auth.authId) || isSet(auth.authKey)}>
        <LabeledRow label={t('workbench.editors.request.auth.hawkAuthId')} info={info('hawkAuthId')}>
          <TemplateInput
            size="small"
            value={auth.authId}
            onChange={(next) => onChange({ ...auth, authId: next })}
            placeholder={t('workbench.editors.request.auth.hawkAuthIdPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.hawkAuthKey')} info={info('hawkAuthKey')}>
          <SecretField
            value={auth.authKey}
            onChange={(next) => onChange({ ...auth, authKey: next })}
            placeholder={t('workbench.editors.request.auth.hawkAuthKeyPlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup auth={auth} group="signing" modified={auth.algorithm !== 'sha256' || auth.includePayloadHash === true}>
        <LabeledRow label={t('workbench.editors.request.auth.hawkAlgorithm')} info={info('hawkAlgorithm')}>
          <Select
            size="small"
            data-testid="oh-auth-hawk-algorithm"
            value={auth.algorithm}
            onChange={(next: 'sha256' | 'sha1') => onChange({ ...auth, algorithm: next })}
            options={[
              { value: 'sha256', label: 'SHA-256' },
              { value: 'sha1', label: 'SHA-1' },
            ]}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <AuthCheckboxRow
          label={t('workbench.editors.request.auth.hawkIncludePayloadHash')}
          checked={auth.includePayloadHash === true}
          testId="oh-auth-hawk-payload-hash"
          info={info('hawkPayloadHash')}
          onChange={(checked) =>
            onChange(
              checked
                ? { ...auth, includePayloadHash: true }
                : (({ includePayloadHash: _omit, ...rest }) => rest)(auth),
            )
          }
        />
      </FormGroup>
      <FormGroup auth={auth} group="attributes" modified={isSet(auth.ext) || isSet(auth.app) || isSet(auth.dlg)}>
        <LabeledRow label={t('workbench.editors.request.auth.hawkExt')} info={info('hawkExt')}>
          <TemplateInput
            size="small"
            value={auth.ext ?? ''}
            onChange={setOptional('ext')}
            placeholder={t('workbench.editors.request.auth.hawkExtPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.hawkApp')} info={info('hawkApp')}>
          <TemplateInput
            size="small"
            value={auth.app ?? ''}
            onChange={setOptional('app')}
            placeholder={t('workbench.editors.request.auth.hawkAppPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.hawkDlg')} info={info('hawkDlg')}>
          <TemplateInput
            size="small"
            value={auth.dlg ?? ''}
            onChange={setOptional('dlg')}
            placeholder={t('workbench.editors.request.auth.hawkDlgPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

// ── JWT Bearer editor ──────────────────────────────────────────────
//
// Mints and signs a fresh JWT per send. The key field follows the
// algorithm family — the HS secret (with its base64 opt-in) or the
// asymmetric PEM private key. Payload and extra headers are JSON text
// (templates resolve per send; `alg`/`typ` are auto-composed). The
// optional lifetime stamps `iat`/`exp` at sign time — payload-set
// claims win. Emptied optional fields persist ABSENT. Both runtimes
// sign — no host gating. Sections: Signing · Token · Delivery.

const JWT_ALGORITHM_OPTIONS = JWT_ALGORITHMS.map((a) => ({ value: a, label: a }));

const jsonFieldStyle: React.CSSProperties = {
  maxWidth: FIELD_DEFAULT_MAX_WIDTH,
  fontFamily: 'monospace',
  fontSize: 12,
};

const JwtEditor: React.FC<FormProps<'jwt'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const symmetric = auth.algorithm.startsWith('HS');
  const setHeaders = (next: string) => {
    if (next.trim()) {
      onChange({ ...auth, headers: next });
    } else {
      const { headers: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  const setHeaderPrefix = (next: string) => {
    // Absent means the Bearer default; an explicit empty string means
    // the bare token — typing the default back collapses to absent.
    if (next === 'Bearer') {
      const { headerPrefix: _omit, ...rest } = auth;
      onChange(rest);
    } else {
      onChange({ ...auth, headerPrefix: next });
    }
  };
  return (
    <AuthForm>
      <FormGroup
        auth={auth}
        group="signing"
        modified={
          auth.algorithm !== 'HS256' || isSet(auth.secret) || isSet(auth.privateKey) || auth.secretBase64 === true
        }
      >
        <LabeledRow label={t('workbench.editors.request.auth.jwtAlgorithm')} info={info('jwtAlgorithm')}>
          <Select
            size="small"
            data-testid="oh-auth-jwt-algorithm"
            value={auth.algorithm}
            onChange={(next: (typeof JWT_ALGORITHMS)[number]) => onChange({ ...auth, algorithm: next })}
            options={JWT_ALGORITHM_OPTIONS}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {symmetric ? (
          <>
            <LabeledRow label={t('workbench.editors.request.auth.jwtSecret')} info={info('jwtSecret')}>
              <SecretField
                value={auth.secret}
                onChange={(next) => onChange({ ...auth, secret: next })}
                placeholder={t('workbench.editors.request.auth.jwtSecretPlaceholder')}
              />
            </LabeledRow>
            <AuthCheckboxRow
              label={t('workbench.editors.request.auth.jwtSecretBase64')}
              checked={auth.secretBase64 === true}
              testId="oh-auth-jwt-secret-base64"
              info={info('jwtSecretBase64')}
              onChange={(checked) =>
                onChange(checked ? { ...auth, secretBase64: true } : (({ secretBase64: _omit, ...rest }) => rest)(auth))
              }
            />
          </>
        ) : (
          <LabeledRow label={t('workbench.editors.request.auth.jwtPrivateKey')} info={info('jwtPrivateKey')}>
            <SecretField
              value={auth.privateKey}
              onChange={(next) => onChange({ ...auth, privateKey: next })}
              placeholder={t('workbench.editors.request.auth.jwtPrivateKeyPlaceholder')}
            />
          </LabeledRow>
        )}
      </FormGroup>
      <FormGroup
        auth={auth}
        group="token"
        modified={auth.payload.trim() !== '' || isSet(auth.headers) || auth.expiresInSeconds !== undefined}
      >
        <LabeledRow label={t('workbench.editors.request.auth.jwtPayload')} info={info('jwtPayload')}>
          <Input.TextArea
            size="small"
            data-testid="oh-auth-jwt-payload"
            value={auth.payload}
            onChange={(e) => onChange({ ...auth, payload: e.target.value })}
            placeholder={t('workbench.editors.request.auth.jwtPayloadPlaceholder')}
            rows={4}
            style={jsonFieldStyle}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.jwtHeaders')} info={info('jwtHeaders')}>
          <Input.TextArea
            size="small"
            data-testid="oh-auth-jwt-headers"
            value={auth.headers ?? ''}
            onChange={(e) => setHeaders(e.target.value)}
            placeholder={t('workbench.editors.request.auth.jwtHeadersPlaceholder')}
            rows={2}
            style={jsonFieldStyle}
          />
        </LabeledRow>
        <AuthFormNote>{t('workbench.editors.request.auth.jwtHeadersNote')}</AuthFormNote>
        <LabeledRow label={t('workbench.editors.request.auth.jwtExpiresIn')} info={info('jwtExpiresIn')}>
          <InputNumber
            size="small"
            data-testid="oh-auth-jwt-expires-in"
            min={1}
            value={auth.expiresInSeconds}
            onChange={(next) => {
              if (typeof next === 'number') {
                onChange({ ...auth, expiresInSeconds: next });
              } else {
                const { expiresInSeconds: _omit, ...rest } = auth;
                onChange(rest);
              }
            }}
            placeholder={t('workbench.editors.request.auth.jwtExpiresInPlaceholder')}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <AuthFormNote>{t('workbench.editors.request.auth.jwtExpiresInNote')}</AuthFormNote>
      </FormGroup>
      <FormGroup auth={auth} group="delivery" modified={auth.addTo !== 'header' || auth.headerPrefix !== undefined}>
        <LabeledRow label={t('workbench.editors.request.auth.jwtAddTo')} info={info('jwtAddTo')}>
          <Select
            size="small"
            data-testid="oh-auth-jwt-add-to"
            value={auth.addTo}
            onChange={(next: 'header' | 'query') => onChange({ ...auth, addTo: next })}
            options={[
              { value: 'header', label: t('workbench.editors.request.auth.addToHeader') },
              { value: 'query', label: t('workbench.editors.request.auth.addToQuery') },
            ]}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {auth.addTo === 'header' && (
          <LabeledRow label={t('workbench.editors.request.auth.jwtHeaderPrefix')} info={info('jwtHeaderPrefix')}>
            <TemplateInput
              size="small"
              value={auth.headerPrefix ?? 'Bearer'}
              onChange={setHeaderPrefix}
              placeholder="Bearer"
              style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            />
          </LabeledRow>
        )}
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
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
  // Both rows open their slice of the OAuth 2.0 card: where the token
  // lands on the send, and the two endpoints a preset fills.
  const sendAsInfo = authRowInfo(t, auth, 'oauth2SendAs');
  const presetInfo = authRowInfo(t, auth, 'oauth2Preset');

  if (layout === 'rows') {
    return (
      <>
        <LabeledRow label={t('workbench.editors.request.auth.sendAsLabel')} info={sendAsInfo}>
          {sendAsSelect}
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.presetLabel')} info={presetInfo}>
          {presetSelect}
        </LabeledRow>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Text strong style={{ fontSize: 12 }}>
            {t('workbench.editors.request.auth.sendAsLabel')}
          </Text>
          <InfoTrigger content={sendAsInfo} />
        </div>
        {sendAsSelect}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Text strong style={{ fontSize: 12 }}>
            {t('workbench.editors.request.auth.presetLabel')}
          </Text>
          <InfoTrigger content={presetInfo} />
        </div>
        {presetSelect}
      </div>
    </div>
  );
};
