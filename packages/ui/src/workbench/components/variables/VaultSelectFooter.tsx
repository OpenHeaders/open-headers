/**
 * VaultSelectFooter — sticky action row under a vault-backed Select's
 * option list (rendered via the Select's `popupRender`, below the
 * scrolling menu, so it stays visible however long the list grows).
 * Opens the device-vault editor tab through {@link OpenVaultContext};
 * renders nothing when no shell provides the action, so the popup
 * never shows a dead button.
 */

import { Button, theme } from 'antd';
import type React from 'react';
import { useOpenVault } from '../../hooks/OpenVaultContext';

const VaultSelectFooter: React.FC<{
  label: string;
  testId?: string;
  /** Close the hosting Select's popup — a footer click is not a
   *  selection, so antd would otherwise leave the popup floating over
   *  the vault tab it navigated to. */
  onNavigate?: () => void;
}> = ({ label, testId, onNavigate }) => {
  const { token } = theme.useToken();
  const openVault = useOpenVault();
  if (openVault === null) return null;
  return (
    <div style={{ marginTop: 4, padding: '4px 4px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
      <Button
        type="link"
        size="small"
        data-testid={testId}
        onClick={() => {
          onNavigate?.();
          openVault();
        }}
        style={{ padding: '0 8px', fontSize: 12 }}
      >
        {label}
      </Button>
    </div>
  );
};

export default VaultSelectFooter;
