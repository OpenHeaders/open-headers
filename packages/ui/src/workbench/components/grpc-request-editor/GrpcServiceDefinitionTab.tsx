/**
 * GrpcServiceDefinitionTab — the spec binding surface: link a
 * workspace protobuf spec (or import a .proto as one — the same picker
 * the method selector carries), the derivation summary, and every
 * parse failure / reference issue named honestly.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select, Typography } from 'antd';
import type React from 'react';
import { GRPC_IMPORT_PROTO_VALUE } from './method-selector';
import type { GrpcSpecBinding } from './useGrpcSpecBinding';

const { Text } = Typography;

interface GrpcServiceDefinitionTabProps {
  spec: GrpcSpecBinding;
  workspaceId: string | null;
  onLinkSpec: (specUid: string) => void;
  /** Open the hidden .proto file picker (owned by the editor — the
   *  method selector shares it). */
  onImportProto: () => void;
}

const GrpcServiceDefinitionTab: React.FC<GrpcServiceDefinitionTabProps> = ({
  spec,
  workspaceId,
  onLinkSpec,
  onImportProto,
}) => {
  const t = useT();
  const { protobufSpecs, linkedSpec, derivation } = spec;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.grpc.spec.selectLabel')}
        </Text>
        <Select
          style={{ width: '100%' }}
          placeholder={t('workbench.editors.grpc.spec.selectPlaceholder')}
          // null, not undefined — an undefined value flips the antd
          // Select to uncontrolled, so a clicked import action would
          // linger as the label.
          value={linkedSpec?.uid ?? null}
          options={[
            ...protobufSpecs.map((s) => ({ value: s.uid, label: s.name })),
            ...(workspaceId
              ? [
                  {
                    value: GRPC_IMPORT_PROTO_VALUE,
                    label: t('workbench.editors.grpc.method.importProto'),
                  },
                ]
              : []),
          ]}
          onChange={(specUid: string) => {
            if (specUid === GRPC_IMPORT_PROTO_VALUE) {
              onImportProto();
              return;
            }
            onLinkSpec(specUid);
          }}
          data-testid="grpc-spec-select"
        />
      </div>
      {derivation && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.grpc.spec.summary', {
            services: derivation.groups.length,
            methods: derivation.groups.reduce((n, g) => n + g.options.length, 0),
          })}
        </Text>
      )}
      {derivation?.parseFailures.map((failure) => (
        <Text key={failure.path} type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.grpc.spec.parseFailure', {
            path: failure.path,
            message: failure.message,
          })}
        </Text>
      ))}
      {derivation?.issues.map((issue) => (
        <Text key={`${issue.kind}:${issue.scope}:${issue.reference}`} type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.grpc.spec.issue', { kind: issue.kind, reference: issue.reference })}
        </Text>
      ))}
    </div>
  );
};

export default GrpcServiceDefinitionTab;
