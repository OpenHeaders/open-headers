/**
 * `TabLifecycleEvent` — discriminated union for cross-driver tab-lifecycle
 * broadcasts. Today carries only `tab-forgotten`; a future `rules-changed`
 * variant will slot in alongside without changing subscriber wiring.
 */

export type TabLifecycleEvent = { kind: 'tab-forgotten'; tabId: number };

export type TabLifecycleListener = (event: TabLifecycleEvent) => void;

export type Unsubscribe = () => void;
