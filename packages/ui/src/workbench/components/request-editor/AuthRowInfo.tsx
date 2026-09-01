/**
 * `(i)` info-popover content for the auth forms — the Settings tab's
 * `SettingsRowInfo` idiom brought to the credential rows: kicker,
 * title, the type's example card with the popover's slice lit, then
 * the popover's own copy. The example is the wire shape OUR signer
 * emits for the type on the Settings card's send — the header (or the
 * query string) token by token in the signer's own attribute order —
 * so a field popover answers "where does this land": the Consumer
 * Secret lights `oauth_signature`, the Digest password lights
 * `response=` (it never rides), the Hawk `ext` lights its attribute.
 *
 * Three levels mirror the form: the Auth Type (i) lights the header's
 * scheme, a group header lights the union of its rows, a row lights
 * its token(s). Values are fictional placeholders, never the user's
 * (the auth-preview law). The card follows the config's discriminators
 * (header vs query, the signature / algorithm family, the digest
 * runtime) since those change the SHAPE; an optional token (`realm`,
 * `oauth_token`, `ext`, `kid`, `exp`, …) shows when its field is set
 * OR when the popover belongs to that row or its group, so an
 * unchecked opt-in still shows what it would add. Card tokens ride raw
 * (wire vocabulary); only the caption is localized.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { ConcreteAuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type ExampleCardToken,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { AUTH_GROUP_LABEL_KEY, type AuthGroupKey, type GroupedAuthType } from './auth-groups';
import { authTypeLabelKey } from './auth-type-labels';
import { getGrantType } from './oauth2-grant-types';

/** One key per auth-form row that opens a popover with the card. */
export type AuthInfoKey =
  | 'basicUsername'
  | 'basicPassword'
  | 'bearerToken'
  | 'apiKeyKey'
  | 'apiKeyValue'
  | 'apiKeyAddTo'
  | 'digestUsername'
  | 'digestPassword'
  | 'digestDisableRetry'
  | 'oauth1SignatureMethod'
  | 'oauth1BodyHash'
  | 'oauth1ConsumerKey'
  | 'oauth1ConsumerSecret'
  | 'oauth1PrivateKey'
  | 'oauth1Token'
  | 'oauth1TokenSecret'
  | 'oauth1AddTo'
  | 'oauth1Realm'
  | 'hawkAuthId'
  | 'hawkAuthKey'
  | 'hawkAlgorithm'
  | 'hawkPayloadHash'
  | 'hawkExt'
  | 'hawkApp'
  | 'hawkDlg'
  | 'jwtAlgorithm'
  | 'jwtSecret'
  | 'jwtSecretBase64'
  | 'jwtPrivateKey'
  | 'jwtPayload'
  | 'jwtHeaders'
  | 'jwtExpiresIn'
  | 'jwtAddTo'
  | 'jwtHeaderPrefix'
  | 'oauth2Token'
  | 'oauth2HeaderPrefix'
  | 'oauth2AutoRefresh'
  | 'oauth2Status'
  | 'oauth2TokenName'
  | 'oauth2GrantType'
  | 'oauth2CallbackUrl'
  | 'oauth2AuthUrl'
  | 'oauth2AccessTokenUrl'
  | 'oauth2Username'
  | 'oauth2Password'
  | 'oauth2ClientId'
  | 'oauth2ClientSecret'
  | 'oauth2CodeChallengeMethod'
  | 'oauth2CodeVerifier'
  | 'oauth2Scope'
  | 'oauth2State'
  | 'oauth2ClientAuthentication'
  | 'oauth2RefreshTokenUrl'
  | 'oauth2AuthRequest'
  | 'oauth2TokenRequest'
  | 'oauth2RefreshRequest'
  | 'oauth2SendAs'
  | 'oauth2Preset';

type AuthTokenId =
  | 'url'
  | 'none'
  | 'location'
  | 'user'
  | 'pass'
  | 'encoded'
  | 'token'
  | 'key'
  | 'value'
  | 'query'
  | 'challenge'
  | 'retry'
  | 'username'
  | 'password'
  | 'realm'
  | 'nonce'
  | 'uri'
  | 'response'
  | 'algorithm'
  | 'qop'
  | 'nc'
  | 'cnonce'
  | 'consumerKey'
  | 'signatureMethod'
  | 'timestamp'
  | 'version'
  | 'oauthToken'
  | 'bodyHash'
  | 'signature'
  | 'id'
  | 'ts'
  | 'hash'
  | 'ext'
  | 'mac'
  | 'app'
  | 'dlg'
  | 'prefix'
  | 'alg'
  | 'typ'
  | 'kid'
  | 'claims'
  | 'iat'
  | 'exp'
  | 'sig'
  | 'authorize'
  | 'clientId'
  | 'callback'
  | 'scope'
  | 'state'
  | 'pkce'
  | 'authParams'
  | 'tokenEndpoint'
  | 'grantType'
  | 'code'
  | 'verifier'
  | 'clientSecret'
  | 'clientAuth'
  | 'tokenParams'
  | 'refreshEndpoint'
  | 'refresh'
  | 'refreshToken'
  | 'refreshParams';

