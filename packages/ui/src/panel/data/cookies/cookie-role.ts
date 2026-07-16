/**
 * Cookie-role classifier — turns an opaque cookie name into a one-word
 * answer to "what is this for?".
 *
 * Four roles, in priority order:
 *
 *   - `auth`        login / session / CSRF / OAuth — the cookies that
 *                   explain 401s.
 *   - `tracking`    analytics, ads, fingerprinting, session replay.
 *   - `pref`        UI preferences, locale, consent state.
 *   - `functional`  everything else (commerce, A/B test buckets, CDN /
 *                   load-balancer affinity, …). The default bucket.
 *
 * Algorithm (in order):
 *
 *   1. Strip RFC 6265bis prefixes (`__Host-`, `__Secure-`) — these
 *      carry security rules, not category info. Patterns match the
 *      underlying name.
 *   2. Walk the vendor table. First match wins. Returns role + vendor
 *      attribution (`vendor` surfaces in the chip tooltip so the user
 *      sees "Google Analytics" instead of just "tracking").
 *   3. Walk the generic keyword tables (auth / tracking / pref).
 *   4. Structural fallback: HttpOnly + long-ish random value + name
 *      NOT in the exclusion list → `auth`. Captures unknown server-
 *      issued session cookies without misclassifying CDN/WAF cookies
 *      (those are caught in step 2 as `functional`).
 *   5. Third-party with no other classification → `tracking` (guess
 *      surfaced with the `?` suffix so the user reads it as such).
 *   6. Default: `functional`.
 *
 * The classifier is intentionally conservative — when in doubt the
 * answer is `functional`, not a confidently-wrong guess. The UI uses
 * `auth?` / `tracking?` (with the trailing `?`) for heuristic-driven
 * roles so the user reads it as a suspicion, not a fact.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';

export type CookieRole = 'auth' | 'tracking' | 'pref' | 'functional';

export interface CookieClassification {
  role: CookieRole;
  /** Optional source / vendor — surfaces in the chip tooltip. */
  vendor?: string;
}

interface ClassifyInput {
  name: string;
  value: string;
  httpOnly?: boolean;
  session?: boolean;
  thirdParty?: boolean;
}

// Non-alphanumeric boundaries — `_` and `-` are common cookie name
// separators, and `_` is a word character in regex, so `\b` doesn't
// fire between `_` and a letter. Use these to bracket keyword matches.
const B = '(?<![A-Za-z0-9])';
const E = '(?![A-Za-z0-9])';

function w(token: string): string {
  return `${B}${token}${E}`;
}

// ── Prefix stripper ────────────────────────────────────────────────

function stripRfcPrefix(name: string): string {
  if (name.startsWith('__Host-')) return name.slice(7);
  if (name.startsWith('__Secure-')) return name.slice(9);
  return name;
}

// ── Vendor table ───────────────────────────────────────────────────
//
// Curated `name → role + vendor` mapping. Order matters — more
// specific patterns first; CDN/infrastructure goes BEFORE the
// structural auth fallback so HttpOnly+long load-balancer cookies
// don't masquerade as auth. Patterns match either the original name
// or the prefix-stripped name; whichever fires first wins.

interface VendorEntry {
  pattern: RegExp;
  role: CookieRole;
  vendor: string;
}

