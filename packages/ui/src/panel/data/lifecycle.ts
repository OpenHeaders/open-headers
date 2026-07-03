/**
 * Panel-side request-lifecycle module. Consumes `LifecycleWireMessage`
 * envelopes from `@openheaders/oracle/request-lifecycle-hub` (delivered
 * over the `oh-lifecycle:<tabId>` port) and projects them into the
 * inspector row shape the network table renders.
 *
 * Lift-readiness: chrome-free, react-bound. The hook is the only file
 * here that depends on `lifelineTransport`; everything else (store,
 * reducer, facet) is pure data + transforms and could lift to a shared
 * panel package once a second consumer needs it (P1-P6 ships it in
 * `@openheaders/ui` for now).
 */

export type { BuildInspectorRowsOptions, InspectorRow } from './inspector-facet';
export { buildInspectorRows, inspectorSortKey } from './inspector-facet';
export type { ClientReducerResult } from './stores/lifecycle-client-reducer';
export { NOOP, reduceClientUpdate } from './stores/lifecycle-client-reducer';
export type { LifecycleClientSnapshot } from './stores/lifecycle-client-store';
export { LifecycleClientStore } from './stores/lifecycle-client-store';
export type { UseLifecycleClientResult } from './stores/use-lifecycle-client';
export { useLifecycleClient } from './stores/use-lifecycle-client';
