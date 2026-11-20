/**
 * The activity monitor's bridge RPC (the activity monitor plan §7,
 * fork 4): a viewer PULLS, and the host that owns the processes answers
 * from a read no older than a second. The host holds no timer for a
 * viewer and no lease a closed document could leave running. Local IPC
 * only — no figure here leaves the device.
 */

import type { ActivityMonitorCursor, ActivityMonitorSnapshot } from '../../activity-monitor/model';

export interface ActivityMonitorRpc {
  /**
   * What the app is running right now. `cursor` is the one the previous
   * answer carried (null on a first ask). Hosts with no process plane
   * under them never answer; the surface gates on the `activityMonitor`
   * capability.
   */
  'oh.activityMonitor.sample': {
    req: { cursor: ActivityMonitorCursor | null };
    res: ActivityMonitorSnapshot;
  };
}