const VENDORS: readonly VendorEntry[] = [
  // ── CDN / load balancer / WAF / bot management ───────────────
  // Often HttpOnly + long random — would trip the structural auth
  // heuristic. These are infrastructure, NOT user auth.
  { pattern: /^AWSALB(?:CORS)?$/, role: 'functional', vendor: 'AWS Application Load Balancer' },
  { pattern: /^AWSELB(?:CORS)?$/, role: 'functional', vendor: 'AWS Elastic Load Balancer' },
  { pattern: /^awsuid$/, role: 'functional', vendor: 'AWS' },
  { pattern: /^__cfduid$/, role: 'functional', vendor: 'Cloudflare (legacy)' },
  { pattern: /^__cf_bm$/, role: 'functional', vendor: 'Cloudflare Bot Management' },
  { pattern: /^cf_clearance$/, role: 'functional', vendor: 'Cloudflare challenge' },
  { pattern: /^cf_chl_/, role: 'functional', vendor: 'Cloudflare challenge' },
  { pattern: /^__cfwaitingroom$/, role: 'functional', vendor: 'Cloudflare Waiting Room' },
  { pattern: /^__cfruid$/, role: 'functional', vendor: 'Cloudflare' },
  { pattern: /^ak_bmsc$/, role: 'functional', vendor: 'Akamai Bot Manager' },
  { pattern: /^_abck$/, role: 'functional', vendor: 'Akamai Bot Manager' },
  { pattern: /^bm_(?:sz|sv|mi|so)$/, role: 'functional', vendor: 'Akamai Bot Manager' },
  { pattern: /^incap_ses_/, role: 'functional', vendor: 'Imperva Incapsula' },
  { pattern: /^visid_incap_/, role: 'functional', vendor: 'Imperva Incapsula' },
  { pattern: /^nlbi_/, role: 'functional', vendor: 'Imperva Incapsula' },
  { pattern: /^BIGipServer/, role: 'functional', vendor: 'F5 BIG-IP affinity' },
  { pattern: /^TS\d+$/, role: 'functional', vendor: 'F5 BIG-IP' },
  { pattern: /^LastMRH_Session$/, role: 'functional', vendor: 'F5 BIG-IP' },
  { pattern: /^MRHSession$/, role: 'functional', vendor: 'F5 BIG-IP' },
  { pattern: /^MRHSequence$/, role: 'functional', vendor: 'F5 BIG-IP' },
  { pattern: /^ARRAffinity(?:SameSite)?$/, role: 'functional', vendor: 'Azure App Service' },
  { pattern: /^_appgw_session/, role: 'functional', vendor: 'Azure Application Gateway' },
  { pattern: /^Fastly-FF$/, role: 'functional', vendor: 'Fastly' },
  { pattern: /^__vercel_live_/, role: 'functional', vendor: 'Vercel Live' },
  { pattern: /^__nf_/, role: 'functional', vendor: 'Netlify' },
  { pattern: /^nf_jwt$/, role: 'functional', vendor: 'Netlify' },
  { pattern: /^sucuri_/, role: 'functional', vendor: 'Sucuri' },
  { pattern: /^_dd_[sr]$/, role: 'functional', vendor: 'Datadog RUM' },
  { pattern: /^dtCookie$/, role: 'functional', vendor: 'Dynatrace' },
  { pattern: /^dtPC$/, role: 'functional', vendor: 'Dynatrace' },
  { pattern: /^dtLatC$/, role: 'functional', vendor: 'Dynatrace' },
  { pattern: /^rxVisitor$/, role: 'functional', vendor: 'Dynatrace' },
  { pattern: /^rxvt$/, role: 'functional', vendor: 'Dynatrace' },

  // ── Consent / cookie banners ─────────────────────────────────
  // GDPR-driven UI state. Conceptually a preference.
  { pattern: /^OptanonConsent$/, role: 'pref', vendor: 'OneTrust Cookiebot' },
  { pattern: /^OptanonAlertBoxClosed$/, role: 'pref', vendor: 'OneTrust Cookiebot' },
  { pattern: /^CookieConsent$/, role: 'pref', vendor: 'Cookiebot' },
  { pattern: /^CookieConsentBulkSetting$/, role: 'pref', vendor: 'Cookiebot' },
  { pattern: /^cookieconsent_/, role: 'pref', vendor: 'cookieconsent.js' },
  { pattern: /^cookiebot-/, role: 'pref', vendor: 'Cookiebot' },
  { pattern: /^OneTrust/, role: 'pref', vendor: 'OneTrust' },
  { pattern: /^cmplz_/, role: 'pref', vendor: 'Complianz' },
  { pattern: /^__cmpcc$/, role: 'pref', vendor: 'IAB CMP' },
  { pattern: /^euconsent-v2$/, role: 'pref', vendor: 'IAB TCF v2' },

  // ── Google ─────────────────────────────────────────────────
  // Analytics / Ads / Tag Manager — tracking.
  { pattern: /^_ga(?:_[A-Z0-9]+)?$/, role: 'tracking', vendor: 'Google Analytics' },
  { pattern: /^_gid$/, role: 'tracking', vendor: 'Google Analytics' },
  { pattern: /^_gat(?:_.*)?$/, role: 'tracking', vendor: 'Google Analytics' },
  { pattern: /^_gac_/, role: 'tracking', vendor: 'Google Ads' },
  { pattern: /^__utm[a-z]$/, role: 'tracking', vendor: 'Google Analytics (Universal)' },
  { pattern: /^_dc_gtm_/, role: 'tracking', vendor: 'Google Tag Manager' },
  { pattern: /^IDE$/, role: 'tracking', vendor: 'Google DoubleClick' },
  { pattern: /^DSID$/, role: 'tracking', vendor: 'Google DoubleClick' },
  { pattern: /^FLC$/, role: 'tracking', vendor: 'Google DoubleClick' },
  { pattern: /^AID$/, role: 'tracking', vendor: 'Google DoubleClick' },
  { pattern: /^TAID$/, role: 'tracking', vendor: 'Google DoubleClick' },
  { pattern: /^ANID$/, role: 'tracking', vendor: 'Google Ads' },
  { pattern: /^NID$/, role: 'tracking', vendor: 'Google preferences / ads' },
  { pattern: /^OGPC$/, role: 'tracking', vendor: 'Google' },
  { pattern: /^1P_JAR$/, role: 'tracking', vendor: 'Google' },
  { pattern: /^CONSENT$/, role: 'pref', vendor: 'Google consent token' },
  // Google identity (Search / Gmail / YouTube auth). The 1P/3P/etc.
  // prefixes are partition variants of the same auth slots.
  { pattern: /^(?:__Secure-)?(?:[13]P)?SID$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^(?:__Secure-)?(?:[13]P)?SIDCC$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^(?:__Secure-)?(?:[13]P)?SIDTS$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^(?:__Secure-)?(?:[13]P)?APISID$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^HSID$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^SSID$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^SAPISID$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^LOGIN_INFO$/, role: 'auth', vendor: 'Google / YouTube login' },
  { pattern: /^__Host-(?:GAPS|3PLSID|1PLSID)$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^__Secure-(?:ENID|BUCKET|STRP)$/, role: 'auth', vendor: 'Google identity' },
  { pattern: /^ACCOUNT_CHOOSER$/, role: 'auth', vendor: 'Google account chooser' },
  { pattern: /^GHCC$/, role: 'pref', vendor: 'Google consent helper' },

  // ── Facebook / Meta ────────────────────────────────────────
  { pattern: /^_fbp$/, role: 'tracking', vendor: 'Meta Pixel' },
  { pattern: /^_fbc$/, role: 'tracking', vendor: 'Meta Pixel' },
  { pattern: /^fr$/, role: 'tracking', vendor: 'Meta Ads' },
  { pattern: /^tr$/, role: 'tracking', vendor: 'Meta Pixel' },
  { pattern: /^datr$/, role: 'tracking', vendor: 'Meta fraud detection' },
  { pattern: /^c_user$/, role: 'auth', vendor: 'Facebook login' },
  { pattern: /^xs$/, role: 'auth', vendor: 'Facebook session' },
  { pattern: /^sb$/, role: 'auth', vendor: 'Facebook session' },

  // ── Microsoft / Bing / Clarity ─────────────────────────────
  { pattern: /^_uetsid$/, role: 'tracking', vendor: 'Microsoft UET' },
  { pattern: /^_uetvid$/, role: 'tracking', vendor: 'Microsoft UET' },
  { pattern: /^_uetmsclkid$/, role: 'tracking', vendor: 'Microsoft UET' },
  { pattern: /^MUID$/, role: 'tracking', vendor: 'Microsoft / Bing' },
  { pattern: /^MUIDB$/, role: 'tracking', vendor: 'Microsoft / Bing' },
  { pattern: /^MR$/, role: 'tracking', vendor: 'Microsoft' },
  { pattern: /^ANON$/, role: 'tracking', vendor: 'Microsoft' },
  { pattern: /^SRCHD$/, role: 'tracking', vendor: 'Bing' },
  { pattern: /^SRCHUID$/, role: 'tracking', vendor: 'Bing' },
  { pattern: /^SRCHUSR$/, role: 'tracking', vendor: 'Bing' },
  { pattern: /^_clck$/, role: 'tracking', vendor: 'Microsoft Clarity' },
  { pattern: /^_clsk$/, role: 'tracking', vendor: 'Microsoft Clarity' },
  { pattern: /^CLID$/, role: 'tracking', vendor: 'Microsoft Clarity' },

  // ── LinkedIn ────────────────────────────────────────────────
  { pattern: /^bcookie$/, role: 'tracking', vendor: 'LinkedIn' },
  { pattern: /^bscookie$/, role: 'tracking', vendor: 'LinkedIn' },
  { pattern: /^lidc$/, role: 'tracking', vendor: 'LinkedIn affinity' },
  { pattern: /^lissc$/, role: 'tracking', vendor: 'LinkedIn' },
  { pattern: /^UserMatchHistory$/, role: 'tracking', vendor: 'LinkedIn Ads' },
  { pattern: /^AnalyticsSyncHistory$/, role: 'tracking', vendor: 'LinkedIn Ads' },
  { pattern: /^li_(?:gc|sugr|theme|alerts)$/, role: 'tracking', vendor: 'LinkedIn' },

  // ── Twitter / X ────────────────────────────────────────────
  { pattern: /^personalization_id$/, role: 'tracking', vendor: 'X / Twitter Ads' },
  { pattern: /^guest_id$/, role: 'tracking', vendor: 'X / Twitter' },
  { pattern: /^guest_id_(?:marketing|ads)$/, role: 'tracking', vendor: 'X / Twitter Ads' },
  { pattern: /^_twitter_sess$/, role: 'auth', vendor: 'X / Twitter session' },
  { pattern: /^kdt$/, role: 'auth', vendor: 'X / Twitter device' },
  { pattern: /^att$/, role: 'auth', vendor: 'X / Twitter session' },

  // ── TikTok ─────────────────────────────────────────────────
  { pattern: /^_ttp$/, role: 'tracking', vendor: 'TikTok Pixel' },
  { pattern: /^_tt_enable_cookie$/, role: 'tracking', vendor: 'TikTok Pixel' },
  { pattern: /^_tt_sessionId$/, role: 'tracking', vendor: 'TikTok Pixel' },

  // ── Pinterest / Reddit / Snapchat ──────────────────────────
  { pattern: /^_pin_unauth/, role: 'tracking', vendor: 'Pinterest' },
  { pattern: /^_pinterest_/, role: 'tracking', vendor: 'Pinterest' },
  { pattern: /^_routing_id$/, role: 'tracking', vendor: 'Pinterest' },
  { pattern: /^_rdt_uuid$/, role: 'tracking', vendor: 'Reddit Pixel' },
  { pattern: /^edgebucket$/, role: 'tracking', vendor: 'Reddit' },
  { pattern: /^_scid$/, role: 'tracking', vendor: 'Snapchat' },
  { pattern: /^sc-anonymous-id$/, role: 'tracking', vendor: 'Snapchat' },

  // ── Yandex / Baidu ─────────────────────────────────────────
  { pattern: /^_ym_/, role: 'tracking', vendor: 'Yandex Metrica' },
  { pattern: /^yandexuid$/, role: 'tracking', vendor: 'Yandex' },
  { pattern: /^yabs-sid$/, role: 'tracking', vendor: 'Yandex' },
  { pattern: /^yp$/, role: 'tracking', vendor: 'Yandex' },
  { pattern: /^BAIDUID$/, role: 'tracking', vendor: 'Baidu' },
  { pattern: /^HMACCOUNT$/, role: 'tracking', vendor: 'Baidu Tongji' },
  { pattern: /^Hm_/, role: 'tracking', vendor: 'Baidu Tongji' },

  // ── Adobe (Analytics / Audience Manager / Target) ──────────
  { pattern: /^s_cc$/, role: 'tracking', vendor: 'Adobe Analytics' },
  { pattern: /^s_sq$/, role: 'tracking', vendor: 'Adobe Analytics' },
  { pattern: /^s_vi$/, role: 'tracking', vendor: 'Adobe Analytics' },
  { pattern: /^s_fid$/, role: 'tracking', vendor: 'Adobe Analytics' },
  { pattern: /^s_ppv/, role: 'tracking', vendor: 'Adobe Analytics' },
  { pattern: /^s_invisit$/, role: 'tracking', vendor: 'Adobe Analytics' },
  { pattern: /^aam_uuid$/, role: 'tracking', vendor: 'Adobe Audience Manager' },
  { pattern: /^mbox$/, role: 'tracking', vendor: 'Adobe Target' },
  { pattern: /^mboxEdgeCluster$/, role: 'tracking', vendor: 'Adobe Target' },
  { pattern: /^at_check$/, role: 'tracking', vendor: 'Adobe Target' },

  // ── Marketing / CDP / MarTech ─────────────────────────────
  { pattern: /^__hssrc$/, role: 'tracking', vendor: 'HubSpot' },
  { pattern: /^__hssc$/, role: 'tracking', vendor: 'HubSpot' },
  { pattern: /^__hstc$/, role: 'tracking', vendor: 'HubSpot' },
  { pattern: /^hubspotutk$/, role: 'tracking', vendor: 'HubSpot' },
  { pattern: /^messagesUtk$/, role: 'tracking', vendor: 'HubSpot Messages' },
  { pattern: /^_mkto_/, role: 'tracking', vendor: 'Marketo' },
  { pattern: /^BIGipServerpool_marketo/, role: 'tracking', vendor: 'Marketo' },
  { pattern: /^pardot$/, role: 'tracking', vendor: 'Salesforce Pardot' },
  { pattern: /^lpv\d+$/, role: 'tracking', vendor: 'Salesforce Pardot' },
  { pattern: /^visitor_id/, role: 'tracking', vendor: 'Salesforce Pardot' },

  // ── Product analytics / session replay ────────────────────
  { pattern: /^mp_/, role: 'tracking', vendor: 'Mixpanel' },
  { pattern: /^ajs_(?:anonymous_id|user_id|group_id)$/, role: 'tracking', vendor: 'Segment' },
  { pattern: /^_segment_xid_/, role: 'tracking', vendor: 'Segment' },
  { pattern: /^amplitude_/, role: 'tracking', vendor: 'Amplitude' },
  { pattern: /^AMP_/, role: 'tracking', vendor: 'Amplitude' },
  { pattern: /^_hjSession/, role: 'tracking', vendor: 'Hotjar' },
  { pattern: /^_hjid$/, role: 'tracking', vendor: 'Hotjar' },
  { pattern: /^_hjFirstSeen$/, role: 'tracking', vendor: 'Hotjar' },
  { pattern: /^_hjIncludedInPageviewSample$/, role: 'tracking', vendor: 'Hotjar' },
  { pattern: /^_hjAbsoluteSessionInProgress$/, role: 'tracking', vendor: 'Hotjar' },
  { pattern: /^_hjMinimizedPolls$/, role: 'tracking', vendor: 'Hotjar' },
  { pattern: /^_hp2_/, role: 'tracking', vendor: 'Heap' },
  { pattern: /^_pendo_/, role: 'tracking', vendor: 'Pendo' },
  { pattern: /^ph_/, role: 'tracking', vendor: 'PostHog' },
  { pattern: /^__ph_/, role: 'tracking', vendor: 'PostHog' },
  { pattern: /^posthog_/, role: 'tracking', vendor: 'PostHog' },
  { pattern: /^fs_uid$/, role: 'tracking', vendor: 'FullStory' },
  { pattern: /^fs_lua$/, role: 'tracking', vendor: 'FullStory' },
  { pattern: /^_CEFT$/, role: 'tracking', vendor: 'Crazy Egg' },
  { pattern: /^_ceg\./, role: 'tracking', vendor: 'Crazy Egg' },
  { pattern: /^mf_/, role: 'tracking', vendor: 'Mouseflow' },

  // ── Ad tech / RTB / DSP ───────────────────────────────────
  { pattern: /^uuid2$/, role: 'tracking', vendor: 'AppNexus / Xandr' },
  { pattern: /^anj$/, role: 'tracking', vendor: 'AppNexus / Xandr' },
  { pattern: /^cto_/, role: 'tracking', vendor: 'Criteo' },
  { pattern: /^tdid$/, role: 'tracking', vendor: 'The Trade Desk' },
  { pattern: /^TDID$/, role: 'tracking', vendor: 'The Trade Desk' },
  { pattern: /^tluid$/, role: 'tracking', vendor: 'The Trade Desk' },
  { pattern: /^OB-USER-TOKEN$/, role: 'tracking', vendor: 'Outbrain' },
  { pattern: /^outbrain_/, role: 'tracking', vendor: 'Outbrain' },
  { pattern: /^t_gid$/, role: 'tracking', vendor: 'Taboola' },
  { pattern: /^taboola_/, role: 'tracking', vendor: 'Taboola' },
  { pattern: /^__qca$/, role: 'tracking', vendor: 'Quantcast' },
  { pattern: /^_kuid_$/, role: 'tracking', vendor: 'Salesforce DMP (Krux)' },
  { pattern: /^bito$/, role: 'tracking', vendor: 'Conversant' },

  // ── Customer support / chat ───────────────────────────────
  { pattern: /^intercom-(?:id|session)-/, role: 'functional', vendor: 'Intercom' },
  { pattern: /^__zlcmid$/, role: 'functional', vendor: 'Zendesk Chat' },
  { pattern: /^drift_/, role: 'functional', vendor: 'Drift' },
  { pattern: /^driftt_/, role: 'functional', vendor: 'Drift' },
  { pattern: /^_olfsk$/, role: 'functional', vendor: 'Olark' },

  // ── SSO / identity providers ──────────────────────────────
  { pattern: /^okta-/, role: 'auth', vendor: 'Okta' },
  { pattern: /^auth0_/, role: 'auth', vendor: 'Auth0' },
  { pattern: /^_auth0compat$/, role: 'auth', vendor: 'Auth0' },
  { pattern: /^mod_auth_openidc_/, role: 'auth', vendor: 'mod_auth_openidc' },

  // ── Common backend frameworks ─────────────────────────────
  { pattern: /^PHPSESSID$/, role: 'auth', vendor: 'PHP session' },
  { pattern: /^JSESSIONID$/, role: 'auth', vendor: 'Java servlet session' },
  { pattern: /^ASP\.NET_SessionId$/, role: 'auth', vendor: 'ASP.NET session' },
  { pattern: /^ASPSESSIONID/, role: 'auth', vendor: 'IIS session' },
  { pattern: /^__RequestVerificationToken$/, role: 'auth', vendor: 'ASP.NET CSRF token' },
  { pattern: /^laravel_session$/, role: 'auth', vendor: 'Laravel session' },
  { pattern: /^XSRF-TOKEN$/i, role: 'auth', vendor: 'Laravel / Angular CSRF token' },
  { pattern: /^_csrf$/, role: 'auth', vendor: 'CSRF token' },
  { pattern: /^csrftoken$/, role: 'auth', vendor: 'Django CSRF token' },
  { pattern: /^sessionid$/, role: 'auth', vendor: 'Django session' },
  { pattern: /^connect\.sid$/, role: 'auth', vendor: 'Express / connect session' },
  { pattern: /^_session_id$/, role: 'auth', vendor: 'Rails session' },
  { pattern: /^authenticity_token$/, role: 'auth', vendor: 'Rails CSRF token' },
  { pattern: /^_wp_session$/, role: 'auth', vendor: 'WordPress session' },
  { pattern: /^wordpress_logged_in_/, role: 'auth', vendor: 'WordPress login' },
  { pattern: /^wordpress_sec_/, role: 'auth', vendor: 'WordPress secret' },

  // ── Well-known apps ───────────────────────────────────────
  { pattern: /^_gh_sess$/, role: 'auth', vendor: 'GitHub session' },
  { pattern: /^user_session$/, role: 'auth', vendor: 'GitHub session' },
  { pattern: /^_octo$/, role: 'tracking', vendor: 'GitHub analytics' },
  { pattern: /^logged_in$/, role: 'auth', vendor: 'GitHub login flag' },
  { pattern: /^_gitlab_session$/, role: 'auth', vendor: 'GitLab session' },
  { pattern: /^known_sign_in$/, role: 'auth', vendor: 'GitLab known-device' },
  { pattern: /^bb_session_/, role: 'auth', vendor: 'Bitbucket session' },
  { pattern: /^secure_customer_sig$/, role: 'auth', vendor: 'Shopify customer' },
  { pattern: /^_secure_session_id$/, role: 'auth', vendor: 'Shopify session' },
  { pattern: /^_shopify_y$/, role: 'tracking', vendor: 'Shopify analytics' },
  { pattern: /^_shopify_s$/, role: 'tracking', vendor: 'Shopify analytics' },
  { pattern: /^_shopify_d$/, role: 'tracking', vendor: 'Shopify analytics' },
  { pattern: /^cart$/, role: 'functional', vendor: 'Shopify cart' },
  { pattern: /^sp_t$/, role: 'auth', vendor: 'Spotify session' },
  { pattern: /^sp_dc$/, role: 'auth', vendor: 'Spotify session' },

  // ── A/B testing / feature flags ───────────────────────────
  { pattern: /^optimizelyEndUserId$/, role: 'tracking', vendor: 'Optimizely' },
  { pattern: /^optimizely(?:Buckets|RedirectData|PendingLogEvents)$/, role: 'tracking', vendor: 'Optimizely' },
  { pattern: /^_vis_opt_/, role: 'tracking', vendor: 'VWO' },
  { pattern: /^_vwo_/, role: 'tracking', vendor: 'VWO' },
  { pattern: /^splitio_/, role: 'functional', vendor: 'Split.io feature flag' },
  { pattern: /^_ld_/, role: 'functional', vendor: 'LaunchDarkly' },

  // ── reCAPTCHA / anti-spam ─────────────────────────────────
  { pattern: /^_GRECAPTCHA$/, role: 'functional', vendor: 'Google reCAPTCHA' },

  // ── Commerce / cart ──────────────────────────────────────
  // Anchored as a generic shopping-cart pattern — also stops a
  // `cart_token` from being mis-classified `auth` via the `token`
  // keyword. Real cart sessions usually ride on a separate session
  // cookie, not the cart cookie itself.
  { pattern: /^cart$/i, role: 'functional', vendor: 'shopping cart' },
  { pattern: /^cart_/i, role: 'functional', vendor: 'shopping cart' },
  { pattern: /^basket$/i, role: 'functional', vendor: 'shopping cart' },
  { pattern: /^basket_/i, role: 'functional', vendor: 'shopping cart' },
  { pattern: /^checkout_/i, role: 'functional', vendor: 'checkout' },
];