type Token = ExampleCardToken<AuthTokenId>;
type Line = ExampleCardLine<AuthTokenId>;

/** The same send the Settings card illustrates, so the editor's
 *  popovers tell one story. */
const URL = 'https://api.openheaders.com/v1/users';
const IDP = 'https://idp.openheaders.com';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huLmRvZSJ9.SflKxw…';
/** The Hawk scheme's published vectors — memorable, and byte-exact
 *  against our signer's pins. */
const HAWK_TS = '1353832234';
const HAWK_NONCE = 'j4h3g2';

const tok = (id: AuthTokenId, text: string): Token => ({ id, text });

const requestLine = (extra: readonly Token[] = []): Line => ({ opener: 'POST', tokens: [tok('url', URL), ...extra] });

/**
 * The type's wire shape. `forced` names the rows whose optional
 * tokens show even while their fields are empty (the popover's own
 * row, or every row of its group).
 */
function exampleLines(auth: ConcreteAuthConfig, forced: ReadonlySet<AuthInfoKey>, browserRuntime: boolean): Line[] {
  switch (auth.type) {
    case 'none':
      return [requestLine([tok('none', 'no Authorization header')])];
    case 'basic':
      return [
        requestLine(),
        {
          opener: tok('location', 'Authorization: Basic'),
          tokens: [
            tok('user', 'user: john.doe'),
            tok('pass', 'password: s3cret'),
            tok('encoded', 'base64 → am9obi5kb2U6czNjcmV0'),
          ],
        },
      ];
    case 'bearer':
      return [requestLine(), { opener: tok('location', 'Authorization: Bearer'), tokens: [tok('token', JWT)] }];
    case 'api-key':
      return auth.in === 'query'
        ? [requestLine(), { opener: tok('location', 'query:'), tokens: [tok('query', 'X-API-Key=8f3a91c2d4e6')] }]
        : [requestLine(), { opener: tok('key', 'X-API-Key:'), tokens: [tok('value', '8f3a91c2d4e6')] }];
    case 'digest': {
      // The challenge leg runs on node runtimes; a browser send goes
      // out unanswered and the card says so. The answering header is
      // the shape either way — it is what the desktop / CLI leg sends.
      const challenge = browserRuntime
        ? '→ 401 Digest realm="api", nonce="c3f1a2" (not answered on this surface)'
        : '→ 401 Digest realm="api", nonce="c3f1a2", qop="auth"';
      return [
        requestLine([tok('challenge', challenge), ...(browserRuntime ? [] : [tok('retry', '↻ retried with:')])]),
        {
          opener: tok('location', 'Authorization: Digest'),
          tokens: [
            tok('username', 'username="john.doe"'),
            tok('realm', 'realm="api"'),
            tok('nonce', 'nonce="c3f1a2"'),
            tok('uri', 'uri="/v1/users"'),
            tok('response', 'response="a7e0f5c1…"'),
            tok('algorithm', 'algorithm=MD5'),
            tok('qop', 'qop=auth'),
            tok('nc', 'nc=00000001'),
            tok('cnonce', 'cnonce="9b2d"'),
          ],
        },
      ];
    }
    case 'oauth1': {
      const query = auth.paramsLocation === 'query';
      // §3.5.1 quoted attributes in the header; bare pairs on the URL.
      const attr = (key: string, value: string): string => (query ? `${key}=${value}` : `${key}="${value}"`);
      const showRealm = !query && ((auth.realm ?? '') !== '' || forced.has('oauth1Realm'));
      const showToken = (auth.token ?? '') !== '' || forced.has('oauth1Token') || forced.has('oauth1TokenSecret');
      const showBodyHash =
        auth.signatureMethod !== 'PLAINTEXT' && (auth.includeBodyHash === true || forced.has('oauth1BodyHash'));
      return [
        requestLine(),
        {
          opener: tok('location', query ? 'query:' : 'Authorization: OAuth'),
          tokens: [
            ...(showRealm ? [tok('realm', attr('realm', 'api'))] : []),
            tok('consumerKey', attr('oauth_consumer_key', 'ck_9f3a')),
            tok('nonce', attr('oauth_nonce', HAWK_NONCE)),
            tok('signatureMethod', attr('oauth_signature_method', auth.signatureMethod)),
            tok('timestamp', attr('oauth_timestamp', HAWK_TS)),
            tok('version', attr('oauth_version', '1.0')),
            ...(showToken ? [tok('oauthToken', attr('oauth_token', 'at_71b0'))] : []),
            ...(showBodyHash ? [tok('bodyHash', attr('oauth_body_hash', '2jmj7l5rSw0yVb…'))] : []),
            tok('signature', attr('oauth_signature', 'tR3+Ty81lMeYAr…')),
          ],
        },
      ];
    }
    case 'hawk': {
      const showHash = auth.includePayloadHash === true || forced.has('hawkPayloadHash');
      const showExt = (auth.ext ?? '') !== '' || forced.has('hawkExt');
      // The signer nests dlg under app — no app, no dlg.
      const showApp = (auth.app ?? '') !== '' || forced.has('hawkApp') || forced.has('hawkDlg');
      const showDlg = showApp && ((auth.dlg ?? '') !== '' || forced.has('hawkDlg'));
      return [
        requestLine(),
        {
          opener: tok('location', 'Authorization: Hawk'),
          tokens: [
            tok('id', 'id="dh37fgj492je"'),
            tok('ts', `ts="${HAWK_TS}"`),
            tok('nonce', `nonce="${HAWK_NONCE}"`),
            ...(showHash ? [tok('hash', 'hash="Yi9LfIIFRtBEPt74…"')] : []),
            ...(showExt ? [tok('ext', 'ext="some-app-ext-data"')] : []),
            tok('mac', 'mac="aSe1DERmZuRl3pI3…"'),
            ...(showApp ? [tok('app', 'app="app_3c1f"')] : []),
            ...(showDlg ? [tok('dlg', 'dlg="dlg_8e2a"')] : []),
          ],
        },
      ];
    }
    case 'jwt': {
      const query = auth.addTo === 'query';
      const prefix = auth.headerPrefix ?? 'Bearer';
      const showKid = (auth.headers ?? '').trim() !== '' || forced.has('jwtHeaders');
      const showLifetime = auth.expiresInSeconds !== undefined || forced.has('jwtExpiresIn');
      // An emptied prefix sends the bare token — its own popover still
      // shows the slot it cleared.
      const prefixTokens =
        prefix !== '' ? [tok('prefix', prefix)] : forced.has('jwtHeaderPrefix') ? [tok('prefix', '(no prefix)')] : [];
      const delivery: Line = query
        ? { opener: tok('location', 'query:'), tokens: [tok('token', `token=${JWT}`)] }
        : { opener: tok('location', 'Authorization:'), tokens: [...prefixTokens, tok('token', JWT)] };
      return [
        requestLine(),
        delivery,
        {
          opener: 'JWT',
          tokens: [
            tok('alg', `alg: ${auth.algorithm}`),
            tok('typ', 'typ: JWT'),
            ...(showKid ? [tok('kid', 'kid: k1')] : []),
            tok('claims', 'payload: {"sub":"john.doe"}'),
            ...(showLifetime ? [tok('iat', `iat: ${HAWK_TS}`), tok('exp', 'exp: 1353832834')] : []),
            tok('sig', auth.algorithm.startsWith('HS') ? 'signature ← secret' : 'signature ← private key'),
          ],
        },
      ];
    }
    case 'oauth2': {
      // Four legs: the authorize redirect (code grants), the token
      // exchange, the send carrying the access token, the refresh.
      const grant = getGrantType(auth);
      const query = auth.sendAs === 'query';
      const basicClientAuth = auth.clientAuthentication === 'basic-header';
      const showAuthParams = (auth.extraAuthParams?.length ?? 0) > 0 || forced.has('oauth2AuthRequest');
      const showTokenParams = (auth.extraTokenParams?.length ?? 0) > 0 || forced.has('oauth2TokenRequest');
      const showRefreshParams = (auth.extraRefreshParams?.length ?? 0) > 0 || forced.has('oauth2RefreshRequest');
      const clientId = tok('clientId', 'client_id=ck_9f3a');
      const lines: Line[] = [];
      if (grant.fields.authUrl) {
        lines.push({
          opener: tok('authorize', `GET ${IDP}/authorize`),
          tokens: [
            clientId,
            ...(grant.fields.callbackUrl ? [tok('callback', 'redirect_uri=…/oauth/callback')] : []),
            tok('scope', 'scope=openid profile'),
            tok('state', 'state=x9f2'),
            ...(grant.fields.pkce ? [tok('pkce', 'code_challenge=E9Melhoa… (S256)')] : []),
            ...(showAuthParams ? [tok('authParams', 'audience=api')] : []),
          ],
        });
      }
      lines.push({
        opener: tok('tokenEndpoint', `POST ${IDP}/token`),
        tokens: [
          tok('grantType', `grant_type=${grant.wire}`),
          ...(grant.fields.authUrl ? [tok('code', 'code=SplxlOBe…')] : []),
          ...(grant.fields.pkce ? [tok('verifier', 'code_verifier=dBjftJeZ…')] : []),
          ...(grant.fields.resourceOwner
            ? [tok('username', 'username=john.doe'), tok('password', 'password=s3cret')]
            : []),
          ...(basicClientAuth
            ? [tok('clientAuth', 'Authorization: Basic base64(ck_9f3a:cs_71b0)')]
            : [clientId, tok('clientSecret', 'client_secret=cs_71b0')]),
          ...(showTokenParams ? [tok('tokenParams', 'audience=api')] : []),
        ],
      });
      lines.push(
        requestLine(),
        query
          ? { opener: tok('location', 'query:'), tokens: [tok('token', `access_token=${JWT}`)] }
          : {
              opener: tok('location', 'Authorization:'),
              tokens: [tok('prefix', auth.headerPrefix?.trim() || 'Bearer'), tok('token', JWT)],
            },
        {
          opener: tok('refreshEndpoint', `POST ${IDP}${auth.refreshEndpoint ? '/refresh' : '/token'}`),
          tokens: [
            tok('refresh', 'grant_type=refresh_token'),
            tok('refreshToken', 'refresh_token=rt_8e2a'),
            ...(showRefreshParams ? [tok('refreshParams', 'audience=api')] : []),
          ],
        },
      );
      return lines;
    }
    case 'aws-sigv4':
      return [];
  }
}

