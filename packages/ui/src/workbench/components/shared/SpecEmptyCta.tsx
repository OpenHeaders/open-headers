/**
 * SpecEmptyCta — what a Spec tab shows when the workspace holds no spec
 * of the editor's format: the fact, and the one action that resolves
 * it — a jump to the sidebar's SPECS section, whose header creates
 * specs. Replaces the picker (a Select with nothing to select is not a
 * control); the picker returns once a spec exists.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Typography } from 'antd';
import type React from 'react';
import { postSpecsSectionReveal } from '../../data/specs-section-reveal';

const { Text } = Typography;

interface SpecEmptyCtaProps {
  /** The format name as the user knows it ("OpenAPI", "AsyncAPI"). */
  format: string;
  testid: string;
}

const SpecEmptyCta: React.FC<SpecEmptyCtaProps> = ({ format, testid }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid={testid}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('workbench.editors.spec.noSpecs', { format })}
      </Text>
      <Button
        type="link"
        size="small"
        style={{ padding: 0, fontSize: 12, height: 'auto' }}
        onClick={postSpecsSectionReveal}
        data-testid={`${testid}-go`}
      >
        {t('workbench.editors.spec.goToSpecs')}
      </Button>
    </div>
  );
};

export default SpecEmptyCta;
