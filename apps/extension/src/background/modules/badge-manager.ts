/**
 * Badge Manager — extension badge rendering.
 *
 * Badge number semantics: **count of your currently-active rules that
 * have matched at least one request on the current tab's current page**.
 * Active = enabled + not paused at any level (rule/folder/collection/
 * engine) + rule-complete. Drafts and paused rules are excluded.
 *
 * When rules exist for the site but none have matched yet (page quiet
 * or still loading), the badge stays empty. Non-numeric states
 * (paused, disconnected) override and are shown with their own glyph.
 */

import { getBackends } from '@openheaders/core/backends';
import { getTranslator, resolveLocale, type Translator } from '@openheaders/i18n';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { logger } from '@utils/logger';
import type { BadgeState } from '@/types/browser';
import { getBrowserAPI } from '@/types/browser';

const browserAPI = getBrowserAPI();

// Number of reconnect attempts before showing the disconnected badge.
// With exponential backoff (1s, 2s, 4s) this is ~7 seconds grace period —
// enough to absorb a transient dropout without flashing the badge red.
const DISCONNECTED_BADGE_THRESHOLD = 3;

let lastBadgeState: string | null = null;
let lastBadgeInput: BadgeUpdateInput | null = null;

// Tooltips follow the settings locale, not the browser UI locale: the
// service worker has no React root, so it reads the persisted language
// setting and threads the runtime Translator directly.
function badgeTranslator(): Translator {
  const preferences = typeof navigator !== 'undefined' ? navigator.languages : [];
  return getTranslator(resolveLocale(getSetting('general.language'), preferences));
}

// Re-title in place when the user switches language. The repaint guard
// keys on badge state only and would skip a locale-only change — clear
// it before replaying the last input.
subscribeKey('general.language', () => {
  if (!lastBadgeInput) return;
  lastBadgeState = null;
  void updateExtensionBadge(lastBadgeInput);
});

export interface BadgeUpdateInput {
  connected: boolean;
  isPaused: boolean;
  reconnectAttempts?: number;
  /** Currently-active rules that have matched at least one request on
   *  the current page. Drives the badge number. */
  matchedRuleCount: number;
  /** Count of rules configured (active + complete) for the current
   *  tab's site. Used only for the tooltip — NOT the badge number. */
  configuredRuleCount: number;
}

/**
 * Update the extension badge based on connection status, rule activity,
 * and placeholder usage.
 */
export async function updateExtensionBadge(input: BadgeUpdateInput): Promise<void> {
  const { connected, isPaused, reconnectAttempts = 0, matchedRuleCount, configuredRuleCount } = input;
  lastBadgeInput = input;
  // Get the appropriate API (chrome.action for MV3, chrome.browserAction for MV2/Firefox)
  const actionAPI =
    browserAPI.action || (browserAPI as unknown as { browserAction?: typeof chrome.action }).browserAction;

  if (!actionAPI) {
    logger.debug('BadgeManager', 'Badge API not available');
    return;
  }

  // Determine badge state and count
  let badgeState: BadgeState = 'none';
  // The "back-end disconnected" badge only applies when there's a
  // back-end to be disconnected FROM. With no enabled auto-connect
  // record, the SW IS the back-end and the concept doesn't exist.
  const wantsBackend = getBackends().some((b) => b.enabled && b.autoConnect);
  const showDisconnected =
    !connected &&
    reconnectAttempts >= DISCONNECTED_BADGE_THRESHOLD &&
    wantsBackend &&
    getSetting('backend.showBadgeWhenDisconnected');

  // Priority: paused > disconnected > active > none. "Active" means at
  // least one of the user's active rules has matched a request on this tab.
  if (isPaused) {
    badgeState = 'paused';
  } else if (showDisconnected) {
    badgeState = 'disconnected';
  } else if (matchedRuleCount > 0) {
    badgeState = 'active';
  }

  // State key includes the matched count so the badge redraws as new
  // rules start firing on the page.
  const currentStateKey = `${badgeState}-${matchedRuleCount}-${configuredRuleCount}-${isPaused}-${connected}`;

  // Only update if state or count changed
  if (currentStateKey === lastBadgeState) {
    return;
  }

  lastBadgeState = currentStateKey;
  const t = badgeTranslator();

  if (badgeState === 'paused') {
    // Show a gray dash when rules execution is paused
    actionAPI.setBadgeText({ text: '\u2212' }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge text error:', browserAPI.runtime.lastError);
      }
    });
    actionAPI.setBadgeBackgroundColor({ color: '#8c8c8c' }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge color error:', browserAPI.runtime.lastError);
      }
    });

    // Update the tooltip
    if (actionAPI.setTitle) {
      actionAPI.setTitle({
        title: t('extension.badge.paused'),
      });
    }
  } else if (badgeState === 'disconnected') {
    actionAPI.setBadgeText({ text: '!' }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge text error:', browserAPI.runtime.lastError);
      }
    });
    actionAPI.setBadgeBackgroundColor({ color: '#c23b22' }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge color error:', browserAPI.runtime.lastError);
      }
    });
    if (actionAPI.setTitle) {
      actionAPI.setTitle({
        title: t('extension.badge.disconnected'),
      });
    }
  } else if (badgeState === 'active') {
    // Show the count of currently-active rules that have matched.
    actionAPI.setBadgeText({ text: matchedRuleCount.toString() }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge text error:', browserAPI.runtime.lastError);
      }
    });
    actionAPI.setBadgeBackgroundColor({ color: '#E8E8E8' }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge color error:', browserAPI.runtime.lastError);
      }
    });

    // Tooltip: "3 of your 5 rules matched requests on this page".
    if (actionAPI.setTitle) {
      actionAPI.setTitle({
        title: t('extension.badge.active', { matched: matchedRuleCount, configured: configuredRuleCount }),
      });
    }
  } else {
    // Clear the badge when connected but no active rules
    actionAPI.setBadgeText({ text: '' });

    // Reset the tooltip to default
    if (actionAPI.setTitle) {
      actionAPI.setTitle({
        title: t('extension.badge.default'),
      });
    }
  }
}

export function resetBadgeState(): void {
  lastBadgeState = null;
  lastBadgeInput = null;
}