// ── Generic keyword fallbacks ──────────────────────────────────────

const AUTH_KEYWORDS: readonly RegExp[] = [
  /sess(?:ion)?/i,
  new RegExp(w('auth'), 'i'),
  new RegExp(w('sid'), 'i'),
  new RegExp(w('jwt'), 'i'),
  new RegExp(w('token'), 'i'),
  new RegExp(w('csrf'), 'i'),
  new RegExp(w('xsrf'), 'i'),
  new RegExp(w('oauth'), 'i'),
  new RegExp(w('sso'), 'i'),
  new RegExp(w('bearer'), 'i'),
  new RegExp(w('access_token'), 'i'),
  new RegExp(w('refresh_token'), 'i'),
  new RegExp(w('id_token'), 'i'),
  new RegExp(w('pkce'), 'i'),
  new RegExp(w('nonce'), 'i'),
  new RegExp(w('code_verifier'), 'i'),
  /\.sig$/,
  /^remember/i,
];

const TRACKING_KEYWORDS: readonly RegExp[] = [
  new RegExp(w('analytics'), 'i'),
  new RegExp(w('tracker'), 'i'),
  new RegExp(w('tracking'), 'i'),
  new RegExp(w('pixel'), 'i'),
  new RegExp(w('campaign'), 'i'),
  new RegExp(w('utm'), 'i'),
];

