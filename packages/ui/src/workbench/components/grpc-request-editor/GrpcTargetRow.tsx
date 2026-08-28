/**
 * GrpcTargetRow — the editor header's title slot: TLS lock + authority
 * input + the method selector grouped by service with call-shape
 * glyphs. The selector is also the spec entry point in EVERY state —
 * workspace protobuf specs offer to link inline (linked, the other
 * specs read as a switch) and an import-a-.proto action mints a spec
 * and links it; a persisted method the spec no longer declares stays
 * visible as an unresolved entry instead of silently blanking.
 */

import { LockOutlined, ReloadOutlined, UnlockOutlined } from '@ant-design/icons';
import type { GrpcMethodRef } from '@openheaders/core/types';
import type { ProtoStreamingShape } from '@openheaders/core/proto';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, Select, type SelectProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useCallback, useMemo } from 'react';
import type { GrpcDraft } from './draft';
import type { GrpcSpecBinding } from './useGrpcSpecBinding';
import {
  findMethodOption,
  GRPC_IMPORT_PROTO_VALUE,
  GRPC_SPEC_LINK_VALUE_PREFIX,
  GRPC_STREAMING_ARROWS,
  parseGrpcSelectValue,
} from './method-selector';
import './grpc-method-select.css';

const { Text } = Typography;

const methodKey = (m: GrpcMethodRef): string => `${m.service}/${m.rpc}`;

interface GrpcTargetRowProps {
  draft: GrpcDraft;
  setDraft: Dispatch<SetStateAction<GrpcDraft>>;
  spec: GrpcSpecBinding;
  workspaceId: string | null;
  /** Open the hidden .proto file picker (owned by the editor — the
   *  Service definition tab shares it). */
  onImportProto: () => void;
}

const GrpcTargetRow: React.FC<GrpcTargetRowProps> = ({ draft, setDraft, spec, workspaceId, onImportProto }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { protobufSpecs, linkedSpec, derivation, refreshDerivation } = spec;

  const selectedOption = findMethodOption(derivation, draft.method);

  const selectOptions = useMemo(() => {
    // Call-shape accent per streaming direction; the double-struck
    // arrow in GRPC_STREAMING_ARROWS keeps the shape readable without
    // the color.
    const streamingColors: Record<ProtoStreamingShape, string> = {
      unary: token.colorInfo,
      'server-streaming': token.colorWarning,
      'client-streaming': token.colorSuccess,
      'bidi-streaming': token.colorError,
    };
    const glyph = (streaming: ProtoStreamingShape) => (
      <span style={{ color: streamingColors[streaming], marginRight: 6 }}>{GRPC_STREAMING_ARROWS[streaming]}</span>
    );
    const groups: NonNullable<SelectProps['options']> = [];
    if (linkedSpec) {
      for (const group of derivation?.groups ?? []) {
        groups.push({
          label: group.service,
          options: group.options.map((option) => ({
            value: `${option.service}/${option.rpc}`,
            label: (
              <span>
                {glyph(option.streaming)}
                {option.rpc}
              </span>
            ),
            // The closed field names the call short-form: short
            // service name / rpc, glyph first. The class lets the
            // search-state CSS hide the node while filtering (antd
            // only blanks its text color; the glyph's inline accent
            // would keep painting under the typed characters).
            selectedLabel: (
              <span className="grpc-method-selected-label">
                {glyph(option.streaming)}
                {option.service.split('.').pop()} / {option.rpc}
              </span>
            ),
            title: option.rpc,
          })),
        });
      }
    }
    // The selector is the spec entry point in every state: link a
    // workspace protobuf spec inline (linked, the OTHER specs read as
    // a switch), or import a .proto file as one.
    const linkableSpecs = protobufSpecs.filter((s) => s.uid !== linkedSpec?.uid);
    if (linkableSpecs.length > 0) {
      groups.push({
        label: t('workbench.editors.grpc.method.linkGroup'),
        options: linkableSpecs.map((s) => ({
          value: `${GRPC_SPEC_LINK_VALUE_PREFIX}${s.uid}`,
          label: s.name,
          selectedLabel: s.name,
          title: s.name,
        })),
      });
    }
    if (workspaceId) {
      const importLabel = t('workbench.editors.grpc.method.importProto');
      groups.push({
        value: GRPC_IMPORT_PROTO_VALUE,
        label: importLabel,
        selectedLabel: importLabel,
        title: importLabel,
      });
    }
    // A persisted method the spec no longer declares stays visible as
    // an unresolved entry instead of silently blanking the select.
    if (draft.method && !selectedOption) {
      const unresolvedLabel = t('workbench.editors.grpc.method.unresolvedOption', { rpc: draft.method.rpc });
      groups.push({
        label: t('workbench.editors.grpc.method.unresolvedGroup'),
        options: [
          {
            value: methodKey(draft.method),
            label: unresolvedLabel,
            selectedLabel: unresolvedLabel,
            title: draft.method.rpc,
          },
        ],
      });
    }
    return groups;
  }, [linkedSpec, derivation, protobufSpecs, workspaceId, draft.method, selectedOption, t, token]);

  const handleSelectChange = useCallback(
    (value: string) => {
      const action = parseGrpcSelectValue(value);
      if (action === null) return;
      if (action.kind === 'method') {
        const method: GrpcMethodRef = action.method;
        setDraft((d) => ({ ...d, method }));
      } else if (action.kind === 'link-spec') {
        setDraft((d) => ({ ...d, specLink: { specUid: action.specUid } }));
      } else {
        onImportProto();
      }
    },
    [setDraft, onImportProto],
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tooltip title={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}>
        <Button
          icon={
            draft.tls ? (
              <LockOutlined style={{ color: token.colorSuccess }} />
            ) : (
              <UnlockOutlined style={{ color: token.colorWarning }} />
            )
          }
          onClick={() => setDraft((d) => ({ ...d, tls: !d.tls }))}
          aria-label={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.grpc.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="grpc-url-input"
      />
      <Select
        style={{ width: 280, flexShrink: 0 }}
        placeholder={t('workbench.editors.grpc.method.placeholder')}
        // null, not undefined — an undefined value flips the antd
        // Select to uncontrolled, so a clicked link/import action
        // option would linger as the displayed label.
        value={draft.method ? methodKey(draft.method) : null}
        options={selectOptions}
        onChange={handleSelectChange}
        showSearch
        optionFilterProp="title"
        optionLabelProp="selectedLabel"
        popupRender={(menu) => (
          <>
            {menu}
            {linkedSpec && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  padding: '4px 12px 0',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workbench.editors.grpc.method.usingSpec', { name: linkedSpec.name })}
                </Text>
                <Tooltip title={t('workbench.editors.grpc.method.refreshSpec')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<ReloadOutlined style={{ fontSize: 11 }} />}
                    onClick={refreshDerivation}
                  />
                </Tooltip>
              </div>
            )}
          </>
        )}
        data-testid="grpc-method-select"
      />
    </div>
  );
};

export default GrpcTargetRow;
