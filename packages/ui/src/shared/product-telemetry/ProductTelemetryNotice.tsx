/**
 * First-run product-telemetry disclosure (`TELEMETRY_PLAN.md` §2/§8).
 * Mounts on every primary surface (popup, side panel, workbench);
 * whichever the user opens first shows the notice once and sets the
 * shared flag — the host client refuses to queue or send anything until
 * then, so disclosure always precedes the first event.
 *
 * The paragraph is the user-signed §8 copy, shipped verbatim.
 *
 * Currently UNMOUNTED everywhere: the blocking-modal form was rejected
 * for onboarding UX; the disclosure surface is being redesigned. While
 * nothing shows this notice the disclosure flag never gets set, so the
 * client latch keeps the whole channel dormant — no events queue or
 * send. Re-mount (or replace) this component to reactivate telemetry.
 */

import { hostStorage, OH } from '@openheaders/core/storage';
import { Button, Modal, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getCurrentHost } from '../host-vocabulary';

const { Paragraph, Text, Link } = Typography;

const ProductTelemetryNotice: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Extension-only until the desktop host adapter lands; a workbench
    // served by a daemon never counts anything and never discloses.
    if (getCurrentHost() !== 'extension') return;
    let cancelled = false;
    void hostStorage.get(OH.productTelemetryDisclosed).then((disclosed) => {
      if (!cancelled && disclosed !== true) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledge = useCallback(() => {
    setOpen(false);
    void hostStorage.set(OH.productTelemetryDisclosed, true);
  }, []);

  if (!open) return null;

  return (
    <Modal
      title="Anonymous usage counting"
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <Button type="primary" onClick={acknowledge} data-testid="product-telemetry-notice-ok">
          Got it
        </Button>
      }
      data-testid="product-telemetry-notice"
    >
      <Paragraph>
        <Text strong>Anonymous usage counting.</Text> Open Headers counts which features get used — nothing more. No
        URLs, no headers, no request or response data, no account identity, no persistent device id. You can see every
        event it sends, byte for byte, in Settings → General → View telemetry events, and turn it off there with one
        switch. <Link href="https://openheaders.io/privacy" target="_blank" rel="noopener">Privacy policy</Link>
      </Paragraph>
    </Modal>
  );
};

export default ProductTelemetryNotice;
