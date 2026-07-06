/**
 * CspBypassHint — inline honesty note under the Bypass CSP checkbox.
 *
 * Bypass CSP keeps its full promise (header AND `<meta>` CSP) only when
 * the host can run the code through the browser's user-scripts path.
 * The `cspExemptInjection` capability reports that at mount; when it
 * resolves `false` the rule still works but degrades to header-CSP-only,
 * so the user is told what's covered and which browser toggle restores
 * the rest. Capability absent (desktop, Firefox / Safari) or `true` —
 * nothing renders. The checkbox itself is never gated: execution
 * degrades gracefully, this is representation only.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';

const { Text } = Typography;

const CspBypassHint: React.FC = () => {
  const [exempt, setExempt] = useState<boolean | null>(null);

  useEffect(() => {
    const probe = getCapability('cspExemptInjection');
    if (!probe) return;
    let cancelled = false;
    probe()
      .then((available) => {
        if (!cancelled) setExempt(available);
      })
      .catch(() => {
        // Probe failure reads as unknown — stay quiet rather than warn wrongly.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (exempt !== false) return null;
  return (
    <div style={{ marginTop: 4, paddingLeft: 24 }}>
      <Text type="warning" style={{ fontSize: 11 }}>
        Covers header CSP only right now — a &lt;meta&gt; CSP can still block this script. To bypass both, enable
        &quot;Allow user scripts&quot; for this extension in your browser&apos;s extension settings.
      </Text>
    </div>
  );
};

export default CspBypassHint;