const PREF_KEYWORDS: readonly RegExp[] = [
  /^tz$/i,
  /^lang$/i,
  /^locale$/i,
  new RegExp(w('country'), 'i'),
  new RegExp(w('theme'), 'i'),
  new RegExp(w('color[_-]?mode'), 'i'),
  new RegExp(w('display'), 'i'),
  new RegExp(w('layout'), 'i'),
  new RegExp(w('currency'), 'i'),
  new RegExp(w('timezone'), 'i'),
  new RegExp(w('cpu[_-]?bucket'), 'i'),
  new RegExp(w('ui[_-]?density'), 'i'),
  new RegExp(w('font[_-]?size'), 'i'),
  new RegExp(w('consent'), 'i'),
  new RegExp(w('dismiss'), 'i'),
  new RegExp(w('viewed'), 'i'),
  new RegExp(w('tour'), 'i'),
  new RegExp(w('welcome'), 'i'),
  new RegExp(w('banner'), 'i'),
];

// ── Structural heuristic ───────────────────────────────────────────
//
// Last-resort: unknown HttpOnly + long random + base64-ish cookie that
// doesn't otherwise look like preferences / commerce / tracking. The
// exclusion list keeps obvious non-auth names from being promoted —
// CDN/infrastructure names are already handled by the vendor table.