function AuthExampleCard({
  auth,
  lit,
  forced,
}: {
  auth: ConcreteAuthConfig;
  lit: ReadonlySet<AuthTokenId>;
  forced: ReadonlySet<AuthInfoKey>;
}) {
  const t = useT();
  const browserRuntime = (getCapability('requestRuntime')?.() ?? 'browser') === 'browser';
  return (
    <ExampleCard
      caption={t('workbench.editors.request.settings.exampleCaption')}
      lines={exampleLines(auth, forced, browserRuntime)}
      lit={lit}
    />
  );
}

/** Which token(s) of the shape each row lights. The secret rows light
 *  the signature they derive — a secret never rides itself. */
const ROW_TOKENS: Record<AuthInfoKey, readonly AuthTokenId[]> = {
  basicUsername: ['user'],
  basicPassword: ['pass'],
  bearerToken: ['token'],
  apiKeyKey: ['key'],
  apiKeyValue: ['value'],
  apiKeyAddTo: ['key', 'value'],
  digestUsername: ['username'],
  digestPassword: ['response'],
  digestDisableRetry: ['challenge', 'retry'],
  oauth1SignatureMethod: ['signatureMethod'],
  oauth1BodyHash: ['bodyHash'],
  oauth1ConsumerKey: ['consumerKey'],
  oauth1ConsumerSecret: ['signature'],
  oauth1PrivateKey: ['signature'],
  oauth1Token: ['oauthToken'],
  oauth1TokenSecret: ['signature'],
  oauth1AddTo: ['location'],
  oauth1Realm: ['realm'],
  hawkAuthId: ['id'],
  hawkAuthKey: ['mac'],
  hawkAlgorithm: ['mac'],
  hawkPayloadHash: ['hash'],
  hawkExt: ['ext'],
  hawkApp: ['app'],
  hawkDlg: ['dlg'],
  jwtAlgorithm: ['alg'],
  jwtSecret: ['sig'],
  jwtSecretBase64: ['sig'],
  jwtPrivateKey: ['sig'],
  jwtPayload: ['claims'],
  jwtHeaders: ['kid'],
  jwtExpiresIn: ['iat', 'exp'],
  jwtAddTo: ['location'],
  jwtHeaderPrefix: ['prefix'],
  oauth2Token: ['token'],
  oauth2HeaderPrefix: ['prefix'],
  oauth2AutoRefresh: ['refresh', 'refreshToken'],
  oauth2Status: ['token', 'refresh'],
  oauth2TokenName: [],
  oauth2GrantType: ['grantType'],
  oauth2CallbackUrl: ['callback'],
  oauth2AuthUrl: ['authorize'],
  oauth2AccessTokenUrl: ['tokenEndpoint'],
  oauth2Username: ['username'],
  oauth2Password: ['password'],
  oauth2ClientId: ['clientId'],
  oauth2ClientSecret: ['clientSecret'],
  oauth2CodeChallengeMethod: ['pkce'],
  oauth2CodeVerifier: ['verifier'],
  oauth2Scope: ['scope'],
  oauth2State: ['state'],
  oauth2ClientAuthentication: ['clientId', 'clientSecret'],
  oauth2RefreshTokenUrl: ['refreshEndpoint'],
  oauth2AuthRequest: ['authParams'],
  oauth2TokenRequest: ['tokenParams'],
  oauth2RefreshRequest: ['refreshParams'],
  oauth2SendAs: ['location', 'prefix'],
  oauth2Preset: ['authorize', 'tokenEndpoint'],
};

