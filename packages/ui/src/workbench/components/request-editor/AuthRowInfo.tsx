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
import { usesClientAssertion } from '@openheaders/core/oauth';
import { getGrantType } from './oauth2-grant-types';

/** One key per auth-form row that opens a popover with the card. */
export type AuthInfoKey =
  | 'basicUsername'
  | 'basicPassword'
  | 'bearerToken'
  | 'apiKeyKey'
  | 'apiKeyValue'
  | 'apiKeyAddTo'
  | 'awsAccessKey'
  | 'awsSecretKey'
  | 'awsSessionToken'
  | 'awsService'
  | 'awsRegion'
  | 'awsAddTo'
  | 'edgeGridClientToken'
  | 'edgeGridAccessToken'
  | 'edgeGridClientSecret'
  | 'edgeGridHeadersToSign'
  | 'edgeGridMaxBodySize'
  | 'asapAlgorithm'
  | 'asapKeyId'
  | 'asapPrivateKey'
  | 'asapIssuer'
  | 'asapAudience'
  | 'asapSubject'
  | 'asapClaims'
  | 'asapExpiresIn'
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
  | 'httpSigAlgorithm'
  | 'httpSigKeyId'
  | 'httpSigPrivateKey'
  | 'httpSigSecret'
  | 'httpSigSecretBase64'
  | 'httpSigComponents'
  | 'httpSigContentDigest'
  | 'httpSigLabel'
  | 'httpSigCreated'
  | 'httpSigExpiresIn'
  | 'httpSigNonce'
  | 'httpSigIncludeAlg'
  | 'httpSigTag'
  | 'oauth2Token'
  | 'oauth2HeaderPrefix'
  | 'oauth2TokenBinding'
  | 'oauth2DpopAlgorithm'
  | 'oauth2AutoRefresh'
  | 'oauth2Status'
  | 'oauth2TokenName'
  | 'oauth2GrantType'
  | 'oauth2CallbackUrl'
  | 'oauth2Issuer'
  | 'oauth2AuthUrl'
  | 'oauth2DeviceAuthUrl'
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
  | 'oauth2AssertionIssuer'
  | 'oauth2AssertionSubject'
  | 'oauth2AssertionClaims'
  | 'oauth2AssertionAlgorithm'
  | 'oauth2AssertionKeyId'
  | 'oauth2AssertionPrivateKey'
  | 'oauth2AssertionAudience'
  | 'oauth2AssertionLifetime'
  | 'oauth2AssertionHeaders'
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
  | 'deviceEndpoint'
  | 'userCode'
  | 'deviceCode'
  | 'poll'
  | 'grantType'
  | 'code'
  | 'verifier'
  | 'clientSecret'
  | 'clientAuth'
  | 'tokenParams'
  | 'refreshEndpoint'
  | 'refresh'
  | 'refreshToken'
  | 'refreshParams'
  | 'amzDate'
  | 'credential'
  | 'signedHeaders'
  | 'securityToken'
  | 'contentSha'
  | 'expires'
  | 'clientToken'
  | 'accessToken'
  | 'contentHash'
  | 'iss'
  | 'aud'
  | 'sub'
  | 'jti'
  | 'clientAssertion'
  | 'assertion'
  | 'proof'
  | 'htu'
  | 'ath'
  | 'label'
  | 'created'
  | 'tag';

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
/** The SigV4 test suite's timestamp — the pinned vector's date. */
const AMZ_DATE = '20150830T123600Z';
/** RFC 9421's Appendix B `created` instant — the pinned vectors' clock. */
const HTTP_SIG_CREATED = 1_618_884_473;

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
      // Four legs: the authorize redirect (code grants) or the device
      // authorization request (the device grant), the token exchange
      // (polled for the device grant), the send carrying the access
      // token, the refresh — plus the minted JWT's claims while an
      // assertion is in play (a JWT client authentication, or the JWT
      // bearer grant whose assertion IS the grant and whose refresh is
      // a fresh assertion).
      const grant = getGrantType(auth);
      // A DPoP-bound token rides the header only (RFC 9449 §7.1).
      const dpop = auth.tokenBinding === 'dpop';
      const query = auth.sendAs === 'query' && !dpop;
      const basicClientAuth = auth.clientAuthentication === 'basic-header';
      const assertionClientAuth = usesClientAssertion(auth);
      const jwtBearer = grant.fields.assertion;
      const device = grant.fields.deviceAuthUrl;
      const showAuthParams = (auth.extraAuthParams?.length ?? 0) > 0 || forced.has('oauth2AuthRequest');
      const showTokenParams = (auth.extraTokenParams?.length ?? 0) > 0 || forced.has('oauth2TokenRequest');
      const showRefreshParams = (auth.extraRefreshParams?.length ?? 0) > 0 || forced.has('oauth2RefreshRequest');
      const showExtraClaims = (auth.assertionClaims ?? '').trim() !== '' || forced.has('oauth2AssertionClaims');
      const showHeaders = (auth.assertionHeaders ?? '').trim() !== '' || forced.has('oauth2AssertionHeaders');
      const clientId = tok('clientId', 'client_id=ck_9f3a');
      const clientAuthTokens: Token[] = basicClientAuth
        ? [tok('clientAuth', 'Authorization: Basic base64(ck_9f3a:cs_71b0)')]
        : assertionClientAuth
          ? [
              clientId,
              tok('clientAssertion', 'client_assertion_type=…:jwt-bearer'),
              tok('clientAssertion', `client_assertion=${JWT}`),
            ]
          : jwtBearer
            ? [clientId]
            : [clientId, tok('clientSecret', 'client_secret=cs_71b0')];
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
      if (device) {
        // RFC 8628 §3.1 / §3.2: the device authorization request and
        // the facts the user acts on (the device_code stays host-side).
        lines.push({
          opener: tok('deviceEndpoint', `POST ${IDP}/device`),
          tokens: [
            ...clientAuthTokens,
            tok('scope', 'scope=openid profile'),
            tok('userCode', '→ user_code=WDJB-MJHT'),
            tok('userCode', 'verification_uri=…/activate'),
            tok('poll', 'interval=5'),
          ],
        });
      }
      lines.push({
        opener: tok('tokenEndpoint', `POST ${IDP}/token${device ? ' (every 5 s)' : ''}`),
        tokens: [
          tok(
            'grantType',
            jwtBearer
              ? 'grant_type=…:jwt-bearer'
              : device
                ? 'grant_type=…:device_code'
                : `grant_type=${grant.wire}`,
          ),
          ...(jwtBearer ? [tok('assertion', `assertion=${JWT}`)] : []),
          ...(device ? [tok('deviceCode', 'device_code=GmRhmhcx…')] : []),
          ...(grant.fields.authUrl ? [tok('code', 'code=SplxlOBe…')] : []),
          ...(grant.fields.pkce ? [tok('verifier', 'code_verifier=dBjftJeZ…')] : []),
          ...(grant.fields.resourceOwner
            ? [tok('username', 'username=john.doe'), tok('password', 'password=s3cret')]
            : []),
          ...clientAuthTokens,
          ...(showTokenParams ? [tok('tokenParams', 'audience=api')] : []),
          ...(dpop ? [tok('proof', `DPoP: ${JWT}`)] : []),
          ...(device ? [tok('poll', '← authorization_pending · slow_down · access_denied · expired_token')] : []),
        ],
      });
      if (assertionClientAuth || jwtBearer) {
        // The minted assertion's anatomy — the client assertion's iss =
        // sub = the client id, or the grant assertion's own issuer.
        const secretJwt = auth.clientAuthentication === 'client-secret-jwt';
        const alg = auth.assertionAlgorithm?.trim() || (secretJwt ? 'HS256' : 'RS256');
        const issuer = jwtBearer ? auth.assertionIssuer?.trim() || 'svc@openheaders.com' : 'ck_9f3a';
        const subject = jwtBearer ? auth.assertionSubject?.trim() : 'ck_9f3a';
        lines.push({
          opener: 'JWT',
          tokens: [
            tok('alg', `alg: ${alg}`),
            tok('kid', `kid: ${auth.assertionKeyId?.trim() || 'key-1'}`),
            ...(showHeaders ? [tok('kid', 'x5t#S256: A1bC2d…')] : []),
            tok('iss', `iss: ${issuer}`),
            ...(subject ? [tok('sub', `sub: ${subject}`)] : []),
            tok('aud', `aud: ${auth.assertionAudience?.trim() || `${IDP}/token`}`),
            tok('iat', `iat: ${HAWK_TS}`),
            tok('exp', `exp: ${Number(HAWK_TS) + (auth.assertionLifetimeSeconds ?? 300)}`),
            ...(jwtBearer && auth.scopes.length > 0 ? [tok('scope', `scope: ${auth.scopes.join(' ')}`)] : []),
            tok('jti', 'jti: 6f1c2a0e-…'),
            ...(showExtraClaims ? [tok('claims', 'box_sub_type: enterprise')] : []),
          ],
        });
      }
      lines.push(
        requestLine(),
        query
          ? { opener: tok('location', 'query:'), tokens: [tok('token', `access_token=${JWT}`)] }
          : {
              opener: tok('location', 'Authorization:'),
              tokens: [tok('prefix', dpop ? 'DPoP' : auth.headerPrefix?.trim() || 'Bearer'), tok('token', JWT)],
            },
      );
      if (dpop) {
        // RFC 9449 §4.2 — the proof every token POST and every send
        // carries, signed by the key the token is bound to.
        lines.push({
          opener: tok('proof', 'DPoP:'),
          tokens: [
            tok('proof', 'typ: dpop+jwt'),
            tok('alg', `alg: ${auth.dpopAlgorithm?.trim() || 'ES256'}`),
            tok('proof', 'jwk: {kty: EC, crv: P-256, x, y}'),
            tok('htu', 'htm: GET'),
            tok('htu', 'htu: https://api.openheaders.com/v1/me'),
            tok('ath', 'ath: SHA-256(access_token)'),
            tok('iat', `iat: ${HAWK_TS}`),
            tok('jti', 'jti: 6f1c2a0e-…'),
            tok('nonce', 'nonce: (when the server issued one)'),
          ],
        });
      }
      if (jwtBearer) {
        // No refresh token: expiry re-runs the grant with a fresh assertion.
        lines.push({
          opener: tok('refreshEndpoint', `POST ${IDP}/token`),
          tokens: [tok('refresh', 'grant_type=…:jwt-bearer'), tok('refreshToken', `assertion=${JWT} (fresh)`)],
        });
      } else {
        lines.push({
          opener: tok('refreshEndpoint', `POST ${IDP}${auth.refreshEndpoint ? '/refresh' : '/token'}`),
          tokens: [
            tok('refresh', 'grant_type=refresh_token'),
            tok('refreshToken', 'refresh_token=rt_8e2a'),
            ...(assertionClientAuth ? [tok('clientAssertion', `client_assertion=${JWT}`)] : []),
            ...(showRefreshParams ? [tok('refreshParams', 'audience=api')] : []),
          ],
        });
      }
      return lines;
    }
    case 'asap': {
      // The JWT line lists the claims in the composed order; the
      // Additional-claims token shows when set / forced.
      const showExtra = (auth.claims ?? '').trim() !== '' || forced.has('asapClaims');
      return [
        requestLine(),
        { opener: tok('location', 'Authorization: Bearer'), tokens: [tok('token', JWT)] },
        {
          opener: 'JWT',
          tokens: [
            tok('alg', `alg: ${auth.algorithm}`),
            tok('kid', 'kid: openheaders/service/key-1'),
            tok('iss', 'iss: openheaders/service'),
            tok('sub', `sub: ${auth.subject?.trim() || 'openheaders/service'}`),
            tok('aud', 'aud: api.openheaders.com'),
            tok('iat', `iat: ${HAWK_TS}`),
            tok('exp', `exp: ${Number(HAWK_TS) + (auth.expiresInSeconds ?? 3600)}`),
            tok('jti', 'jti: 6f1c2a0e-…'),
            ...(showExtra ? [tok('claims', 'scope: read')] : []),
            tok('sig', 'signature ← private key'),
          ],
        },
      ];
    }
    case 'edgegrid': {
      // The signed line is what the signature covers beyond the
      // request line: the listed headers (when set / forced) and the
      // POST content hash the body window bounds.
      const showHeaders = (auth.headersToSign ?? '').trim() !== '' || forced.has('edgeGridHeadersToSign');
      const showHash = auth.maxBodySize !== undefined || forced.has('edgeGridMaxBodySize');
      return [
        requestLine(),
        {
          opener: tok('location', 'Authorization: EG1-HMAC-SHA256'),
          tokens: [
            tok('clientToken', 'client_token=akab-client-token-xxx'),
            tok('accessToken', 'access_token=akab-access-token-xxx'),
            tok('timestamp', 'timestamp=20140321T19:34:21+0000'),
            tok('nonce', 'nonce=nonce-xx-xxxx'),
            tok('signature', 'signature=tL+y4hxyHxgW…'),
          ],
        },
        ...(showHeaders || showHash
          ? [
              {
                opener: 'signed',
                tokens: [
                  ...(showHeaders ? [tok('signedHeaders', 'x-test1:test-simple-header')] : []),
                  ...(showHash ? [tok('contentHash', 'content hash (POST) ← first 131072 bytes')] : []),
                ],
              },
            ]
          : []),
      ];
    }
    case 'http-signature': {
      // The two headers the signer adds, then the signature base line
      // by line — "the signed line is what the signature covers". The
      // Content-Digest line and the optional parameters show when set
      // / forced; the covered list is the config's own, in its order.
      const show = (key: AuthInfoKey, set: boolean) => set || forced.has(key);
      const label = auth.label?.trim() || 'sig1';
      const components = auth.components
        .split(/[\s,]+/)
        .filter((c) => c !== '')
        .map((c) => c.toLowerCase());
      const digestAlgorithm = auth.contentDigest ?? 'sha-256';
      const digestValue = `${digestAlgorithm}=:X48E9qOokqqrvdts…:`;
      const showDigest = show('httpSigContentDigest', auth.contentDigest !== undefined);
      const created = auth.created !== false;
      const params: Token[] = [
        ...(created ? [tok('created', `created=${HTTP_SIG_CREATED}`)] : []),
        ...(created && show('httpSigExpiresIn', auth.expiresInSeconds !== undefined)
          ? [tok('expires', `expires=${HTTP_SIG_CREATED + (auth.expiresInSeconds ?? 300)}`)]
          : []),
        ...(show('httpSigKeyId', (auth.keyId ?? '').trim() !== '')
          ? [tok('kid', `keyid="${auth.keyId?.trim() || 'my-service-key-1'}"`)]
          : []),
        ...(show('httpSigIncludeAlg', auth.includeAlgorithm === true) ? [tok('alg', `alg="${auth.algorithm}"`)] : []),
        ...(show('httpSigNonce', auth.nonce === true) ? [tok('nonce', 'nonce="b3k2pp5k7z-50gnwp.yemd"')] : []),
        ...(show('httpSigTag', (auth.tag ?? '').trim() !== '')
          ? [tok('tag', `tag="${auth.tag?.trim() || 'app'}"`)]
          : []),
      ];
      const sample = (component: string): string => {
        switch (component) {
          case '@method':
            return 'POST';
          case '@target-uri':
            return URL;
          case '@authority':
            return 'api.openheaders.com';
          case '@scheme':
            return 'https';
          case '@request-target':
          case '@path':
            return '/v1/users';
          case '@query':
            return '?';
          case 'content-digest':
            return digestValue;
          case 'content-type':
            return 'application/json';
          case 'date':
            return 'Tue, 20 Apr 2021 02:07:55 GMT';
          default:
            return '…';
        }
      };
      const covered = `(${components.map((c) => `"${c}"`).join(' ')})`;
      return [
        requestLine(),
        ...(showDigest
          ? [{ opener: tok('contentHash', 'Content-Digest:'), tokens: [tok('contentHash', digestValue)] }]
          : []),
        {
          opener: tok('location', 'Signature-Input:'),
          tokens: [tok('label', `${label}=`), tok('signedHeaders', covered), ...params],
        },
        {
          opener: tok('location', 'Signature:'),
          tokens: [
            tok('label', `${label}=`),
            tok('signature', `:wqcAqbmYJ2ji…: ← ${auth.algorithm === 'hmac-sha256' ? 'secret' : 'private key'}`),
          ],
        },
        {
          opener: 'signed',
          tokens: [
            ...components.map((c) => tok('signedHeaders', `"${c}": ${sample(c)}`)),
            tok('signedHeaders', `"@signature-params": ${covered}…`),
          ],
        },
      ];
    }
    case 'aws-sigv4': {
      // The scope the card shows is the one the signer derives from the
      // card's own host when a field is blank — the same rule as the
      // send. The session token and the s3 payload-hash header show
      // when set / forced, the way the other optional tokens do.
      const query = auth.addTo === 'query';
      const service = auth.service.trim() || 'execute-api';
      const region = auth.region.trim() || 'us-east-1';
      const showToken = (auth.sessionToken ?? '') !== '' || forced.has('awsSessionToken');
      const scope = `${AMZ_DATE.slice(0, 8)}/${region}/${service}/aws4_request`;
      if (query) {
        return [
          requestLine(),
          {
            opener: tok('location', 'query:'),
            tokens: [
              tok('location', 'X-Amz-Algorithm=AWS4-HMAC-SHA256'),
              tok('credential', `X-Amz-Credential=AKIDEXAMPLE/${scope}`),
              tok('amzDate', `X-Amz-Date=${AMZ_DATE}`),
              ...(service === 's3' ? [tok('expires', 'X-Amz-Expires=86400')] : []),
              tok('signedHeaders', 'X-Amz-SignedHeaders=host'),
              ...(showToken ? [tok('securityToken', 'X-Amz-Security-Token=FQoGZXIv…')] : []),
              tok('signature', 'X-Amz-Signature=5fa00fa3…'),
            ],
          },
        ];
      }
      return [
        requestLine(),
        {
          opener: tok('location', 'Authorization: AWS4-HMAC-SHA256'),
          tokens: [
            tok('credential', `Credential=AKIDEXAMPLE/${scope}`),
            tok('signedHeaders', `SignedHeaders=host;x-amz-date${service === 's3' ? ';x-amz-content-sha256' : ''}`),
            tok('signature', 'Signature=5fa00fa3…'),
          ],
        },
        { opener: tok('amzDate', 'X-Amz-Date:'), tokens: [tok('amzDate', AMZ_DATE)] },
        ...(showToken
          ? [{ opener: tok('securityToken', 'X-Amz-Security-Token:'), tokens: [tok('securityToken', 'FQoGZXIv…')] }]
          : []),
        ...(service === 's3'
          ? [{ opener: tok('contentSha', 'X-Amz-Content-Sha256:'), tokens: [tok('contentSha', 'e3b0c442…')] }]
          : []),
      ];
    }
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
  awsAccessKey: ['credential'],
  awsSecretKey: ['signature'],
  awsSessionToken: ['securityToken'],
  awsService: ['credential'],
  awsRegion: ['credential'],
  awsAddTo: ['location'],
  edgeGridClientToken: ['clientToken'],
  edgeGridAccessToken: ['accessToken'],
  edgeGridClientSecret: ['signature'],
  edgeGridHeadersToSign: ['signedHeaders'],
  edgeGridMaxBodySize: ['contentHash'],
  asapAlgorithm: ['alg'],
  asapKeyId: ['kid'],
  asapPrivateKey: ['sig'],
  asapIssuer: ['iss'],
  asapAudience: ['aud'],
  asapSubject: ['sub'],
  asapClaims: ['claims'],
  asapExpiresIn: ['iat', 'exp'],
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
  httpSigAlgorithm: ['signature'],
  httpSigKeyId: ['kid'],
  httpSigPrivateKey: ['signature'],
  httpSigSecret: ['signature'],
  httpSigSecretBase64: ['signature'],
  httpSigComponents: ['signedHeaders'],
  httpSigContentDigest: ['contentHash'],
  httpSigLabel: ['label'],
  httpSigCreated: ['created'],
  httpSigExpiresIn: ['expires'],
  httpSigNonce: ['nonce'],
  httpSigIncludeAlg: ['alg'],
  httpSigTag: ['tag'],
  oauth2Token: ['token'],
  oauth2HeaderPrefix: ['prefix'],
  oauth2TokenBinding: ['proof', 'htu', 'ath', 'prefix'],
  oauth2DpopAlgorithm: ['alg'],
  oauth2AutoRefresh: ['refresh', 'refreshToken'],
  oauth2Status: ['token', 'refresh'],
  oauth2TokenName: [],
  oauth2GrantType: ['grantType'],
  oauth2CallbackUrl: ['callback'],
  oauth2Issuer: ['authorize', 'tokenEndpoint'],
  oauth2AuthUrl: ['authorize'],
  oauth2DeviceAuthUrl: ['deviceEndpoint', 'userCode'],
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
  oauth2AssertionIssuer: ['iss'],
  oauth2AssertionSubject: ['sub'],
  oauth2AssertionClaims: ['claims'],
  oauth2AssertionAlgorithm: ['alg'],
  oauth2AssertionKeyId: ['kid'],
  oauth2AssertionPrivateKey: ['alg'],
  oauth2AssertionAudience: ['aud'],
  oauth2AssertionLifetime: ['iat', 'exp'],
  oauth2AssertionHeaders: ['kid'],
  oauth2RefreshTokenUrl: ['refreshEndpoint'],
  oauth2AuthRequest: ['authParams'],
  oauth2TokenRequest: ['tokenParams'],
  oauth2RefreshRequest: ['refreshParams'],
  oauth2SendAs: ['location', 'prefix'],
  oauth2Preset: ['authorize', 'tokenEndpoint'],
};

