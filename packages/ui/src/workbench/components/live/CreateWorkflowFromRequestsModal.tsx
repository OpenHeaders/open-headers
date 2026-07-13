/**
 * CreateWorkflowFromRequestsModal — the request picker behind the
 * request tree's "Create Workflow…" container action (collection /
 * folder `⋯` menu). Renders the container's subtree as a checkable
 * tree with every request pre-checked; confirming hands the selected
 * requests — in tree order — to the host, which opens a seeded
 * Live Workflow draft. Nothing is persisted here: the draft editor
 * owns review + Save, matching the single-request Extract flow.
 */

import type { TreeNode } from '@openheaders/core/types';
import { Modal, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { WorkflowSeedStep } from '../../types';
import { methodTag } from '../sidebar/icons';
import { collectRequestSeeds } from './workflow-seed';

const { Text } = Typography;

export interface WorkflowFromRequestsTarget {
  /** Container (collection / folder) name — titles the modal and pre-names the draft. */
  name: string;
  /** The container's subtree, as the sidebar renders it. */
  tree: TreeNode[];
}

interface Props {
  /** Non-null opens the modal. */
  target: WorkflowFromRequestsTarget | null;
  onCancel: () => void;
  onCreate: (name: string, seedSteps: WorkflowSeedStep[]) => void;
}

function toDataNodes(tree: readonly TreeNode[]): DataNode[] {
  const nodes: DataNode[] = [];
  for (const node of tree) {
    if (node.type === 'folder') {
      const children = toDataNodes(node.children);
      nodes.push({
        key: `folder:${node.uid}`,
        title: <span data-testid={`wf-from-requests-folder-${node.uid}`}>{node.name}</span>,
        selectable: false,
        children,
        // A folder with no requests underneath has nothing to check.
        disabled: children.length === 0,
      });
    } else if (node.type === 'request') {
      nodes.push({
        key: node.uid,
        selectable: false,
        title: (
          <span
            data-testid={`wf-from-requests-node-${node.uid}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {methodTag(node.method)}
            {node.name}
          </span>
        ),
      });
    }
  }
  return nodes;
}

const CreateWorkflowFromRequestsModal: React.FC<Props> = ({ target, onCancel, onCreate }) => {
  const allSeeds = useMemo(() => (target ? collectRequestSeeds(target.tree) : []), [target]);
  const [checkedUids, setCheckedUids] = useState<ReadonlySet<string>>(new Set());

  // Re-arm on every open: all requests pre-checked — unchecking the
  // unwanted few is the lighter gesture for the common case.
  useEffect(() => {
    if (target) setCheckedUids(new Set(collectRequestSeeds(target.tree).map((s) => s.requestUid)));
  }, [target]);

  const treeData = useMemo(() => (target ? toDataNodes(target.tree) : []), [target]);
  const requestUids = useMemo(() => new Set(allSeeds.map((s) => s.requestUid)), [allSeeds]);
  const selected = useMemo(
    () => collectRequestSeeds(target?.tree ?? [], checkedUids),
    [target, checkedUids],
  );

  return (
    <Modal
      open={target !== null}
      title={<span style={{ fontSize: 13, fontWeight: 600 }}>Create Workflow from “{target?.name ?? ''}”</span>}
      width={440}
      onCancel={onCancel}
      okText={
        <span data-testid="wf-from-requests-create">
          {`Create Workflow (${selected.length} ${selected.length === 1 ? 'step' : 'steps'})`}
        </span>
      }
      okButtonProps={{ size: 'small', disabled: selected.length === 0 }}
      cancelButtonProps={{ size: 'small' }}
      onOk={() => {
        if (target && selected.length > 0) onCreate(target.name, selected);
      }}
      destroyOnHidden
    >
      <div data-testid="wf-from-requests-modal">
        {allSeeds.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This container has no requests to build a workflow from.
          </Text>
        ) : (
          <>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Each selected request becomes a workflow step, in the order shown.
            </Text>
            <Tree
              checkable
              defaultExpandAll
              selectable={false}
              treeData={treeData}
              checkedKeys={[...checkedUids]}
              onCheck={(keys) => {
                const flat = Array.isArray(keys) ? keys : keys.checked;
                setCheckedUids(new Set(flat.map(String).filter((k) => requestUids.has(k))));
              }}
              style={{ maxHeight: 320, overflowY: 'auto', overscrollBehavior: 'none' }}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

export default CreateWorkflowFromRequestsModal;