/** Shape-aware: an API key on the URL is one `key=value` token; the
 *  OAuth 2.0 client secret rides the token body or the Basic header;
 *  a query-delivered access token has no prefix. */
function rowTokens(key: AuthInfoKey, auth: ConcreteAuthConfig): readonly AuthTokenId[] {
  if (auth.type === 'api-key' && auth.in === 'query') {
    if (key === 'apiKeyAddTo') return ['location', 'query'];
    if (key === 'apiKeyKey' || key === 'apiKeyValue') return ['query'];
  }
  if (auth.type === 'oauth2') {
    if (auth.clientAuthentication === 'basic-header') {
      if (key === 'oauth2ClientAuthentication' || key === 'oauth2ClientSecret') return ['clientAuth'];
      if (key === 'oauth2ClientId') return ['clientId', 'clientAuth'];
    }
    if (auth.sendAs === 'query' && key === 'oauth2SendAs') return ['location', 'token'];
  }
  return ROW_TOKENS[key];
}

type CardType = GroupedAuthType;

/** The configs whose forms are sectioned with a card. */
export type CardAuthConfig = Extract<ConcreteAuthConfig, { type: CardType }>;

/** Each type's rows by group — the one membership record the group
 *  popovers (union of rows) and the row kickers read. */
const GROUP_ROWS: Record<CardType, Partial<Record<AuthGroupKey, readonly AuthInfoKey[]>>> = {
  basic: { credentials: ['basicUsername', 'basicPassword'] },
  bearer: { token: ['bearerToken'] },
  'api-key': { credentials: ['apiKeyKey', 'apiKeyValue'], delivery: ['apiKeyAddTo'] },
  digest: { credentials: ['digestUsername', 'digestPassword'], challenge: ['digestDisableRetry'] },
  oauth1: {
    signing: ['oauth1SignatureMethod', 'oauth1BodyHash'],
    consumer: ['oauth1ConsumerKey', 'oauth1ConsumerSecret', 'oauth1PrivateKey'],
    token: ['oauth1Token', 'oauth1TokenSecret'],
    delivery: ['oauth1AddTo', 'oauth1Realm'],
  },
  hawk: {
    credentials: ['hawkAuthId', 'hawkAuthKey'],
    signing: ['hawkAlgorithm', 'hawkPayloadHash'],
    attributes: ['hawkExt', 'hawkApp', 'hawkDlg'],
  },
  jwt: {
    signing: ['jwtAlgorithm', 'jwtSecret', 'jwtSecretBase64', 'jwtPrivateKey'],
    token: ['jwtPayload', 'jwtHeaders', 'jwtExpiresIn'],
    delivery: ['jwtAddTo', 'jwtHeaderPrefix'],
  },
  // The rail's Add-to and Preset rows sit outside the sections.
  oauth2: {
    token: ['oauth2Token', 'oauth2HeaderPrefix', 'oauth2AutoRefresh', 'oauth2Status'],
    grant: [
      'oauth2TokenName',
      'oauth2GrantType',
      'oauth2CallbackUrl',
      'oauth2AuthUrl',
      'oauth2AccessTokenUrl',
      'oauth2Username',
      'oauth2Password',
      'oauth2ClientId',
      'oauth2ClientSecret',
      'oauth2CodeChallengeMethod',
      'oauth2CodeVerifier',
      'oauth2Scope',
      'oauth2State',
      'oauth2ClientAuthentication',
    ],
    advanced: ['oauth2RefreshTokenUrl', 'oauth2AuthRequest', 'oauth2TokenRequest', 'oauth2RefreshRequest'],
  },
};

