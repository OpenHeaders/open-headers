/**
 * SpecEditorTab — the spec document's editor surface (tab mode
 * `spec-edit`).
 *
 * Phase B scope: a read-only view of the root source file under the
 * format header, live off the spec sync mirror. Phase C replaces the
 * body with the Monaco editor (YAML/JSON modes, derived dirty + save,
 * parse-on-idle validation counts) behind the same tab target.
 */

import { FileTextOutlined } from '@ant-design/icons';
import { SPEC_FORMATS } from '@openheaders/core/schemas';
import { Empty, Tag, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';

/** Header badge label per format — presentation of the picklist value. */
const FORMAT_LABELS: Record<(typeof SPEC_FORMATS)[number], string> = {
  'openapi-3.0': 'OpenAPI 3.0',
  'openapi-3.1': 'OpenAPI 3.1',
};

/** File syntax derives from the extension (invariant #15). */
function syntaxLabel(fileName: string): string {
  return fileName.endsWith('.json') ? 'JSON' : 'YAML';
}

interface SpecEditorTabProps {
  specUid: string;
  workspaceId: string | null;
}

const SpecEditorTab: React.FC<SpecEditorTabProps> = ({ specUid, workspaceId }) => {
  const { token } = theme.useToken();
  const t = useT();
  const specs = useSpecs(workspaceId);
  const spec = specs.find((s) => s.uid === specUid);
  if (!spec) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workbench.editors.spec.notFound')} />
      </div>
    );
  }
  const rootFile = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <FileTextOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>{rootFile?.fileName}</span>
        <Tag style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}>{FORMAT_LABELS[spec.format]}</Tag>
        {rootFile && <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{syntaxLabel(rootFile.fileName)}</Tag>}
      </div>
      <pre
        style={{
          flex: 1,
          minHeight: 0,
          margin: 0,
          padding: '8px 12px',
          overflow: 'auto',
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "'SF Mono', Menlo, Consolas, monospace",
          color: token.colorText,
          background: 'transparent',
        }}
      >
        {rootFile?.content ?? ''}
      </pre>
    </div>
  );
};

export default SpecEditorTab;
