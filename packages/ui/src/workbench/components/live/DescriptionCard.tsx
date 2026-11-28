/**
 * DescriptionCard — a note of several lines on what a step, or the
 * workflow, is for (the workflow runs plan, Decisions log, S36): the last
 * card of a step's Setup and of the workflow's Overview.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input } from 'antd';
import type React from 'react';
import WorkflowCard from './WorkflowCard';

interface Props {
  testId: string;
  /** The line under the title: whose note it is. */
  line: string;
  value: string;
  onChange: (value: string) => void;
  /** Canonical schema path of the description — read by field-focus awareness. */
  fieldPath?: string;
}

const DescriptionCard: React.FC<Props> = ({ testId, line, value, onChange, fieldPath }) => {
  const t = useT();
  const title = t('workbench.editors.live.description.title');
  return (
    <WorkflowCard testId={testId} title={title} description={line}>
      <div className="oh-wf-card-body">
        <span data-field-path={fieldPath} style={{ display: 'contents' }}>
          <Input.TextArea
            aria-label={title}
            autoSize={{ minRows: 2, maxRows: 8 }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
      </div>
    </WorkflowCard>
  );
};

export default DescriptionCard;
