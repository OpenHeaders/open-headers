/**
 * DevPanel Initiator category — defaults for the Initiator tab inside
 * the browser DevTools panel. Persisted via the shared settings store
 * so preferences carry across panel close/reopen and every request
 * opened in the panel inherits the same defaults.
 *
 * The free-text filter input is NOT a setting — it's request-specific
 * scratch state owned by each InitiatorView instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sortSchema = v.picklist(['initiator', 'chronological', 'largest']);
export type DevpanelInitiatorSortSetting = v.InferOutput<typeof sortSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelInitiator.sortMode': DevpanelInitiatorSortSetting;
    'devpanelInitiator.showInsights': boolean;
    'devpanelInitiator.failuresOnly': boolean;
    'devpanelInitiator.thirdPartyOnly': boolean;
  }
}

// ── Sort ────────────────────────────────────────────────────────────

registerSetting({
  key: 'devpanelInitiator.sortMode',
  type: 'enum',
  default: 'initiator',
  schema: sortSchema,
  label: 'Initiator Children Sort',
  description:
    'How child requests are ordered inside the initiator chain. Initiator order preserves the original initiator-graph traversal; Chronological orders by request time; Largest subtree puts the heaviest subtree first.',
  category: 'devpanelInitiator',
  subcategory: 'View',
  tags: ['initiator', 'sort', 'order', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'initiator', label: 'Initiator order', description: 'As discovered.' },
    { value: 'chronological', label: 'Chronological', description: 'By request time.' },
    { value: 'largest', label: 'Largest subtree', description: 'Heaviest subtrees first.' },
  ],
});

registerSetting({
  key: 'devpanelInitiator.showInsights',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Suggestions',
  description:
    'Display the actionable callouts at the top of the Initiator tab (failed subrequests, dominant host, third-party share, …).',
  category: 'devpanelInitiator',
  subcategory: 'View',
  tags: ['initiator', 'insights', 'suggestions', 'devtools'],
  scope: 'user',
});

// ── Filter defaults ────────────────────────────────────────────────

registerSetting({
  key: 'devpanelInitiator.failuresOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Failures Only',
  description: 'Show only failed or blocked rows in the initiator chain.',
  category: 'devpanelInitiator',
  subcategory: 'Filters',
  tags: ['initiator', 'failures', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelInitiator.thirdPartyOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: '3rd-party Only',
  description: 'Show only rows from origins different than the page origin.',
  category: 'devpanelInitiator',
  subcategory: 'Filters',
  tags: ['initiator', 'third-party', 'filter', 'devtools'],
  scope: 'user',
});
