/**
 * MqttSpecTab — the AsyncAPI binding surface: link a workspace
 * AsyncAPI spec, the census summary, the channel browser (pick a
 * message row to land its synthesized example on the compose surface;
 * a channel-scoped pick also prefills the publish topic), and every
 * parse failure / census issue named honestly.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select, Tree, Typography } from 'antd';
import type React from 'react';
import type { MqttComposeAids } from './useMqttComposeAids';

const { Text } = Typography;

interface MqttSpecTabProps {
  aids: MqttComposeAids;
  onLinkSpec: (specUid: string) => void;
}

const MqttSpecTab: React.FC<MqttSpecTabProps> = ({ aids, onLinkSpec }) => {
  const t = useT();
  const { asyncapiSpecs, linkedSpec, census, browserTree, handleBrowserSelect } = aids;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.mqtt.spec.selectLabel')}
        </Text>
        <Select
          style={{ width: '100%' }}
          placeholder={t('workbench.editors.mqtt.spec.selectPlaceholder')}
          value={linkedSpec?.uid}
          options={asyncapiSpecs.map((s) => ({ value: s.uid, label: s.name }))}
          onChange={onLinkSpec}
          data-testid="mqtt-spec-select"
        />
      </div>
      {census.census && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.spec.summary', {
            servers: census.census.servers.length,
            channels: census.census.channels.length,
            operations: census.census.operations.length,
          })}
        </Text>
      )}
      {browserTree.length > 0 && (
        <div data-testid="mqtt-asyncapi-browser">
          {/* Pick a message row to land its synthesized example on the
            compose surface (a channel-scoped pick also prefills the
            publish topic with the channel address). */}
          <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
            {t('workbench.editors.mqtt.spec.browser.hint')}
          </Text>
          <Tree
            treeData={browserTree}
            showIcon
            defaultExpandAll
            selectedKeys={[]}
            onSelect={handleBrowserSelect}
            blockNode
          />
        </div>
      )}
      {census.parseError !== null && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.spec.parseFailure', { message: census.parseError })}
        </Text>
      )}
      {census.census?.issues.map((issue) => (
        <Text key={`${issue.kind}:${issue.reference}`} type="warning" style={{ fontSize: 11 }}>
          {`${issue.kind}: ${issue.reference}`}
        </Text>
      ))}
    </div>
  );
};

export default MqttSpecTab;
