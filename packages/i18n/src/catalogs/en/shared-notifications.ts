/**
 * Shared notifications family — the Notifications tool window (panel
 * chrome, mute flow), the seed nudges, and the app-update timeline
 * entries. Shared-plane: the window mounts on workbench, popup, and
 * devtools-panel surfaces alike. Store copy is captured at push time —
 * entries keep the locale they were pushed under (timeline entries are
 * historical records, not live-rerendered chrome).
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': 'Notifications',
  'shared.notifications.info.summary':
    'Suggestions about your setup and a session timeline of app events — update availability, background task outcomes, and other notices, collected here instead of interrupting your work.',
  'shared.notifications.suggestionsHeading': 'Suggestions',
  'shared.notifications.timelineHeading': 'Timeline',
  'shared.notifications.clearAll': 'Clear all',
  'shared.notifications.suggestionsEmpty.title': 'No suggestions',
  'shared.notifications.suggestionsEmpty.description': 'Advice about your setup will appear here.',
  'shared.notifications.timelineEmpty.title': 'No notifications',
  'shared.notifications.timelineEmpty.description': 'App events and updates will appear here.',
  'shared.notifications.dismiss': 'Dismiss',
  'shared.notifications.moreActions': 'More actions',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': "Don't show again",
  'shared.notifications.muted.title': 'Notifications disabled',
  'shared.notifications.muted.description': "“{title}” won't be shown again.",
  'shared.notifications.muted.reEnable': 'Re-enable',
  'shared.notifications.muted.reEnableTooltip': 'Allow this notification to show again',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Discover Open Headers',
  'shared.notifications.seed.website.description': 'See all our features interactively, plus the latest updates.',
  'shared.notifications.seed.website.action': 'Visit our website',
  'shared.notifications.seed.website.tooltip': 'Open website and clear notification',
  'shared.notifications.seed.star.title': 'Help Us Grow',
  'shared.notifications.seed.star.description': 'Recommend us to your friends & colleagues',
  'shared.notifications.seed.star.action': 'Give us a star on GitHub',
  'shared.notifications.seed.star.tooltip': 'Open github and clear notification',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': 'One Unified User Experience',
  'shared.notifications.desktopApp.rowTerminal': 'Integrated terminal — full shell access in your workspaces',
  'shared.notifications.desktopApp.rowGit': 'Version control — Git commits & history for your workspaces',
  'shared.notifications.desktopApp.rowProxy': 'Capture live traffic from your browser tabs or system',
  'shared.notifications.desktopApp.rowMcp': 'MCP server for AI assistants — live traffic analysis & debugging',
  'shared.notifications.desktopApp.rowRequests': 'Build & run native API requests — gRPC, WebSocket, SSE & more',
  'shared.notifications.desktopApp.action': 'Download the desktop app',
  'shared.notifications.desktopApp.tooltip': 'Download app and clear suggestion',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': '{version} available',
  'shared.notifications.appUpdate.securityTitle': '{version} security update available',
  'shared.notifications.appUpdate.securityDescription':
    'This release fixes a security issue affecting the version you are running. Update as soon as possible.',
  'shared.notifications.appUpdate.download': 'Download…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': 'Settings…',
  'shared.notifications.toast.dontShowAgain': "Don't Show Again",
  'shared.notifications.toast.optionsTooltip': 'Turn off or change behavior',
  'shared.notifications.toast.optionsAria': 'Update notification options',
  'shared.notifications.toast.close': 'Close',
  'shared.notifications.toast.upToDateTitle': "You're up to date",
  'shared.notifications.toast.upToDateDescription': '{version} is the latest version.',
  'shared.notifications.toast.checkFailed': 'Update check failed',
  'shared.notifications.toast.downloadFailed': 'Update download failed',
  'shared.notifications.toast.available': '{version} available',
  'shared.notifications.toast.update': 'Update…',
  'shared.notifications.toast.packageManager': 'Update via your Linux package manager.',
  'shared.notifications.toast.releaseNotes': 'Release notes',
  'shared.notifications.toast.readyToInstall': '{version} ready to install',
  'shared.notifications.toast.restartToInstall': 'Restart to install',
  'shared.notifications.toast.updatedTo': 'Updated to {version}',
  'shared.notifications.toast.seeWhatsNew': "See what's new",

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    '{availableVersion} fixes a security issue affecting the version you are running ({currentVersion}). Update as soon as possible.',
  'shared.notifications.securityBanner.messageNoVersion':
    'A security fix is published for the version you are running ({currentVersion}). Update as soon as possible.',
  'shared.notifications.securityBanner.update': 'Update…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'Secrets storage is locked',
  'shared.notifications.secrets.description':
    'Vault secrets and OAuth tokens cannot be read or saved this session. {remedy}',
  'shared.notifications.secrets.relaunch': 'Relaunch app',
  'shared.notifications.secrets.remedy.darwin':
    'Open Headers was denied access to the system keychain. Relaunch the app and allow keychain access when prompted.',
  'shared.notifications.secrets.remedy.linux':
    'No usable keyring backend is available. Set one up (GNOME Keyring or KWallet), then relaunch the app.',
  'shared.notifications.secrets.remedy.other':
    'Open Headers could not access the system credential store. Relaunch the app to try again.',
} as const satisfies Catalog;
