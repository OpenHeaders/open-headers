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
 * Edits are STAGED, not committed — the user types freely and the value
 * flows into the connection-draft layer (`useConnectionField`); the
 * persisted port (and the in-place rebind) only lands when the user hits
 * "Apply & reconnect" in the ApplyBar, so tabbing out of a half-typed
 * port can't silently rebind the daemon. A `reject` verdict (privileged
 * or out-of-range) blocks the stage and shows an inline error; a `warn`
 * verdict (ephemeral range) stages but shows an inline caution. Outside
 * the BackendPane (settings search) the hook falls back to auto-apply.
 */

import { InputNumber } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type PortValidation, validatePort } from '@openheaders/core/utils';
import FieldRow from '../fields/FieldRow';
import type { SettingDef } from '../types';
import { useConnectionField } from './connection-draft';
import PortHint from './port-hint';

const BackendBindPortField: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { value: port, setValue: setPort, dirty, discard } = useConnectionField('backend.bindPort');
  // Local input buffer; stages into the connection draft on blur / Enter.
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
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      modified={dirty}
      onReset={discard}
      resetTooltip="Discard unapplied change"
      block
    >
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
