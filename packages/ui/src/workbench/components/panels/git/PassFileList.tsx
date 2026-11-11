/**
 * PassFileList — the files a pass names in a dialog of its own (the
 * uncommitted-work question, the conflicts step): one path per line in
 * the code face, clipped with its full text in the title, scrolling
 * past a handful of rows.
 */

import { theme } from 'antd';
import type React from 'react';

export interface PassFileListProps {
  files: readonly string[];
  testId: string;
}

const PassFileList: React.FC<PassFileListProps> = ({ files, testId }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        maxHeight: 132,
        overflowY: 'auto',
        overscrollBehavior: 'none',
        padding: '6px 8px',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        fontFamily: token.fontFamilyCode,
        fontSize: 12,
        lineHeight: '18px',
      }}
      data-testid={testId}
    >
      {files.map((filePath) => (
        <div key={filePath} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={filePath}>
          {filePath}
        </div>
      ))}
    </div>
  );
};

export default PassFileList;
