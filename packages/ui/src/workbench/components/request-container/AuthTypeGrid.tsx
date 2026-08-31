/**
 * The container's no-auth empty state: the title, the level's
 * subtitle, and one card per auth type — a click mints the pool's
 * first (default) entry of that type.
 */

import { Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ConcreteAuthType } from '../request-editor/auth-type-menu';
import { AUTH_TYPE_ORDER, authTypeIcon } from '../request-editor/auth-type-menu';
import { authTypeLabelKey } from '../request-editor/inherited-auth';

const { Text } = Typography;

const CARD_TYPES: readonly ConcreteAuthType[] = [...AUTH_TYPE_ORDER, 'none'];

const AuthTypeGrid: React.FC<{
  kind: 'collection' | 'folder';
  onPick: (type: ConcreteAuthType) => void;
}> = ({ kind, onPick }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      data-testid="oh-auth-pool-empty"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flex: 1,
        minHeight: 320,
        padding: 24,
      }}
    >
      <Text strong style={{ fontSize: 15 }}>
        {t('workbench.editors.requestContainer.auth.emptyTitle')}
      </Text>
      <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', maxWidth: 440 }}>
        {kind === 'collection'
          ? t('workbench.editors.requestContainer.auth.emptySubtitleCollection')
          : t('workbench.editors.requestContainer.auth.emptySubtitleFolder')}
      </Text>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
          marginTop: 24,
          maxWidth: 640,
        }}
      >
        {CARD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            data-testid="oh-auth-type-card"
            data-type={type}
            onClick={() => onPick(type)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: 108,
              height: 96,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadius,
              background: token.colorBgContainer,
              color: token.colorTextSecondary,
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1.25,
              textAlign: 'center',
              padding: '8px 6px',
            }}
          >
            <span style={{ fontSize: 20, color: token.colorText }}>{authTypeIcon(type)}</span>
            <span>{t(authTypeLabelKey(type))}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AuthTypeGrid;
