/**
 * Multi-tab Behavior diagrams — split by topic.
 *
 *   sync.tsx              — overview: two tab mockups, shared storage.
 *   navigation.tsx        — same-window-first routing (Navigation diagram).
 *   numbering.tsx         — ordinals are stable within a tab's lifetime.
 *   synced-vs-local.tsx   — paired view of "what syncs" vs "what stays".
 */

export { MultiTabSyncDiagram } from './sync';
export { MultiTabNavigationDiagram } from './navigation';
export { MultiTabNumberingDiagram } from './numbering';
export { MultiTabLocalDiagram, MultiTabSyncedDiagram } from './synced-vs-local';