const GROUP_OF = new Map<AuthInfoKey, AuthGroupKey>();
for (const groups of Object.values(GROUP_ROWS)) {
  for (const [group, rows] of Object.entries(groups) as Array<[AuthGroupKey, readonly AuthInfoKey[]]>) {
    for (const row of rows) GROUP_OF.set(row, group);
  }
}

const ROW_TITLE_KEY: Record<AuthInfoKey, MessageKey> = {
  basicUsername: 'workbench.editors.request.auth.username',
  basicPassword: 'workbench.editors.request.auth.password',
  bearerToken: 'workbench.editors.request.auth.token',
  apiKeyKey: 'workbench.editors.request.auth.key',
  apiKeyValue: 'workbench.editors.request.auth.value',
  apiKeyAddTo: 'workbench.editors.request.auth.addTo',
  digestUsername: 'workbench.editors.request.auth.username',
  digestPassword: 'workbench.editors.request.auth.password',
  digestDisableRetry: 'workbench.editors.request.auth.digestDisableRetry',
  oauth1SignatureMethod: 'workbench.editors.request.auth.oauth1SignatureMethod',
  oauth1BodyHash: 'workbench.editors.request.auth.oauth1IncludeBodyHash',
  oauth1ConsumerKey: 'workbench.editors.request.auth.oauth1ConsumerKey',
  oauth1ConsumerSecret: 'workbench.editors.request.auth.oauth1ConsumerSecret',
  oauth1PrivateKey: 'workbench.editors.request.auth.oauth1PrivateKey',
  oauth1Token: 'workbench.editors.request.auth.oauth1Token',
  oauth1TokenSecret: 'workbench.editors.request.auth.oauth1TokenSecret',
  oauth1AddTo: 'workbench.editors.request.auth.addTo',
  oauth1Realm: 'workbench.editors.request.auth.oauth1Realm',
  hawkAuthId: 'workbench.editors.request.auth.hawkAuthId',
  hawkAuthKey: 'workbench.editors.request.auth.hawkAuthKey',
  hawkAlgorithm: 'workbench.editors.request.auth.hawkAlgorithm',
  hawkPayloadHash: 'workbench.editors.request.auth.hawkIncludePayloadHash',
  hawkExt: 'workbench.editors.request.auth.hawkExt',
  hawkApp: 'workbench.editors.request.auth.hawkApp',
  hawkDlg: 'workbench.editors.request.auth.hawkDlg',
  jwtAlgorithm: 'workbench.editors.request.auth.jwtAlgorithm',
  jwtSecret: 'workbench.editors.request.auth.jwtSecret',
  jwtSecretBase64: 'workbench.editors.request.auth.jwtSecretBase64',
  jwtPrivateKey: 'workbench.editors.request.auth.jwtPrivateKey',
  jwtPayload: 'workbench.editors.request.auth.jwtPayload',
  jwtHeaders: 'workbench.editors.request.auth.jwtHeaders',
  jwtExpiresIn: 'workbench.editors.request.auth.jwtExpiresIn',
  jwtAddTo: 'workbench.editors.request.auth.jwtAddTo',
  jwtHeaderPrefix: 'workbench.editors.request.auth.jwtHeaderPrefix',
  oauth2Token: 'workbench.editors.request.oauth.tokenLabel',
  oauth2HeaderPrefix: 'workbench.editors.request.oauth.headerPrefix',
  oauth2AutoRefresh: 'workbench.editors.request.oauth.autoRefresh',
  oauth2Status: 'workbench.editors.request.oauth.status',
  oauth2TokenName: 'workbench.editors.request.oauth.tokenName',
  oauth2GrantType: 'workbench.editors.request.oauth.grantType',
  oauth2CallbackUrl: 'workbench.editors.request.oauth.callbackUrl',
  oauth2AuthUrl: 'workbench.editors.request.oauth.authUrl',
  oauth2AccessTokenUrl: 'workbench.editors.request.oauth.accessTokenUrl',
  oauth2Username: 'workbench.editors.request.auth.username',
  oauth2Password: 'workbench.editors.request.auth.password',
  oauth2ClientId: 'workbench.editors.request.oauth.clientId',
  oauth2ClientSecret: 'workbench.editors.request.oauth.clientSecret',
  oauth2CodeChallengeMethod: 'workbench.editors.request.oauth.codeChallengeMethod',
  oauth2CodeVerifier: 'workbench.editors.request.oauth.codeVerifier',
  oauth2Scope: 'workbench.editors.request.oauth.scope',
  oauth2State: 'workbench.editors.request.oauth.state',
  oauth2ClientAuthentication: 'workbench.editors.request.oauth.clientAuthentication',
  oauth2RefreshTokenUrl: 'workbench.editors.request.oauth.refreshTokenUrl',
  oauth2AuthRequest: 'workbench.editors.request.oauth.authRequest',
  oauth2TokenRequest: 'workbench.editors.request.oauth.tokenRequest',
  oauth2RefreshRequest: 'workbench.editors.request.oauth.refreshRequest',
  oauth2SendAs: 'workbench.editors.request.auth.sendAsLabel',
  oauth2Preset: 'workbench.editors.request.auth.presetLabel',
};

