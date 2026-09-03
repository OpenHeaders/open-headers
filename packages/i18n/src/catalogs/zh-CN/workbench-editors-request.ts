/**
 * Workbench editors — the API request editor — Simplified Chinese.
 * Mirrors `catalogs/en/workbench-editors-request.ts` key for key;
 * extends the zh-CN register contract (`zh-CN/shared.ts`). Raw by
 * design: HTTP methods, header names, MIME types, auth scheme names
 * (Basic Auth / Bearer Token / API Key / OAuth 2.0 / AWS Signature
 * v4 / Digest Auth / OAuth 1.0), OAuth/PKCE spec params (Client ID,
 * Client Secret, Code Verifier, State, refresh_token, oauth_*),
 * body-mode enums, `Docs` / `Params` tab names (设置 = Settings tab,
 * S58 law), wire tokens (Timing-Allow-Origin, resource-timing,
 * Referer, Host, User-Agent, Set-Cookie, SSE `ID`/`Retry`,
 * Trailers), the phase ladder's DNS/TCP/TLS/TTFB tokens, generated
 * `<calculated…>` placeholder values verbatim, and lowercase vault /
 * oh (token case follows en). Assertion verdicts translate
 * caps-for-caps as plain nouns（通过 / 失败）. Reuses shipped mints:
 * 继承（editors, the Inherit label）, 发送 / 正文 / 授权 / 标头 /
 * 美化 / 键 / 值 / 描述（editors grid）, 脚本 / 请求前脚本 /
 * 响应后脚本, 后端 = back-end, 断言 = assertion（workbench-live）,
 * 运行时 = runtime, and the shared-conflicts scalar twins quoted
 * verbatim for the Settings knob labels（TLS 最低版本 / TLS
 * 最高版本 / TLS 密码套件 / 允许 HTTP/2 / 解析到地址 / 客户端证书 /
 * 代理凭据 / Unix 套接字 / 请求超时 / 响应大小限制 /
 * 最大重定向次数 / 跟随原始 HTTP 方法 / 跟随 Authorization 标头）.
 * `Cookie jar` rides raw where en capitalizes; zh prose says Cookie
 * 罐（S67 law）. MINTS: 安全模式 / 开发者模式 = script execution
 * modes; 下限 = TLS floor; 沙箱 = sandbox（沙箱化 adjectival）.
 * Browser cert-interstitial paths quote the browsers' own zh-CN UI
 * (both localize zh): Chrome 高级 → 继续前往（不安全）, Firefox
 * 高级… → 接受风险并继续.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': '未找到请求。',
  'workbench.editors.request.loading': '正在加载请求…',
  'workbench.editors.request.toast.deletedOtherTab': '请求已在另一个标签页中被删除',
  'workbench.editors.request.toast.updateFailed': '更新请求失败',
  'workbench.editors.request.toast.updateFailedDetail': '更新请求失败：{message}',
  'workbench.editors.request.toast.invalidSetting': '{label}无效——请先在设置中修正后再保存。',
  'workbench.editors.request.toast.savedExample': '已保存示例“{name}”',
  'workbench.editors.request.toast.saveExampleFailed': '保存示例失败',
  'workbench.editors.request.toast.saveExampleFailedDetail': '保存示例失败：{message}',
  'workbench.editors.request.send.label': '发送',
  'workbench.editors.request.send.sending': '正在发送…',
  'workbench.editors.request.send.unresolvedTooltip':
    '请求含有未解析的变量。发送前请在 vault、环境、集合、工作区或 live 工作流中定义它们。',
  'workbench.editors.request.send.remoteDispatchHint': '在 {host} 上运行——已连接的后端',
  'workbench.editors.request.send.stop': '停止',
  'workbench.editors.request.send.stopTooltip': '停止请求并保留已到达的内容',
  'workbench.editors.request.menu.copyAsCurl': '复制为 cURL',
  'workbench.editors.request.menu.copyAsFetch': '复制为 fetch',
  'workbench.editors.request.schemeHint':
    '你的 URL 没有协议前缀。它将按 https:// 发送——点击 URL 栏并按 Tab 或 Enter 即可锁定。',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': '授权',
  'workbench.editors.request.tab.headers': '标头',
  'workbench.editors.request.tab.body': '正文',
  'workbench.editors.request.tab.scripts': '脚本',
  'workbench.editors.request.tab.settings': '设置',
  'workbench.editors.request.spec.selectLabel': 'OpenAPI 规范',
  'workbench.editors.request.spec.none': '此请求未关联 OpenAPI 规范。',
  'workbench.editors.request.spec.selectPlaceholder': '关联 OpenAPI 规范…',
  'workbench.editors.request.spec.inheritedPlaceholder': '继承自集合：{name}',
  'workbench.editors.request.spec.fromCollection': '来自集合 {name}',
  'workbench.editors.request.spec.missing': '关联的规范已不在此工作区中。',
  'workbench.editors.request.spec.parseFailure': '规范解析失败：{message}',
  'workbench.editors.request.spec.drifted': '此集合生成后规范已更改。',
  'workbench.editors.request.spec.operation': '操作',
  'workbench.editors.request.spec.noOperation': '规范中没有与 {method} {url} 匹配的操作。',
  'workbench.editors.request.spec.inSync': '与规范一致。',
  'workbench.editors.request.spec.fieldDiffers': '{field} 与规范不同。',
  'workbench.editors.request.spec.apply': '应用',
  'workbench.editors.request.spec.applyAll': '全部应用',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': '输入 URL 或粘贴文本',
  'workbench.editors.request.url.socketCta': '套接字风格 URL——发送将通过 Unix 套接字设置拨号 {path}。',
  'workbench.editors.request.url.socketCtaApply': '应用',
  'workbench.editors.request.method.customGroup': '自定义',
  'workbench.editors.request.method.usePrefix': '使用',
  'workbench.editors.request.method.forbiddenSuffix': '无法从浏览器发送。',
  'workbench.editors.request.method.invalidHint': '方法只能使用字母、数字和连字符（最多 32 个字符）。',
  'workbench.editors.request.method.removeCustomAria': '移除自定义方法 {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': '前往授权',
  'workbench.editors.request.goToBody': '前往正文',
  'workbench.editors.request.headers.keyPlaceholder': '标头',
  'workbench.editors.request.headers.hideAuto': '隐藏自动生成的标头',
  'workbench.editors.request.headers.hiddenCount': '已隐藏 {count} 个',
  'workbench.editors.request.headers.autoInfo':
    '这些标头会被自动添加并随请求一起发送。点击行上的信息图标可查看每个标头的详情。',
  'workbench.editors.request.headers.duplicateAuthOverride': '此标头重复，将被授权设置生成的 {header} 标头覆盖。',
  'workbench.editors.request.headers.calculated': '<calculated when request is sent>',
  'workbench.editors.request.headers.browserUserAgent': '<browser user agent>',
  'workbench.editors.request.headers.hint.cacheControl':
    '从浏览器主机发送时都会带上“Cache-Control: no-cache”，这样重复请求时服务器不会从过期缓存应答。添加你自己的 Cache-Control 行可发送其他值。',
  'workbench.editors.request.headers.hint.contentType':
    '运行时会根据正文编码计算 Content-Type（form-data → 带 boundary 的 multipart/form-data；x-www-form-urlencoded → application/x-www-form-urlencoded；raw JSON → application/json；等等）。设置你自己的标头即可覆盖。',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length 在请求发送前根据序列化后的正文字节大小计算。浏览器拒绝采用与实际正文长度不符的用户自设 Content-Length。',
  'workbench.editors.request.headers.hint.host': '浏览器从目标 URL 推导 Host，并拒绝让用户代码覆盖它。',
  'workbench.editors.request.headers.hint.userAgent':
    'User-Agent 标识客户端。请求会以浏览器自己的 User-Agent 发出；在下方添加你自己的 User-Agent 行即可覆盖。',
  'workbench.editors.request.headers.hint.accept':
    'Accept 告诉服务器客户端能解析哪些媒体类型。`*/*` 让服务器自行选择；用更窄的集合（如 `application/json`）覆盖可约束响应。',
  'workbench.editors.request.headers.hint.acceptEncoding':
    '浏览器支持的压缩算法。由浏览器设置并按连接协商；无法从用户代码覆盖。',
  'workbench.editors.request.headers.hint.connection':
    'HTTP/1.1 连接复用。浏览器管理连接池，不允许用户代码覆盖此标头。',
  'workbench.editors.request.headers.hint.node.host': '发送时从目标 URL 推导。你自己的 Host 行会在线路上替换它。',
  'workbench.editors.request.headers.hint.node.connection':
    'node 运行时保持连接并按来源复用。你自己的 Connection 行会替换它。',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'node 运行时的 fetch 客户端发送通配符。你自己的行会替换它。',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    '由 node 运行时的 fetch 客户端在每次发送时附加。你自己的行会替换它。',
  'workbench.editors.request.headers.hint.node.userAgent':
    'node 运行时在每次发送时标识本应用。添加你自己的 User-Agent 行可发送其他值。',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'node 运行时接受并为你解码的压缩方式。你自己的行会替换它——响应体将按原样到达。',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <credentials>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<value>',
  'workbench.editors.request.authPreview.accessTokenValue': '<access token>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <access token>',
  'workbench.editors.request.authPreview.basicHint':
    '由授权标签页生成（Basic Auth）。发送请求时，用户名和密码会经 base64 编码写入此标头。',
  'workbench.editors.request.authPreview.bearerHint':
    '由授权标签页生成（Bearer Token）。发送请求时，token 会被添加到此标头。',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    '由授权标签页生成（API Key）。发送请求时，该值会被添加到此标头。',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    '由授权标签页生成（API Key）。发送请求时，该值会被添加到此查询参数。',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    '由授权标签页生成（OAuth 2.0）。发送请求时，访问 token 会被添加到此标头。',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    '由授权标签页生成（OAuth 2.0）。发送请求时，访问 token 会被追加到请求 URL。',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <signature>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<request timestamp>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    '由授权标签页生成（AWS Signature v4）。发送时用你的凭据对请求签名。',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    '由授权标签页生成（AWS Signature v4）。发送请求时，签名时间戳会被添加到此标头。',
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<已签名参数>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    '由\u201c授权\u201d标签生成（AWS Signature v4）。发送请求时，X-Amz-* 参数会追加到 URL 查询字符串。',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <已签名参数>',
  'workbench.editors.request.authPreview.edgeGridHint':
    '由\u201c授权\u201d标签生成（Akamai EdgeGrid）。发送请求时用您的凭据签名。',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <已签名 JWT>',
  'workbench.editors.request.authPreview.asapHint':
    '由\u201c授权\u201d标签生成（ASAP）。发送请求时用您的私钥签发新令牌并加入此标头。',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<覆盖的组件>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<签名>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    '由“授权”标签页生成（HTTP 消息签名）。发送时使用你的密钥对请求签名。',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<正文摘要>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    '由“授权”标签页生成（HTTP 消息签名）。正文摘要在发送时计算。',
  'workbench.editors.request.authPreview.digestValue': 'Digest <challenge response>',
  'workbench.editors.request.authPreview.digestHint':
    '由授权标签页生成（Digest Auth）。发送请求时根据服务器的质询计算该值，然后带上它重新发送请求。',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <signed parameters>',
  'workbench.editors.request.authPreview.oauth1Hint': '由授权标签页生成（OAuth 1.0）。发送时用你的凭据对请求签名。',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    '由授权标签页生成（OAuth 1.0）。发送请求时，oauth_* 参数会被添加到 URL 查询串。',
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <signed parameters>',
  'workbench.editors.request.authPreview.hawkHint':
    '由授权标签页生成（Hawk Authentication）。发送时用你的凭据对请求签名。',
  'workbench.editors.request.authPreview.jwtValue': '<signed JWT>',
  'workbench.editors.request.authPreview.jwtHint': '由授权标签页生成（JWT Bearer）。发送请求时签名令牌并添加到此标头。',
  'workbench.editors.request.authPreview.jwtQueryHint':
    '由授权标签页生成（JWT Bearer）。发送请求时签名令牌并添加到此查询参数。',
  'workbench.editors.request.authPreview.inheritedFrom': '继承自{source}——请在父级中编辑。',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': '授权类型',
  'workbench.editors.request.auth.group.credentials': '凭据',
  'workbench.editors.request.auth.group.token': '令牌',
  'workbench.editors.request.auth.group.signing': '签名',
  'workbench.editors.request.auth.group.consumer': '消费者',
  'workbench.editors.request.auth.group.attributes': '属性',
  'workbench.editors.request.auth.group.delivery': '投递',
  'workbench.editors.request.auth.group.challenge': '质询',
  'workbench.editors.request.auth.group.grant': '授权',
  'workbench.editors.request.auth.group.advanced': '高级',
  'workbench.editors.request.auth.group.coverage': '覆盖范围',
  'workbench.editors.request.auth.group.parameters': '参数',
  'workbench.editors.request.auth.typeInfo.none': '不添加任何内容 \u2014 请求按 Headers 和 Params 标签页所示原样发出。',
  'workbench.editors.request.auth.typeInfo.basic':
    '用户名和密码以冒号连接、base64 编码后，每次发送都作为 Authorization: Basic 标头发出 \u2014 只是编码而非加密，因此仅限 HTTPS。',
  'workbench.editors.request.auth.typeInfo.bearer':
    '每次发送时，令牌原样跟在 Authorization 标头的 Bearer 方案之后发出。',
  'workbench.editors.request.auth.typeInfo.apiKey':
    '键指定一个标头或查询参数，值随之发送 \u2014 大多数公共 API 使用的简单凭据方案。',
  'workbench.editors.request.auth.typeInfo.digest':
    '首次发送引出服务器的 401 质询（realm、nonce、qop）；凭据与之一起散列进 response= 并重试请求 \u2014 密码本身从不发送。',
  'workbench.editors.request.auth.typeInfo.oauth1':
    '消费者与令牌凭据对由方法、URL 和参数组成的基础字符串签名；签名后的 oauth_* 参数放在 Authorization 标头或 URL 中，nonce、时间戳和版本每次发送时生成。',
  'workbench.editors.request.auth.typeInfo.hawk':
    '对方法、URL、时间戳、nonce 及可选属性计算的 MAC 放在 Authorization: Hawk 标头中；时间戳和 nonce 每次发送时生成。',
  'workbench.editors.request.auth.typeInfo.jwt':
    '每次发送时用此处的密钥材料铸造并签名一个新 JWT \u2014 即下方的标头、载荷和签名 \u2014 并作为 bearer 令牌或查询参数投递。',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    '成为 base64 凭据的这一对 \u2014 两者都会发送，编码但不加密。',
  'workbench.editors.request.auth.groupInfo.bearer.token': '服务器签发的令牌原样；Bearer 方案在线路上前置。',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    '名称与密文 \u2014 名称即标头或参数，值即随之发送的内容。',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery': '键落在何处：请求标头，或追加到 URL 的查询参数。',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    '用于计算质询响应的这一对 \u2014 用户名会发送，密码只作为响应散列的一部分。',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    '桌面和 CLI 发送时如何处理 401 环节 \u2014 除非禁用，否则自动应答并重试。',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    '为基础字符串签名的方法 \u2014 使用密文的 HMAC、使用私钥的 RSA 或 PLAINTEXT \u2014 以及正文是否散列进去。',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    '应用的凭据 \u2014 键作为 oauth_consumer_key 发送，密文（或私钥）只通过 oauth_signature 体现。',
  'workbench.editors.request.auth.groupInfo.oauth1.token': '三方流程得到的用户访问令牌对 \u2014 单方调用请两者留空。',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'oauth_* 参数落在何处 \u2014 Authorization 标头（可带 realm）或 URL 的查询字符串。',
  'workbench.editors.request.auth.groupInfo.hawk.credentials': 'id 放在标头中；密钥只通过它计算出的 MAC 体现。',
  'workbench.editors.request.auth.groupInfo.hawk.signing': 'MAC 的摘要算法，以及请求正文是否作为 hash= 散列进去。',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    '该方案的可选属性 \u2014 应用数据（ext）、应用 ID（app）与委托方（dlg）\u2014 存在时参与签名。',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'JWT 标头中声明的算法及为其签名的密钥材料 \u2014 HS 用共享密文，RS / PS / ES 用私钥。',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'JWT 承载的内容 \u2014 载荷声明、额外的受保护标头，以及作为 iat / exp 盖戳的可选有效期。',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    '签名后的 JWT 落在何处 \u2014 带前缀的 Authorization 标头，或 token 查询参数。',
  'workbench.editors.request.auth.rowInfo.basicUsername': '位于 base64 凭据中冒号之前。',
  'workbench.editors.request.auth.rowInfo.basicPassword': '位于冒号之后 \u2014 只编码不加密，因此仅限 HTTPS。',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    '原样跟在 Bearer 之后发送；粘贴的“Bearer \u2026”会在此去掉前缀。',
  'workbench.editors.request.auth.rowInfo.apiKeyKey': '值所在的标头名或查询参数名。',
  'workbench.editors.request.auth.rowInfo.apiKeyValue': '作为标头值或参数值发送的密文。',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    'Header 将键放在请求上；Query Params 将其追加到 URL，会进入日志。',
  'workbench.editors.request.auth.rowInfo.digestUsername': '在质询应答中作为 username= 发送。',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    '从不发送 \u2014 与 realm、nonce 和方法一起散列进 response=。',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry': '停止自动的第二步：401 直接作为响应返回，而不应答。',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    '在 oauth_signature_method 中声明签名算法，并决定下方的凭据组合。',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    '用该方法的散列将非表单正文摘要进 oauth_body_hash，与其余参数一起签名。',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey': '标识应用 \u2014 作为 oauth_consumer_key 发送。',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    '与令牌密文一起为请求签名；它从不发送，只有 oauth_signature 发送。',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'RSA 方法下为基础字符串签名的 PEM 密钥 \u2014 只有签名发送。',
  'workbench.editors.request.auth.rowInfo.oauth1Token': '用户的访问令牌，作为 oauth_token 发送；单方调用时留空。',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    '签名密钥的后半部分；它从不发送，只有 oauth_signature 发送。',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    'Header 将 oauth_* 参数放在 Authorization 标头中；Query Params 将其追加到 URL。',
  'workbench.editors.request.auth.rowInfo.oauth1Realm': '作为 realm= 回显在标头开头，命名保护空间。',
  'workbench.editors.request.auth.rowInfo.hawkAuthId': '标识凭据 \u2014 作为 id= 放在标头中。',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey': '计算 mac= 的共享密钥；它从不发送。',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm': 'MAC 与载荷散列使用的 HMAC 摘要算法。',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash': '将正文及其内容类型散列进 hash=，把载荷绑定到签名。',
  'workbench.editors.request.auth.rowInfo.hawkExt': '应用特定数据 \u2014 作为 ext= 发送并参与签名。',
  'workbench.editors.request.auth.rowInfo.hawkApp': '应用 ID \u2014 作为 app= 发送并参与签名。',
  'workbench.editors.request.auth.rowInfo.hawkDlg': '委托方应用 ID \u2014 作为 dlg= 跟在 app= 之后发送并参与签名。',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm': '写入受保护标头的 alg，并决定下方的密钥字段。',
  'workbench.editors.request.auth.rowInfo.jwtSecret': '生成签名的共享 HMAC 密文；它从不发送。',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64': '签名前将密文从 base64 解码，用于以该形式签发的密文。',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey': '为 RS / PS / ES 生成签名的 PEM 私钥；只有签名发送。',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'JSON 形式的声明 \u2014 模板每次发送时解析；此处设置的 iat 或 exp 优先于有效期。',
  'workbench.editors.request.auth.rowInfo.jwtHeaders': 'JSON 形式的额外受保护标头（通常是 kid）；alg 和 typ 自动添加。',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn': '签名时将 iat 和 exp 盖戳进载荷，使每次发送都带有新的有效期。',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    'Header 将 JWT 放在 Authorization 标头中；Query Params 将其作为 token= 追加到 URL。',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'Authorization 标头中 JWT 前的方案 \u2014 默认为 Bearer；留空则发送裸令牌。',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    '用 Secret Key 对方法、路径、查询、标头和载荷哈希签名；签名随 Authorization: AWS4-HMAC-SHA256 标头与 X-Amz-Date 一起发送，或作为 X-Amz-* 查询参数发送——不发送任何机密。',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    'Access Key 随 Credential= 发送，Secret Key 只通过其计算出的签名体现；Session Token 以 X-Amz-Security-Token 发送，用于临时凭据。',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    '签名密钥派生所依据的凭据范围——服务和区域；任一留空即从 AWS 主机名推导（区域回退为 us-east-1）。',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    '签名落在何处——带 X-Amz-Date 的 Authorization 标头，或供无法接受标头的端点使用的 X-Amz-* 查询参数。',
  'workbench.editors.request.auth.rowInfo.awsAccessKey': '标识密钥对——随 Credential= 在范围之前发送。',
  'workbench.editors.request.auth.rowInfo.awsSecretKey': '派生签名密钥的密钥材料；永不发送。',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'STS 会话令牌——以 X-Amz-Security-Token 发送并参与签名，仅用于临时凭据。',
  'workbench.editors.request.auth.rowInfo.awsService':
    '凭据范围中的服务（s3、execute-api 等）；留空则从 AWS 主机名推导。s3 还会将载荷哈希作为标头签名。',
  'workbench.editors.request.auth.rowInfo.awsRegion': '凭据范围中的区域；留空则从 AWS 主机名推导，否则为 us-east-1。',
  'workbench.editors.request.auth.rowInfo.awsAddTo': '标头（默认）或 URL 查询——供无法接受标头的端点使用的预签名形式。',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    'Client Secret 对方法、协议、主机、路径、所列标头和 POST 正文哈希签名；两个令牌、每次发送的时间戳和 nonce 以及签名随 Authorization: EG1-HMAC-SHA256 标头发送——密钥永不发送。',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    '两个令牌以 client_token= 和 access_token= 随标头发送；Client Secret 只通过其派生的签名体现。',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    '签名在请求行之外覆盖的内容——API 指定的标头（按该顺序）以及受字节窗口限制的 POST 正文哈希（除非 API 另有说明，否则为方案的 128 KiB）。',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken': '标识 API 客户端——以 client_token= 发送。',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken': '标识凭据——以 access_token= 发送。',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret': '派生每次发送签名密钥的密钥材料；永不发送。',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    '参与签名的标头名，逗号分隔，按签名顺序；请求中缺少的所列标头会被跳过，未列出的标头永不签名。',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    '内容哈希覆盖的 POST 正文字节窗口；留空 = 方案的 131072。',
  'workbench.editors.request.auth.typeInfo.asap':
    '每次发送铸造一个新 JWT——签发者、受众和主题作为声明，iat / exp 取自时钟，唯一的 jti nonce——以私钥在 kid 标头下签名并作为 bearer 令牌发送；私钥永不发送。',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'JWT 标头中指定的非对称算法族、接收方据以查找公钥的 Key ID，以及用于签名的私钥。',
  'workbench.editors.request.auth.groupInfo.asap.token':
    '令牌声明的内容——谁签发、给谁、代表谁、附加声明以及有效期（默认为方案的一小时上限）。',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm': '在标头中指定签名算法族；方案不允许 HS。',
  'workbench.editors.request.auth.rowInfo.asapKeyId': '以 kid 发送——按方案布局为 签发者/密钥名；接收方据此获取公钥。',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    '用于签名的 PEM（或 Atlassian 的 data:application/pkcs8 形式）；永不发送。',
  'workbench.editors.request.auth.rowInfo.asapIssuer': '已注册的服务标识——以 iss 发送。',
  'workbench.editors.request.auth.rowInfo.asapAudience': '令牌的接收方——以 aud 发送；数组可通过附加声明提供。',
  'workbench.editors.request.auth.rowInfo.asapSubject': '代表谁——以 sub 发送；留空则发送签发者。',
  'workbench.editors.request.auth.rowInfo.asapClaims': '最后合并的附加声明——覆盖所有组合声明，包括 jti / iat / exp。',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn': '以 exp \u2212 iat 标记的有效期；留空 = 3600，即方案上限。',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    '请求在发送时签名（RFC 9421）：由覆盖的组件（方法、目标、指定的头、正文的 Content-Digest）加上签名参数构建签名基础，用密钥签名后以 Signature-Input 和 Signature 发送；密钥本身从不发送。',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    '已注册的算法、验证方用于查找密钥的密钥 ID，以及用于签名的密钥 — PEM 私钥，或 hmac-sha256 下的共享密钥。',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    '签名覆盖的内容：按签名顺序排列的组件 — @method、@target-uri 等派生组件、按名称指定的头 — 以及是否生成正文的 Content-Digest 以供覆盖。',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    '@signature-params 元数据：两个头共用的标签、created / expires 时刻、每次发送的 nonce、alg 参数、应用标签。',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    '六种已注册算法之一；验证方必须持有对应密钥。rsa-pss-sha512 是 RFC 示例的首选。',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    '以 keyid 发送 — 验证方据此获取公钥（或密钥）。留空则省略该参数。',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey': '用于签名的 PEM — PKCS#8、PKCS#1 或 SEC1；从不发送。',
  'workbench.editors.request.auth.rowInfo.httpSigSecret': '与验证方共享的密钥 — HMAC 的密钥；从不发送。',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64': '密钥为 base64 文本 — 签名前先解码为原始密钥字节。',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    '以空格分隔，按签名顺序：@method、@target-uri、@authority、@scheme、@request-target、@path、@query 以及头名称。覆盖了请求中不存在的头会使发送失败。',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    '对正文字节生成 Content-Digest（RFC 9530），以便覆盖 content-digest；无正文的发送对空内容摘要。multipart 正文无法摘要。',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'Signature-Input 和 Signature 携带此签名所用的字典键；留空 = sig1。',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    '写入 created = 签名时刻；验证方据此拒绝过时签名。关闭则省略该参数（expires 一并省略）。',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn': '写入 expires = created + 此秒数；留空则不写入过期。',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    '每次发送写入一个新的随机 nonce — 供跟踪 nonce 的验证方防重放。',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    '写入 alg 指明算法；关闭则由验证方解析的密钥决定（RFC 默认）。',
  'workbench.editors.request.auth.rowInfo.httpSigTag': '应用专用的 tag 参数，供验证方区分签名；留空则省略。',
  'workbench.editors.request.auth.typeInfo.oauth2':
    '客户端从提供方获取访问令牌 \u2014 先在浏览器中授权再交换令牌，或对机器与密码授权直接交换 \u2014 每次发送都以 bearer 令牌携带；若签发了刷新令牌，过期时自动刷新。',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    '此配置当前持有的令牌 \u2014 发送时跟在 Bearer 之后的内容，以及它是否自动刷新。',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    '如何获取新令牌 \u2014 授权类型、提供方的端点、客户端身份以及所请求的内容。',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced': '刷新环节，以及三个提供方请求各自携带的额外参数。',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    '此配置签发的 JWT — 作为每次令牌请求的客户端断言，或作为 JWT bearer 授权本身。',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    '上次流程存储的访问令牌 \u2014 每次发送都跟在 Bearer 之后；流程运行前为空。',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP（RFC 9449）将 Token 绑定到交换时生成的密钥对：每次 Token 请求和每次发送都携带针对该请求方法与 URL 签名的证明，提供方以 DPoP 形式签发 Token 并以该方案发送——标头前缀与 URL 模式让位。密钥与存储的 Token 放在一起，绝不进入配置。',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    '证明的签名族——密钥对按其生成。ES256 是所有 DPoP 部署都接受的算法。',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'Authorization 头中位于令牌之前的方案 — 留空时发送提供商签发的 token_type（默认 Bearer）；设置后以其为准。',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    '过期的访问令牌在发送前续期 — 提供方签发了刷新令牌时用它，否则重新执行无需浏览器的授权。',
  'workbench.editors.request.auth.rowInfo.oauth2Status': '存储的令牌还能有效多久；刷新会立即交换，断开则将其忘记。',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName': '此令牌在应用中的标签 \u2014 不会出现在线路上。',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    '令牌交换的 grant_type 及其前置环节 — 授权码类需要浏览器授权，客户端、密码或 JWT bearer 凭据则不需要。',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    '提供方带着授权码把浏览器送回的 redirect_uri \u2014 需在提供方处注册。',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl': '浏览器首先被送往的提供方授权端点。',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    '提供方的设备授权端点（RFC 8628）——返回用户代码和验证 URL，您可在任意设备上批准，同时此主机轮询令牌端点。',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    '提供方的颁发者标识，或其 /.well-known/ 元数据 URL。“发现”会读取元数据文档（RFC 8414 / OpenID Connect Discovery），填充下方的端点行，并列出文档对你所选项的说明 — 其他内容不变，之后这些行仍由你掌控。',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl': '用授权码（或凭据）交换令牌的提供方令牌端点。',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    '资源所有者的用户名，放在令牌请求正文中发送 \u2014 仅密码授权。',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    '资源所有者的密码，放在令牌请求正文中发送 \u2014 仅密码授权。',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId': '标识应用 \u2014 出现在授权 URL 和令牌请求中。',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    '在令牌端点认证应用 \u2014 按客户端认证的设置放在正文或 Basic 标头中。',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE：授权 URL 上的 code_challenge 是每次流程生成的校验码的 S256 摘要。',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    '每次流程生成，并在令牌交换中作为 code_verifier 发送，以证明是同一客户端发起的。',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    '请求的 scope \u2014 以空格分隔作为 scope 放在授权 URL 或令牌请求中发送。',
  'workbench.editors.request.auth.rowInfo.oauth2State': '每次流程生成并由提供方回显，使回调与本次授权对应。',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    '客户端在令牌请求中如何证明身份 — 凭据放在表单正文或 Authorization: Basic 标头，或以签名的 client_assertion 代替密钥。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    '授权断言的 iss 声明 — 在提供方注册的服务账号或消费者密钥。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    '可选的 sub 声明 — 令牌所代表的用户（全域委托、模拟）；留空则不发送。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    '合并进授权断言的附加声明，优先于自动组合的声明 — 提供方专有声明，或你自己的 scope。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    '签署断言的 JWS 算法族 — 私钥用非对称算法，客户端密钥用 HS256/384/512。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId': '指明已注册密钥的 kid 标头，让提供方选取正确的公钥。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    '签名密钥 — PEM、裸 DER 或 data:application/pkcs8 形式；永不导出。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'aud 声明 — 留空发送访问令牌 URL；FAPI 与 Keycloak 则要求签发者标识。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    'exp 减 iat，签名时盖章 — 默认 300 秒；提供方可能设上限（Google：一小时）。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    '合并进断言的额外受保护标头 JSON — Azure 的 x5t#S256 证书指纹。',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl': '刷新交换所 POST 的端点 \u2014 留空即访问令牌 URL。',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest': '追加到授权 URL 的额外参数（audience、prompt 等）。',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    '令牌请求的额外参数 \u2014 每项按其“发送位置”放在表单正文、标头或 URL 中。',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    '刷新请求的额外参数 \u2014 每项按其“发送位置”放在表单正文、标头或 URL 中。',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    '请求标头把令牌跟在 Bearer 之后放入 Authorization 标头；请求 URL 则将其作为 access_token 追加 \u2014 已弃用，仅用于旧式提供方。',
  'workbench.editors.request.auth.type.inherit': '从父级继承授权',
  'workbench.editors.request.auth.type.none': '无授权',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'HTTP 消息签名',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Access Token',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': '可选——单腿调用留空',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': '可选——单腿调用留空',
  'workbench.editors.request.auth.oauth1SignatureMethod': '签名方法',
  'workbench.editors.request.auth.oauth1PrivateKey': '私钥',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} 或 PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': '包含请求体哈希',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': '可选',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'hawk auth id',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'hawk auth key',
  'workbench.editors.request.auth.hawkAlgorithm': '算法',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': '可选——应用特定数据',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': '可选——应用 ID',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': '可选——委托方应用 ID',
  'workbench.editors.request.auth.hawkIncludePayloadHash': '包含负载哈希',
  'workbench.editors.request.auth.jwtAddTo': '将 JWT 令牌添加到',
  'workbench.editors.request.auth.jwtAlgorithm': '算法',
  'workbench.editors.request.auth.jwtSecret': '密钥',
  'workbench.editors.request.auth.jwtSecretPlaceholder': '密钥',
  'workbench.editors.request.auth.jwtSecretBase64': '密钥为 Base64 编码',
  'workbench.editors.request.auth.jwtPrivateKey': '私钥',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} 或 PEM',
  'workbench.editors.request.auth.jwtPayload': 'Payload',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'JWT 标头',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': '算法相关的标头会自动添加。',
  'workbench.editors.request.auth.jwtHeaderPrefix': '请求标头前缀',
  'workbench.editors.request.auth.jwtExpiresIn': '有效期（秒）',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': '可选',
  'workbench.editors.request.auth.jwtExpiresInNote':
    '设置后，发送时会将 iat 和 exp 写入 payload。payload 中已设置的 claim 优先。',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth 用第二个请求应答服务器的质询，这在桌面端应用和 CLI 上运行。从此界面发送不会带上它——服务器会回复 401。',
  'workbench.editors.request.auth.digestRetryNote': '默认情况下会应答 401 质询并自动重试请求。要禁用吗？',
  'workbench.editors.request.auth.digestDisableRetry': '是，禁用请求重试',
  'workbench.editors.request.auth.authAutoGeneratedNote': '发送请求时将自动生成授权标头。',
  'workbench.editors.request.auth.inheritNote': '发送请求时将自动生成授权标头。',
  'workbench.editors.request.auth.noneNote': '此请求不使用任何授权。',
  'workbench.editors.request.auth.inheritDetail':
    '此请求正在使用其父集合的授权助手。要更改它，请编辑集合的授权标签页。',
  'workbench.editors.request.auth.inheritedNone': '无授权——文件夹和集合均未设置任何内容。',
  'workbench.editors.request.auth.sourceCollection': '集合“{name}”',
  'workbench.editors.request.auth.sourceFolder': '文件夹“{name}”',
  'workbench.editors.request.auth.groupInherited': '继承',
  'workbench.editors.request.auth.refusalQualifier.inQuery': '（查询参数）',
  'workbench.editors.request.auth.refusalQualifier.inHeader': '（标头）',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': '（绑定 DPoP 密钥）',
  'workbench.editors.request.auth.groupOwn': '此请求',
  'workbench.editors.request.auth.optionMissingEntry': '条目缺失',
  'workbench.editors.request.auth.danglingPick': '此请求选择的条目已不存在——改为应用最近的默认项。',
  'workbench.editors.request.auth.editInParent': '在父级中编辑',
  'workbench.editors.request.auth.resetToInheritedAuth': '重置为继承的授权',
  'workbench.editors.request.auth.resizeRailAria': '调整授权类型栏宽度',
  'workbench.editors.request.auth.username': '用户名',
  'workbench.editors.request.auth.password': '密码',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': '键',
  'workbench.editors.request.auth.keyPlaceholder': '例如 X-API-Key',
  'workbench.editors.request.auth.value': '值',
  'workbench.editors.request.auth.addTo': '添加到',
  'workbench.editors.request.auth.addToHeader': '标头',
  'workbench.editors.request.auth.addToQuery': '查询参数',
  'workbench.editors.request.auth.usernamePlaceholder': 'username',
  'workbench.editors.request.auth.passwordPlaceholder': 'password',
  'workbench.editors.request.auth.tokenPlaceholder': 'bearer token',
  'workbench.editors.request.auth.valuePlaceholder': 'api key value',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': '服务名称',
  'workbench.editors.request.auth.awsRegion': '区域',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': '例如 AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'secret access key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': '可选——仅限临时（STS）凭据',
  'workbench.editors.request.auth.awsServicePlaceholder': '自动取自 AWS 主机——例如 s3、execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': '自动取自 AWS 主机，否则为 us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Client Token',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Access Token',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Client Secret',
  'workbench.editors.request.auth.edgeGridHeadersToSign': '要签名的标头',
  'workbench.editors.request.auth.edgeGridMaxBodySize': '最大正文大小',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': '例如 akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': '例如 akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'client secret',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder': '可选——逗号分隔，例如 X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': '算法',
  'workbench.editors.request.auth.asapKeyId': 'Key ID',
  'workbench.editors.request.auth.asapPrivateKey': '私钥',
  'workbench.editors.request.auth.asapIssuer': '签发者',
  'workbench.editors.request.auth.asapAudience': '受众',
  'workbench.editors.request.auth.asapSubject': '主题',
  'workbench.editors.request.auth.asapClaims': '附加声明',
  'workbench.editors.request.auth.asapExpiresIn': '过期（秒）',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': '例如 my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- \u2026 或 data:application/pkcs8 形式',
  'workbench.editors.request.auth.asapIssuerPlaceholder': '例如 my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': '例如 api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': '可选——留空则发送签发者',
  'workbench.editors.request.auth.asapClaimsPlaceholder': '可选——JSON，例如 {"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': '算法',
  'workbench.editors.request.auth.httpSigKeyId': '密钥 ID',
  'workbench.editors.request.auth.httpSigPrivateKey': '私钥',
  'workbench.editors.request.auth.httpSigSecret': '共享密钥',
  'workbench.editors.request.auth.httpSigSecretBase64': '密钥为 base64 编码',
  'workbench.editors.request.auth.httpSigComponents': '覆盖的组件',
  'workbench.editors.request.auth.httpSigContentDigest': 'Content Digest',
  'workbench.editors.request.auth.httpSigDigestNone': '无',
  'workbench.editors.request.auth.httpSigLabel': '标签',
  'workbench.editors.request.auth.httpSigCreated': 'created 时间戳',
  'workbench.editors.request.auth.httpSigExpiresIn': '过期时长（秒）',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': '算法参数 (alg)',
  'workbench.editors.request.auth.httpSigTag': 'Tag',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': '例如 my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': '与验证方共享的密钥',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': '可选 — 例如 300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': '可选 — 应用标签',
  'workbench.editors.request.auth.sendAsLabel': '将授权数据添加到',
  'workbench.editors.request.auth.sendAsHeaders': '请求标头',
  'workbench.editors.request.auth.sendAsUrl': '请求 URL',
  'workbench.editors.request.auth.presetLabel': '提供方预设',
  'workbench.editors.request.auth.presetInfo':
    '选择提供方会预填其授权/token 端点、默认 scope 和推荐流程。选择“自定义”可手动配置一切。',
  'workbench.editors.request.auth.presetCustom': '自定义（无预设）',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': '在 URL 中发送访问 token 已被弃用',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 保留了 URI 查询参数方式，但同时警告：token 会泄漏到服务器日志、HTTP `Referer` 标头、浏览器历史和中间缓存。除非提供方要求查询形式，否则请优先使用默认的',
  'workbench.editors.request.oauth.queryWarningAfter': '标头。',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': '还没有 token——使用下方的“获取新的访问 token”',
  'workbench.editors.request.oauth.headerPrefix': '标头前缀',
  'workbench.editors.request.oauth.tokenBinding': 'Token 绑定',
  'workbench.editors.request.oauth.tokenBindingNone': '无（bearer）',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': '证明算法',
  'workbench.editors.request.oauth.autoRefresh': '自动刷新 Token',
  'workbench.editors.request.oauth.autoRefreshDesc': '发送请求前会自动刷新已过期的 token。',
  'workbench.editors.request.oauth.status': '状态',
  'workbench.editors.request.oauth.statusExpired': '已过期——存有 refresh_token 时，下次发送会自动刷新。',
  'workbench.editors.request.oauth.statusValid': '有效 · {duration}',
  'workbench.editors.request.oauth.refreshNow': '立即刷新',
  'workbench.editors.request.oauth.disconnect': '断开连接',
  'workbench.editors.request.oauth.tokenName': 'Token 名称',
  'workbench.editors.request.oauth.tokenNameDesc':
    '自由格式的标签，当一个工作区对同一提供方持有多个 token 时显示在凭据列表中。',
  'workbench.editors.request.oauth.tokenNamePlaceholder': '输入 token 名称…',
  'workbench.editors.request.oauth.grantType': '授权类型（grant type）',
  'workbench.editors.request.oauth.callbackUrl': '回调 URL',
  'workbench.editors.request.oauth.detecting': '正在检测…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl': '在你的 OAuth 提供方注册此 URL。它看起来不同于',
  'workbench.editors.request.oauth.callbackTipBeforeHost': '地址栏中的 URL，因为 Chrome 为',
  'workbench.editors.request.oauth.callbackTipBeforeApi': '暴露了一个专用的重定向主机，即',
  'workbench.editors.request.oauth.callbackTipAfterApi': '。扩展 ID 相同；只有主机和协议不同。',
  'workbench.editors.request.oauth.authorizeUsingBrowser': '使用浏览器授权',
  'workbench.editors.request.oauth.noTokenNote':
    '尚无令牌 — 在下方运行一个流程来获取。对于带外签发的令牌，请改用 Bearer Token 认证。',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    '登录在您的默认浏览器中打开 — 它保有您在提供商的会话、密码管理器和通行密钥，且身份提供商会阻止嵌入在应用内的登录（RFC 8252）。',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    '提供商将浏览器重定向回应用后端端口上的回调 URL — 在设置中更改端口会改变需要注册的 URL。',
  'workbench.editors.request.oauth.authUrl': 'Auth URL',
  'workbench.editors.request.oauth.accessTokenUrl': 'Access Token URL',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': '留空则自动生成',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': '例如 read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': '每次授权请求自动生成',
  'workbench.editors.request.oauth.clientAuthentication': '客户端身份验证',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    '客户端在令牌 POST 中如何证明身份 — id 与密钥放在正文或 Basic 标头，或用私钥（private_key_jwt）或密钥（client_secret_jwt）签名的 JWT。',
  'workbench.editors.request.oauth.clientAuthBody': '在正文中发送客户端凭据',
  'workbench.editors.request.oauth.clientAuthBasicHeader': '作为 Basic Auth 标头发送',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': '发送签名 JWT（private_key_jwt）',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': '发送 HMAC JWT（client_secret_jwt）',
  'workbench.editors.request.oauth.assertionIssuer': '签发者',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': '例如 service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': '主体',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder': '可选 — 令牌所代表的用户',
  'workbench.editors.request.oauth.assertionClaims': '附加声明',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder': '可选 — JSON，例如 {"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': '算法',
  'workbench.editors.request.oauth.assertionKeyId': '密钥 ID',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': '可选 — kid 标头，例如 key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': '私钥',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- …（PEM，或 data:application/pkcs8 形式）',
  'workbench.editors.request.oauth.assertionAudience': '受众',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': '留空 = 访问令牌 URL',
  'workbench.editors.request.oauth.assertionLifetime': '有效期（秒）',
  'workbench.editors.request.oauth.assertionHeaders': '额外标头',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': '可选 — JSON，例如 {"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro': '你可以在这里为 OAuth2 请求添加更细的自定义。',
  'workbench.editors.request.oauth.advancedLearnMore': '进一步了解配置',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh Token URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    '多数提供方复用 Access Token URL 进行刷新；仅当提供方暴露了独立路径时才需要填写覆盖值。',
  'workbench.editors.request.oauth.sendInColumn': '发送位置',
  'workbench.editors.request.oauth.sendInBody': '请求体',
  'workbench.editors.request.oauth.sendInHeader': '标头',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
  'workbench.editors.request.oauth.authRequest': '授权请求',
  'workbench.editors.request.oauth.tokenRequest': 'Token 请求',
  'workbench.editors.request.oauth.refreshRequest': '刷新请求',
  'workbench.editors.request.oauth.getNewToken': '获取新的访问 token',
  'workbench.editors.request.oauth.clearCookies': '清除 Cookie',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Token 按工作区存储于',
  'workbench.editors.request.oauth.storedFootnoteAfter': '。删除工作区即可清除。',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth：已收到 token',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth：授权完成',
  'workbench.editors.request.oauth.toast.failed': 'OAuth 失败：{error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth：访问 token 已刷新',
  'workbench.editors.request.oauth.toast.refreshFailed': '刷新失败：{error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth：已断开连接',
  'workbench.editors.request.oauth.toast.callbackCopied': '回调 URL 已复制',
  'workbench.editors.request.oauth.toast.copyUnsupported': '不支持复制——请手动选择该 URL',
  'workbench.editors.request.oauth.deviceAuthUrl': '设备授权 URL',
  'workbench.editors.request.oauth.deviceWaitingTitle': '等待您在 {host} 上批准',
  'workbench.editors.request.oauth.deviceWaitingDesc': '在任意设备上打开链接，输入代码并批准。此页面会自动更新。',
  'workbench.editors.request.oauth.deviceCode': '代码',
  'workbench.editors.request.oauth.deviceOpen': '打开',
  'workbench.editors.request.oauth.deviceCancel': '取消',
  'workbench.editors.request.oauth.deviceExpiresIn': '{duration} 后过期',
  'workbench.editors.request.oauth.deviceCheckEvery': '每 {seconds} 秒检查一次',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth：请在 {host} 上使用代码 {code} 批准',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth：设备授权已批准',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth：授权被拒绝 — {error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth：设备代码已过期 — {error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'OAuth 设备授权失败：{error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth：设备授权已取消',
  'workbench.editors.request.oauth.toast.codeCopied': '代码已复制',
  'workbench.editors.request.oauth.issuerUrl': '颁发者 URL',
  'workbench.editors.request.oauth.issuerUrlPlaceholder': 'https://accounts.example.com — 或 /.well-known/… 元数据 URL',
  'workbench.editors.request.oauth.discover': '发现',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth：已发现端点',
  'workbench.editors.request.oauth.toast.discoveryFailed': '发现失败：{error}',
  'workbench.editors.request.oauth.discoveryTitle': '发现自 {url}',
  'workbench.editors.request.oauth.discoveryFilled': '已填充 {rows}',
  'workbench.editors.request.oauth.discoveryFilledNone': '文档未声明任何端点 — 未填充',
  'workbench.editors.request.oauth.discoveryListed': '{pick} 在提供方的列表中',
  'workbench.editors.request.oauth.discoveryUnlisted': '{pick} 不在列表中 — 提供方列出 {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': '客户端身份验证 {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': '授权类型 {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'DPoP 算法 {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': '断言算法 {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    '颁发者标识为 {issuer} — 部分提供方要求以它作为断言 Audience，而不是访问令牌 URL',
  'workbench.editors.request.oauth.discoveryScopes': '提供的 Scope：{supported} — 已在 Scope 行中建议',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': '此请求没有正文',
  'workbench.editors.request.body.modeNoneInfo': '发送请求时不携带载荷——没有正文字节，也不发送 Content-Type 头。',
  'workbench.editors.request.body.modeFormDataInfo':
    '将各部分作为一个 multipart/form-data 载荷发送——每一行是一个文本字段或文件部分。',
  'workbench.editors.request.body.modeFormDataDescription':
    '带边界的 Content-Type 在发送时生成；手动设置的 multipart Content-Type 会被替换，确保边界始终与载荷一致。',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    '将字段以百分号编码的 key=value 形式发送，Content-Type 为 application/x-www-form-urlencoded。停用的行保留在编辑器中，但不会随请求发送。',
  'workbench.editors.request.body.modeRawInfo': '按原样发送编辑器内容——线上的字节与你输入的完全一致。',
  'workbench.editors.request.body.modeRawDescription':
    '格式选择器决定语法高亮和默认 Content-Type（application/json、application/xml、text/plain、text/javascript、text/html）；在 Headers 标签页设置的 Content-Type 优先。',
  'workbench.editors.request.body.modeGraphqlInfo':
    '按照 GraphQL HTTP 传输规范，将查询和变量作为一个 application/json 载荷（{ query, variables }）发送。',
  'workbench.editors.request.body.modeGraphqlDescription':
    '变量必须是有效的 JSON；无法解析的变量面板会从线上正文中省略，仅发送查询。',
  'workbench.editors.request.body.beautify': '美化',
  'workbench.editors.request.body.format': '格式化',
  'workbench.editors.request.body.formatAria': '格式化正文',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'GraphQL 查询',
  'workbench.editors.request.body.queryInfoSummary':
    '以普通 POST 发送，JSON 正文为 { query, variables }。Schema 自省和查询自动补全暂不可用。',
  'workbench.editors.request.body.variablesTitle': 'GraphQL Variables',
  'workbench.editors.request.body.variablesInfoTitle': 'GraphQL 变量',
  'workbench.editors.request.body.variablesInfoSummary': '以 JSON 格式定义变量，供查询引用（例如 $id）。',
  'workbench.editors.request.body.kindText': '文本',
  'workbench.editors.request.body.kindFile': '文件',
  'workbench.editors.request.body.newFile': '从本机选择新文件',
  'workbench.editors.request.body.uploadedFiles': '已上传的文件',
  'workbench.editors.request.body.allAttached': '所有已上传的文件都已附加',
  'workbench.editors.request.body.selectFiles': '选择文件',
  'workbench.editors.request.body.loadingFiles': '正在加载文件…',
  'workbench.editors.request.body.addFile': '+ 添加文件',
  'workbench.editors.request.body.uploadRequired': '需要上传',
  'workbench.editors.request.body.deleteFileAria': '从工作区删除 {filename}',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': '编写',
  'workbench.editors.request.docs.preview': '预览',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    '为此请求写文档——它为什么存在、何时运行、预期的授权范围。支持 Markdown：标题、列表、表格、代码块、链接。{{variable}} 引用在预览中渲染为芯片。',
  'workbench.editors.request.docs.placeholder': '这个请求是做什么的？\n它为什么存在、何时运行、预期的授权范围。',
  'workbench.editors.request.docs.empty': '还没有任何文档——切换到“编写”来添加笔记。',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': '请求前',
  'workbench.editors.request.scripts.postResponse': '响应后',
  'workbench.editors.request.scripts.preInfoTitle': '请求前脚本',
  'workbench.editors.request.scripts.preInfoSummary': '在请求发出之前运行一次。用 oh API 重写 URL、标头、参数和正文。',
  'workbench.editors.request.scripts.postInfoTitle': '响应后脚本',
  'workbench.editors.request.scripts.postInfoSummary':
    '在响应到达之后运行一次。读取状态、标头和正文；断言结果显示在响应面板中。',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': '添加或替换标头',
  'workbench.editors.request.scripts.apiSetQueryParam': '添加或替换查询参数',
  'workbench.editors.request.scripts.apiSetUrl': '改写目标 URL',
  'workbench.editors.request.scripts.apiSetBody': '替换请求体',
  'workbench.editors.request.scripts.apiRequire': '从包库加载脚本包',
  'workbench.editors.request.scripts.apiTest': '注册断言',
  'workbench.editors.request.scripts.runsAfter': '在 {count} 个脚本之后运行：',
  'workbench.editors.request.scripts.runsAfterOne': '在 1 个脚本之后运行：',
  'workbench.editors.request.scripts.prePlaceholderContainer': '编写在每个 HTTP 请求发送前运行的脚本。',
  'workbench.editors.request.scripts.postPlaceholderContainer': '编写在每个 HTTP 响应结束时运行的脚本。',
  'workbench.editors.request.scripts.prePlaceholder': '用 JavaScript 在发送前修改此请求。',
  'workbench.editors.request.scripts.postPlaceholder': '用 JavaScript 在响应到达后测试并读取它。',
  // ── Session script slots (gRPC · WebSocket · MQTT) ─────────────────
  'workbench.editors.request.scripts.grpcBeforeInvoke': '调用前',
  'workbench.editors.request.scripts.grpcOnMessage': '收到消息时',
  'workbench.editors.request.scripts.grpcAfterResponse': '响应后',
  'workbench.editors.request.scripts.wsBeforeConnect': '连接前',
  'workbench.editors.request.scripts.wsBeforeSend': '发送前',
  'workbench.editors.request.scripts.wsOnMessage': '收到消息时',
  'workbench.editors.request.scripts.wsAfterClose': '关闭后',
  'workbench.editors.request.scripts.mqttBeforeConnect': '连接前',
  'workbench.editors.request.scripts.mqttBeforePublish': '发布前',
  'workbench.editors.request.scripts.mqttOnMessage': '收到消息时',
  'workbench.editors.request.scripts.mqttAfterClose': '关闭后',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder': '用 JavaScript 在调用前修改此调用的元数据和消息。',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholder': '用 JavaScript 在每个消息帧到达时读取它。',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholder': '用 JavaScript 在此调用结束后测试并读取回复。',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholder': '用 JavaScript 在此会话连接前修改握手。',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholder': '用 JavaScript 在每条消息发送前修改或丢弃它。',
  'workbench.editors.request.scripts.wsOnMessagePlaceholder': '用 JavaScript 在每条消息到达时作出响应。',
  'workbench.editors.request.scripts.wsAfterClosePlaceholder': '用 JavaScript 在此会话关闭后测试并读取它。',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder': '用 JavaScript 在此会话连接前修改 CONNECT。',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholder': '用 JavaScript 在每条消息发布前修改或丢弃它。',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholder': '用 JavaScript 在每条消息到达时作出响应。',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholder': '用 JavaScript 在此会话断开后测试并读取它。',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer': '编写在每个 gRPC 调用发起前运行的脚本。',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer': '编写在每个 gRPC 消息帧上运行的脚本。',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer': '编写在每个 gRPC 调用结束时运行的脚本。',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer':
    '编写在每个 WebSocket 会话连接前运行的脚本。',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer': '编写在每条 WebSocket 消息发送前运行的脚本。',
  'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer': '编写在每条收到的 WebSocket 消息上运行的脚本。',
  'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer': '编写在每个 WebSocket 会话关闭后运行的脚本。',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer': '编写在每个 MQTT 会话连接前运行的脚本。',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer': '编写在每条 MQTT 消息发布前运行的脚本。',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer': '编写在每条收到的 MQTT 消息上运行的脚本。',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer': '编写在每个 MQTT 会话断开后运行的脚本。',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle': '调用前脚本',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary':
    '在调用发起前运行一次。用 oh API 改写元数据和请求消息；oh.session 把状态带入此调用后续的钩子。',
  'workbench.editors.request.scripts.grpcOnMessageInfoTitle': '收到消息时脚本',
  'workbench.editors.request.scripts.grpcOnMessageInfoSummary':
    '在调用捕获的每个消息帧上运行，双向皆是，在捕获之后。读取解码后的消息；捕获永远不会被延迟。',
  'workbench.editors.request.scripts.grpcAfterResponseInfoTitle': '响应后脚本',
  'workbench.editors.request.scripts.grpcAfterResponseInfoSummary':
    '在调用结束后运行一次。读取状态、标头、trailer 和消息；断言结果显示在响应面板中。',
  'workbench.editors.request.scripts.wsBeforeConnectInfoTitle': '连接前脚本',
  'workbench.editors.request.scripts.wsBeforeConnectInfoSummary':
    '在每次拨号时运行，包括重连。用 oh API 改写 URL、标头、参数和子协议；失败会被记录，拨号按原样继续。',
  'workbench.editors.request.scripts.wsBeforeSendInfoTitle': '发送前脚本',
  'workbench.editors.request.scripts.wsBeforeSendInfoSummary':
    '在你发送的每条消息前运行。改写或丢弃外发消息；心跳帧和协议帧从不经过这里。',
  'workbench.editors.request.scripts.wsOnMessageInfoTitle': '收到消息时脚本',
  'workbench.editors.request.scripts.wsOnMessageInfoSummary':
    '在每条收到的消息上运行，在捕获之后。作出响应：用 oh.send 回复，在 oh.session 中保存状态，注册断言。',
  'workbench.editors.request.scripts.wsAfterCloseInfoTitle': '关闭后脚本',
  'workbench.editors.request.scripts.wsAfterCloseInfoSummary':
    '在会话结束后运行一次（前提是它曾打开）。读取关闭记录和会话计数；断言结果显示在会话面板中。',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle': '连接前脚本',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary':
    '在每次拨号时运行，包括重连。用 oh API 改写客户端 ID、凭据、遗嘱和订阅；失败会被记录，拨号按原样继续。',
  'workbench.editors.request.scripts.mqttBeforePublishInfoTitle': '发布前脚本',
  'workbench.editors.request.scripts.mqttBeforePublishInfoSummary':
    '在你发布的每条消息前运行。改写主题、负载、QoS、retain 标志和属性，或丢弃此次发布。',
  'workbench.editors.request.scripts.mqttOnMessageInfoTitle': '收到消息时脚本',
  'workbench.editors.request.scripts.mqttOnMessageInfoSummary':
    '在每条收到的消息上运行，在捕获之后。作出响应：用 oh.publish 回复，在 oh.session 中保存状态，注册断言。',
  'workbench.editors.request.scripts.mqttAfterCloseInfoTitle': '关闭后脚本',
  'workbench.editors.request.scripts.mqttAfterCloseInfoSummary':
    '在会话结束后运行一次（前提是它曾打开）。读取结束记录、CONNACK 和会话计数；断言结果显示在会话面板中。',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.followRedirects': '自动跟随重定向',
  'workbench.editors.request.settings.followRedirectsInfo':
    '跟随 HTTP 3xx 响应到其目标。关闭后停在重定向本身——响应显示为不带标头和正文的不透明重定向，可用来确认重定向确实发生。',
  'workbench.editors.request.settings.maxRedirects': '最大重定向次数',
  'workbench.editors.request.settings.maxRedirectsInfo':
    '一次发送最多可跟随多少次重定向，超过则失败并报出该上限。留空为默认的 20。设为 0 则任何重定向都直接失败。',
  'workbench.editors.request.settings.followOriginalMethod': '跟随原始 HTTP 方法',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    '当 301、302 或 303 重定向本会把请求切换为 GET 时，保持原方法和正文。307 和 308 重定向在任何情况下都保持方法。',
  'workbench.editors.request.settings.followAuthHeader': '跟随 Authorization 标头',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    '当重定向跨到不同源时保留 Authorization 标头。通常它在跨源跳转时会被丢弃，使凭据绝不会流向请求未指向的主机。',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    '凭据会流向重定向链最终到达的任何主机。链条确实跨过源的响应会被标记。',
  'workbench.editors.request.settings.sendBrowserCookies': '发送浏览器 Cookie',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    '把浏览器中目标站点的现有 Cookie 附加到此请求。关闭是安全默认：请求不带任何 Cookie 发送，结果不依赖你在浏览器中的登录状态。',
  'workbench.editors.request.settings.sslVerification': 'SSL 证书验证',
  'workbench.editors.request.settings.sslVerificationSummary':
    '对照运行时的受信任 CA 存储验证服务器的 TLS 证书——默认开启。',
  'workbench.editors.request.settings.sslVerificationDescription':
    '证书自签名、过期或不受信任的主机会以 TLS 证书错误失败——关闭验证仍可访问它，例如使用自签名证书的开发服务器。',
  'workbench.editors.request.settings.sslVerificationWarning':
    '发送会跳过服务器身份检查——任何证书都被接受，包括自签名和已过期的。',
  'workbench.editors.request.settings.tlsMin': 'TLS 最低版本',
  'workbench.editors.request.settings.tlsMinSummary':
    '一次发送可协商的最低 TLS 协议版本——留空保持运行时默认的 TLS 1.2。',
  'workbench.editors.request.settings.tlsMinDescription':
    '选择 1.0 或 1.1 会把下限降到默认之下以连接旧式服务器——以降低的下限发送的响应会被标记。',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2（默认）',
  'workbench.editors.request.settings.tlsMinWarning':
    '发送可能协商出低于 1.2 的 TLS——这些协议版本存在已知弱点。响应会被标记。',
  'workbench.editors.request.settings.tlsMax': 'TLS 最高版本',
  'workbench.editors.request.settings.tlsMaxSummary':
    '一次发送可协商的最高 TLS 协议版本——留空保持运行时默认的 TLS 1.3。',
  'workbench.editors.request.settings.tlsMaxDescription':
    '降低它可检查服务器在旧协议上的行为——最低版本可能也需要降低，否则两者没有交集。',
  'workbench.editors.request.settings.tlsVersionsHeading': '版本',
  'workbench.editors.request.settings.tlsVersionLegacyDesc': '旧式版本，存在已知弱点——发送会被标记。',
  'workbench.editors.request.settings.tlsVersion12Desc': '默认下限。',
  'workbench.editors.request.settings.tlsVersion13Desc': '默认上限——当前最佳实践。',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3（默认）',
  'workbench.editors.request.settings.tlsCipherSuites': 'TLS 密码套件',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'TLS 握手期间提供的密码套件，为一个冒号分隔的列表——留空则提供运行时的默认套件。',
  'workbench.editors.request.settings.tlsCipherSuitesDescription': '服务器按自己的偏好顺序从所提供的套件中选择。',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': '格式',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': '以 IANA 名称表示的 TLS 1.3 套件。',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    '以 OpenSSL 名称表示的旧式套件——两类都放进同一个列表。',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': '连接各条目——不能有空格。',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': '运行时默认套件',
  'workbench.editors.request.settings.tlsCipherSuitesError': '仅限冒号分隔的 OpenSSL 套件名——不能有空格。',
  'workbench.editors.request.settings.tlsCipherSuitesExample':
    '例如 TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 跳（默认）',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 跳' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB（默认）',
  'workbench.editors.request.settings.resetToDefault': '重置为默认值',
  'workbench.editors.request.settings.group.redirects': '重定向',
  'workbench.editors.request.settings.group.tls': 'TLS 与信任',
  'workbench.editors.request.settings.group.connection': '连接',
  'workbench.editors.request.settings.group.cookies': 'Cookie',
  'workbench.editors.request.settings.group.execution': '执行与限制',
  'workbench.editors.request.settings.groupInfo.connection':
    '发送如何抵达服务器——所使用的 HTTP 协议以及拨号路径：直连、经代理、连到固定地址，或进入本地套接字。',
  'workbench.editors.request.settings.groupInfo.tls':
    '发送在 TLS 握手中验证和提供的内容——证书验证、协议版本窗口、密码套件与客户端证书。',
  'workbench.editors.request.settings.groupInfo.redirects':
    '服务器以重定向应答时会发生什么——是否跟随链条、跟随多远，以及后续请求携带什么。',
  'workbench.editors.request.settings.groupInfo.cookies':
    'Cookie 是否随发送一起——默认关闭，结果绝不依赖环境中的登录状态。',
  'workbench.editors.request.settings.groupInfo.execution': '这次运行本身如何受限——脚本模式、时间预算与响应大小上限。',
  'workbench.editors.request.settings.httpVersion': 'HTTP 版本',
  'workbench.editors.request.settings.httpVersionSummary':
    '发送使用的 HTTP 协议方式——Auto（默认）同时提供 HTTP/2 与 HTTP/1.1，由服务器选择。',
  'workbench.editors.request.settings.httpVersionDescription':
    '固定的版本若服务器无法使用，会以明确错误失败，绝不静默回退。响应的“网络”弹层始终显示线上实际协商出的协议。',
  'workbench.editors.request.settings.httpVersionValuesHeading': '取值',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    '在 TLS 握手中同时提供 HTTP/2 + HTTP/1.1，由服务器选择——普通 http:// 保持 HTTP/1.1。',
  'workbench.editors.request.settings.httpVersion11Desc': '固定使用经典的 HTTP/1.1 语义。',
  'workbench.editors.request.settings.httpVersion2Desc': '通过握手提供项固定 HTTP/2。',
  'workbench.editors.request.settings.httpVersionPkDesc': '跳过协商直接以 HTTP/2 通信——这是明文 HTTP/2 服务器的通路。',
  'workbench.editors.request.settings.httpVersion3Desc': '直接以 QUIC 连接服务器，不回退到 TCP。',
  'workbench.editors.request.settings.exampleCaption': '示例发送',
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Auto——由服务器选择',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2（prior knowledge）',
  'workbench.editors.request.settings.resolveToAddress': '解析到地址',
  'workbench.editors.request.settings.resolveToAddressInfo':
    '把此请求发送到指定的服务器地址，而不是 DNS 的应答——URL 的主机名仍用于 TLS 和 Host 标头，因此开启验证时证书仍须与之匹配。适合测试负载均衡器背后的某个特定后端。URL 保留自己的端口，重定向到其他主机时也落在此地址上。留空则照常通过 DNS 解析。',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': '系统 DNS',
  'workbench.editors.request.settings.resolveToAddressError': '仅限 IPv4 或 IPv6 地址——不能有主机名或端口。',
  'workbench.editors.request.settings.resolveToAddressExample': '例如 10.0.0.12 或 2001:db8::1',
  'workbench.editors.request.settings.sni': 'SNI 服务器名称',
  'workbench.editors.request.settings.sniInfo':
    '在 TLS 握手中代替 URL 主机发送的服务器名称——用于在一个地址上承载多个主机名的网关，或为 DNS 无法解析的名称签发的证书。留空则发送 URL 主机。',
  'workbench.editors.request.settings.sniPlaceholder': '自动 — URL 主机',
  'workbench.editors.request.settings.sniExample': '例如 api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': '客户端证书 (mTLS)',
  'workbench.editors.request.settings.clientCertificateInfo':
    '在 TLS 握手期间出示客户端证书（双向 TLS，mTLS），用于双向 TLS 网关背后按证书验证调用方的 API。从 vault 中选择一个证书条目——请求只保存条目名称，每台设备出示自己同名的 vault 条目；证书和密钥绝不离开 vault。留空则不带客户端证书连接。',
  'workbench.editors.request.settings.clientCertificatePlaceholder': '无客户端证书',
  'workbench.editors.request.settings.clientCertificateEmpty': '此设备的 vault 中还没有客户端证书条目。',
  'workbench.editors.request.settings.vaultManageCertificates': '在 vault 中管理证书',
  'workbench.editors.request.settings.clientCertificateDangling':
    '此设备上没有名为“{name}”的 vault 证书条目——在该条目存在或此设置被清除之前，发送都会失败。',
  'workbench.editors.request.settings.proxy': '代理',
  'workbench.editors.request.settings.proxySummary':
    '此次发送如何抵达网络。默认继承执行设备的系统配置——系统代理设置、PAC 或代理环境变量——因此企业机器下发的代理开箱即用；“直连”让这一个请求退出任何系统代理，“自定义 URL”则让它经由请求自己的代理。',
  'workbench.editors.request.settings.proxyDescription':
    '响应元信息始终记录发送实际走过的路由——哪个代理、由请求还是由系统决定。支持 HTTP(S) 与 SOCKS5 代理——socks5:// URL 既可作为自定义代理也可作为系统应答；只有 SOCKS4 系列会收到指名它的明确错误。',
  'workbench.editors.request.settings.proxyModesHeading': '模式',
  'workbench.editors.request.settings.proxyModePlaceholder': '继承——由系统决定',
  'workbench.editors.request.settings.proxyModeDirect': '直连——不走代理',
  'workbench.editors.request.settings.proxyModeCustom': '自定义 URL',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    '由执行设备的系统按 URL 决定——机器配置了代理就走代理，否则直连。对固定 HTTP/3、拨号本地套接字或解析到固定地址的发送，继承的代理会主动让路。',
  'workbench.editors.request.settings.proxyModeDirectDesc': '此请求永不走代理，无论机器的系统设置怎么说。',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    '以隧道穿过请求自己的代理 URL——随请求同步，在每台设备上走同一条路由。',
  'workbench.editors.request.settings.proxyUrl': '代理 URL',
  'workbench.editors.request.settings.proxyUrlInfo':
    '让此请求经由此 HTTP(S) 代理。到目标的连接以隧道穿过代理，因此 https 交换保持端到端加密，证书验证仍针对目标进行。凭据填在下方的“代理凭据”设置中，绝不放进此 URL。',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing': '自定义 URL 模式需要代理 URL——输入一个，或把模式切回去。',
  'workbench.editors.request.settings.proxyError':
    '仅限带主机和端口的 http://、https:// 或 socks5:// URL——URL 中不能有凭据。',
  'workbench.editors.request.settings.proxyUrlExample': '例如 http://127.0.0.1:8080 或 socks5://127.0.0.1:1080',
  'workbench.editors.request.settings.proxyResolveConflict':
    '同时设置了解析到地址，但代理会自行解析主机名——在其中一项被清除之前，发送都会失败。',
  'workbench.editors.request.settings.proxyCredentials': '代理凭据',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    '用 vault 中的凭据向代理进行身份验证，以 user:password 形式存入一个字符串条目。请求只保存条目名称，每台设备对照自己的本地 vault 解析——凭据绝不离开 vault，只发送给代理，绝不发送给目标。代理无需身份验证时留空。',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': '无身份验证',
  'workbench.editors.request.settings.proxyCredentialsEmpty': '此设备的 vault 中还没有字符串条目。',
  'workbench.editors.request.settings.vaultManageCredentials': '在 vault 中管理凭据',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    '此设备上没有名为“{name}”的 vault 字符串条目——在该条目存在或此设置被清除之前，发送都会失败。',
  // ── 会话韧性区块（WebSocket / Socket.IO / MQTT）───────────────────────
  'workbench.editors.request.settings.autoReconnect': '自动重连',
  'workbench.editors.request.settings.autoReconnectInfo':
    '已打开的连接断开时（套接字中断、服务器关闭、空闲超时）重新打开会话，按重连周期反复拨号，直到再次打开或你手动断开。首次连接失败不会重试。默认关闭。',
  'workbench.editors.request.settings.reconnectPeriod': '重连周期',
  'workbench.editors.request.settings.reconnectPeriodInfo': '两次重连尝试之间的等待时间。留空使用默认的 5 s。',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5 s（默认）',
  'workbench.editors.request.settings.reconnectMaxAttempts': '重连次数上限',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    '一次断开后连续重连尝试的上限——重连成功后计数归零；上限用尽时会话以“重连已放弃”结束。留空则持续尝试，直到服务器恢复或你手动断开。',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': '不限（默认）',
  'workbench.editors.request.settings.reconnectBackoff': '指数退避',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    '每次尝试失败后等待时间翻倍——先是重连周期，然后 2×、4×……最长 60 s——并加入少量随机抖动，避免客户端同时重连。默认开启；关闭后每次都精确等待重连周期。',
  'workbench.editors.request.settings.idleTimeout': '空闲超时',
  'workbench.editors.request.settings.idleTimeoutInfo':
    '这么长时间内没有任何数据到达时，把连接视为丢失并关闭——客户端无法用 ping 帧完成的存活检查。开启自动重连后会话会重新拨号。留空则不设空闲期限。',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    '这么长时间内没有任何数据到达时，把连接视为丢失并关闭。开启自动重连后会话会重新拨号。留空则遵循服务器握手：每 pingInterval 应收到一次 ping，最多可迟 pingTimeout——官方客户端的规则。',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': '关闭（默认）',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': '服务器 ping 节奏（默认）',
  'workbench.editors.request.settings.heartbeatMessage': '心跳消息',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    '按心跳间隔发送的文本帧，让空闲会话穿过负载均衡器和代理保持存活——内容由你的服务器决定。两种 WebSocket 客户端都无法发送协议层 ping 帧，因此保活是一条应用消息；它会像任何已发送帧一样被记录。支持模板。留空则不发送心跳。',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': '无心跳',
  'workbench.editors.request.settings.heartbeatMessageExample': '例如 ping 或 {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': '心跳间隔',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    '两条心跳消息之间的等待时间。留空使用默认的 30 s——低于多数负载均衡器 60 s 的空闲切断。',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30 s（默认）',
  'workbench.editors.request.settings.unixSocket': 'Unix 套接字',
  'workbench.editors.request.settings.unixSocketInfo':
    '拨号这个本地套接字——绝对 Unix 套接字路径，或形如 \\\\.\\pipe\\name 的 Windows 命名管道——而不是打开 TCP 连接，例如 Docker 守护进程或监听套接字的本地开发服务。URL 的主机不再决定连接去向，但 Host 标头、TLS 服务器名和证书验证仍使用它，重定向到其他主机时也拨号同一个套接字。留空则使用普通 TCP 连接。',
  'workbench.editors.request.settings.unixSocketPlaceholder': '无套接字——TCP 连接',
  'workbench.editors.request.settings.unixSocketError':
    '仅限绝对 Unix 套接字路径（/…）或 Windows 命名管道（\\\\.\\pipe\\…）。',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    '同时设置了代理，但代理隧道无法拨号本地套接字——在其中一项被清除之前，发送都会失败。',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    '同时设置了解析到地址，但套接字拨号不解析任何主机名——在其中一项被清除之前，发送都会失败。',
  'workbench.editors.request.settings.unixSocketExample': '例如 /var/run/docker.sock',
  'workbench.editors.request.settings.cookieJar': '使用 Cookie 罐',
  'workbench.editors.request.settings.cookieJarInfo':
    '把此请求的 Set-Cookie 响应存进应用自己的 Cookie 罐，并自动附加匹配的 Cookie——这样登录请求之后的鉴权调用无需手动复制 Cookie 值即可工作。罐按工作区存于内存中，只被开启此设置的请求使用，从不同步，应用退出时清空。你自己设置的 Cookie 标头始终优先。关闭是默认：不附加任何 Cookie，Set-Cookie 响应被丢弃。',
  'workbench.editors.request.settings.timeout': '请求超时',
  'workbench.editors.request.settings.timeoutInfo':
    '整个请求可占用的最长时间——连接、等待响应和读取正文。超过限制时发送被中止，并以报出该限制的超时错误失败。留空则没有按请求的限制；只有网络栈自身的超时生效。',
  'workbench.editors.request.settings.timeoutPlaceholder': '无限制',
  'workbench.editors.request.settings.responseSizeLimit': '响应大小限制',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    '从线路上读取的响应体最大大小；超出部分被截断，响应会被标记为已截断。留空为默认限制 2,048 KB（2 MB）。可提高到 10,240 KB（10 MB）以容纳更大的负载，或降低它来测试截断的响应是什么样子。',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.maxMessageSize': '最大消息大小',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    '会话接受的最大入站消息。超过上限的消息不会被捕获：会话以代码 1009（Message Too Big）关闭并注明两个大小，自动重连也不会重新打开——这是客户端的请求。留空表示不设置每请求上限；桌面运行时最多组装 128 MB 的消息，浏览器不设限制。',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': '无限制（默认）',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    '跟随握手的 3xx 应答并拨号其 Location——认证网关弹回升级请求的方式。默认关闭，这是 WebSocket 标准自身的规则：被重定向的握手会失败并注明重定向。当会话在桌面应用或服务器上运行时生效；浏览器从不跟随。',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    '一次连接在因超出限制而报错前最多可跟随多少次握手重定向。留空表示默认值 20。',
  'workbench.editors.request.settings.managed.browserKicker': '浏览器管理',
  'workbench.editors.request.settings.managed.nodeKicker': '运行时管理',
  'workbench.editors.request.settings.managed.browserIntro':
    '由浏览器为从扩展发出的每个请求固定——列在这里，让你知道哪些不可协商。',
  'workbench.editors.request.settings.managed.nodeIntro':
    '由应用的网络运行时为每个请求固定——列在这里，让你知道哪些不可协商。',
  'workbench.editors.request.settings.managed.hideBrowser': '隐藏浏览器管理的设置',
  'workbench.editors.request.settings.managed.hideNode': '隐藏运行时管理的设置',
  'workbench.editors.request.settings.managed.countBrowser': '{count} 项浏览器管理',
  'workbench.editors.request.settings.managed.countNode': '{count} 项运行时管理',
  'workbench.editors.request.settings.managed.on': '开',
  'workbench.editors.request.settings.managed.off': '关',
  'workbench.editors.request.settings.managed.auto': '自动',
  'workbench.editors.request.settings.managed.policy': '策略',
  'workbench.editors.request.settings.managed.browser': '浏览器',
  'workbench.editors.request.settings.managed.browserStore': '浏览器信任库',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': '不发送',
  'workbench.editors.request.settings.managed.offered': '已提供',
  'workbench.editors.request.settings.managed.none': '无',
  'workbench.editors.request.settings.managed.never': '从不',
  'workbench.editors.request.settings.managed.websocketOnly': '仅 WebSocket',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': '压缩',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    '每次握手都会提供 permessage-deflate，由服务器决定帧是否压缩；“已连接”行显示协商结果。该提议无法按请求撤回。',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    '消息以未压缩形式发出，且不协商任何 grpc-encoding；服务器返回的压缩帧会显示为已压缩，而不会被解码。',
  'workbench.editors.request.settings.managed.transport': '传输',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    '会话直接拨号 WebSocket 传输，跳过官方客户端起始并从中升级的 HTTP 长轮询握手。',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC 仅运行于 HTTP/2：TLS 通道通过 ALPN 协商 h2，明文通道以先验知识方式使用 h2。',
  'workbench.editors.request.settings.managed.connectionReuse': '连接复用',
  'workbench.editors.request.settings.managed.onePerCall': '每次调用一个',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    '每次调用都打开自己的 HTTP/2 连接，并在调用结束时关闭；调用之间不做池化也不保活，因此保活只在调用打开期间运行。',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    '浏览器从不跟随被重定向的握手；3xx 应答会使连接失败。要跟随重定向，请在桌面应用或服务器上运行会话。',
  'workbench.editors.request.settings.managed.httpVersion': 'HTTP 版本',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    '浏览器按连接协商 HTTP/1.1、HTTP/2 或 HTTP/3；fetch API 不提供版本选择器。',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    '证书按浏览器策略验证。指向证书无效主机的请求会失败；无法按请求禁用验证。',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    '在 301/302/303 重定向上，浏览器按 fetch 规范把非 GET 方法切换为 GET。307/308 始终保持方法。',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    '重定向跨到不同源时，浏览器会剥除 Authorization 标头；这一安全行为不可覆盖。',
  'workbench.editors.request.settings.managed.refererRedirect': '重定向时移除 Referer 标头',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    '跨重定向的 Referer 处理遵循扩展上下文的浏览器 referrer 策略。',
  'workbench.editors.request.settings.managed.strictParser': '严格 HTTP 解析器',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    '浏览器网络栈始终拒绝格式错误的响应标头；没有宽松模式。',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    '运行时的 HTTP 解析器拒绝格式错误的响应标头；没有宽松模式。',
  'workbench.editors.request.settings.managed.encodeUrl': '自动编码 URL',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    '请求上线前，URL 的路径和查询串由 URL 解析器进行百分号编码。输入已编码的序列即可原样保留。',
  'workbench.editors.request.settings.managed.cipherOrder': '服务器密码套件顺序',
  'workbench.editors.request.settings.managed.cipherOrderDesc': 'TLS 密码协商由浏览器掌控；套件列表和顺序都不可配置。',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'fetch API 把重定向链限制在约 20 跳。无法实现按请求的上限：手动重定向模式返回不带标头的不透明响应，无从跟随。',
  'workbench.editors.request.settings.managed.tlsVersions': 'TLS/SSL 协议版本',
  'workbench.editors.request.settings.managed.tlsVersionsDesc': '启用的 TLS 协议版本由浏览器固定；不提供按请求的选择。',
  'workbench.editors.request.settings.managed.referer': 'Referer 标头',
  'workbench.editors.request.settings.managed.refererDesc':
    '运行时没有页面上下文，因此除非你自己把 Referer 添加为标头，否则线路上不会有它。',
  'workbench.editors.request.settings.managed.scripts': '请求前 / 响应后脚本',
  'workbench.editors.request.settings.managed.scriptsNotRun': '不在此处运行',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    '应答此界面发送的主机没有脚本运行时，因此请求前和响应后脚本被跳过，响应不携带任何脚本结果。',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': '安全模式',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    '此界面的发送在已连接的后端上执行，后端在其沙箱化的安全运行时中运行请求前和响应后脚本：只有 oh.* 脚本 API——没有文件系统、没有进程访问、没有模块加载器。转发的发送绝不在开发者模式下运行，每次运行都会在响应上记录其执行模式。',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': '脚本执行',
  'workbench.editors.request.settings.scriptModeSummary': '此工作区的请求前和响应后脚本在这台设备上如何运行。',
  'workbench.editors.request.settings.scriptModeDescription':
    '该选择适用于工作区中的每个请求，只留在这台设备上，从不同步——每次运行都会在响应上记录其执行模式。',
  'workbench.editors.request.settings.scriptModeModesHeading': '模式',
  'workbench.editors.request.settings.scriptModeSafe': '安全模式',
  'workbench.editors.request.settings.scriptModeDeveloper': '开发者模式',
  'workbench.editors.request.settings.scriptModeWarning':
    '开发者模式以完整系统访问权限运行此工作区的脚本——文件系统、进程和网络。只有当你信任每个能编辑此工作区脚本的人时才启用它。工作流步骤和其他设备转发的请求继续在安全模式下运行。',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': '脚本执行：{mode}',
  'workbench.editors.request.settings.scriptModeRecommended': '推荐',
  'workbench.editors.request.settings.scriptModeSafeCard':
    '脚本在应用的沙箱化脚本运行时中运行——只有 oh.* 脚本 API，没有文件系统或进程访问，没有模块加载器。',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    '脚本在完整的 Node.js 运行时中运行——require、文件系统、进程和网络访问。',
  'workbench.editors.request.settings.scriptModeDeveloperTrust': '仅当你信任每个能编辑此工作区脚本的人时使用',
  'workbench.editors.request.settings.scriptModeScopeNote':
    '适用于此工作区中的每个请求，且仅限这台设备——该选择从不同步。',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), { other: '此工作区的 Cookie 罐中有 {count} 个 Cookie' }),
  'workbench.editors.request.settings.jar.infoTitle': 'Cookie 罐内容',
  'workbench.editors.request.settings.jar.infoSummary':
    '此工作区内存罐当前持有的 Cookie——由启用罐的发送存入，附加到匹配的启用罐的发送上，应用退出即消失。值是会话凭据，留在应用的网络运行时内部；这里只显示名称、范围和过期时间。',
  'workbench.editors.request.settings.jar.storedHeading': '已存储的 Cookie',
  'workbench.editors.request.settings.jar.clear': '清空',
  'workbench.editors.request.settings.jar.delete': '删除 {name}',
  'workbench.editors.request.settings.jar.expires': '{date} 过期',
  'workbench.editors.request.settings.jar.session': '会话',
  'workbench.editors.request.settings.jar.httpsOnly': '仅 https',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': '响应',
  'workbench.editors.request.response.clear': '清除',
  'workbench.editors.request.response.saveResponse': '保存响应',
  'workbench.editors.request.response.createWorkflow': '创建工作流',
  'workbench.editors.request.response.createWorkflowNew': '创建新工作流',
  'workbench.editors.request.response.createWorkflowAttach': '附加到现有工作流',
  'workbench.editors.request.response.createWorkflowNeedsSave': '该请求尚未保存 — 请先保存，才能在工作流中使用',
  'workbench.editors.request.response.copyBody': '复制正文',
  'workbench.editors.request.response.saveBodyToFile': '将正文保存到文件',
  'workbench.editors.request.response.saveBodyToFileTruncated': '将正文保存到文件（已截断——保存已保留的部分）',
  'workbench.editors.request.response.clearResponse': '清除响应',
  'workbench.editors.request.response.moreActionsAria': '更多响应操作',
  'workbench.editors.request.response.copied': '已复制',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': '正文',
  'workbench.editors.request.response.tab.headers': '标头（{count}）',
  'workbench.editors.request.response.tab.cookies': 'Cookies（{count}）',
  'workbench.editors.request.response.tab.assertions': '断言',
  'workbench.editors.request.response.tab.assertionsFailed': '断言（{count} 个失败）',
  'workbench.editors.request.response.tab.assertionsPassed': '断言（{count} 个通过）',
  'workbench.editors.request.response.tab.console': 'Console（{count}）',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': '响应元信息',
  'workbench.editors.request.response.meta.timingTitle': '耗时',
  'workbench.editors.request.response.meta.timingSummary': '围绕 fetch 调用测得：{duration}。',
  'workbench.editors.request.response.meta.timingNoEntry':
    '平台没有为此请求记录 resource-timing 条目，因此没有阶段拆分可显示。',
  'workbench.editors.request.response.meta.timingTotalOnly':
    '网络总计 {duration}。服务器未向此跨源请求公开耗时详情（没有 Timing-Allow-Origin 标头），因此 DNS / 连接 / TTFB / 下载各阶段被隐藏。',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': '重定向',
  'workbench.editors.request.response.meta.phase.stalled': '停滞',
  'workbench.editors.request.response.meta.phase.dns': 'DNS 查询',
  'workbench.editors.request.response.meta.phase.connect': 'TCP 连接',
  'workbench.editors.request.response.meta.phase.tls': 'TLS 握手',
  'workbench.editors.request.response.meta.phase.waiting': '等待（TTFB）',
  'workbench.editors.request.response.meta.phase.download': '内容下载',
  'workbench.editors.request.response.meta.totalNetwork': '总计（网络）',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    '从应用的网络运行时无法按发送观察 DNS、连接和 TLS——它们计入等待。',
  'workbench.editors.request.response.meta.sizeTitle': '大小',
  'workbench.editors.request.response.meta.sizeSummary': '此次交换两个方向的字节数。',
  'workbench.editors.request.response.meta.responseSize': '响应大小',
  'workbench.editors.request.response.meta.requestSize': '请求大小',
  'workbench.editors.request.response.meta.rowHeaders': '标头',
  'workbench.editors.request.response.meta.rowBody': '正文',
  'workbench.editors.request.response.meta.rowCompressed': '压缩后',
  'workbench.editors.request.response.meta.rowTransferred': '已传输',
  'workbench.editors.request.response.meta.noteHeaderBytes': '标头字节按可见内容计——HTTP/2+ 会在线路上压缩它们。',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    '请求标头只计入此次发送设置的内容；浏览器会添加自己的（Host、User-Agent 等）。',
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    '请求标头只计入此次发送设置的内容；运行时会添加自己的（Host、Accept-Encoding 等）。',
  'workbench.editors.request.response.meta.noteTruncatedAtCap': '正文在 {cap} 响应大小限制处被截断；大小按完整值计。',
  'workbench.editors.request.response.meta.noteTruncated': '正文视图已截断；大小按完整值计。',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    '请求体大小是近似值——multipart boundary 由浏览器生成。',
  'workbench.editors.request.response.meta.noteWireHidden':
    '线路大小（压缩后、已传输）被隐藏：服务器未发送 Timing-Allow-Origin。',
  'workbench.editors.request.response.meta.networkTitle': '网络',
  'workbench.editors.request.response.meta.networkSummary': '此次交换的连接层事实。',
  'workbench.editors.request.response.meta.httpVersion': 'HTTP 版本',
  'workbench.editors.request.response.meta.localAddress': '本地地址',
  'workbench.editors.request.response.meta.remoteAddress': '远程地址',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'HTTP 版本被隐藏：本次发送的协商协议不可观测（经代理的发送在隧道内协商）。',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'HTTP 版本被隐藏：平台没有为此请求记录 timing 条目。',
  'workbench.editors.request.response.meta.noteNoIp': '远程地址不可用：线路捕获没有看到此次 fetch 的任何内容。',
  'workbench.editors.request.response.meta.tlsProtocol': 'TLS 协议',
  'workbench.editors.request.response.meta.tlsCipher': '加密套件名称',
  'workbench.editors.request.response.meta.tlsCertificate': '证书 CN',
  'workbench.editors.request.response.meta.tlsIssuer': '颁发者 CN',
  'workbench.editors.request.response.meta.tlsValidUntil': '有效期至',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': '证书未验证（{code}）',
  'workbench.editors.request.response.meta.trustPinned': '证书已固定在此设备——再次发送以验证。',
  'workbench.editors.request.response.meta.noteNoTls': 'Chromium 上不向扩展代码公开本地地址、TLS 和证书详情。',
  'workbench.editors.request.response.meta.tlsSelfSigned': '自签名证书',
  'workbench.editors.request.response.meta.tlsUnverified': '证书未验证',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'TLS 下限已降低',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    '此请求发送时其设置中的 TLS 最低版本被设为 1.2 以下，因此连接被允许协商 TLS 1.0 或 1.1——这些协议版本存在已知弱点，运行时默认禁用它们。',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization 已转发',
  'workbench.editors.request.response.meta.authForwardedSummary':
    '一次重定向把此请求带到了不同的源，而其设置在跨源时保留 Authorization 标头——因此凭据被重新发送到了新主机。通常在重定向离开原始源时该标头会被丢弃。',
  'workbench.editors.request.response.meta.authTitle': '授权',
  'workbench.editors.request.response.meta.authSummaryRequest': '使用请求自身的{type}配置发送。',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type}——继承自{source}。',
  'workbench.editors.request.response.meta.authSummaryNone': '未携带授权发送——请求之上未设置任何内容。',
  'workbench.editors.request.response.meta.authDangling': '请求选择的条目已不存在——改为应用了默认项。',
  'workbench.editors.request.response.meta.scriptsTag': '脚本 · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': '脚本链',
  'workbench.editors.request.response.meta.scriptsSummary':
    '脚本链的每一层都已成功运行——集合和文件夹的脚本先于请求自身的脚本，请求前与响应后均如此。根据本次运行的实际情况记录。',
  'workbench.editors.request.response.meta.scriptsSummaryFailed': '脚本链中有一层失败——下方各行指明是哪一层以及原因。',
  'workbench.editors.request.response.meta.scriptsLevelRequest': '请求',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} 毫秒',
  'workbench.editors.request.response.meta.executedOnTag': '从 {name} 发送',
  'workbench.editors.request.response.meta.executedOnTitle': '在已连接的后端上执行',
  'workbench.editors.request.response.meta.executedOnSummary':
    '此请求由“{name}”发送——即此界面连接的后端——而不是这台设备。目标服务器看到的是那台机器的 IP 地址和网络位置，因此基于地理或 IP 的行为反映后端的运行位置。由执行它的主机在本次运行时记录。',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    '此请求使用了工作区的内存 Cookie 罐：匹配的已存 Cookie 被自动附加，Set-Cookie 响应被保留给之后启用罐的发送。',
  'workbench.editors.request.response.meta.jarAttachedLabel': '附加到第一个请求',
  'workbench.editors.request.response.meta.jarAttachedNone':
    '无——没有已存 Cookie 匹配，或请求上自设的 Cookie 标头胜出。',
  'workbench.editors.request.response.meta.jarStoredLabel': '从 Set-Cookie 响应存入',
  'workbench.editors.request.response.meta.jarStoredNone': '无——没有响应设置 Cookie。',
  'workbench.editors.request.response.meta.proxyTag': '经代理',
  'workbench.editors.request.response.meta.proxyTitle': '代理路由',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    '本次运行经其自身请求设置中所设的代理隧道传输——记录自发送实际所做的。',
  'workbench.editors.request.response.meta.proxySummarySystem':
    '本次运行经执行设备系统所指定的代理隧道传输——记录自运行实际所做的，绝非实时读取设置。',
  'workbench.editors.request.response.meta.proxyRowUrl': '代理',
  'workbench.editors.request.response.meta.proxyRowSource': '决定方',
  'workbench.editors.request.response.meta.proxySourceRequest': '请求设置',
  'workbench.editors.request.response.meta.proxySourceDevice': '设备代理设置',
  'workbench.editors.request.response.meta.proxySourceEnv': '环境变量',
  'workbench.editors.request.response.meta.proxySourceSystem': '系统代理设置',
  'workbench.editors.request.response.meta.proxySourceManual': '手动代理配置',
  'workbench.editors.request.response.meta.proxySourcePac': 'PAC 脚本',
  'workbench.editors.request.response.meta.proxyStandDownTag': '代理已绕过',
  'workbench.editors.request.response.meta.proxyStandDownTitle': '系统代理已让位',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    '系统指定了代理，但本次运行的目标是代理隧道无法拨号的本地套接字——因此直连进行。',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    '系统指定了代理，但本次运行固定了自己的地址解析，而代理会覆盖它——因此直连进行。',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    '系统指定了代理，但本次运行固定为 HTTP/3，它拨号自己的 QUIC 路径——因此直连进行。',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 次重定向' }),
  'workbench.editors.request.response.meta.redirectsTitle': '重定向链',
  'workbench.editors.request.response.meta.redirectsSummary':
    '此请求在最终响应之前经过的跳转——每一跳显示发出的请求和它应答的重定向，在发送运行时记录。',
  'workbench.editors.request.response.meta.redirectMethodChanged': '下一个请求的方法改为 {method}',
  'workbench.editors.request.response.meta.redirectAuthStripped': 'Authorization 标头已丢弃——下一个请求跨到了不同的源',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Authorization 标头被跨源重新发送——由此请求的设置保留',
  'workbench.editors.request.response.meta.redirectFinal': '最终响应',
  'workbench.editors.request.response.meta.streamedEnd': '流已结束',
  'workbench.editors.request.response.meta.streamedStop': '已停止',
  'workbench.editors.request.response.meta.streamedCap': '流已达上限',
  'workbench.editors.request.response.meta.streamedTimeout': '流中途超时',
  'workbench.editors.request.response.meta.streamedError': '流失败',
  'workbench.editors.request.response.meta.streamedEndSummary':
    '此响应实时流入，直到服务器关闭了流。下方正文是完整捕获。',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    '交换结束时响应仍在流入，因此下方正文是截至该时刻的部分捕获——已到达的一切都被保留。',
  'workbench.editors.request.response.streamReceiving': '正在接收流——{size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': '已连接到 {url}',
  'workbench.editors.request.response.sse.closed': '连接已关闭',
  'workbench.editors.request.response.sse.stopped': '连接已停止',
  'workbench.editors.request.response.sse.capped': '捕获已达上限——达到了正文大小限制',
  'workbench.editors.request.response.sse.timedOut': '连接超时',
  'workbench.editors.request.response.sse.failed': '连接失败',
  'workbench.editors.request.response.sse.searchEvents': '搜索事件',
  'workbench.editors.request.response.sse.noMatches': '没有匹配的事件。',
  'workbench.editors.request.response.sse.waiting': '等待事件…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个事件' }),
  'workbench.editors.request.response.sse.clearEvents': '清除事件（仅显示层面）',
  'workbench.editors.request.response.sse.newEvents': '新事件',
  'workbench.editors.request.response.sse.sortOrder': '排序',
  'workbench.editors.request.response.sse.newestFirst': '最新在前',
  'workbench.editors.request.response.sse.oldestFirst': '最早在前',
  'workbench.editors.request.response.sse.groupByName': '按事件名分组',
  'workbench.editors.request.response.sse.rowsPerGroup': '每组行数',
  'workbench.editors.request.response.sse.noLimit': '无限制',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': '大小',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': '事件详情',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': '响应在 {cap} 处被截断（原始大小 {size}）。',
  'workbench.editors.request.response.body.increaseLimit': '提高限制',
  'workbench.editors.request.response.body.limitHint': '该限制可在“API 请求”设置中调整。',
  'workbench.editors.request.response.body.viewPickerAria': '正文视图',
  'workbench.editors.request.response.body.preview': '预览',
  'workbench.editors.request.response.body.wrapLines': '自动换行',
  'workbench.editors.request.response.body.unwrapLines': '取消自动换行',
  'workbench.editors.request.response.body.renderAnsi': '渲染 ANSI 颜色',
  'workbench.editors.request.response.body.plainAnsi': '显示纯文本',
  'workbench.editors.request.response.body.filterJsonPathTooltip': '筛选正文（JSONPath）',
  'workbench.editors.request.response.body.filterXPathTooltip': '筛选正文（XPath）',
  'workbench.editors.request.response.body.filterMetricsTooltip': '筛选正文（指标族）',
  'workbench.editors.request.response.body.filterAria': '筛选正文',
  'workbench.editors.request.response.body.invalidJsonPath': 'JSONPath 表达式无效。',
  'workbench.editors.request.response.body.invalidXPath': 'XPath 表达式无效，或文档无法解析。',
  'workbench.editors.request.response.body.invalidMetricsFilter': '指标选择器无效。',
  'workbench.editors.request.response.body.noMatches': '此路径没有匹配项。',
  'workbench.editors.request.response.body.showingLastMatch': '正在显示最后一个匹配项。',
  'workbench.editors.request.response.body.hexCapNotice': 'Hex 视图显示 {total} 中的前 {shown}。',
  'workbench.editors.spec.tab': '规范',
  'workbench.editors.spec.noSpecs': '此工作区尚无 {format} 规范。',
  'workbench.editors.spec.goToSpecs': '前往规范',
  'workbench.editors.timelineViewer.format': '消息格式',
  'workbench.editors.timelineViewer.showMessage': '显示消息',
  'workbench.editors.timelineViewer.showHexdump': '显示十六进制转储',
  'workbench.editors.request.response.body.previewIframeTitle': '响应预览',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'PDF 预览',
  'workbench.editors.request.response.body.imagePreviewAlt': '响应图像',
  'workbench.editors.request.response.body.imagePreviewFailed': '图像数据无法解码——原始字节见 Hex 视图。',
  'workbench.editors.request.response.body.mediaPreviewAria': '媒体预览',
  'workbench.editors.request.response.body.mediaPreviewFailed': '媒体数据无法解码——原始字节见 Hex 视图。',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    '请求体未发送——浏览器无法给 GET 或 HEAD 请求附加正文。',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice': 'JSON 键重复——显示的是最后一个值：{keys}',
  'workbench.editors.request.response.body.partialJsonNotice': '正文已截断——预览和筛选只显示被完整捕获的值。',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    '无 schema 解码（尽力而为）——显示字段编号；嵌套和文本从线路字节推断。',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': '名称',
  'workbench.editors.request.response.headers.value': '值',
  'workbench.editors.request.response.headers.filterPlaceholder': '筛选标头',
  'workbench.editors.request.response.headers.copyAll': '复制所有标头',
  'workbench.editors.request.response.headers.copyAria': '复制 {name}',
  'workbench.editors.request.response.headers.copyTitle': '复制标头',
  'workbench.editors.request.response.headers.empty': '没有标头',
  'workbench.editors.request.response.headers.noMatch': '没有标头匹配“{query}”',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': '名称',
  'workbench.editors.request.response.cookies.value': '值',
  'workbench.editors.request.response.cookies.copyAria': '复制 {name} 的 Set-Cookie',
  'workbench.editors.request.response.cookies.copyTitle': '复制 Set-Cookie 行',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    '此请求以包含凭据的方式运行，因此浏览器可能存储了这些 Cookie（取决于每个 Cookie 自己的属性），并会在未来携带凭据的请求上发送它们。',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    '服务器发送了这些 Cookie，但此请求以省略凭据的方式运行（默认），因此浏览器丢弃了它们——什么也没存储。',
  'workbench.editors.request.response.cookies.noteJarOff':
    '这些 Cookie 未被存储——此请求在未启用 Cookie 罐的情况下运行（默认），或罐一个也没接受。',
  'workbench.editors.request.response.cookies.noteJarStored':
    '此请求在启用 Cookie 罐的情况下运行，罐把 {names} 存入了工作区的内存罐，供之后启用罐的请求使用。',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    '此请求在启用 Cookie 罐的情况下运行，罐把 {names} 存入了工作区的内存罐，供之后启用罐的请求使用。其中一些是在中间重定向跳转上设置的，因此它们的 Set-Cookie 行未列在这里——这里只有最终响应的标头。',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': '通过',
  'workbench.editors.request.response.assertions.fail': '失败',
  'workbench.editors.request.response.console.preRequest': '请求前',
  'workbench.editors.request.response.console.postResponse': '响应后',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': '正在发送请求…',
  'workbench.editors.request.response.empty.prompt': '发送请求后在这里查看响应。',
  'workbench.editors.request.response.error.title': '无法发送请求',
  'workbench.editors.request.response.error.openInTab': '在新标签页中打开',
  'workbench.editors.request.response.error.trust.title': '信任 {origin} 出示的证书',
  'workbench.editors.request.response.error.trust.probing': '正在读取服务器出示的证书…',
  'workbench.editors.request.response.error.trust.probeFailed': '无法读取服务器证书：{message}',
  'workbench.editors.request.response.error.trust.retryProbe': '重试',
  'workbench.editors.request.response.error.trust.failure': '失败原因',
  'workbench.editors.request.response.error.trust.noAnchor':
    '服务器未出示其根证书，因此这里没有可固定的内容。请在 设置 › API 请求 › TLS 中添加颁发该证书的 CA。',
  'workbench.editors.request.response.error.trust.trustOnDevice': '在此设备上信任',
  'workbench.editors.request.response.error.trust.addToWorkspace': '添加到工作区',
  'workbench.editors.request.response.error.certSteps.summary':
    '本地开发服务器通常使用自签名证书运行，你需要先接受它。',
  'workbench.editors.request.response.error.certSteps.step1': '在新标签页中打开该 URL',
  'workbench.editors.request.response.error.certSteps.step2': '接受证书警告',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': '高级 → 继续前往（不安全）',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': '高级… → 接受风险并继续',
  'workbench.editors.request.response.error.certSteps.step3': '重新发送请求',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': '新标签页',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': '高级',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ 发送',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': '继续前往（不安全）',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': '接受风险并继续',
  'workbench.editors.request.scripts.apiConnect': '组装好的连接 — URL、请求头、参数、子协议、尝试次数',
  'workbench.editors.request.scripts.apiSetSubprotocols': '替换子协议列表',
  'workbench.editors.request.scripts.apiMessage': '消息 — 文本、帧类型、捕获序号',
  'workbench.editors.request.scripts.apiSetMessage': '替换待发送文本',
  'workbench.editors.request.scripts.apiSetEvent': '重命名 Socket.IO 事件',
  'workbench.editors.request.scripts.apiDrop': '丢弃消息 — 不会发送任何内容',
  'workbench.editors.request.scripts.apiSend': '向会话发送一个文本帧',
  'workbench.editors.request.scripts.apiSendBinary': '发送一个二进制帧（base64）',
  'workbench.editors.request.scripts.apiEmit': '发出 Socket.IO 事件',
  'workbench.editors.request.scripts.apiClose': '结束记录 — 关闭代码、原因、计数、时长',
  'workbench.editors.request.scripts.apiSession': '本会话所有钩子共享的状态',
  'workbench.editors.request.scripts.apiMqttConnect':
    '组装好的 CONNECT — 客户端 ID、凭据、遗嘱、订阅、用户属性、尝试次数',
  'workbench.editors.request.scripts.apiSetClientId': '替换客户端 ID',
  'workbench.editors.request.scripts.apiSetUsername': '替换用户名',
  'workbench.editors.request.scripts.apiSetPassword': '替换密码',
  'workbench.editors.request.scripts.apiSetWill': '替换遗嘱（null 表示不注册）',
  'workbench.editors.request.scripts.apiAddSubscription': '在打开时订阅一个主题过滤器',
  'workbench.editors.request.scripts.apiSetUserProperty': '设置一个 5.0 用户属性',
  'workbench.editors.request.scripts.apiMqttMessage': '消息 — 主题、载荷、QoS、retain、捕获索引',
  'workbench.editors.request.scripts.apiSetTopic': '改变发布目标主题',
  'workbench.editors.request.scripts.apiSetPayload': '替换载荷（文本，或 base64 字节）',
  'workbench.editors.request.scripts.apiSetQos': '设置 QoS',
  'workbench.editors.request.scripts.apiSetRetain': '设置 RETAIN 标志',
  'workbench.editors.request.scripts.apiPublish': '向会话发布一条消息',
  'workbench.editors.request.scripts.apiMqttClose': '结束记录 — 结束方式、CONNACK、计数、时长',
  'workbench.editors.request.scripts.apiInvoke': '组装完成的调用 — 目标、方法、调用形态、元数据、消息文本',
  'workbench.editors.request.scripts.apiSetMetadata': '设置一对元数据',
  'workbench.editors.request.scripts.apiRemoveMetadata': '移除一对元数据',
  'workbench.editors.request.scripts.apiGrpcSetMessage': '替换消息文本（JSON）',
  'workbench.editors.request.scripts.apiGrpcMessage': '捕获的帧 — 方向、类型、解码后的消息、捕获索引',
  'workbench.editors.request.scripts.apiGrpcResponse': '结束记录 — 状态、元数据、trailer、双向计数、时长',
} as const satisfies Catalog;
