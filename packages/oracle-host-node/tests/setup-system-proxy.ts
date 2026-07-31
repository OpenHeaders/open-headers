/**
 * Test hermeticity: the system-plane registry defaults to the
 * env-var resolver (FORK A — the plane is ON by default), which would
 * let a developer machine's `http_proxy` reroute every live-rig suite
 * dialing 127.0.0.1. Turn the plane off for the whole test run; suites
 * exercising it inject their own fake resolver via the transport's
 * `systemProxy` option, which bypasses the registry.
 */

import { registerSystemProxyResolver } from '../src/live/system-proxy/registry';

registerSystemProxyResolver(null);