const ROW_SUMMARY_KEY: Record<AuthInfoKey, MessageKey> = {
  basicUsername: 'workbench.editors.request.auth.rowInfo.basicUsername',
  basicPassword: 'workbench.editors.request.auth.rowInfo.basicPassword',
  bearerToken: 'workbench.editors.request.auth.rowInfo.bearerToken',
  apiKeyKey: 'workbench.editors.request.auth.rowInfo.apiKeyKey',
  apiKeyValue: 'workbench.editors.request.auth.rowInfo.apiKeyValue',
  apiKeyAddTo: 'workbench.editors.request.auth.rowInfo.apiKeyAddTo',
  digestUsername: 'workbench.editors.request.auth.rowInfo.digestUsername',
  digestPassword: 'workbench.editors.request.auth.rowInfo.digestPassword',
  digestDisableRetry: 'workbench.editors.request.auth.rowInfo.digestDisableRetry',
  oauth1SignatureMethod: 'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod',
  oauth1BodyHash: 'workbench.editors.request.auth.rowInfo.oauth1BodyHash',
  oauth1ConsumerKey: 'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey',
  oauth1ConsumerSecret: 'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret',
  oauth1PrivateKey: 'workbench.editors.request.auth.rowInfo.oauth1PrivateKey',
  oauth1Token: 'workbench.editors.request.auth.rowInfo.oauth1Token',
  oauth1TokenSecret: 'workbench.editors.request.auth.rowInfo.oauth1TokenSecret',
  oauth1AddTo: 'workbench.editors.request.auth.rowInfo.oauth1AddTo',
  oauth1Realm: 'workbench.editors.request.auth.rowInfo.oauth1Realm',
  hawkAuthId: 'workbench.editors.request.auth.rowInfo.hawkAuthId',
  hawkAuthKey: 'workbench.editors.request.auth.rowInfo.hawkAuthKey',
  hawkAlgorithm: 'workbench.editors.request.auth.rowInfo.hawkAlgorithm',
  hawkPayloadHash: 'workbench.editors.request.auth.rowInfo.hawkPayloadHash',
  hawkExt: 'workbench.editors.request.auth.rowInfo.hawkExt',
  hawkApp: 'workbench.editors.request.auth.rowInfo.hawkApp',
  hawkDlg: 'workbench.editors.request.auth.rowInfo.hawkDlg',
  jwtAlgorithm: 'workbench.editors.request.auth.rowInfo.jwtAlgorithm',
  jwtSecret: 'workbench.editors.request.auth.rowInfo.jwtSecret',
  jwtSecretBase64: 'workbench.editors.request.auth.rowInfo.jwtSecretBase64',
  jwtPrivateKey: 'workbench.editors.request.auth.rowInfo.jwtPrivateKey',
  jwtPayload: 'workbench.editors.request.auth.rowInfo.jwtPayload',
  jwtHeaders: 'workbench.editors.request.auth.rowInfo.jwtHeaders',
  jwtExpiresIn: 'workbench.editors.request.auth.rowInfo.jwtExpiresIn',
  jwtAddTo: 'workbench.editors.request.auth.rowInfo.jwtAddTo',
  jwtHeaderPrefix: 'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix',
  oauth2Token: 'workbench.editors.request.auth.rowInfo.oauth2Token',
  oauth2HeaderPrefix: 'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix',
  oauth2AutoRefresh: 'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh',
  oauth2Status: 'workbench.editors.request.auth.rowInfo.oauth2Status',
  oauth2TokenName: 'workbench.editors.request.auth.rowInfo.oauth2TokenName',
  oauth2GrantType: 'workbench.editors.request.auth.rowInfo.oauth2GrantType',
  oauth2CallbackUrl: 'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl',
  oauth2AuthUrl: 'workbench.editors.request.auth.rowInfo.oauth2AuthUrl',
  oauth2AccessTokenUrl: 'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl',
  oauth2Username: 'workbench.editors.request.auth.rowInfo.oauth2Username',
  oauth2Password: 'workbench.editors.request.auth.rowInfo.oauth2Password',
  oauth2ClientId: 'workbench.editors.request.auth.rowInfo.oauth2ClientId',
  oauth2ClientSecret: 'workbench.editors.request.auth.rowInfo.oauth2ClientSecret',
  oauth2CodeChallengeMethod: 'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod',
  oauth2CodeVerifier: 'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier',
  oauth2Scope: 'workbench.editors.request.auth.rowInfo.oauth2Scope',
  oauth2State: 'workbench.editors.request.auth.rowInfo.oauth2State',
  oauth2ClientAuthentication: 'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication',
  oauth2RefreshTokenUrl: 'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl',
  oauth2AuthRequest: 'workbench.editors.request.auth.rowInfo.oauth2AuthRequest',
  oauth2TokenRequest: 'workbench.editors.request.auth.rowInfo.oauth2TokenRequest',
  oauth2RefreshRequest: 'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest',
  oauth2SendAs: 'workbench.editors.request.auth.rowInfo.oauth2SendAs',
  oauth2Preset: 'workbench.editors.request.auth.presetInfo',
};