const STRUCTURAL_AUTH_EXCLUSIONS: readonly RegExp[] = [
  /consent/i,
  /tracking/i,
  /tracker/i,
  /analytics/i,
  /metric/i,
  /telemetry/i,
  /preferences?/i,
  /settings?/i,
  /cart/i,
  /basket/i,
  /checkout/i,
  /shop/i,
  /lang(uage)?/i,
  /locale/i,
  /region/i,
  /country/i,
  /currency/i,
  /theme/i,
  /display/i,
  /layout/i,
  /\bview\b/i,
  /\bpref\b/i,
  /dismiss/i,
  /seen/i,
  /viewed/i,
  /tour/i,
  /welcome/i,
];

function structurallyAuthLike(input: { name: string; value: string; httpOnly?: boolean; session?: boolean }): boolean {
  if (!input.httpOnly) return false;
  if (input.session) return false;
  if (input.value.length < 24) return false;
  // High-entropy-ish — alphanumerics + URL-safe punctuation only.
  if (!/^[A-Za-z0-9._%~+/=-]+$/.test(input.value)) return false;
  // Name doesn't look like obvious non-auth.
  for (const re of STRUCTURAL_AUTH_EXCLUSIONS) if (re.test(input.name)) return false;
  return true;
}

// ── Public API ─────────────────────────────────────────────────────

