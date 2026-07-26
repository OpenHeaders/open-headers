/**
 * Web namespace — Simplified Chinese. Mirrors `catalogs/en/web.ts` key
 * for key; the 'OpenHeaders' brand, the `ohd show-token` command, URLs
 * and the `oh-license.` key prefix stay raw. Mints: 守护进程 = daemon;
 * 席位 = seat / 个人席位 = individual seat; 邮箱 = email; 配对 token =
 * pairing token (token raw lowercase); 身份提供方 = identity provider;
 * 反向代理 = reverse proxy; 单点登录 = single sign-on; Workbench raw
 * as the surface name; quoted README section titles stay raw English
 * inside “”.
 */

import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': '登录此 Team Server',
  'web.gate.titlePair': '与此 Team Server 配对',
  'web.gate.introSso': '使用 {provider} 登录，或在下方粘贴配对 token。',
  'web.gate.introPassword': '使用 Team Server 管理员为你设置的邮箱和密码登录，或在下方粘贴配对 token。',
  'web.gate.introTokenPrefix': '此 OpenHeaders Team Server 需要配对 token。在运行它的机器上使用',
  'web.gate.introTokenSuffix': '生成一个，并粘贴到下方。',
  'web.gate.ssoButton': '使用 {provider} 登录',
  'web.gate.or': '或',
  'web.gate.emailPlaceholder': '邮箱',
  'web.gate.passwordPlaceholder': '密码',
  'web.gate.signIn': '登录',
  'web.gate.tokenPlaceholder': '配对 token',
  'web.gate.connect': '连接',
  'web.gate.workLocally': '跳过——在本地工作',
  'web.gate.errorTokenRejected': 'Team Server 拒绝了此 token。请检查后重试。',
  'web.gate.errorTokenOffline': 'Team Server 没有响应。请检查它是否在运行，然后重试。',
  'web.gate.errorPasswordRefused': '登录失败。请检查邮箱和密码后重试。',
  'web.gate.errorSessionRefused': 'Team Server 未接受该会话。请重试。',
  'web.gate.seatIntroPrefix':
    '有个人席位？粘贴其密钥即可登录，无需等待空闲的团队席位——它只允许购买时使用的邮箱。获取地址：',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': '个人席位密钥（oh-license.…）',
  'web.gate.seatSignIn': '使用个人席位登录',
  'web.overlay.signingIn': '正在为你登录…',
  'web.overlay.takingYouTo': '正在前往 {provider}…',
  'web.oidcError.unknownUser': '已登录，但此 Team Server 上没有对应你邮箱的用户。请 Team Server 管理员添加你。',
  'web.oidcError.userDeactivated': '已登录，但你在此 Team Server 上的用户已被停用。请联系 Team Server 管理员。',
  'web.oidcError.emailUnverified': '你的身份提供方报告该邮箱未验证。请验证后重试。',
  'web.oidcError.providerUnavailable': '无法连接身份提供方。请稍后重试。',
  'web.oidcError.seatLimitReached':
    '已登录，但此 Team Server 没有空闲席位可分配给新用户。请联系 Team Server 管理员——或者现在就用你自己的个人席位进入。',
  'web.oidcError.personalSeatsDisabled': '此 Team Server 已禁用个人席位。请向 Team Server 管理员咨询席位。',
  'web.oidcError.personalLicenseInvalid': '该个人席位密钥不可用——它无效、已过期或不是个人席位。请检查密钥后重试。',
  'web.oidcError.personalLicenseIdentityMismatch': '该个人席位属于另一个邮箱。它只允许购买时使用的地址。',
  'web.oidcError.personalLicenseNoIdentity': '你的登录没有携带可与个人席位匹配的邮箱。请联系 Team Server 管理员。',
  'web.oidcError.failed': '单点登录失败。请重试，或改用配对 token 连接。',
  'web.insecure.title': '此页面需要安全连接',
  'web.insecure.intro':
    'OpenHeaders Workbench 将其所有数据保存在此浏览器配置文件中，并且需要浏览器的加密 API——它们仅在安全源上可用。',
  'web.insecure.waysIn': '请改用以下方式之一打开：',
  'web.insecure.httpsPrefix':
    '通过 HTTPS——将 Team Server 置于 TLS 反向代理之后（参见 Team Server README 中的“Behind a reverse proxy”），然后打开',
  'web.insecure.httpsSuffix': '.',
  'web.insecure.loopbackPrefix': '在 Team Server 所在的机器上访问',
  'web.insecure.loopbackSuffix': '.',
} as const satisfies Catalog;
