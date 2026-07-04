/**
 * Smart pre-fill for the Override Cookies CTA — builds the Cookie /
 * Set-Cookie header value the create popover opens with.
 *
 * The captured cookies seed the template: structure and separators come
 * from the real request, and auth/session-classified values are swapped
 * for domain-scoped variable references — `{{cookie_<name>_<domain>}}`,
 * the same naming convention as the redirect CTA's seeds — so the
 * secret ends up in a variable rather than pasted into the rule.
 * Preference / analytics values stay literal. No capture ⇒ a syntax
 * skeleton that teaches the format.
 */

import { domainFolderName } from '../rule-create/quick-rule-destination';
import type { CookieRow } from './cookie-model';
import { classifyCookieRole } from './cookie-role';

/** Domain-scoped variable name for one cookie's templated value —
 *  `cookie_sessionid_openheaders_io`. Null when the URL has no
 *  derivable domain (the caller falls back to the literal value). */
export function cookieOverrideVarName(cookieName: string, url: string): string | null {
  const domain = domainFolderName(url);
  if (!domain) return null;
  return `cookie_${cookieName}_${domain}`.replace(/[^a-zA-Z0-9]+/g, '_');
}

function valueSlot(row: CookieRow, url: string): string {
  const role = classifyCookieRole({
    name: row.name,
    value: row.value,
    httpOnly: row.httpOnly,
    session: row.session,
  });
  if (role === 'auth') {
    const varName = cookieOverrideVarName(row.name, url);
    if (varName) return `{{${varName}}}`;
  }
  return row.value;
}

function skeletonVar(url: string): string {
  const varName = cookieOverrideVarName('session', url);
  return varName ? `{{${varName}}}` : 'value';
}

/** Cookie-header seed: the cookies the request actually carried, in
 *  order, `; `-joined, auth values templated. */
export function seedRequestCookieOverride(rows: readonly CookieRow[], url: string): string {
  const sent = rows.filter((r) => r.attribution !== 'filtered-out');
  if (sent.length === 0) return `session=${skeletonVar(url)}; theme=dark`;
  return sent.map((r) => `${r.name}=${valueSlot(r, url)}`).join('; ');
}

const SAMESITE_ATTR: Record<string, string> = {
  no_restriction: 'None',
  lax: 'Lax',
  strict: 'Strict',
};

/** Set-Cookie seed: the first Set-Cookie of this response rebuilt with
 *  its attributes, auth value templated. */
export function seedResponseCookieOverride(rows: readonly CookieRow[], url: string): string {
  const first = rows[0];
  if (!first) return `session=${skeletonVar(url)}; Path=/; Secure; HttpOnly; SameSite=Lax`;
  const parts: string[] = [`${first.name}=${valueSlot(first, url)}`];
  if (first.domain) parts.push(`Domain=${first.domain}`);
  if (first.path) parts.push(`Path=${first.path}`);
  if (first.maxAge != null) parts.push(`Max-Age=${first.maxAge}`);
  else if (first.expiresRaw) parts.push(`Expires=${first.expiresRaw}`);
  else if (first.expirationDate != null) parts.push(`Expires=${new Date(first.expirationDate * 1000).toUTCString()}`);
  if (first.secure) parts.push('Secure');
  if (first.httpOnly) parts.push('HttpOnly');
  const sameSite = first.sameSite ? SAMESITE_ATTR[first.sameSite] : undefined;
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (first.partitionKey) parts.push('Partitioned');
  if (first.priority) parts.push(`Priority=${first.priority}`);
  return parts.join('; ');
}
