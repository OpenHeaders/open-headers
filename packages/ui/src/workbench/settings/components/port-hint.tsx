/**
 * Inline validation hint for a port input — shared by the daemon
 * bind-port field and the client backend-URL port field so both surfaces
 * render the same colour + copy for the same `validatePort` verdict.
 *
 * `ok` renders nothing. `warn` renders the message in the warning colour
 * (the commit is still allowed). `reject` renders it in the error colour
 * (the caller blocks the commit).
 */

import { theme } from 'antd';
import type React from 'react';
import type { PortValidation } from '@openheaders/core/utils';

const PortHint: React.FC<{ verdict: PortValidation }> = ({ verdict }) => {
  const { token } = theme.useToken();
  if (verdict.level === 'ok') return null;
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
      {verdict.message}
    </div>
  );
};

export default PortHint;