export function classifyCookie(input: ClassifyInput): CookieClassification {
  const original = input.name;
  const stripped = stripRfcPrefix(original);

  // 1. Vendor table — first match wins. Try the original, then the
  //    stripped name so `__Secure-_ga_*` resolves to Google Analytics
  //    instead of falling to the auth fallback via the prefix.
  for (const entry of VENDORS) {
    if (entry.pattern.test(original) || entry.pattern.test(stripped)) {
      return { role: entry.role, vendor: entry.vendor };
    }
  }

  // 2. Generic keywords — match against the stripped name (prefix is
  //    not a category signal).
  for (const re of AUTH_KEYWORDS) if (re.test(stripped)) return { role: 'auth' };
  for (const re of TRACKING_KEYWORDS) if (re.test(stripped)) return { role: 'tracking' };
  for (const re of PREF_KEYWORDS) if (re.test(stripped)) return { role: 'pref' };

  // 3. Structural — unknown HttpOnly + long random + no exclusion
  //    keyword in the name → likely an auth/session cookie.
  if (structurallyAuthLike(input)) return { role: 'auth' };

  // 4. Third-party with no other classification — almost always
  //    tracking, but flag as a guess via the question-marked chip.
  if (input.thirdParty) return { role: 'tracking' };

  return { role: 'functional' };
}

/** Back-compat thin wrapper — returns role only. */
export function classifyCookieRole(input: ClassifyInput): CookieRole {
  return classifyCookie(input).role;
}

export function roleChipLabel(t: Translate, role: CookieRole): string {
  switch (role) {
    case 'auth':
      return t('panel.inspector.cookies.role.chipAuth');
    case 'tracking':
      return t('panel.inspector.cookies.role.chipTracking');
    case 'pref':
      return t('panel.inspector.cookies.role.chipPref');
    case 'functional':
      return '';
  }
}

export function roleSortOrder(role: CookieRole): number {
  switch (role) {
    case 'auth':
      return 0;
    case 'functional':
      return 1;
    case 'pref':
      return 2;
    case 'tracking':
      return 3;
  }
}

export function roleSectionLabel(t: Translate, role: CookieRole): string {
  switch (role) {
    case 'auth':
      return t('panel.inspector.cookies.role.sectionAuth');
    case 'functional':
      return t('panel.inspector.cookies.role.sectionFunctional');
    case 'pref':
      return t('panel.inspector.cookies.role.sectionPref');
    case 'tracking':
      return t('panel.inspector.cookies.role.sectionTracking');
  }
}
