/**
 * Workbench editors — the API request editor: params/auth/headers/
 * body/scripts/settings tabs, send flow, response pane, and their
 * corpora.
 *
 * Raw by design inside or beside keyed values: HTTP methods, header
 * names, MIME types, auth scheme names (Basic / Bearer / OAuth 2.0
 * as spec vocabulary), `{{ns.NAME}}` variable refs, and technical
 * example placeholders.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Request not found.',
  'workbench.editors.request.loading': 'Loading request…',
  'workbench.editors.request.toast.deletedOtherTab': 'Request was deleted from another tab',
  'workbench.editors.request.toast.updateFailed': 'Failed to update request',
  'workbench.editors.request.toast.updateFailedDetail': 'Failed to update request: {message}',
  'workbench.editors.request.toast.savedExample': 'Saved example "{name}"',
  'workbench.editors.request.toast.saveExampleFailed': 'Failed to save example',
  'workbench.editors.request.toast.saveExampleFailedDetail': 'Failed to save example: {message}',
  'workbench.editors.request.send.label': 'Send',
  'workbench.editors.request.send.sending': 'Sending…',
  'workbench.editors.request.send.unresolvedTooltip':
    'Request has unresolved variables. Define them in vault, environment, collection, workspace, or a live workflow before sending.',
  'workbench.editors.request.send.remoteDispatchHint': 'Runs on {host} — the connected back-end',
  'workbench.editors.request.send.stop': 'Stop',
  'workbench.editors.request.send.stopTooltip': 'Stop the request and keep what has arrived',
  'workbench.editors.request.menu.copyAsCurl': 'Copy as cURL',
  'workbench.editors.request.menu.copyAsFetch': 'Copy as fetch',
  'workbench.editors.request.schemeHint':
    'Your URL has no scheme. It will be sent as https:// — click the URL bar and press Tab or Enter to lock it in.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Authorization',
  'workbench.editors.request.tab.headers': 'Headers',
  'workbench.editors.request.tab.body': 'Body',
  'workbench.editors.request.tab.scripts': 'Scripts',
  'workbench.editors.request.tab.settings': 'Settings',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Enter URL or paste text',
  'workbench.editors.request.method.customGroup': 'Custom',
  'workbench.editors.request.method.usePrefix': 'Use',
  'workbench.editors.request.method.forbiddenSuffix': "can't be sent from a browser.",
  'workbench.editors.request.method.invalidHint': 'Methods use letters, digits, and hyphens (max 32).',
  'workbench.editors.request.method.removeCustomAria': 'Remove custom method {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Go to authorization',
  'workbench.editors.request.goToBody': 'Go to body',
  'workbench.editors.request.goToSettings': 'Go to settings',
  'workbench.editors.request.headers.keyPlaceholder': 'Header',
  'workbench.editors.request.headers.hideAuto': 'Hide auto-generated headers',
  'workbench.editors.request.headers.hiddenCount': '{count} hidden',
  'workbench.editors.request.headers.autoInfo':
    'These headers will be automatically added and sent with the request. Click the info icon on a row for per-header detail.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Duplicate — replaced on send by the {header} header generated from the Authorization tab.',
  'workbench.editors.request.headers.calculated': '<calculated when request is sent>',
  'workbench.editors.request.headers.browserUserAgent': '<browser user agent>',
  'workbench.editors.request.headers.hint.cacheControl':
    '"Cache-Control: no-cache" is added as a precautionary measure to prevent the server from returning stale responses when you make repeated requests. You can remove this header in the request settings or enter a new one with a different value.',
  'workbench.editors.request.headers.hint.contentType':
    'The runtime computes Content-Type from the body encoding (form-data → multipart/form-data with a boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; raw JSON → application/json; etc.). Set your own header to override.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length is computed from the serialized body byte size before the request is sent. The browser refuses to honour a user-set Content-Length that does not match the actual body length.',
  'workbench.editors.request.headers.hint.host':
    'The browser derives Host from the target URL and refuses to let userland code override it.',
  'workbench.editors.request.headers.hint.userAgent':
    'The User-Agent identifies the client. Requests go out with the browser’s own User-Agent; add your own User-Agent row below to override it.',
  'workbench.editors.request.headers.hint.accept':
    'Accept tells the server which media types the client can parse. `*/*` lets the server pick; override with a narrower set (e.g. `application/json`) to constrain responses.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Compression algorithms the browser supports. Set by the browser and negotiated per-connection; not overridable from userland.',
  'workbench.editors.request.headers.hint.connection':
    'HTTP/1.1 connection reuse. The browser manages the connection pool and does not let userland code override this header.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <credentials>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<value>',
  'workbench.editors.request.authPreview.accessTokenValue': '<access token>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <access token>',
  'workbench.editors.request.authPreview.basicHint':
    'Generated from the Authorization tab (Basic Auth). Username and password are base64-encoded into this header when the request is sent.',
  'workbench.editors.request.authPreview.bearerHint':
    'Generated from the Authorization tab (Bearer Token). The token is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    'Generated from the Authorization tab (API Key). The value is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    'Generated from the Authorization tab (API Key). The value is added to this query param when the request is sent.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    'Generated from the Authorization tab (OAuth 2.0). The access token is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    'Generated from the Authorization tab (OAuth 2.0). The access token is appended to the request URL when the request is sent.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <signature>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<request timestamp>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    'Generated from the Authorization tab (AWS Signature v4). The request is signed with your credentials when it is sent.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    'Generated from the Authorization tab (AWS Signature v4). The signing timestamp is added to this header when the request is sent.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <challenge response>',
  'workbench.editors.request.authPreview.digestHint':
    'Generated from the Authorization tab (Digest Auth). The value is computed from the server’s challenge when the request is sent, then the request is resent with it.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <signed parameters>',
  'workbench.editors.request.authPreview.oauth1Hint':
    'Generated from the Authorization tab (OAuth 1.0). The request is signed with your credentials when it is sent.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    'Generated from the Authorization tab (OAuth 1.0). The oauth_* parameters are added to the URL query when the request is sent.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Auth Type',
  'workbench.editors.request.auth.type.inherit': 'Inherit auth from parent',
  'workbench.editors.request.auth.type.none': 'No Auth',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Access Token',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'optional — empty for one-legged calls',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'optional — empty for one-legged calls',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Signature Method',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'optional',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth answers the server’s challenge with a second request, which runs on the desktop app and CLI. Sends from this surface go out without it — the server replies 401.',
  'workbench.editors.request.auth.inheritNote':
    'The authorization data will be automatically configured based on the parent collection.',
  'workbench.editors.request.auth.noneNote': 'This request does not use any authorization.',
  'workbench.editors.request.auth.inheritDetail':
    "This request is using the authorization helper from its parent collection. Edit the collection's Authorization tab to change it.",
  'workbench.editors.request.auth.resizeRailAria': 'Resize auth-type rail',
  'workbench.editors.request.auth.username': 'Username',
  'workbench.editors.request.auth.password': 'Password',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': 'Key',
  'workbench.editors.request.auth.keyPlaceholder': 'e.g. X-API-Key',
  'workbench.editors.request.auth.value': 'Value',
  'workbench.editors.request.auth.addTo': 'Add to',
  'workbench.editors.request.auth.addToHeader': 'Header',
  'workbench.editors.request.auth.addToQuery': 'Query Params',
  'workbench.editors.request.auth.usernamePlaceholder': 'username',
  'workbench.editors.request.auth.passwordPlaceholder': 'password',
  'workbench.editors.request.auth.tokenPlaceholder': 'bearer token',
  'workbench.editors.request.auth.valuePlaceholder': 'api key value',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': 'Service Name',
  'workbench.editors.request.auth.awsRegion': 'Region',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'e.g. AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'secret access key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'optional — temporary (STS) credentials only',
  'workbench.editors.request.auth.awsServicePlaceholder': 'e.g. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'e.g. us-east-1',
  'workbench.editors.request.auth.sendAsLabel': 'Add authorization data to',
  'workbench.editors.request.auth.sendAsHeaders': 'Request Headers',
  'workbench.editors.request.auth.sendAsUrl': 'Request URL',
  'workbench.editors.request.auth.presetLabel': 'Provider preset',
  'workbench.editors.request.auth.presetInfo':
    'Picking a provider pre-fills its authorization/token endpoints, default scopes, and recommended flow. Pick Custom to configure everything manually.',
  'workbench.editors.request.auth.presetCustom': 'Custom (no preset)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'Sending the access token in the URL is deprecated',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 kept the URI query-parameter method available but warns against it: tokens leak into server logs, HTTP `Referer` headers, browser history, and intermediary caches. Prefer the default',
  'workbench.editors.request.oauth.queryWarningAfter': 'header unless the provider requires the query form.',
  'workbench.editors.request.oauth.currentToken': 'Current Token',
  'workbench.editors.request.oauth.configureNewToken': 'Configure New Token',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': 'No token yet — use Get new access token below',
  'workbench.editors.request.oauth.headerPrefix': 'Header Prefix',
  'workbench.editors.request.oauth.autoRefresh': 'Auto-refresh Token',
  'workbench.editors.request.oauth.autoRefreshDesc':
    'Your expired token will be auto-refreshed before sending a request.',
  'workbench.editors.request.oauth.status': 'Status',
  'workbench.editors.request.oauth.statusExpired':
    'Expired — next send will auto-refresh when a refresh_token is stored.',
  'workbench.editors.request.oauth.statusValid': 'Valid · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Refresh now',
  'workbench.editors.request.oauth.disconnect': 'Disconnect',
  'workbench.editors.request.oauth.tokenName': 'Token Name',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Free-form label, surfaced in the credentials list when a workspace has several tokens against the same provider.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Enter a token name…',
  'workbench.editors.request.oauth.grantType': 'Grant type',
  'workbench.editors.request.oauth.callbackUrl': 'Callback URL',
  'workbench.editors.request.oauth.detecting': 'Detecting…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'Register this URL at your OAuth provider. It looks different from the',
  'workbench.editors.request.oauth.callbackTipBeforeHost': 'URL in your address bar because Chrome exposes a dedicated',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'redirect host for',
  'workbench.editors.request.oauth.callbackTipAfterApi':
    '. The extension ID is the same; only the host + scheme differ.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Authorize using browser',
  'workbench.editors.request.oauth.authUrl': 'Auth URL',
  'workbench.editors.request.oauth.accessTokenUrl': 'Access Token URL',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Automatically generated if left blank',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': 'e.g. read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': 'Automatically generated per authorize request',
  'workbench.editors.request.oauth.clientAuthentication': 'Client Authentication',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Where client_id / client_secret ride on token POSTs. Providers vary — Auth0 / Keycloak typically require the Basic header form.',
  'workbench.editors.request.oauth.clientAuthBody': 'Send client credentials in body',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Send as Basic Auth header',
  'workbench.editors.request.oauth.advanced': 'Advanced',
  'workbench.editors.request.oauth.advancedIntro':
    'You can add more specific customizations to your OAuth2 requests here.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Learn more about configuration',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh Token URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'Most providers reuse the Access Token URL for refresh; supply an override only when the provider exposes a distinct path.',
  'workbench.editors.request.oauth.authRequest': 'Auth Request',
  'workbench.editors.request.oauth.tokenRequest': 'Token Request',
  'workbench.editors.request.oauth.refreshRequest': 'Refresh Request',
  'workbench.editors.request.oauth.getNewToken': 'Get new access token',
  'workbench.editors.request.oauth.clearCookies': 'Clear cookies',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Tokens are stored per workspace under',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. Delete the workspace to purge.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: token received',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: authorization complete',
  'workbench.editors.request.oauth.toast.failed': 'OAuth failed: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: access token refreshed',
  'workbench.editors.request.oauth.toast.refreshFailed': 'Refresh failed: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: disconnected',
  'workbench.editors.request.oauth.toast.callbackCopied': 'Callback URL copied',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'Copy not supported — select the URL manually',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'This request does not have a body',
  'workbench.editors.request.body.beautify': 'Beautify',
  'workbench.editors.request.body.format': 'Format',
  'workbench.editors.request.body.formatAria': 'Format body',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'GraphQL query',
  'workbench.editors.request.body.queryInfoSummary':
    'Sent as a plain POST with a JSON body of { query, variables }. Schema introspection and query autocomplete are not available yet.',
  'workbench.editors.request.body.variablesTitle': 'GraphQL Variables',
  'workbench.editors.request.body.variablesInfoTitle': 'GraphQL variables',
  'workbench.editors.request.body.variablesInfoSummary':
    'Define variables in JSON format to reference from the query (e.g. $id).',
  'workbench.editors.request.body.kindText': 'Text',
  'workbench.editors.request.body.kindFile': 'File',
  'workbench.editors.request.body.newFile': 'New file from local machine',
  'workbench.editors.request.body.uploadedFiles': 'Uploaded files',
  'workbench.editors.request.body.allAttached': 'All uploaded files already attached',
  'workbench.editors.request.body.selectFiles': 'Select files',
  'workbench.editors.request.body.loadingFiles': 'Loading files…',
  'workbench.editors.request.body.addFile': '+ Add file',
  'workbench.editors.request.body.uploadRequired': 'Upload required',
  'workbench.editors.request.body.deleteFileAria': 'Delete {filename} from workspace',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Write',
  'workbench.editors.request.docs.preview': 'Preview',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'Document this request — why it exists, when to run it, expected auth scope. Markdown supported: headings, lists, tables, code blocks, links. {{variable}} references render as chips in the preview.',
  'workbench.editors.request.docs.placeholder':
    'What does this request do?\nWhy it exists, when to run it, expected auth scope.',
  'workbench.editors.request.docs.empty': 'Nothing documented yet — switch to Write to add notes.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Pre-request',
  'workbench.editors.request.scripts.postResponse': 'Post-response',
  'workbench.editors.request.scripts.preInfoTitle': 'Pre-request script',
  'workbench.editors.request.scripts.preInfoSummary':
    'Runs in a sandboxed iframe before the request is sent. Mutate the outgoing request with the oh API:',
  'workbench.editors.request.scripts.postInfoTitle': 'Post-response script',
  'workbench.editors.request.scripts.postInfoSummary':
    'Runs in a sandboxed iframe after the response arrives. Assertion results land in the Response panel:',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'add or replace a header',
  'workbench.editors.request.scripts.apiSetQueryParam': 'add or replace a query parameter',
  'workbench.editors.request.scripts.apiSetUrl': 'rewrite the target URL',
  'workbench.editors.request.scripts.apiSetBody': 'replace the request body',
  'workbench.editors.request.scripts.apiRequire': 'load a script package from the Package Library',
  'workbench.editors.request.scripts.apiTest': 'register an assertion',
  'workbench.editors.request.scripts.prePlaceholder': 'Use JavaScript to modify this request before it is sent.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Use JavaScript to test and read this response after it arrives.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.enabled': 'Enabled',
  'workbench.editors.request.settings.disabled': 'Disabled',
  'workbench.editors.request.settings.followRedirects': 'Automatically follow redirects',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Follow HTTP 3xx responses to their target. Switch off to stop at the redirect itself — the response shows as an opaque redirect with no headers or body, useful to confirm that a redirect happens at all.',
  'workbench.editors.request.settings.maxRedirects': 'Maximum redirects',
  'workbench.editors.request.settings.maxRedirectsInfo':
    'How many redirects a send may follow before failing with an error naming the limit. Leave empty for the default of 20. Set 0 to fail on any redirect at all.',
  'workbench.editors.request.settings.followOriginalMethod': 'Follow original HTTP method',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    'Keep the original method and body when a 301, 302, or 303 redirect would normally switch the request to GET. 307 and 308 redirects always keep the method either way.',
  'workbench.editors.request.settings.followAuthHeader': 'Follow Authorization header',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    "Keep the Authorization header when a redirect crosses to a different origin. Normally it is dropped on a cross-origin hop so credentials never travel to a host the request didn't address.",
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'Credentials travel to whatever host the redirect chain lands on. A response whose chain actually crossed origins is marked.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Send browser cookies',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    "Attach the browser's existing cookies for the target site to this request. Off is the safe default: the request is sent with no cookies, so results don't depend on your logged-in browser state.",
  'workbench.editors.request.settings.sslVerification': 'SSL certificate verification',
  'workbench.editors.request.settings.sslVerificationInfo':
    "Verify the server's TLS certificate against the runtime's trusted CA store. A host with a self-signed, expired, or otherwise untrusted certificate fails with a TLS certificate error — switch verification off to reach it anyway, e.g. a development server with a self-signed certificate.",
  'workbench.editors.request.settings.sslVerificationWarning':
    'Sends skip the server identity check — any certificate is accepted, including self-signed and expired ones. The response is marked as unverified.',
  'workbench.editors.request.settings.tlsMin': 'TLS version minimum',
  'workbench.editors.request.settings.tlsMinInfo':
    'Lowest TLS protocol version a send may negotiate. Leave empty for the runtime default of TLS 1.2. Choosing 1.0 or 1.1 lowers the floor below the default to reach legacy servers — a response sent with a lowered floor is marked.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (default)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Sends may negotiate TLS below 1.2 — protocol versions with known weaknesses. The response is marked.',
  'workbench.editors.request.settings.tlsMax': 'TLS version maximum',
  'workbench.editors.request.settings.tlsMaxInfo':
    "Highest TLS protocol version a send may negotiate. Leave empty for the runtime default of TLS 1.3. Lower it to check how a server behaves on an older protocol — the minimum may need lowering too, or the two won't overlap.",
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (default)',
  'workbench.editors.request.settings.tlsCipherSuites': 'TLS cipher suites',
  'workbench.editors.request.settings.tlsCipherSuitesInfo':
    "Cipher suites offered during the TLS handshake, as a colon-separated OpenSSL-format list — TLS 1.3 suite names and older suite names both go in the one list. Leave empty to offer the runtime's default suites. The server picks the suite from what is offered, in its own preference order.",
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Runtime default suites',
  'workbench.editors.request.settings.tlsCipherSuitesError': 'Colon-separated OpenSSL suite names only — no spaces.',
  'workbench.editors.request.settings.httpVersion': 'HTTP version',
  'workbench.editors.request.settings.httpVersionInfo':
    "How the send speaks HTTP. Auto (the default) offers HTTP/2 alongside HTTP/1.1 during the TLS handshake and the server picks — plain http:// stays HTTP/1.1. HTTP/1.1 pins classic semantics. HTTP/2 pins the protocol via the handshake offer: the send fails with a clear error when the server doesn't negotiate it, never a silent fallback. HTTP/2 (prior knowledge) skips negotiation and speaks HTTP/2 immediately — the route for cleartext HTTP/2 servers — and HTTP/3 dials QUIC; both fail honestly until this runtime supports them. The Network popover on the response always shows the protocol that was actually negotiated on the wire.",
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Auto — server picks',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (prior knowledge)',
  'workbench.editors.request.settings.resolveToAddress': 'Resolve to address',
  'workbench.editors.request.settings.resolveToAddressInfo':
    "Send this request to a specific server address instead of whatever DNS answers — the URL's hostname is still used for TLS and the Host header, so with verification on the certificate must still match it. Useful to test one specific backend behind a load balancer. The URL keeps its own port, and a redirect to another host also lands on this address. Leave empty to resolve through DNS as usual.",
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'System DNS',
  'workbench.editors.request.settings.resolveToAddressError': 'IPv4 or IPv6 address only — no hostname, no port.',
  'workbench.editors.request.settings.clientCertificate': 'Client certificate',
  'workbench.editors.request.settings.clientCertificateInfo':
    "Present a client certificate during the TLS handshake, for APIs behind mutual-TLS gateways that authenticate the caller by certificate. Pick a certificate entry from the vault — the request saves only the entry's name, and each device presents its own vault entry of that name; the certificate and key never leave the vault. Leave empty to connect without a client certificate.",
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'No client certificate',
  'workbench.editors.request.settings.clientCertificateDangling':
    'No vault certificate entry named "{name}" on this device — sends will fail until the entry exists or this setting is cleared.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxyInfo':
    "Route this request through an HTTP(S) proxy instead of connecting directly. The connection to the target tunnels through the proxy, so an https exchange stays end-to-end encrypted and certificate verification still runs against the target. SOCKS proxies are not supported. Credentials go in the 'Proxy credentials' setting below, never in this URL. Leave empty for a direct connection.",
  'workbench.editors.request.settings.proxyPlaceholder': 'No proxy — direct connection',
  'workbench.editors.request.settings.proxyError':
    'http:// or https:// URL with host and port only — no credentials in the URL, no SOCKS.',
  'workbench.editors.request.settings.proxyResolveConflict':
    'Also sets resolve-to-address, but a proxy resolves the hostname itself — sends will fail until one of the two is cleared.',
  'workbench.editors.request.settings.proxyCredentials': 'Proxy credentials',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    "Authenticate against the proxy with credentials from the vault, as user:password in a string entry. The request saves only the entry's name, and each device resolves it against its own local vault — the credentials never leave the vault and are sent only to the proxy, never to the target. Leave empty for a proxy that needs no authentication.",
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'No authentication',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'No vault string entry named "{name}" on this device — sends will fail until the entry exists or this setting is cleared.',
  'workbench.editors.request.settings.unixSocket': 'Unix socket',
  'workbench.editors.request.settings.unixSocketInfo':
    "Dial this local socket — an absolute Unix socket path, or a Windows named pipe like \\\\.\\pipe\\name — instead of opening a TCP connection, e.g. a Docker daemon or a local development service listening on a socket. The URL's host no longer decides where the connection goes, but the Host header, TLS server name, and certificate verification still use it, and a redirect to another host also dials this same socket. Leave empty for a normal TCP connection.",
  'workbench.editors.request.settings.unixSocketPlaceholder': 'No socket — TCP connection',
  'workbench.editors.request.settings.unixSocketError':
    'Absolute Unix socket path (/…) or Windows named pipe (\\\\.\\pipe\\…) only.',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'Also sets a proxy, but a proxy tunnel can’t dial a local socket — sends will fail until one of the two is cleared.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'Also sets resolve-to-address, but a socket dial resolves no hostname — sends will fail until one of the two is cleared.',
  'workbench.editors.request.settings.cookieJar': 'Use cookie jar',
  'workbench.editors.request.settings.cookieJarInfo':
    "Store this request's Set-Cookie responses in the app's own cookie jar and attach matching cookies automatically — so a login request followed by an authenticated call works without copying cookie values by hand. The jar lives in memory per workspace, is used only by requests with this setting on, never syncs, and is cleared when the app quits. A Cookie header you set yourself always wins. Off is the default: no cookies are attached and Set-Cookie responses are discarded.",
  'workbench.editors.request.settings.timeout': 'Request timeout',
  'workbench.editors.request.settings.timeoutInfo':
    "Maximum time the whole request may take — connecting, waiting for the response, and reading the body. When the limit elapses the send is aborted and fails with a timeout error naming it. Leave empty for no per-request limit; only the network stack's own timeouts apply.",
  'workbench.editors.request.settings.timeoutPlaceholder': 'No limit',
  'workbench.editors.request.settings.responseSizeLimit': 'Response size limit',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'Maximum response body size read off the wire; anything past it is cut off and the response is marked as truncated. Leave empty for the default limit of 2,048 KB (2 MB). Raise it up to 10,240 KB (10 MB) for larger payloads, or lower it to test how a truncated response looks.',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.managed.browserKicker': 'Browser-managed',
  'workbench.editors.request.settings.managed.nodeKicker': 'Runtime-managed',
  'workbench.editors.request.settings.managed.browserIntro':
    'Fixed by the browser for every request sent from an extension — shown so you know what is not negotiable.',
  'workbench.editors.request.settings.managed.nodeIntro':
    'Fixed by the app’s network runtime for every request — shown so you know what is not negotiable.',
  'workbench.editors.request.settings.managed.hideBrowser': 'Hide browser-managed settings',
  'workbench.editors.request.settings.managed.hideNode': 'Hide runtime-managed settings',
  'workbench.editors.request.settings.managed.countBrowser': '{count} browser-managed',
  'workbench.editors.request.settings.managed.countNode': '{count} runtime-managed',
  'workbench.editors.request.settings.managed.on': 'On',
  'workbench.editors.request.settings.managed.off': 'Off',
  'workbench.editors.request.settings.managed.auto': 'Auto',
  'workbench.editors.request.settings.managed.policy': 'Policy',
  'workbench.editors.request.settings.managed.browser': 'Browser',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Not sent',
  'workbench.editors.request.settings.managed.httpVersion': 'HTTP version',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'The browser negotiates HTTP/1.1, HTTP/2, or HTTP/3 per connection; the fetch API does not expose a version selector.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Certificates are verified by browser policy. A request to a host with an invalid certificate fails; verification cannot be disabled per request.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'On a 301/302/303 redirect the browser switches non-GET methods to GET per the fetch spec. 307/308 always preserve the method.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'The browser strips the Authorization header when a redirect crosses to a different origin; this safety behavior is not overridable.',
  'workbench.editors.request.settings.managed.refererRedirect': 'Remove Referer header on redirect',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'Referer handling across redirects follows the browser referrer policy for the extension context.',
  'workbench.editors.request.settings.managed.strictParser': 'Strict HTTP parser',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'The browser network stack always rejects malformed response headers; there is no lenient mode.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'The runtime’s HTTP parser rejects malformed response headers; there is no lenient mode.',
  'workbench.editors.request.settings.managed.encodeUrl': 'Encode URL automatically',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'The URL path and query are percent-encoded by the URL parser before the request goes on the wire. Type already-encoded sequences to keep them verbatim.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Server cipher suite order',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'TLS cipher negotiation is owned by the browser; neither suite list nor order is configurable.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'The fetch API caps the redirect chain at about 20 hops. A per-request cap is not implementable: manual redirect mode returns an opaque response with no headers to follow.',
  'workbench.editors.request.settings.managed.tlsVersions': 'TLS/SSL protocol versions',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Enabled TLS protocol versions are fixed by the browser; per-request selection is not exposed.',
  'workbench.editors.request.settings.managed.referer': 'Referer header',
  'workbench.editors.request.settings.managed.refererDesc':
    'The runtime has no page context, so no Referer goes on the wire unless you add one as a header yourself.',
  'workbench.editors.request.settings.managed.scripts': 'Pre-request / post-response scripts',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'Don’t run here',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'The host answering this surface’s sends has no script runtime, so pre-request and post-response scripts are skipped and the response carries no script results.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Safe mode',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'This surface’s sends execute on the connected back-end, which runs pre-request and post-response scripts in its sandboxed Safe runtime: the oh.* script API only — no filesystem, no process access, no module loader. Forwarded sends never run in Developer mode, and each run records the mode it executed under on the response.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Script execution',
  'workbench.editors.request.settings.scriptModeInfo':
    'How pre-request and post-response scripts in this workspace run on this device. Safe mode executes them in the app’s sandboxed script runtime: the oh.* script API only — no filesystem, no process access, no module loader. Developer mode executes them in a full Node.js runtime with require and system access. The choice applies to every request in the workspace, stays on this device, and never syncs — each run records the mode it executed under on the response.',
  'workbench.editors.request.settings.scriptModeSafe': 'Safe mode',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Developer mode',
  'workbench.editors.request.settings.scriptModeWarning':
    'Developer mode runs this workspace’s scripts with full system access — filesystem, processes, and network. Enable it only if you trust everyone who can edit this workspace’s scripts. Workflow steps and requests forwarded by other devices keep running in Safe mode.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Script execution: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Recommended',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'Scripts run in the app’s sandboxed script runtime — the oh.* script API only, with no filesystem or process access and no module loader.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'Scripts run in a full Node.js runtime — require, filesystem, processes, and network access.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'Use only if you trust everyone who can edit this workspace’s scripts',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'Applies to every request in this workspace, on this device only — the choice never syncs.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie in this workspace’s jar',
      other: '{count} cookies in this workspace’s jar',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Cookie jar contents',
  'workbench.editors.request.settings.jar.infoSummary':
    'Cookies currently held by this workspace’s in-memory jar — stored by jar-enabled sends, attached to jar-enabled sends that match, and gone when the app quits. Values are session credentials and stay inside the app’s network runtime; only name, scope, and expiry are shown.',
  'workbench.editors.request.settings.jar.storedHeading': 'Stored cookies',
  'workbench.editors.request.settings.jar.clear': 'Clear',
  'workbench.editors.request.settings.jar.delete': 'Delete {name}',
  'workbench.editors.request.settings.jar.expires': 'expires {date}',
  'workbench.editors.request.settings.jar.session': 'session',
  'workbench.editors.request.settings.jar.httpsOnly': 'https only',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Response',
  'workbench.editors.request.response.clear': 'Clear',
  'workbench.editors.request.response.saveResponse': 'Save Response',
  'workbench.editors.request.response.createWorkflow': 'Create workflow',
  'workbench.editors.request.response.createWorkflowNew': 'Create new workflow',
  'workbench.editors.request.response.createWorkflowAttach': 'Attach to existing workflow',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    'This request is unsaved — save it first to use it in a workflow',
  'workbench.editors.request.response.copyBody': 'Copy body',
  'workbench.editors.request.response.saveBodyToFile': 'Save body to file',
  'workbench.editors.request.response.saveBodyToFileTruncated': 'Save body to file (truncated — saves what was kept)',
  'workbench.editors.request.response.clearResponse': 'Clear response',
  'workbench.editors.request.response.moreActionsAria': 'More response actions',
  'workbench.editors.request.response.copied': 'Copied',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Body',
  'workbench.editors.request.response.tab.headers': 'Headers ({count})',
  'workbench.editors.request.response.tab.cookies': 'Cookies ({count})',
  'workbench.editors.request.response.tab.assertions': 'Assertions',
  'workbench.editors.request.response.tab.assertionsFailed': 'Assertions ({count} failed)',
  'workbench.editors.request.response.tab.assertionsPassed': 'Assertions ({count} passed)',
  'workbench.editors.request.response.tab.console': 'Console ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Response meta',
  'workbench.editors.request.response.meta.timingTitle': 'Timing',
  'workbench.editors.request.response.meta.timingSummary': 'Measured around the fetch call: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    'The platform recorded no resource-timing entry for this request, so no phase breakdown is available.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'Network total {duration}. The server did not expose timing detail to this cross-origin request (no Timing-Allow-Origin header), so the DNS / connect / TTFB / download phases are hidden.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Redirects',
  'workbench.editors.request.response.meta.phase.stalled': 'Stalled',
  'workbench.editors.request.response.meta.phase.dns': 'DNS lookup',
  'workbench.editors.request.response.meta.phase.connect': 'TCP connect',
  'workbench.editors.request.response.meta.phase.tls': 'TLS handshake',
  'workbench.editors.request.response.meta.phase.waiting': 'Waiting (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Content download',
  'workbench.editors.request.response.meta.totalNetwork': 'Total (network)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS, connect, and TLS are not observable per send from the app’s network runtime — they are included in Waiting.',
  'workbench.editors.request.response.meta.sizeTitle': 'Size',
  'workbench.editors.request.response.meta.sizeSummary': 'Bytes in each direction of this exchange.',
  'workbench.editors.request.response.meta.responseSize': 'Response Size',
  'workbench.editors.request.response.meta.requestSize': 'Request Size',
  'workbench.editors.request.response.meta.rowHeaders': 'Headers',
  'workbench.editors.request.response.meta.rowBody': 'Body',
  'workbench.editors.request.response.meta.rowCompressed': 'Compressed',
  'workbench.editors.request.response.meta.rowTransferred': 'Transferred',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    'Header bytes as visible — HTTP/2+ compresses them on the wire.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Request headers count only what this send set; the browser adds its own (Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Body truncated at the {cap} response size limit; the full size is counted.',
  'workbench.editors.request.response.meta.noteTruncated': 'Body view truncated; the full size is counted.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'Request body size is approximate — the multipart boundary is browser-generated.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Wire sizes (compressed, transferred) hidden: the server sent no Timing-Allow-Origin.',
  'workbench.editors.request.response.meta.noteWireHiddenNode':
    'Wire sizes (compressed, transferred) are not reported by the app’s network runtime.',
  'workbench.editors.request.response.meta.networkTitle': 'Network',
  'workbench.editors.request.response.meta.networkSummary': 'Connection-level facts for this exchange.',
  'workbench.editors.request.response.meta.httpVersion': 'HTTP Version',
  'workbench.editors.request.response.meta.localAddress': 'Local Address',
  'workbench.editors.request.response.meta.remoteAddress': 'Remote Address',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'HTTP version hidden: the negotiated protocol was not observable for this send (proxied sends negotiate inside the tunnel).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'HTTP version hidden: the platform recorded no timing entry for this request.',
  'workbench.editors.request.response.meta.noteNoIp':
    'Remote address unavailable: the wire capture saw nothing for this fetch.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Local address, TLS and certificate details are not exposed to extension code on Chromium.',
  'workbench.editors.request.response.meta.tagUnverifiedTls': 'Unverified TLS',
  'workbench.editors.request.response.meta.unverifiedTlsTitle': 'SSL verification disabled',
  'workbench.editors.request.response.meta.unverifiedTlsSummary':
    'This request was sent with certificate verification switched off in its Settings. The connection was encrypted, but the server’s identity was not checked — any certificate was accepted, including self-signed and expired ones.',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'TLS floor lowered',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'This request was sent with its minimum TLS version set below 1.2 in its Settings, so the connection was allowed to negotiate TLS 1.0 or 1.1 — protocol versions with known weaknesses that runtimes disable by default.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization forwarded',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'A redirect took this request to a different origin, and its Settings keep the Authorization header across origins — so the credentials were re-sent to the new host. Normally the header is dropped when a redirect leaves the original origin.',
  'workbench.editors.request.response.meta.executedOnTag': 'Sent from {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Executed on the connected back-end',
  'workbench.editors.request.response.meta.executedOnSummary':
    'This request was sent by "{name}" — the back-end this surface is connected to — not from this device. The target server saw that machine’s IP address and network location, so geo- or IP-based behavior reflects where the back-end runs. Recorded on this run by the host that executed it.',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'This request used the workspace’s in-memory cookie jar: matching stored cookies were attached automatically, and Set-Cookie responses were kept for later jar-enabled sends.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'Attached to the first request',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Nothing — no stored cookie matched, or a Cookie header set on the request won.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Stored from Set-Cookie responses',
  'workbench.editors.request.response.meta.jarStoredNone': 'Nothing — no response set a cookie.',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} redirect', other: '{count} redirects' }),
  'workbench.editors.request.response.meta.redirectsTitle': 'Redirect chain',
  'workbench.editors.request.response.meta.redirectsSummary':
    'The hops this request followed before the final response — each one shows the request that was sent and the redirect it answered with, recorded when the send ran.',
  'workbench.editors.request.response.meta.redirectMethodChanged': 'Method changed to {method} for the next request',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Authorization header dropped — the next request crossed to a different origin',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Authorization header re-sent across origins — kept by this request’s Settings',
  'workbench.editors.request.response.meta.redirectFinal': 'Final response',
  'workbench.editors.request.response.meta.streamedEnd': 'Stream ended',
  'workbench.editors.request.response.meta.streamedStop': 'Stopped',
  'workbench.editors.request.response.meta.streamedCap': 'Stream capped',
  'workbench.editors.request.response.meta.streamedTimeout': 'Timed out mid-stream',
  'workbench.editors.request.response.meta.streamedError': 'Stream failed',
  'workbench.editors.request.response.meta.streamedEndSummary':
    'This response streamed in live until the server closed the stream. The body below is the complete capture.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    'The response was still streaming when the exchange ended, so the body below is the partial capture up to that point — everything that arrived was kept.',
  'workbench.editors.request.response.streamReceiving': 'Receiving stream — {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': 'Connected to {url}',
  'workbench.editors.request.response.sse.closed': 'Connection closed',
  'workbench.editors.request.response.sse.stopped': 'Connection stopped',
  'workbench.editors.request.response.sse.capped': 'Capture capped — the body limit was reached',
  'workbench.editors.request.response.sse.timedOut': 'Connection timed out',
  'workbench.editors.request.response.sse.failed': 'Connection failed',
  'workbench.editors.request.response.sse.searchEvents': 'Search events',
  'workbench.editors.request.response.sse.noMatches': 'No events match.',
  'workbench.editors.request.response.sse.waiting': 'Waiting for events…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} event', other: '{count} events' }),
  'workbench.editors.request.response.sse.clearEvents': 'Clear events (display only)',
  'workbench.editors.request.response.sse.newEvents': 'New events',
  'workbench.editors.request.response.sse.sortOrder': 'Sort order',
  'workbench.editors.request.response.sse.newestFirst': 'Newest first',
  'workbench.editors.request.response.sse.oldestFirst': 'Oldest first',
  'workbench.editors.request.response.sse.groupByName': 'Group by event name',
  'workbench.editors.request.response.sse.rowsPerGroup': 'Rows per group',
  'workbench.editors.request.response.sse.noLimit': 'No limit',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'Size',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': 'Event details',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'Response truncated at {cap} (original {size}).',
  'workbench.editors.request.response.body.increaseLimit': 'Increase limit',
  'workbench.editors.request.response.body.limitHint': 'The limit is adjustable in Settings → API Requests.',
  'workbench.editors.request.response.body.viewPickerAria': 'Body view',
  'workbench.editors.request.response.body.preview': 'Preview',
  'workbench.editors.request.response.body.wrapLines': 'Wrap lines',
  'workbench.editors.request.response.body.unwrapLines': 'Unwrap lines',
  'workbench.editors.request.response.body.renderAnsi': 'Render ANSI colors',
  'workbench.editors.request.response.body.plainAnsi': 'Show plain text',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Filter body (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Filter body (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Filter body (metric families)',
  'workbench.editors.request.response.body.filterAria': 'Filter body',
  'workbench.editors.request.response.body.invalidJsonPath': 'Invalid JSONPath expression.',
  'workbench.editors.request.response.body.invalidXPath': 'Invalid XPath expression, or the document does not parse.',
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Invalid metric selector.',
  'workbench.editors.request.response.body.noMatches': 'No matches for this path.',
  'workbench.editors.request.response.body.showingLastMatch': 'Showing the last match.',
  'workbench.editors.request.response.body.hexCapNotice': 'Hex view shows the first {shown} of {total}.',
  'workbench.editors.request.response.body.previewIframeTitle': 'Response preview',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'PDF preview',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Response image',
  'workbench.editors.request.response.body.imagePreviewFailed':
    'The image data does not decode — see the Hex view for the raw bytes.',
  'workbench.editors.request.response.body.mediaPreviewAria': 'Media preview',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'The media data does not decode — see the Hex view for the raw bytes.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Request body not sent — the browser cannot attach a body to GET or HEAD requests.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Duplicate JSON keys — the last value is shown: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Truncated body — Preview and filter show only the values captured completely.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    'Schema-less decode (best effort) — field numbers shown; nesting and text are inferred from the wire bytes.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Name',
  'workbench.editors.request.response.headers.value': 'Value',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Filter headers',
  'workbench.editors.request.response.headers.copyAll': 'Copy all headers',
  'workbench.editors.request.response.headers.copyAria': 'Copy {name}',
  'workbench.editors.request.response.headers.copyTitle': 'Copy header',
  'workbench.editors.request.response.headers.empty': 'No headers',
  'workbench.editors.request.response.headers.noMatch': 'No headers match “{query}”',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Name',
  'workbench.editors.request.response.cookies.value': 'Value',
  'workbench.editors.request.response.cookies.copyAria': 'Copy Set-Cookie for {name}',
  'workbench.editors.request.response.cookies.copyTitle': 'Copy Set-Cookie line',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'This request ran with credentials included, so the browser may have stored these cookies (subject to each cookie’s own attributes) and will send them on future credentialed requests.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'The server sent these cookies, but this request ran with credentials omitted (the default), so the browser discarded them — nothing was stored.',
  'workbench.editors.request.response.cookies.noteJarOff':
    'These cookies were not stored — this request ran without the cookie jar (the default), or the jar accepted none of them.',
  'workbench.editors.request.response.cookies.noteJarStored':
    'This request ran with the cookie jar on, which stored {names} in the workspace’s in-memory jar for future jar-enabled requests.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'This request ran with the cookie jar on, which stored {names} in the workspace’s in-memory jar for future jar-enabled requests. Some were set on intermediate redirect hops, so their Set-Cookie lines are not listed here — only the final response’s headers are.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'PASS',
  'workbench.editors.request.response.assertions.fail': 'FAIL',
  'workbench.editors.request.response.console.preRequest': 'Pre-request',
  'workbench.editors.request.response.console.postResponse': 'Post-response',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Sending request…',
  'workbench.editors.request.response.empty.prompt': 'Send the request to see the response here.',
  'workbench.editors.request.response.error.title': 'Could not send request',
  'workbench.editors.request.response.error.openInTab': 'Open in new tab',
  'workbench.editors.request.response.error.certSteps.summary':
    'Local dev servers usually run with a self-signed certificate, which you need to accept.',
  'workbench.editors.request.response.error.certSteps.step1': 'Open the URL in a new tab',
  'workbench.editors.request.response.error.certSteps.step2': 'Accept the certificate warning',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': 'Advanced → Proceed (unsafe)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': 'Advanced… → Accept the Risk and Continue',
  'workbench.editors.request.response.error.certSteps.step3': 'Send the request again',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': 'new tab',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': 'Advanced',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ Send',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': 'Proceed (unsafe)',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': 'Accept the Risk and Continue',
} as const satisfies Catalog;
