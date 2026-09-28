/**
 * EditorNotFound — the tab body when an editor's entity is gone: the
 * plain secondary line on the container background, the one panel
 * every request editor's tab renders in place of the editor.
 */

import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface EditorNotFoundProps {
  message: string;
}

const EditorNotFound: React.FC<EditorNotFoundProps> = ({ message }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ padding: 24, background: token.colorBgContainer }}>
      <Text type="secondary">{message}</Text>
    </div>
  );
};

export default EditorNotFound;
