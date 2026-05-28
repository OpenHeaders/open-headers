import { subscribeActivityMuteChanges } from '@openheaders/oracle/sync';
import { broadcast } from '@utils/bridge';
import { subscribeActivityEntries } from '../sync-activity-installer';

export function installActivityBroadcasts(): void {
  // Live tail for the Activity Feed panel — each classified entry is
  // pushed onto the renderer bridge so panels can prepend without re-fetching.
  subscribeActivityEntries((entry) => {
    broadcast('activityEntry', entry);
  });

  // Mute/unmute changes fan out so open panels keep their badges in
  // lockstep without polling the RPC.
  subscribeActivityMuteChanges((change) => {
    broadcast('activityMuteChanged', change);
  });
}
