/**
 * CommitToolPanel — the Commit tool window follows the workspace the
 * workbench SHOWS and serves one workspace at a time: its body is keyed
 * by that workspace, so the checks, the selection and Amend of one
 * never reach another.
 */

import type React from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../../../hooks/EditingScopeWorkspaceContext';
import CommitToolBody, { type CommitToolBodyProps } from './CommitToolBody';

export type CommitToolPanelProps = Omit<CommitToolBodyProps, 'workspaceId'>;

const CommitToolPanel: React.FC<CommitToolPanelProps> = ({ info, onHide }) => {
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  return <CommitToolBody key={workspaceId} info={info} onHide={onHide} workspaceId={workspaceId} />;
};

export default CommitToolPanel;
