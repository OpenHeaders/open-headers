/**
 * The container's no-auth empty state: the title, the level's
 * subtitle, and one card per auth type in the offer's sections — a
 * row per section (the credential schemes, the vendor signatures,
 * then No Auth apart), a click mints the pool's first (default) entry
 * of that type. The card face and its hover live in editor.less.
 */

import { Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ConcreteAuthType } from '../request-editor/auth-type-menu';
import { AUTH_TYPE_SECTIONS, authTypeIcon } from '../request-editor/auth-type-menu';
import { authTypeLabelKey } from '../request-editor/inherited-auth';

const { Text } = Typography;

const AuthTypeGrid: React.FC<{
  kind: 'collection' | 'folder';
  onPick: (type: ConcreteAuthType) => void;
}> = ({ kind, onPick }) => {
  const t = useT();
  return (
    <div
      data-testid="oh-auth-pool-empty"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 18 }}>
        {AUTH_TYPE_SECTIONS.map((section) => (
          <div
            key={section[0]}
            data-testid="oh-auth-type-section"
            style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 920 }}
          >
            {section.map((type) => (
              <button
                key={type}
                type="button"
                className="oh-auth-type-card"
                data-testid="oh-auth-type-card"
                data-type={type}
                onClick={() => onPick(type)}
              >
                <span className="oh-auth-type-card-icon">{authTypeIcon(type)}</span>
                <span>{t(authTypeLabelKey(type))}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthTypeGrid;