const GROUP_SUMMARY_KEY: Record<CardType, Partial<Record<AuthGroupKey, MessageKey>>> = {
  basic: { credentials: 'workbench.editors.request.auth.groupInfo.basic.credentials' },
  bearer: { token: 'workbench.editors.request.auth.groupInfo.bearer.token' },
  'api-key': {
    credentials: 'workbench.editors.request.auth.groupInfo.apiKey.credentials',
    delivery: 'workbench.editors.request.auth.groupInfo.apiKey.delivery',
  },
  digest: {
    credentials: 'workbench.editors.request.auth.groupInfo.digest.credentials',
    challenge: 'workbench.editors.request.auth.groupInfo.digest.challenge',
  },
  oauth1: {
    signing: 'workbench.editors.request.auth.groupInfo.oauth1.signing',
    consumer: 'workbench.editors.request.auth.groupInfo.oauth1.consumer',
    token: 'workbench.editors.request.auth.groupInfo.oauth1.token',
    delivery: 'workbench.editors.request.auth.groupInfo.oauth1.delivery',
  },
  hawk: {
    credentials: 'workbench.editors.request.auth.groupInfo.hawk.credentials',
    signing: 'workbench.editors.request.auth.groupInfo.hawk.signing',
    attributes: 'workbench.editors.request.auth.groupInfo.hawk.attributes',
  },
  jwt: {
    signing: 'workbench.editors.request.auth.groupInfo.jwt.signing',
    token: 'workbench.editors.request.auth.groupInfo.jwt.token',
    delivery: 'workbench.editors.request.auth.groupInfo.jwt.delivery',
  },
  oauth2: {
    token: 'workbench.editors.request.auth.groupInfo.oauth2.token',
    grant: 'workbench.editors.request.auth.groupInfo.oauth2.grant',
    advanced: 'workbench.editors.request.auth.groupInfo.oauth2.advanced',
  },
};

