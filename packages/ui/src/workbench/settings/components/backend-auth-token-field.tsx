/**
 * Authentication field with in-app pairing (WS-A2).
 *
 * Editor for one `OH.backends` record's paired token, resolved through
 * the row-editor's record context. Two ways to supply the credential,
 * with the friendlier one shown first and a quiet text link to switch
 * (the one-time-code idiom):
 *
 *   - **Code** (default) — type the 6-digit code the daemon displayed
 *     into an OTP input; the last digit triggers a `pairWithCode`
 *     exchange that mints a token and writes it onto the record. On
 *     success we DON'T flip views or fire a toast — pairing is auth
 *     setup, not activation, so we stay put and show a calm inline
 *     "Paired" line. The user still explicitly enables the back-end.
 *   - **Token** — paste / edit a long-lived token directly.
 *
 * The code path only exists when the running host registered the
 * `pairWithCode` capability (the extension surfaces do; a host that pairs
 * by another gesture doesn't). Without it the field degrades to the bare
 * token input with no switch link.
 */

import { CheckCircleFilled } from '@ant-design/icons';
import { App as AntApp, Button, Input, theme, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getCapability, hasCapability } from '@openheaders/core/capabilities';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { deriveBackendMode } from '../schema/backend';
import FieldRow from '../fields/FieldRow';
import { BackendIcon, backendModeIcon } from './backend-icons';
import { useBackendRecord } from './backend-record-context';
import { humanizePairFailure } from './pair-popover';

type AuthMode = 'token' | 'code';
const CODE_LENGTH = 6;

const FIELD_LABEL = 'Authentication';
const FIELD_DESCRIPTION =
  'How this device proves itself to the back-end. Pair with a code, or paste a token directly.';

const BackendAuthTokenField: React.FC = () => {
  const { token: themeToken } = theme.useToken();
  const { message } = AntApp.useApp();
  const handle = useBackendRecord();
  const token = handle?.record.authToken ?? '';
  const url = handle?.record.url ?? '';
  const [draft, setDraft] = useState(token);
  const canPair = hasCapability('pairWithCode');
  const hasToken = token.trim().length > 0;
  // A device with a saved token lands in the token view (its masked
  // value); a fresh one defaults to the code path when the host can pair.
  const [authMode, setAuthMode] = useState<AuthMode>(hasToken ? 'token' : canPair ? 'code' : 'token');
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    setDraft(token);
  }, [token]);

  // When the row's reset clears the token, drop the now-consumed code so
  // the boxes re-open empty for a fresh pairing.
  useEffect(() => {
    if (!token) setCode('');
  }, [token]);

  const setToken = useCallback(
    (next: string) => {
      if (handle) void handle.patch({ authToken: next });
    },
    [handle],
  );

  const commit = useCallback(() => {
    if (draft !== token) setToken(draft);
  }, [draft, token, setToken]);

  const pair = useCallback(
    async (value: string) => {
      const exchange = getCapability('pairWithCode');
      if (!exchange) return;
      setPairing(true);
      const result = await exchange({ url, code: value });
      setPairing(false);
      if (result.ok) {
        // Save the token silently and stay put with a calm inline
        // confirmation — no toast, no flip. The minted token now locks the
        // code input (consumed, single-use); the row's reset is the override.
        setDraft(result.token);
        setToken(result.token);
        return;
      }
      // Keep the entered code on failure — a wrong code is usually a single
      // mistyped digit the user can fix in place, not a reason to retype all six.
      message.error(humanizePairFailure(result, url));
    },
    [url, message, setToken],
  );

  if (!handle) return null;

  const inCodeMode = canPair && authMode === 'code';
  // Pairing is done once a token exists — lock the code input and the
  // method toggle. The row's reset (undo) is the way to override.
  const locked = inCodeMode && hasToken;
  // The back-end-tier glyph for the record being paired — classified off
  // its URL, so the code input reads as "pairing with THIS back-end".
  const icon = backendModeIcon(deriveBackendMode(getCurrentHost(), { ...handle.record, enabled: true }));

  return (
    <FieldRow
      settingKey="backend.authToken"
      label={FIELD_LABEL}
      description={FIELD_DESCRIPTION}
      // Registry-backed: the store can't derive modified/reset for this
      // field. A saved token shows the dot; reset clears it — the
      // documented override for a locked (paired) code input.
      modified={hasToken}
      onReset={() => setToken('')}
      block
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, width: '100%' }}>
        {inCodeMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
              <BackendIcon kind={icon} size={24} />
            </span>
            <Input.OTP
              length={CODE_LENGTH}
              value={code}
              disabled={pairing || !url || locked}
              aria-label="Pairing code"
              formatter={(s) => s.replace(/\D/g, '')}
              onChange={setCode}
            />
            <Button
              type="primary"
              loading={pairing}
              disabled={locked || code.length !== CODE_LENGTH || !url}
              onClick={() => void pair(code)}
            >
              Pair
            </Button>
          </div>
        ) : (
          <Input.Password
            style={{ width: '100%' }}
            value={draft}
            placeholder="Paste a token"
            aria-label="Auth token"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onPressEnter={commit}
          />
        )}
        {locked && (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: themeToken.colorSuccess }}
          >
            <CheckCircleFilled />
            Paired — access token saved
          </span>
        )}
        {canPair && (
          <Typography.Link
            disabled={locked}
            style={{ fontSize: 12 }}
            onClick={() => setAuthMode((m) => (m === 'code' ? 'token' : 'code'))}
          >
            {inCodeMode ? 'Use an auth token instead' : 'Pair with a code instead'}
          </Typography.Link>
        )}
      </div>
    </FieldRow>
  );
};

export default BackendAuthTokenField;
