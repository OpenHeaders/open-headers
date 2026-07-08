/**
 * Daemon bind-port field — custom editor for `backend.bindPort` (A7).
 *
 * The port this host's daemon binds its WebSocket server on. Sibling to
 * the LAN-peers toggle (`backend.bindAddress`): the address decides WHO
 * can reach the daemon, this decides WHERE. Changing it rebinds the
 * server in place (see `daemon-bind-supervisor`); clients that dial this
 * host must update their backend URL's port to match, exactly as they
 * would for any server that moved ports.
 *
 * Commits on blur / Enter through a local input buffer. A `reject`
 * verdict (privileged or out-of-range) blocks the commit and shows an
 * inline error; a `warn` verdict (ephemeral range) commits but shows an
 * inline caution.
 */

import { InputNumber } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type PortValidation, validatePort } from '@openheaders/core/utils';
import FieldRow from '../fields/FieldRow';
import type { SettingDef } from '../types';
import { useSetting } from '../hooks';
import PortHint from './port-hint';

const BackendBindPortField: React.FC<{ def: SettingDef }> = ({ def }) => {
  const [port, setPort] = useSetting('backend.bindPort');
  // Local input buffer; commits on blur / Enter.
  const [input, setInput] = useState<number | null>(port);

  useEffect(() => {
    setInput(port);
  }, [port]);

  const verdict: PortValidation =
    input === null ? { level: 'reject', message: 'Enter a port.' } : validatePort(input);

  function commit(): void {
    if (input === null || verdict.level === 'reject') return;
    if (input !== port) setPort(input);
  }

  return (
    <FieldRow settingKey={def.key} label={def.label} description={def.description} block>
      <div style={{ width: '100%' }}>
        <InputNumber
          style={{ width: '100%' }}
          value={input}
          min={1}
          max={65535}
          step={1}
          placeholder="8137"
          status={verdict.level === 'reject' ? 'error' : verdict.level === 'warn' ? 'warning' : undefined}
          onChange={(next) => setInput(typeof next === 'number' ? next : null)}
          onBlur={commit}
          onPressEnter={commit}
        />
        <PortHint verdict={verdict} />
      </div>
    </FieldRow>
  );
};

export default BackendBindPortField;
