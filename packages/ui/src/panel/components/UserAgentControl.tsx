/**
 * User-Agent override toolbar control (CDP Control Plane, Phase F3a). A button
 * beside the throttle dropdown that opens a small form to pin this tab's
 * User-Agent string.
 *
 * Overriding the UA has NO standard-mode fallback (`Network.setUserAgentOverride`
 * is the only mechanism), so the control is DISABLED whenever the inspected tab
 * is not CDP-controlled; the hover tooltip and the (i) popover both point the
 * user at Debug mode. This is the never-silent surface for the override plane:
 * the user can only set an override that will actually take effect.
 */

import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, Input, Modal, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { buildUserAgentInfo } from './debug-controls-info';

export interface UserAgentControlProps {
  /** The active UA override, or `null` when the tab uses its real UA. */
  userAgent: string | null;
  /** Pin a UA string, or `null` to restore the real UA. */
  setUserAgent: (userAgent: string | null) => void;
  /** The inspected tab is CDP-controlled — the override is operable. */
  cdpOwned: boolean;
  /** Renders an "Enable Debug mode" action in the (i) popover when set. */
  onEnableDebug?: () => void;
}

export const UserAgentControl: React.FC<UserAgentControlProps> = ({
  userAgent,
  setUserAgent,
  cdpOwned,
  onEnableDebug,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const openModal = (): void => {
    setDraft(userAgent ?? '');
    setOpen(true);
  };

  const apply = (): void => {
    const trimmed = draft.trim();
    setUserAgent(trimmed ? trimmed : null);
    setOpen(false);
  };

  const resetToDefault = (): void => {
    setUserAgent(null);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      className="dt-toolbar-dropdown dt-useragent-trigger"
      disabled={!cdpOwned}
      onClick={openModal}
    >
      <span>{userAgent ? 'Custom UA' : 'User-Agent'}</span>
      <span className="dt-toolbar-dropdown-caret">▾</span>
    </button>
  );

  return (
    <span className="dt-debug-control">
      {cdpOwned ? (
        trigger
      ) : (
        <Tooltip
          title="A User-Agent override is available only in Debug mode. Enable Debug mode to override this tab."
          placement="bottom"
        >
          {/* span wrapper so the tooltip shows over the disabled trigger */}
          <span className="dt-useragent-disabled-wrap">{trigger}</span>
        </Tooltip>
      )}
      <InfoTrigger content={buildUserAgentInfo({ cdpOwned, onEnableDebug })} ariaLabel="About User-Agent override" />

      <Modal
        title="User-Agent override"
        open={open}
        onOk={apply}
        onCancel={() => setOpen(false)}
        okText="Apply"
        width={420}
        footer={[
          <Button key="reset" disabled={!userAgent} onClick={resetToDefault}>
            Reset to default
          </Button>,
          <Button key="cancel" onClick={() => setOpen(false)}>
            Cancel
          </Button>,
          <Button key="apply" type="primary" onClick={apply}>
            Apply
          </Button>,
        ]}
      >
        <div className="dt-useragent-form">
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a User-Agent string to send for this tab"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
          <p className="dt-useragent-hint">
            Sent as the <code>User-Agent</code> request header and reported to page scripts as{' '}
            <code>navigator.userAgent</code> while this tab stays in Debug mode. Leave it empty and Apply to restore the
            real User-Agent.
          </p>
        </div>
      </Modal>
    </span>
  );
};
