/**
 * Shared info-popover corpus — Set-Cookie attributes, Simplified
 * Chinese. Mirrors `catalogs/en/shared-info-cookies.ts` key for key.
 * Attribute names (Domain / Path / Expires / Max-Age / SameSite /
 * Secure / HttpOnly / Strict / Lax / None / CHIPS) are wire vocabulary
 * and ride raw. MINTS: Cookie raw (written capitalized in zh prose,
 * standard usage); 会话 Cookie = session cookie; Cookie 罐 = the
 * cookie jar; 跨站 = cross-site; 子域 = subdomain; 注册表 = registry.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Set-Cookie 属性',
  'shared.info.cookie.fallbackSummary': '此属性未收录在我们的注册表中。',
  'shared.info.cookie.fallbackDescription':
    '它可能是特定于供应商的或实验性的 Set-Cookie 扩展；浏览器会忽略无法识别的属性。',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary': '接收该 Cookie 的主机——设置后也包括子域。',
  'shared.info.cookie.domain.body': '不设置 Domain 时，Cookie 的作用范围严格限定为响应的主机，不含子域。',
  'shared.info.cookie.path.summary': '浏览器发送该 Cookie 所需的 URL 路径前缀。',
  'shared.info.cookie.expires.summary': '绝对过期日期——Cookie 会保留到这一时刻。',
  'shared.info.cookie.expires.body':
    '不设置 Expires 或 Max-Age 时，该 Cookie 是会话 Cookie，浏览器会话结束时即被丢弃。',
  'shared.info.cookie.maxAge.summary': '自收到起以秒计的生命周期；两者同时存在时优先于 Expires。',
  'shared.info.cookie.maxAge.body': '零或负值会让 Cookie 立即过期——这是删除 Cookie 的标准方式。',
  'shared.info.cookie.secure.summary': '该 Cookie 只通过 HTTPS 连接发送。',
  'shared.info.cookie.secure.body': 'SameSite=None 的 Cookie 必须带上它——否则浏览器会拒绝跨站 Cookie。',
  'shared.info.cookie.httponly.summary': '该 Cookie 对页面 JavaScript（document.cookie）不可见——只随请求发送。',
  'shared.info.cookie.httponly.body': '防止会话 token 通过脚本注入被窃取的标准防御手段。',
  'shared.info.cookie.samesite.summary': '控制该 Cookie 是否随跨站请求发送：Strict、Lax 或 None。',
  'shared.info.cookie.samesite.body': 'Strict：仅同站。Lax（默认值）：外加顶级导航。None：任何场景，但要求 Secure。',
  'shared.info.cookie.partitioned.summary': '按顶级站点分区存储该 Cookie（CHIPS）——一种无法跨站跟踪的第三方 Cookie。',
  'shared.info.cookie.priority.summary': 'Chromium 特有的逐出提示（Low / Medium / High），用于 Cookie 罐已满时。',
} as const satisfies Catalog;
