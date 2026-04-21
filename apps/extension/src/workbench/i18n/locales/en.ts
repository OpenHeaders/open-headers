/**
 * English dictionary — the canonical set of translation keys.
 *
 * Every other locale augments this via `Partial<Dictionary>`, so
 * adding a new string is a two-step process: (1) add the key here,
 * (2) translate it in each other locale file as you reach parity.
 *
 * Key naming convention: `area.subArea.label`. Flat keys only —
 * nested objects aren't supported by the resolver. Keep variable
 * placeholders descriptive (`{count}`, not `{n}`) so translators can
 * spot them without context.
 */

export const en = {
  // Landing — Home
  'landing.home.welcomeTitle': 'Welcome to Open Headers',
  'landing.home.welcomeDescription':
    'Manage request workbench, collections, and templates from this workspace. Your last session is not restored because Settings → General → Open To is set to Home.',
  'landing.home.stats.rules': 'Rules',
  'landing.home.stats.active': 'Active',
  'landing.home.stats.collections': 'Collections',
  'landing.home.stats.templates': 'Templates',
  'landing.home.quickActions': 'Quick actions',
  'landing.home.newHeaderRule': 'New Header Rule',
  'landing.home.newRedirectRule': 'New Redirect Rule',
  'landing.home.newBlockRule': 'New Block Rule',
  'landing.home.openSettings': 'Open Settings',
  'landing.home.recentRules': 'Recent workbench',
  'landing.home.noRules': 'No workbench yet',
  'landing.home.collections': 'Collections',
  'landing.home.ruleCount_one': '{count} rule',
  'landing.home.ruleCount_other': '{count} workbench',

  // Landing — Rules
  'landing.rules.title': 'All workbench',
  'landing.rules.newRule': 'New Rule',
  'landing.rules.column.name': 'Name',
  'landing.rules.column.type': 'Type',
  'landing.rules.column.status': 'Status',
  'landing.rules.status.active': 'Active',
  'landing.rules.status.disabled': 'Disabled',

  // Landing — Collections
  'landing.collections.title': 'Collections',
  'landing.collections.empty': 'No collections yet',

  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.close': 'Close',
} as const;
