/**
 * The saved-download toast: when the host reports that a download the
 * document started has left its native save routine (`downloadDone`),
 * say so where the person is looking — a bottom-right balloon naming
 * the file with "Show in folder", and the same entry on the timeline so
 * it outlives the balloon. An interrupted save warns instead. Hosts
 * that never send the broadcast (browser surfaces, whose shelf already
 * shows the file) render nothing.
 */

import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { App, Button } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { pushNotification } from './store';

const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 13 };

export default function DownloadFeedbackToast(): null {
  const { notification } = App.useApp();
  const t = useT();

  useEffect(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    return bridge.subscribe('downloadDone', ({ filename, path, state }) => {
      const key = `oh-download:${path}`;
      if (state === 'interrupted') {
        const title = t('shared.notifications.toast.saveFailed', { filename });
        notification.warning({ key, title, placement: 'bottomRight', duration: 8 });
        pushNotification({ severity: 'warning', title, dedupeKey: key });
        return;
      }
      const title = t('shared.notifications.toast.downloadSaved', { filename });
      const reveal = (): void => {
        const show = getCapability('revealDownload');
        if (show) void show(path);
      };
      const showInFolder = t('shared.notifications.toast.showInFolder');
      notification.success({
        key,
        title,
        description: (
          <Button
            type="link"
            size="small"
            style={LINK_STYLE}
            onClick={() => {
              notification.destroy(key);
              reveal();
            }}
          >
            {showInFolder}
          </Button>
        ),
        placement: 'bottomRight',
        duration: 8,
      });
      pushNotification({ severity: 'success', title, dedupeKey: key, actions: [{ label: showInFolder, run: reveal }] });
    });
  }, [notification, t]);

  return null;
}