const TYPE_SUMMARY_KEY: Record<CardType | 'none', MessageKey> = {
  none: 'workbench.editors.request.auth.typeInfo.none',
  basic: 'workbench.editors.request.auth.typeInfo.basic',
  bearer: 'workbench.editors.request.auth.typeInfo.bearer',
  'api-key': 'workbench.editors.request.auth.typeInfo.apiKey',
  digest: 'workbench.editors.request.auth.typeInfo.digest',
  oauth1: 'workbench.editors.request.auth.typeInfo.oauth1',
  hawk: 'workbench.editors.request.auth.typeInfo.hawk',
  jwt: 'workbench.editors.request.auth.typeInfo.jwt',
  oauth2: 'workbench.editors.request.auth.typeInfo.oauth2',
};

function isCardType(auth: ConcreteAuthConfig): auth is CardAuthConfig {
  return auth.type in GROUP_ROWS;
}

function card(auth: ConcreteAuthConfig, lit: Iterable<AuthTokenId>, forced: Iterable<AuthInfoKey>) {
  return {
    diagram: <AuthExampleCard auth={auth} lit={new Set(lit)} forced={new Set(forced)} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  };
}

/** The type-level popover (the Auth Type row's (i)): the header's
 *  scheme lit, the type's one-sentence summary. Absent for the one
 *  type with no card (AWS Signature v4). */
export function authTypeInfo(t: Translate, auth: ConcreteAuthConfig): InfoPopoverContent | undefined {
  if (auth.type === 'none') {
    return {
      kicker: t('workbench.editors.request.tab.authorization'),
      title: t(authTypeLabelKey('none')),
      ...card(auth, ['none'], []),
      summary: t(TYPE_SUMMARY_KEY.none),
    };
  }
  if (!isCardType(auth)) return undefined;
  const lit: AuthTokenId[] = auth.type === 'api-key' && auth.in === 'header' ? ['key', 'value'] : ['location'];
  return {
    kicker: t('workbench.editors.request.tab.authorization'),
    title: t(authTypeLabelKey(auth.type)),
    ...card(auth, lit, []),
    summary: t(TYPE_SUMMARY_KEY[auth.type]),
  };
}

/** A group header's popover: the union of its rows' tokens lit, its
 *  optional tokens shown. */
export function authGroupInfo(t: Translate, auth: CardAuthConfig, group: AuthGroupKey): InfoPopoverContent {
  const rows = GROUP_ROWS[auth.type][group] ?? [];
  const summaryKey = GROUP_SUMMARY_KEY[auth.type][group];
  return {
    kicker: t(authTypeLabelKey(auth.type)),
    title: t(AUTH_GROUP_LABEL_KEY[group]),
    ...card(
      auth,
      rows.flatMap((row) => rowTokens(row, auth)),
      rows,
    ),
    summary: summaryKey === undefined ? '' : t(summaryKey),
  };
}

/** One row's popover: its token(s) lit, kicker = its group. */
export function authRowInfo(t: Translate, auth: ConcreteAuthConfig, key: AuthInfoKey): InfoPopoverContent {
  const group = GROUP_OF.get(key);
  return {
    kicker: group === undefined ? t(authTypeLabelKey(auth.type)) : t(AUTH_GROUP_LABEL_KEY[group]),
    title: t(ROW_TITLE_KEY[key]),
    ...card(auth, rowTokens(key, auth), [key]),
    summary: t(ROW_SUMMARY_KEY[key]),
  };
}
