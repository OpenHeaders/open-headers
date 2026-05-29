/**
 * Daemon auth-token field with in-app pairing (WS-A2).
 *
 * Custom editor for `backend.authToken`. Renders the plain token input
 * (same draft-commit semantics as the generic StringField) plus a "Pair
 * with a code" affordance ({@link PairPopover}): the user types the
 * 6-digit code the daemon displayed and we exchange it for a token
 * through the host-neutral `pairWithCode` capability, writing the result
 * straight into the setting — no leaving the app to open the
 * server-rendered confirm page and hand-copy the secret.
 *
 * The pairing button only appears when the running host registered the
 * capability (the extension surfaces do; a host that pairs by another
 * gesture doesn't) and a back-end URL is configured. Everything else
 * degrades to the bare token input.
 */

import { Input, Space } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { hasCapability } from '@openheaders/core/capabilities';
import { useSetting, useSettingValue } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from '../fields/FieldRow';
import { PairPopover } from './pair-popover';

const BackendAuthTokenField: React.FC<{ def: SettingDef }> = ({ def }) => {
  const [token, setToken] = useSetting('backend.authToken');
  const url = useSettingValue('backend.url');
  const [draft, setDraft] = useState(token);

  useEffect(() => {
    setDraft(token);
  }, [token]);

  const commit = useCallback(() => {
    if (draft !== token) setToken(draft);
  }, [draft, token, setToken]);

  const onPaired = useCallback(
    (next: string) => {
      setDraft(next);
      setToken(next);
    },
    [setToken],
  );

  const canPair = hasCapability('pairWithCode');

  return (
    <FieldRow settingKey={def.key} label={def.label} description={def.description} block>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Input.Password
          value={draft}
          placeholder="Paste a token, or pair with a code"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onPressEnter={commit}
        />
        {canPair && <PairPopover url={url} onPaired={onPaired} />}
      </Space>
    </FieldRow>
  );
};

export default BackendAuthTokenField;
