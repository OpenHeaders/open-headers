/**
 * Badge Manager — extension badge rendering.
 *
 * Badge number semantics: **rule-matched requests observed on the
 * current tab's current page** — i.e. `totalFires` from tab-telemetry.
 * When rules exist for the site but no matching request has been
 * observed yet (page quiet, or still loading), the badge stays empty.
 * Non-numeric states (paused, disconnected) override and are shown
 * with their own glyph.
 */

import { logger } from '@utils/logger';
import { get as getSetting } from '@/rules/settings/store';
import type { BadgeState } from '@/types/browser';
import { getBrowserAPI } from '@/types/browser';
import type { IRecordingService } from '@/types/recording';

const browserAPI = getBrowserAPI();

// Number of reconnect attempts before showing the disconnected badge.
// With exponential backoff (1s, 2s, 4s) this is ~7 seconds grace period —
// enough to absorb a transient dropout without flashing the badge red.
const DISCONNECTED_BADGE_THRESHOLD = 3;

let lastBadgeState: string | null = null;

export interface BadgeUpdateInput {
  connected: boolean;
  isPaused: boolean;
  recordingService: IRecordingService | null;
  reconnectAttempts?: number;
  /** `totalFires` from the current tab's telemetry snapshot. */
  fireCount: number;
  /** Count of rules configured (enabled + unpaused) for the current
   *  tab's site. Used only for the tooltip — NOT the badge number. */
  configuredRuleCount: number;
}

/**
 * Update the extension badge based on connection status, rule activity,
 * and placeholder usage.
 */
export async function updateExtensionBadge(input: BadgeUpdateInput): Promise<void> {
  const {
    connected,
    isPaused,
    recordingService,
    reconnectAttempts = 0,
    fireCount,
    configuredRuleCount,
  } = input;
  // Get the appropriate API (chrome.action for MV3, chrome.browserAction for MV2/Firefox)
  const actionAPI =
    browserAPI.action || (browserAPI as unknown as { browserAction?: typeof chrome.action }).browserAction;

  if (!actionAPI) {
    logger.debug('BadgeManager', 'Badge API not available');
    return;
  }

  // Check if recording is active for ANY tab (not just the current active tab)
  if (recordingService) {
    // Get all tabs
    const allTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      browserAPI.tabs.query({}, resolve);
    });

    // Check if any tab is recording
    const anyTabRecording = allTabs.some((tab) => tab.id !== undefined && recordingService.isRecording(tab.id));

    if (anyTabRecording) {
      // Skip badge update if any tab is recording
      logger.info('BadgeManager', 'Skipping badge update - recording is active on some tab');
      return;
    }
  }

  // Determine badge state and count
  let badgeState: BadgeState = 'none';
  const showDisconnected =
    !connected &&
    reconnectAttempts >= DISCONNECTED_BADGE_THRESHOLD &&
    getSetting('desktop.connection.showBadgeWhenDisconnected') &&
    getSetting('desktop.connection.autoConnect');

  // Priority: paused > disconnected > active > none. "Active" means at
  // least one rule-matched request has been observed on this tab.
  if (isPaused) {
    badgeState = 'paused';
  } else if (showDisconnected) {
    badgeState = 'disconnected';
  } else if (fireCount > 0) {
    badgeState = 'active';
  }

  // Create a unique state key that includes the fire count so the badge
  // redraws as traffic comes in.
  const currentStateKey = `${badgeState}-${fireCount}-${configuredRuleCount}-${isPaused}-${connected}`;

  // Only update if state or count changed
  if (currentStateKey === lastBadgeState) {
    return;
  }

  lastBadgeState = currentStateKey;

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
        title: 'Open Headers - Paused\nRules execution is paused',
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
        title: 'Open Headers - Disconnected\nCannot reach the desktop app',
      });
    }
  } else if (badgeState === 'active') {
    // Show the count of rule-matched requests observed on this tab.
    const badgeText = fireCount > 99 ? '99+' : fireCount.toString();
    actionAPI.setBadgeText({ text: badgeText }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge text error:', browserAPI.runtime.lastError);
      }
    });
    actionAPI.setBadgeBackgroundColor({ color: '#E8E8E8' }, () => {
      if (browserAPI.runtime.lastError) {
        logger.debug('BadgeManager', 'Badge color error:', browserAPI.runtime.lastError);
      }
    });

    // Tooltip includes both the activity count and the configured-rule
    // count — "3 requests matched (5 rules active for this site)".
    if (actionAPI.setTitle) {
      const requestText = fireCount === 1 ? 'request' : 'requests';
      const ruleText = configuredRuleCount === 1 ? 'rule' : 'rules';
      actionAPI.setTitle({
        title: `Open Headers - Active\n${fireCount} ${requestText} matched by your ${configuredRuleCount} ${ruleText}`,
      });
    }
  } else {
    // Clear the badge when connected but no active rules
    actionAPI.setBadgeText({ text: '' });

    // Reset the tooltip to default
    if (actionAPI.setTitle) {
      actionAPI.setTitle({
        title: 'Open Headers',
      });
    }
  }
}

export function resetBadgeState(): void {
  lastBadgeState = null;
}
