/**
 * The per-type auth form bodies every auth editor composes — the
 * request's Authorization tab (rail + pane) and the container's pool
 * entry pane (labeled rows) render the SAME fields for a type, so a
 * Bearer form reads identically wherever a bearer config is edited.
 * `seedAuthConfig` is the one seeding rule for a type switch — a fresh
 * empty config of the picked type.
 */

import { type AuthProtocolKind, authRefusalOf } from '@openheaders/core/auth-inheritance';
import {
  ASAP_ALGORITHMS,
  HTTP_SIGNATURE_ALGORITHMS,
  HTTP_SIGNATURE_DEFAULT_COMPONENTS,
  HTTP_SIGNATURE_DIGEST_ALGORITHMS,
  JWT_ALGORITHMS,
} from '@openheaders/core/auth-signing';
import { getCapability } from '@openheaders/core/capabilities';
import { findOAuth2Preset, OAUTH2_PROVIDER_PRESETS, usesDpop } from '@openheaders/core/oauth';
import type { ConcreteAuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Input, InputNumber, Select, Typography } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
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

/** A fresh, empty config of `type` — what a type switch seeds. The
 *  one seed the kind changes: an AWS signature rides a WebSocket
 *  handshake only as the signed URL, so it seeds in query mode there. */
export function seedAuthConfig(type: ConcreteAuthType, kind: AuthProtocolKind = 'http'): ConcreteAuthConfig {
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
      return {
        type: 'aws-sigv4',
        accessKeyId: '',
        secretAccessKey: '',
        service: '',
        region: '',
        ...(kind === 'websocket' ? { addTo: 'query' } : {}),
      };
    case 'edgegrid':
      return { type: 'edgegrid', clientToken: '', accessToken: '', clientSecret: '' };
    case 'asap':
      return { type: 'asap', algorithm: 'RS256', issuer: '', audience: '', keyId: '', privateKey: '' };
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
    case 'http-signature':
      return {
        type: 'http-signature',
        algorithm: 'rsa-pss-sha512',
        privateKey: '',
        secret: '',
        components: HTTP_SIGNATURE_DEFAULT_COMPONENTS,
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

/** A form whose placement select depends on the wire kind. */
type PlacedFormProps<T extends ConcreteAuthType> = FormProps<T> & { kind: AuthProtocolKind };

const PLACEMENTS = ['header', 'query'] as const;
type Placement = (typeof PLACEMENTS)[number];

/**
 * The Add-to / Send-as options a kind admits — a placement is offered
 * only when the config placed there can ride the kind
 * (`authRefusalOf`, the ONE predicate the greying and the executors'
 * refusals share): Query drops off a kind with no query leg (gRPC),
 * Header drops off the WebSocket SigV4 (the signed URL is the
 * credential). HTTP offers both; nothing is rewritten silently.
 */
function placementOptions(
  t: Translate,
  kind: AuthProtocolKind,
  placed: (placement: Placement) => ConcreteAuthConfig,
): { value: Placement; label: string }[] {
  const labelKey = (placement: Placement): MessageKey =>
    placement === 'header' ? 'workbench.editors.request.auth.addToHeader' : 'workbench.editors.request.auth.addToQuery';
  return PLACEMENTS.filter((placement) => authRefusalOf(kind, placed(placement)) === null).map((placement) => ({
    value: placement,
    label: t(labelKey(placement)),
  }));
}

/**
 * The fields of `auth`'s type. `none` renders nothing — the caller
 * owns that empty state (the tab's centered pane, the entry pane's
 * note). `kind` (default HTTP) shapes the placement selects — a
 * session editor passes its wire kind.
 */
export const AuthConfigFields: React.FC<{
  auth: ConcreteAuthConfig;
  onChange: (auth: ConcreteAuthConfig) => void;
  kind?: AuthProtocolKind;
}> = ({ auth, onChange, kind = 'http' }) => {
  switch (auth.type) {
    case 'none':
      return null;
    case 'basic':
      return <BasicEditor auth={auth} onChange={onChange} />;
    case 'bearer':
      return <BearerEditor auth={auth} onChange={onChange} />;
    case 'api-key':
      return <ApiKeyEditor auth={auth} onChange={onChange} kind={kind} />;
    case 'aws-sigv4':
      return <AwsSigV4Editor auth={auth} onChange={onChange} kind={kind} />;
    case 'edgegrid':
      return <EdgeGridEditor auth={auth} onChange={onChange} />;
    case 'asap':
      return <AsapEditor auth={auth} onChange={onChange} />;
    case 'digest':
      return <DigestEditor auth={auth} onChange={onChange} />;
    case 'oauth1':
      return <OAuth1Editor auth={auth} onChange={onChange} />;
    case 'hawk':
      return <HawkEditor auth={auth} onChange={onChange} />;
    case 'jwt':
      return <JwtEditor auth={auth} onChange={onChange} kind={kind} />;
    case 'http-signature':
      return <HttpSignatureEditor auth={auth} onChange={onChange} />;
    case 'oauth2':
      return <OAuth2AuthEditor auth={auth} onChange={onChange} kind={kind} />;
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
            data-testid="oh-auth-basic-username"
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.password')} info={info('basicPassword')}>
          <SecretField
            value={auth.password}
            onChange={(next) => onChange({ ...auth, password: next })}
            placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
            data-testid="oh-auth-basic-password"
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
            data-testid="oh-auth-bearer-token"
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

const ApiKeyEditor: React.FC<PlacedFormProps<'api-key'>> = ({ auth, onChange, kind }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const placements = placementOptions(t, kind, (placement) => ({ ...auth, in: placement }));
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
            onChange={(next: Placement) => onChange({ ...auth, in: next })}
            options={placements}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
    </AuthForm>
  );
};

// ── AWS Signature v4 editor ────────────────────────────────────────
//
// Credentials (the key pair + the STS session token) · Signing (the
// credential scope — service and region, each blank = derived from an
// AWS host at send time) · Delivery (header or query). The signature
// itself is derived at send time over the final wire shape. Emptied
// optional fields persist ABSENT (the Session Token pattern); the
// header delivery persists absent too.

const AwsSigV4Editor: React.FC<PlacedFormProps<'aws-sigv4'>> = ({ auth, onChange, kind }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const withPlacement = (placement: Placement): ConcreteAuthConfig =>
    placement === 'query' ? { ...auth, addTo: 'query' } : (({ addTo: _omit, ...rest }) => rest)(auth);
  const placements = placementOptions(t, kind, withPlacement);
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
      <FormGroup
        auth={auth}
        group="credentials"
        modified={isSet(auth.accessKeyId) || isSet(auth.secretAccessKey) || isSet(auth.sessionToken)}
      >
        <LabeledRow label={t('workbench.editors.request.auth.awsAccessKey')} info={info('awsAccessKey')}>
          <TemplateInput
            size="small"
            value={auth.accessKeyId}
            onChange={(next) => onChange({ ...auth, accessKeyId: next })}
            placeholder={t('workbench.editors.request.auth.awsAccessKeyPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.awsSecretKey')} info={info('awsSecretKey')}>
          <SecretField
            value={auth.secretAccessKey}
            onChange={(next) => onChange({ ...auth, secretAccessKey: next })}
            placeholder={t('workbench.editors.request.auth.awsSecretKeyPlaceholder')}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.awsSessionToken')} info={info('awsSessionToken')}>
          <SecretField
            value={auth.sessionToken ?? ''}
            onChange={setSessionToken}
            placeholder={t('workbench.editors.request.auth.awsSessionTokenPlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup auth={auth} group="signing" modified={isSet(auth.service) || isSet(auth.region)}>
        <LabeledRow label={t('workbench.editors.request.auth.awsService')} info={info('awsService')}>
          <TemplateInput
            size="small"
            value={auth.service}
            onChange={(next) => onChange({ ...auth, service: next })}
            placeholder={t('workbench.editors.request.auth.awsServicePlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.awsRegion')} info={info('awsRegion')}>
          <TemplateInput
            size="small"
            value={auth.region}
            onChange={(next) => onChange({ ...auth, region: next })}
            placeholder={t('workbench.editors.request.auth.awsRegionPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup auth={auth} group="delivery" modified={auth.addTo === 'query'}>
        <LabeledRow label={t('workbench.editors.request.auth.addTo')} info={info('awsAddTo')}>
          <Select
            size="small"
            data-testid="oh-auth-aws-add-to"
            value={auth.addTo ?? 'header'}
            onChange={(next: Placement) => onChange(withPlacement(next))}
            options={placements}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

// ── Akamai EdgeGrid editor ─────────────────────────────────────────
//
// Credentials (the two tokens that ride, the secret that signs) ·
// Signing (the header list an API names, the POST content-hash
// window). The timestamp and nonce are minted per send, so neither is
// configuration; emptied optional fields persist ABSENT (the Session
// Token pattern). Both runtimes sign — no host gating.

const EdgeGridEditor: React.FC<FormProps<'edgegrid'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const setHeadersToSign = (next: string) => {
    if (next.trim()) {
      onChange({ ...auth, headersToSign: next });
    } else {
      const { headersToSign: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  return (
    <AuthForm>
      <FormGroup
        auth={auth}
        group="credentials"
        modified={isSet(auth.clientToken) || isSet(auth.accessToken) || isSet(auth.clientSecret)}
      >
        <LabeledRow label={t('workbench.editors.request.auth.edgeGridClientToken')} info={info('edgeGridClientToken')}>
          <TemplateInput
            size="small"
            value={auth.clientToken}
            onChange={(next) => onChange({ ...auth, clientToken: next })}
            placeholder={t('workbench.editors.request.auth.edgeGridClientTokenPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.edgeGridAccessToken')} info={info('edgeGridAccessToken')}>
          <TemplateInput
            size="small"
            value={auth.accessToken}
            onChange={(next) => onChange({ ...auth, accessToken: next })}
            placeholder={t('workbench.editors.request.auth.edgeGridAccessTokenPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow
          label={t('workbench.editors.request.auth.edgeGridClientSecret')}
          info={info('edgeGridClientSecret')}
        >
          <SecretField
            value={auth.clientSecret}
            onChange={(next) => onChange({ ...auth, clientSecret: next })}
            placeholder={t('workbench.editors.request.auth.edgeGridClientSecretPlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup auth={auth} group="signing" modified={isSet(auth.headersToSign) || auth.maxBodySize !== undefined}>
        <LabeledRow
          label={t('workbench.editors.request.auth.edgeGridHeadersToSign')}
          info={info('edgeGridHeadersToSign')}
        >
          <TemplateInput
            size="small"
            value={auth.headersToSign ?? ''}
            onChange={setHeadersToSign}
            placeholder={t('workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.edgeGridMaxBodySize')} info={info('edgeGridMaxBodySize')}>
          <InputNumber
            size="small"
            data-testid="oh-auth-edgegrid-max-body"
            min={1}
            value={auth.maxBodySize}
            onChange={(next) => {
              if (typeof next === 'number') {
                onChange({ ...auth, maxBodySize: next });
              } else {
                const { maxBodySize: _omit, ...rest } = auth;
                onChange(rest);
              }
            }}
            placeholder={t('workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder')}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

// ── ASAP (Atlassian) editor ────────────────────────────────────────
//
// Signing (the asymmetric family, the kid, the private key) · Token
// (the issuer / audience / subject claims, Additional claims JSON that
// wins over them, the expiry). iat / exp and the per-send jti are
// minted at sign time. Emptied optional fields persist ABSENT. Both
// runtimes sign — no host gating.

const ASAP_ALGORITHM_OPTIONS = ASAP_ALGORITHMS.map((a) => ({ value: a, label: a }));

const AsapEditor: React.FC<FormProps<'asap'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const setOptional = (field: 'subject' | 'claims') => (next: string) => {
    if (next.trim()) {
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
        modified={auth.algorithm !== 'RS256' || isSet(auth.keyId) || isSet(auth.privateKey)}
      >
        <LabeledRow label={t('workbench.editors.request.auth.asapAlgorithm')} info={info('asapAlgorithm')}>
          <Select
            size="small"
            data-testid="oh-auth-asap-algorithm"
            value={auth.algorithm}
            onChange={(next: (typeof ASAP_ALGORITHMS)[number]) => onChange({ ...auth, algorithm: next })}
            options={ASAP_ALGORITHM_OPTIONS}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.asapKeyId')} info={info('asapKeyId')}>
          <TemplateInput
            size="small"
            value={auth.keyId}
            onChange={(next) => onChange({ ...auth, keyId: next })}
            placeholder={t('workbench.editors.request.auth.asapKeyIdPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.asapPrivateKey')} info={info('asapPrivateKey')}>
          <SecretField
            value={auth.privateKey}
            onChange={(next) => onChange({ ...auth, privateKey: next })}
            placeholder={t('workbench.editors.request.auth.asapPrivateKeyPlaceholder')}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup
        auth={auth}
        group="token"
        modified={
          isSet(auth.issuer) ||
          isSet(auth.audience) ||
          isSet(auth.subject) ||
          isSet(auth.claims) ||
          auth.expiresInSeconds !== undefined
        }
      >
        <LabeledRow label={t('workbench.editors.request.auth.asapIssuer')} info={info('asapIssuer')}>
          <TemplateInput
            size="small"
            value={auth.issuer}
            onChange={(next) => onChange({ ...auth, issuer: next })}
            placeholder={t('workbench.editors.request.auth.asapIssuerPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.asapAudience')} info={info('asapAudience')}>
          <TemplateInput
            size="small"
            value={auth.audience}
            onChange={(next) => onChange({ ...auth, audience: next })}
            placeholder={t('workbench.editors.request.auth.asapAudiencePlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.asapSubject')} info={info('asapSubject')}>
          <TemplateInput
            size="small"
            value={auth.subject ?? ''}
            onChange={setOptional('subject')}
            placeholder={t('workbench.editors.request.auth.asapSubjectPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.asapClaims')} info={info('asapClaims')}>
          <Input.TextArea
            size="small"
            data-testid="oh-auth-asap-claims"
            value={auth.claims ?? ''}
            onChange={(e) => setOptional('claims')(e.target.value)}
            placeholder={t('workbench.editors.request.auth.asapClaimsPlaceholder')}
            rows={3}
            style={jsonFieldStyle}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.asapExpiresIn')} info={info('asapExpiresIn')}>
          <InputNumber
            size="small"
            data-testid="oh-auth-asap-expires-in"
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
            placeholder={t('workbench.editors.request.auth.asapExpiresInPlaceholder')}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
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

// ── HTTP Message Signature editor ─────────────────────────────────
//
// Signing (algorithm, key id, the key per family) · Coverage (the
// covered components, the content digest) · Parameters (label,
// created, expires, nonce, the alg parameter, tag). The optional
// strings drop from the config when blanked; the flags drop when
// unchecked (`created` is the one flag that stores its OFF state —
// absent means on).

const HTTP_SIGNATURE_ALGORITHM_OPTIONS = HTTP_SIGNATURE_ALGORITHMS.map((a) => ({ value: a, label: a }));

const HttpSignatureEditor: React.FC<FormProps<'http-signature'>> = ({ auth, onChange }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const symmetric = auth.algorithm === 'hmac-sha256';
  const setOptional = (field: 'keyId' | 'label' | 'tag') => (next: string) => {
    if (next.trim()) {
      onChange({ ...auth, [field]: next });
    } else {
      const { [field]: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  const setFlag = (field: 'secretBase64' | 'nonce' | 'includeAlgorithm') => (checked: boolean) => {
    if (checked) {
      onChange({ ...auth, [field]: true });
    } else {
      const { [field]: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  const digestOptions = [
    { value: 'none', label: t('workbench.editors.request.auth.httpSigDigestNone') },
    ...HTTP_SIGNATURE_DIGEST_ALGORITHMS.map((a) => ({ value: a, label: a })),
  ];
  return (
    <AuthForm>
      <FormGroup
        auth={auth}
        group="signing"
        modified={
          auth.algorithm !== 'rsa-pss-sha512' || isSet(auth.keyId) || isSet(auth.privateKey) || isSet(auth.secret)
        }
      >
        <LabeledRow label={t('workbench.editors.request.auth.httpSigAlgorithm')} info={info('httpSigAlgorithm')}>
          <Select
            size="small"
            data-testid="oh-auth-http-signature-algorithm"
            value={auth.algorithm}
            onChange={(next: (typeof HTTP_SIGNATURE_ALGORITHMS)[number]) => onChange({ ...auth, algorithm: next })}
            options={HTTP_SIGNATURE_ALGORITHM_OPTIONS}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.auth.httpSigKeyId')} info={info('httpSigKeyId')}>
          <TemplateInput
            size="small"
            value={auth.keyId ?? ''}
            onChange={setOptional('keyId')}
            placeholder={t('workbench.editors.request.auth.httpSigKeyIdPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {symmetric ? (
          <>
            <LabeledRow label={t('workbench.editors.request.auth.httpSigSecret')} info={info('httpSigSecret')}>
              <SecretField
                value={auth.secret}
                onChange={(next) => onChange({ ...auth, secret: next })}
                placeholder={t('workbench.editors.request.auth.httpSigSecretPlaceholder')}
              />
            </LabeledRow>
            <AuthCheckboxRow
              label={t('workbench.editors.request.auth.httpSigSecretBase64')}
              checked={auth.secretBase64 === true}
              testId="oh-auth-http-signature-secret-base64"
              info={info('httpSigSecretBase64')}
              onChange={setFlag('secretBase64')}
            />
          </>
        ) : (
          <LabeledRow label={t('workbench.editors.request.auth.httpSigPrivateKey')} info={info('httpSigPrivateKey')}>
            <SecretField
              value={auth.privateKey}
              onChange={(next) => onChange({ ...auth, privateKey: next })}
              placeholder={t('workbench.editors.request.auth.httpSigPrivateKeyPlaceholder')}
            />
          </LabeledRow>
        )}
      </FormGroup>
      <FormGroup
        auth={auth}
        group="coverage"
        modified={auth.components !== HTTP_SIGNATURE_DEFAULT_COMPONENTS || auth.contentDigest !== undefined}
      >
        <LabeledRow label={t('workbench.editors.request.auth.httpSigComponents')} info={info('httpSigComponents')}>
          <TemplateInput
            size="small"
            data-testid="oh-auth-http-signature-components"
            value={auth.components}
            onChange={(next) => onChange({ ...auth, components: next })}
            placeholder={HTTP_SIGNATURE_DEFAULT_COMPONENTS}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <LabeledRow
          label={t('workbench.editors.request.auth.httpSigContentDigest')}
          info={info('httpSigContentDigest')}
        >
          <Select
            size="small"
            data-testid="oh-auth-http-signature-digest"
            value={auth.contentDigest ?? 'none'}
            onChange={(next: 'none' | (typeof HTTP_SIGNATURE_DIGEST_ALGORITHMS)[number]) => {
              if (next === 'none') {
                const { contentDigest: _omit, ...rest } = auth;
                onChange(rest);
              } else {
                onChange({ ...auth, contentDigest: next });
              }
            }}
            options={digestOptions}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <FormGroup
        auth={auth}
        group="parameters"
        modified={
          isSet(auth.label) ||
          auth.created === false ||
          auth.expiresInSeconds !== undefined ||
          auth.nonce === true ||
          auth.includeAlgorithm === true ||
          isSet(auth.tag)
        }
      >
        <LabeledRow label={t('workbench.editors.request.auth.httpSigLabel')} info={info('httpSigLabel')}>
          <TemplateInput
            size="small"
            value={auth.label ?? ''}
            onChange={setOptional('label')}
            placeholder={t('workbench.editors.request.auth.httpSigLabelPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <AuthCheckboxRow
          label={t('workbench.editors.request.auth.httpSigCreated')}
          checked={auth.created !== false}
          testId="oh-auth-http-signature-created"
          info={info('httpSigCreated')}
          onChange={(checked) => {
            if (checked) {
              const { created: _omit, ...rest } = auth;
              onChange(rest);
            } else {
              onChange({ ...auth, created: false });
            }
          }}
        />
        <LabeledRow label={t('workbench.editors.request.auth.httpSigExpiresIn')} info={info('httpSigExpiresIn')}>
          <InputNumber
            size="small"
            data-testid="oh-auth-http-signature-expires-in"
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
            placeholder={t('workbench.editors.request.auth.httpSigExpiresInPlaceholder')}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        <AuthCheckboxRow
          label={t('workbench.editors.request.auth.httpSigNonce')}
          checked={auth.nonce === true}
          testId="oh-auth-http-signature-nonce"
          info={info('httpSigNonce')}
          onChange={setFlag('nonce')}
        />
        <AuthCheckboxRow
          label={t('workbench.editors.request.auth.httpSigIncludeAlg')}
          checked={auth.includeAlgorithm === true}
          testId="oh-auth-http-signature-include-alg"
          info={info('httpSigIncludeAlg')}
          onChange={setFlag('includeAlgorithm')}
        />
        <LabeledRow label={t('workbench.editors.request.auth.httpSigTag')} info={info('httpSigTag')}>
          <TemplateInput
            size="small"
            value={auth.tag ?? ''}
            onChange={setOptional('tag')}
            placeholder={t('workbench.editors.request.auth.httpSigTagPlaceholder')}
            style={{ maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </FormGroup>
      <AuthFormNote>{t('workbench.editors.request.auth.authAutoGeneratedNote')}</AuthFormNote>
    </AuthForm>
  );
};

const jsonFieldStyle: React.CSSProperties = {
  maxWidth: FIELD_DEFAULT_MAX_WIDTH,
  fontFamily: 'monospace',
  fontSize: 12,
};

const JwtEditor: React.FC<PlacedFormProps<'jwt'>> = ({ auth, onChange, kind }) => {
  const t = useT();
  const info = (key: AuthInfoKey) => authRowInfo(t, auth, key);
  const symmetric = auth.algorithm.startsWith('HS');
  const placements = placementOptions(t, kind, (placement) => ({ ...auth, addTo: placement }));
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
            onChange={(next: Placement) => onChange({ ...auth, addTo: next })}
            options={placements}
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
// pool entry pane lays them as labeled rows under the type row. On a
// kind with no query leg (gRPC) the query option is not offered — the
// candidate is judged unbound, since a DPoP binding refuses either
// placement and is the Token binding row's own concern.

export const OAuth2RailControls: React.FC<{
  auth: Extract<ConcreteAuthConfig, { type: 'oauth2' }>;
  onChange: (auth: ConcreteAuthConfig) => void;
  layout: 'rail' | 'rows';
  kind?: AuthProtocolKind;
}> = ({ auth, onChange, layout, kind = 'http' }) => {
  const t = useT();
  const { tokenBinding: _binding, dpopAlgorithm: _algorithm, ...unbound } = auth;
  const sendAsOffered = new Set(
    placementOptions(t, kind, (placement) => ({ ...unbound, sendAs: placement })).map((o) => o.value),
  );
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
      data-testid="oh-auth-oauth2-send-as"
      value={auth.sendAs ?? 'header'}
      onChange={(next: 'header' | 'query') => onChange({ ...auth, sendAs: next })}
      options={[
        { value: 'header', label: t('workbench.editors.request.auth.sendAsHeaders') },
        // A DPoP-bound token rides the Authorization header only (RFC 9449 §7.1).
        ...(sendAsOffered.has('query')
          ? [{ value: 'query', label: t('workbench.editors.request.auth.sendAsUrl'), disabled: usesDpop(auth) }]
          : []),
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
