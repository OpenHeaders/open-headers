import { FileTextOutlined, MoreOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps, Tooltip } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';

interface EditorActionClusterProps {
  isDirty: boolean;
  onSave: () => void;
  onSaveAsTemplate?: () => void;
}

const EditorActionCluster: React.FC<EditorActionClusterProps> = ({ isDirty, onSave, onSaveAsTemplate }) => {
  const saveLabel = useShortcutLabel('save');

  const overflowItems: MenuProps['items'] = [];
  if (onSaveAsTemplate) {
    overflowItems.push({
      key: 'save-as-template',
      icon: <FileTextOutlined />,
      label: 'Save as Template',
      onClick: () => onSaveAsTemplate(),
    });
  }

  return (
    <div className="rules-editor-action-cluster">
      <Tooltip title={<ShortcutHintTitle label={saveLabel}>Save</ShortcutHintTitle>} placement="bottomLeft">
        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          onClick={onSave}
          disabled={!isDirty}
          style={{
            fontSize: 11,
            ...(isDirty ? { background: '#f5722d', borderColor: '#f5722d' } : {}),
          }}
        >
          Save
        </Button>
      </Tooltip>
      {overflowItems.length > 0 && (
        <Dropdown menu={{ items: overflowItems }} trigger={['click']} placement="bottomRight">
          <Button size="small" icon={<MoreOutlined />} style={{ fontSize: 11 }} aria-label="More actions" />
        </Dropdown>
      )}
    </div>
  );
};

export default EditorActionCluster;
