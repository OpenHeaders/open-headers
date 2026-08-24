/**
 * Web namespace — Simplified Chinese. Mirrors `catalogs/en/web.ts` key
 * for key; the 'OpenHeaders' brand, URLs and the `oh-license.` key
 * prefix stay raw. Mints: 守护进程 = daemon; 席位 = seat / 个人席位 =
 * individual seat; 邮箱 = email; 配对 = pairing; 安装码 = setup code;
 * 身份提供方 = identity provider; 反向代理 = reverse proxy; 单点登录 =
 * single sign-on; Workbench raw as the surface name.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': '登录此服务器',
  'web.gate.titleSetup': '设置此服务器',
  'web.gate.introSso': '使用 {provider} 登录，进入此 OpenHeaders 服务器。',
  'web.gate.introPassword': '使用服务器管理员为你设置的邮箱和密码登录。',
  'web.gate.introSetup': '此 OpenHeaders 服务器尚未设置。创建第一个账户——它管理这台服务器，并拥有其上已有的一切。',
  'web.gate.introNoLogin':
    '此服务器上浏览器无法登录：未配置单点登录，也没有任何账户设置了密码。请运行该服务器的人为你设置一个。',
  'web.gate.ssoButton': '使用 {provider} 登录',
  'web.gate.emailPlaceholder': '邮箱',
  'web.gate.passwordPlaceholder': '密码',
  'web.gate.signIn': '登录',
  'web.gate.setupNamePlaceholder': '你的姓名',
  'web.gate.setupConfirmPlaceholder': '确认密码',
  'web.gate.setupPasswordHint': '至少 {min} 个字符。没有密码重置功能——请妥善保管。',
  'web.gate.setupCodePlaceholder': '安装码（可选）',
  'web.gate.setupCodeHint': '仅当此浏览器不在服务器本机上运行时才需要。服务器启动时会打印该码，每次重启都会换成新的。',
  'web.gate.setupSubmit': '创建账户',
  'web.gate.setupDoneTitle': '此服务器已设置完成',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '设置过程解除了 {count} 台已配对设备，以免它们绕过你的新账户继续管理这台服务器。请在设置中重新配对。',
    }),
  'web.gate.setupDoneContinue': '继续',
  'web.gate.setupDoneReload': '重新加载',
  'web.gate.setupErrorDisplayName': '请输入账户使用的姓名。',
  'web.gate.setupErrorEmail': '请输入用于登录的邮箱。',
  'web.gate.setupErrorPasswordShort': '请至少使用 {min} 个字符。',
  'web.gate.setupErrorPasswordMismatch': '两次输入的密码不一致。',
  'web.gate.setupErrorMalformed': '服务器无法读取此表单。请重新加载页面后重试。',
  'web.gate.setupErrorRefused':
    '服务器拒绝了此次设置。它可能已经设置过，或者安装码有误、来自上一次启动——服务器每次重启都会打印一个新的。',
  'web.gate.setupErrorSessionRefused': '账户已创建，但此标签页未能打开会话。请重新加载页面并用它登录。',
  'web.gate.clientsIntro': '此标签页并非唯一的客户端。扩展程序和桌面应用可直接连接到此服务器：',
  'web.gate.clientsExtension': '获取扩展程序',
  'web.gate.clientsDesktop': '获取桌面应用',
  'web.gate.errorServerOffline': '服务器没有响应。请检查它是否在运行，然后重试。',
  'web.gate.errorPasswordRefused': '登录失败。请检查邮箱和密码后重试。',
  'web.gate.errorSessionRefused': '服务器未接受该会话。请重试。',
  'web.gate.seatIntroPrefix':
    '有个人席位？粘贴其密钥即可登录，无需等待空闲的团队席位——它只允许购买时使用的邮箱。获取地址：',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': '个人席位密钥（oh-license.…）',
  'web.gate.seatSignIn': '使用个人席位登录',
  'web.overlay.signingIn': '正在为你登录…',
  'web.overlay.takingYouTo': '正在前往 {provider}…',
  'web.oidcError.unknownUser': '已登录，但此服务器上没有对应你邮箱的用户。请服务器管理员添加你。',
  'web.oidcError.userDeactivated': '已登录，但你在此服务器上的用户已被停用。请联系服务器管理员。',
  'web.oidcError.emailUnverified': '你的身份提供方报告该邮箱未验证。请验证后重试。',
  'web.oidcError.providerUnavailable': '无法连接身份提供方。请稍后重试。',
  'web.oidcError.seatLimitReached':
    '已登录，但此服务器没有空闲席位可分配给新用户。请联系服务器管理员——或者现在就用你自己的个人席位进入。',
  'web.oidcError.personalSeatsDisabled': '此服务器已禁用个人席位。请向服务器管理员咨询席位。',
  'web.oidcError.personalLicenseInvalid': '该个人席位密钥不可用——它无效、已过期或不是个人席位。请检查密钥后重试。',
  'web.oidcError.personalLicenseIdentityMismatch': '该个人席位属于另一个邮箱。它只允许购买时使用的地址。',
  'web.oidcError.personalLicenseNoIdentity': '你的登录没有携带可与个人席位匹配的邮箱。请联系服务器管理员。',
  'web.oidcError.failed': '单点登录失败。请重试，或请运行该服务器的人检查身份提供方。',
  'web.access.title': '尚未获得工作区授权',
  'web.access.intro': '你已登录 {org}，但尚未获得其中任何工作区的访问权限。需要管理员为你授予一个工作区。',
  'web.access.introNoOrg': '你已登录此服务器，但尚未获得其中任何工作区的访问权限。需要管理员为你授予一个工作区。',
  'web.access.signedInAs': '已登录：{name}',
  'web.access.signedInAsWithEmail': '已登录：{name}（{email}）',
  'web.access.waiting': '访问权限授予后此界面会立即更新——无需刷新。',
  'web.access.signOut': '退出登录',
  'web.insecure.title': '此页面需要安全连接',
  'web.insecure.intro':
    '此标签页运行完整的 Workbench，而不是服务器的轻量视图，因此必须为此设备创建身份——浏览器仅在安全源上允许这样做。',
  'web.insecure.optionLocal': '在服务器本机上：',
  'web.insecure.optionTls': '从这里通过 HTTPS——在前面放置一个终止 TLS 的反向代理。',
  'web.insecure.optionClients': '从这里且不使用 TLS——扩展和桌面应用直接连接到',
} as const satisfies Catalog;
