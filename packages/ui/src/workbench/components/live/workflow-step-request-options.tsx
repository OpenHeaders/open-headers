/**
 * Request-picker options for {@link WorkflowStepEditor}. Each option
 * label is a structured breadcrumb:
 *
 *   [📂] <Collection>  ›  [📁] <Folder>  ›  [METHOD] <Request>
 *
 * Method is colored via the shared `METHOD_COLORS` so it matches the
 * sidebar + tab-bar method tags. The plain-text `title` mirrors the
 * same segments for search filtering + accessibility.
 */

import { FolderOpenOutlined, FolderOutlined } from '@ant-design/icons';
import type { GlobalToken } from 'antd/es/theme/interface';
import { METHOD_COLORS } from '../sidebar/icons';

/**
 * Request the step's Request picker can choose from. The structured
 * `collectionName` + `folderTrail` feed the option label's rich
 * breadcrumb render (folder icons + colored method). `null`
 * `collectionName` means the request isn't associated with any
 * collection — the option falls back to `<method> <name>`.
 */
export interface StepRequestChoice {
  uid: string;
  name: string;
  method: string;
  collectionName: string | null;
  folderTrail: string[];
}

export function buildRequestPickerOptions(availableRequests: StepRequestChoice[], token: GlobalToken) {
  return availableRequests.map((r) => {
    const methodColor = METHOD_COLORS[r.method] ?? token.colorTextSecondary;
    // String for filterOption + accessibility; stays consistent
    // with the JSX the user sees (same segments, same order).
    const titleSegments = [r.collectionName, ...r.folderTrail, `${r.method} ${r.name}`].filter(
      (s): s is string => s !== null,
    );
    const title = titleSegments.join(' > ');
    const separatorStyle = { color: token.colorTextQuaternary, margin: '0 4px' };
    const iconStyle = { color: token.colorTextTertiary, fontSize: 11, marginRight: 4 };
    return {
      value: r.uid,
      title,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap' }}>
          {r.collectionName !== null && (
            <>
              <FolderOpenOutlined style={iconStyle} />
              <span>{r.collectionName}</span>
              <span style={separatorStyle}>›</span>
            </>
          )}
          {r.folderTrail.map((f) => (
            <span key={f} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <FolderOutlined style={iconStyle} />
              <span>{f}</span>
              <span style={separatorStyle}>›</span>
            </span>
          ))}
          <span
            style={{
              fontWeight: 700,
              color: methodColor,
              fontFamily: "'SF Mono', monospace",
              fontSize: 10,
              marginRight: 4,
            }}
          >
            {r.method}
          </span>
          <span>{r.name}</span>
        </span>
      ),
    };
  });
}
