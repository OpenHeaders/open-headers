/**
 * Inline validation hint for a port input — shared by the daemon
 * bind-port field and the client backend-URL port field so both surfaces
 * render the same colour + copy for the same `validatePort` verdict.
 *
 * `ok` renders nothing. `warn` renders the message in the warning colour
 * (the commit is still allowed). `reject` renders it in the error colour
 * (the caller blocks the commit). Core hands back a semantic reason;
 * this component owns the localized copy for each. Callers with a
 * UI-only reject state (an empty input) pass an explicit `messageKey`
 * instead of a core verdict.
 */

import { theme } from 'antd';
import type React from 'react';
import type { PortIssueReason, PortValidation } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';

const REASON_KEY: Record<PortIssueReason, MessageKey> = {
  'not-integer': 'workbench.settings.backendPane.port.notInteger',
  privileged: 'workbench.settings.backendPane.port.privileged',
  'above-max': 'workbench.settings.backendPane.port.aboveMax',
  ephemeral: 'workbench.settings.backendPane.port.ephemeral',
};

export type PortHintVerdict = PortValidation | { level: 'warn' | 'reject'; messageKey: MessageKey };

const PortHint: React.FC<{ verdict: PortHintVerdict }> = ({ verdict }) => {
  const { token } = theme.useToken();
  const t = useT();
  if (verdict.level === 'ok') return null;
  const messageKey = 'messageKey' in verdict ? verdict.messageKey : REASON_KEY[verdict.reason];
  return (
    <div
      role={verdict.level === 'reject' ? 'alert' : 'status'}
      style={{
        marginTop: 4,
        fontSize: 12,
        lineHeight: 1.4,
        color: verdict.level === 'reject' ? token.colorError : token.colorWarning,
      }}
    >
      {t(messageKey)}
    </div>
  );
};

export default PortHint;