/** Shape-aware: an API key on the URL is one `key=value` token; the
 *  OAuth 2.0 client secret rides the token body or the Basic header;
 *  a query-delivered access token has no prefix; the s3 service adds
 *  the payload-hash header (or the presigned lifetime). */
function rowTokens(key: AuthInfoKey, auth: ConcreteAuthConfig): readonly AuthTokenId[] {
  if (auth.type === 'api-key' && auth.in === 'query') {
    if (key === 'apiKeyAddTo') return ['location', 'query'];
    if (key === 'apiKeyKey' || key === 'apiKeyValue') return ['query'];
  }
  if (auth.type === 'aws-sigv4' && key === 'awsService' && auth.service.trim() === 's3') {
    return ['credential', auth.addTo === 'query' ? 'expires' : 'contentSha'];
  }
  if (auth.type === 'oauth2') {
    if (auth.clientAuthentication === 'basic-header') {
      if (key === 'oauth2ClientAuthentication' || key === 'oauth2ClientSecret') return ['clientAuth'];
      if (key === 'oauth2ClientId') return ['clientId', 'clientAuth'];
    }
    if (usesClientAssertion(auth)) {
      if (key === 'oauth2ClientAuthentication') return ['clientAssertion'];
      // The secret method's Client Secret IS the signing key.
      if (key === 'oauth2ClientSecret') return ['clientAssertion', 'alg'];
      if (key === 'oauth2ClientId') return ['clientId', 'iss', 'sub'];
    }
    if (getGrantType(auth).fields.assertion) {
      if (key === 'oauth2GrantType') return ['grantType', 'assertion'];
      if (key === 'oauth2AutoRefresh') return ['refresh', 'refreshToken'];
      if (key === 'oauth2Scope') return ['scope'];
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
  'aws-sigv4': {
    credentials: ['awsAccessKey', 'awsSecretKey', 'awsSessionToken'],
    signing: ['awsService', 'awsRegion'],
    delivery: ['awsAddTo'],
  },
  edgegrid: {
    credentials: ['edgeGridClientToken', 'edgeGridAccessToken', 'edgeGridClientSecret'],
    signing: ['edgeGridHeadersToSign', 'edgeGridMaxBodySize'],
  },
  asap: {
    signing: ['asapAlgorithm', 'asapKeyId', 'asapPrivateKey'],
    token: ['asapIssuer', 'asapAudience', 'asapSubject', 'asapClaims', 'asapExpiresIn'],
  },
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
  'http-signature': {
    signing: ['httpSigAlgorithm', 'httpSigKeyId', 'httpSigPrivateKey', 'httpSigSecret', 'httpSigSecretBase64'],
    coverage: ['httpSigComponents', 'httpSigContentDigest'],
    parameters: [
      'httpSigLabel',
      'httpSigCreated',
      'httpSigExpiresIn',
      'httpSigNonce',
      'httpSigIncludeAlg',
      'httpSigTag',
    ],
  },
  // The rail's Add-to and Preset rows sit outside the sections.
  oauth2: {
    token: [
      'oauth2Token',
      'oauth2HeaderPrefix',
      'oauth2TokenBinding',
      'oauth2DpopAlgorithm',
      'oauth2AutoRefresh',
      'oauth2Status',
    ],
    grant: [
      'oauth2TokenName',
      'oauth2GrantType',
      'oauth2CallbackUrl',
      'oauth2Issuer',
      'oauth2AuthUrl',
      'oauth2DeviceAuthUrl',
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
      'oauth2AssertionIssuer',
      'oauth2AssertionSubject',
      'oauth2AssertionClaims',
    ],
    signing: [
      'oauth2AssertionAlgorithm',
      'oauth2AssertionKeyId',
      'oauth2AssertionPrivateKey',
      'oauth2AssertionAudience',
      'oauth2AssertionLifetime',
      'oauth2AssertionHeaders',
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
  awsAccessKey: 'workbench.editors.request.auth.awsAccessKey',
  awsSecretKey: 'workbench.editors.request.auth.awsSecretKey',
  awsSessionToken: 'workbench.editors.request.auth.awsSessionToken',
  awsService: 'workbench.editors.request.auth.awsService',
  awsRegion: 'workbench.editors.request.auth.awsRegion',
  awsAddTo: 'workbench.editors.request.auth.addTo',
  edgeGridClientToken: 'workbench.editors.request.auth.edgeGridClientToken',
  edgeGridAccessToken: 'workbench.editors.request.auth.edgeGridAccessToken',
  edgeGridClientSecret: 'workbench.editors.request.auth.edgeGridClientSecret',
  edgeGridHeadersToSign: 'workbench.editors.request.auth.edgeGridHeadersToSign',
  edgeGridMaxBodySize: 'workbench.editors.request.auth.edgeGridMaxBodySize',
  asapAlgorithm: 'workbench.editors.request.auth.asapAlgorithm',
  asapKeyId: 'workbench.editors.request.auth.asapKeyId',
  asapPrivateKey: 'workbench.editors.request.auth.asapPrivateKey',
  asapIssuer: 'workbench.editors.request.auth.asapIssuer',
  asapAudience: 'workbench.editors.request.auth.asapAudience',
  asapSubject: 'workbench.editors.request.auth.asapSubject',
  asapClaims: 'workbench.editors.request.auth.asapClaims',
  asapExpiresIn: 'workbench.editors.request.auth.asapExpiresIn',
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
  httpSigAlgorithm: 'workbench.editors.request.auth.httpSigAlgorithm',
  httpSigKeyId: 'workbench.editors.request.auth.httpSigKeyId',
  httpSigPrivateKey: 'workbench.editors.request.auth.httpSigPrivateKey',
  httpSigSecret: 'workbench.editors.request.auth.httpSigSecret',
  httpSigSecretBase64: 'workbench.editors.request.auth.httpSigSecretBase64',
  httpSigComponents: 'workbench.editors.request.auth.httpSigComponents',
  httpSigContentDigest: 'workbench.editors.request.auth.httpSigContentDigest',
  httpSigLabel: 'workbench.editors.request.auth.httpSigLabel',
  httpSigCreated: 'workbench.editors.request.auth.httpSigCreated',
  httpSigExpiresIn: 'workbench.editors.request.auth.httpSigExpiresIn',
  httpSigNonce: 'workbench.editors.request.auth.httpSigNonce',
  httpSigIncludeAlg: 'workbench.editors.request.auth.httpSigIncludeAlg',
  httpSigTag: 'workbench.editors.request.auth.httpSigTag',
  oauth2Token: 'workbench.editors.request.oauth.tokenLabel',
  oauth2HeaderPrefix: 'workbench.editors.request.oauth.headerPrefix',
  oauth2TokenBinding: 'workbench.editors.request.oauth.tokenBinding',
  oauth2DpopAlgorithm: 'workbench.editors.request.oauth.dpopAlgorithm',
  oauth2AutoRefresh: 'workbench.editors.request.oauth.autoRefresh',
  oauth2Status: 'workbench.editors.request.oauth.status',
  oauth2TokenName: 'workbench.editors.request.oauth.tokenName',
  oauth2GrantType: 'workbench.editors.request.oauth.grantType',
  oauth2CallbackUrl: 'workbench.editors.request.oauth.callbackUrl',
  oauth2Issuer: 'workbench.editors.request.oauth.issuerUrl',
  oauth2AuthUrl: 'workbench.editors.request.oauth.authUrl',
  oauth2DeviceAuthUrl: 'workbench.editors.request.oauth.deviceAuthUrl',
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
  oauth2AssertionIssuer: 'workbench.editors.request.oauth.assertionIssuer',
  oauth2AssertionSubject: 'workbench.editors.request.oauth.assertionSubject',
  oauth2AssertionClaims: 'workbench.editors.request.oauth.assertionClaims',
  oauth2AssertionAlgorithm: 'workbench.editors.request.oauth.assertionAlgorithm',
  oauth2AssertionKeyId: 'workbench.editors.request.oauth.assertionKeyId',
  oauth2AssertionPrivateKey: 'workbench.editors.request.oauth.assertionPrivateKey',
  oauth2AssertionAudience: 'workbench.editors.request.oauth.assertionAudience',
  oauth2AssertionLifetime: 'workbench.editors.request.oauth.assertionLifetime',
  oauth2AssertionHeaders: 'workbench.editors.request.oauth.assertionHeaders',
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
  awsAccessKey: 'workbench.editors.request.auth.rowInfo.awsAccessKey',
  awsSecretKey: 'workbench.editors.request.auth.rowInfo.awsSecretKey',
  awsSessionToken: 'workbench.editors.request.auth.rowInfo.awsSessionToken',
  awsService: 'workbench.editors.request.auth.rowInfo.awsService',
  awsRegion: 'workbench.editors.request.auth.rowInfo.awsRegion',
  awsAddTo: 'workbench.editors.request.auth.rowInfo.awsAddTo',
  edgeGridClientToken: 'workbench.editors.request.auth.rowInfo.edgeGridClientToken',
  edgeGridAccessToken: 'workbench.editors.request.auth.rowInfo.edgeGridAccessToken',
  edgeGridClientSecret: 'workbench.editors.request.auth.rowInfo.edgeGridClientSecret',
  edgeGridHeadersToSign: 'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign',
  edgeGridMaxBodySize: 'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize',
  asapAlgorithm: 'workbench.editors.request.auth.rowInfo.asapAlgorithm',
  asapKeyId: 'workbench.editors.request.auth.rowInfo.asapKeyId',
  asapPrivateKey: 'workbench.editors.request.auth.rowInfo.asapPrivateKey',
  asapIssuer: 'workbench.editors.request.auth.rowInfo.asapIssuer',
  asapAudience: 'workbench.editors.request.auth.rowInfo.asapAudience',
  asapSubject: 'workbench.editors.request.auth.rowInfo.asapSubject',
  asapClaims: 'workbench.editors.request.auth.rowInfo.asapClaims',
  asapExpiresIn: 'workbench.editors.request.auth.rowInfo.asapExpiresIn',
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
  httpSigAlgorithm: 'workbench.editors.request.auth.rowInfo.httpSigAlgorithm',
  httpSigKeyId: 'workbench.editors.request.auth.rowInfo.httpSigKeyId',
  httpSigPrivateKey: 'workbench.editors.request.auth.rowInfo.httpSigPrivateKey',
  httpSigSecret: 'workbench.editors.request.auth.rowInfo.httpSigSecret',
  httpSigSecretBase64: 'workbench.editors.request.auth.rowInfo.httpSigSecretBase64',
  httpSigComponents: 'workbench.editors.request.auth.rowInfo.httpSigComponents',
  httpSigContentDigest: 'workbench.editors.request.auth.rowInfo.httpSigContentDigest',
  httpSigLabel: 'workbench.editors.request.auth.rowInfo.httpSigLabel',
  httpSigCreated: 'workbench.editors.request.auth.rowInfo.httpSigCreated',
  httpSigExpiresIn: 'workbench.editors.request.auth.rowInfo.httpSigExpiresIn',
  httpSigNonce: 'workbench.editors.request.auth.rowInfo.httpSigNonce',
  httpSigIncludeAlg: 'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg',
  httpSigTag: 'workbench.editors.request.auth.rowInfo.httpSigTag',
  oauth2Token: 'workbench.editors.request.auth.rowInfo.oauth2Token',
  oauth2HeaderPrefix: 'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix',
  oauth2TokenBinding: 'workbench.editors.request.auth.rowInfo.oauth2TokenBinding',
  oauth2DpopAlgorithm: 'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm',
  oauth2AutoRefresh: 'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh',
  oauth2Status: 'workbench.editors.request.auth.rowInfo.oauth2Status',
  oauth2TokenName: 'workbench.editors.request.auth.rowInfo.oauth2TokenName',
  oauth2GrantType: 'workbench.editors.request.auth.rowInfo.oauth2GrantType',
  oauth2CallbackUrl: 'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl',
  oauth2Issuer: 'workbench.editors.request.auth.rowInfo.oauth2Issuer',
  oauth2AuthUrl: 'workbench.editors.request.auth.rowInfo.oauth2AuthUrl',
  oauth2DeviceAuthUrl: 'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl',
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
  oauth2AssertionIssuer: 'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer',
  oauth2AssertionSubject: 'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject',
  oauth2AssertionClaims: 'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims',
  oauth2AssertionAlgorithm: 'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm',
  oauth2AssertionKeyId: 'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId',
  oauth2AssertionPrivateKey: 'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey',
  oauth2AssertionAudience: 'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience',
  oauth2AssertionLifetime: 'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime',
  oauth2AssertionHeaders: 'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders',
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
  'aws-sigv4': {
    credentials: 'workbench.editors.request.auth.groupInfo.awsSigV4.credentials',
    signing: 'workbench.editors.request.auth.groupInfo.awsSigV4.signing',
    delivery: 'workbench.editors.request.auth.groupInfo.awsSigV4.delivery',
  },
  edgegrid: {
    credentials: 'workbench.editors.request.auth.groupInfo.edgeGrid.credentials',
    signing: 'workbench.editors.request.auth.groupInfo.edgeGrid.signing',
  },
  asap: {
    signing: 'workbench.editors.request.auth.groupInfo.asap.signing',
    token: 'workbench.editors.request.auth.groupInfo.asap.token',
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
  'http-signature': {
    signing: 'workbench.editors.request.auth.groupInfo.httpSignature.signing',
    coverage: 'workbench.editors.request.auth.groupInfo.httpSignature.coverage',
    parameters: 'workbench.editors.request.auth.groupInfo.httpSignature.parameters',
  },
  oauth2: {
    token: 'workbench.editors.request.auth.groupInfo.oauth2.token',
    grant: 'workbench.editors.request.auth.groupInfo.oauth2.grant',
    signing: 'workbench.editors.request.auth.groupInfo.oauth2.signing',
    advanced: 'workbench.editors.request.auth.groupInfo.oauth2.advanced',
  },
};

const TYPE_SUMMARY_KEY: Record<CardType | 'none', MessageKey> = {
  none: 'workbench.editors.request.auth.typeInfo.none',
  basic: 'workbench.editors.request.auth.typeInfo.basic',
  bearer: 'workbench.editors.request.auth.typeInfo.bearer',
  'api-key': 'workbench.editors.request.auth.typeInfo.apiKey',
  'aws-sigv4': 'workbench.editors.request.auth.typeInfo.awsSigV4',
  edgegrid: 'workbench.editors.request.auth.typeInfo.edgeGrid',
  asap: 'workbench.editors.request.auth.typeInfo.asap',
  digest: 'workbench.editors.request.auth.typeInfo.digest',
  oauth1: 'workbench.editors.request.auth.typeInfo.oauth1',
  hawk: 'workbench.editors.request.auth.typeInfo.hawk',
  jwt: 'workbench.editors.request.auth.typeInfo.jwt',
  'http-signature': 'workbench.editors.request.auth.typeInfo.httpSignature',
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
 *  scheme lit, the type's one-sentence summary. */
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
