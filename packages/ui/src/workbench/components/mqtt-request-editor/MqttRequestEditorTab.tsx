/**
 * MqttRequestEditorTab — the `mqtt-edit` tab body: resolves the tab's
 * uid to the live MqttRequest and mounts the editor over it, or the
 * not-found panel when the request is gone (deleted, or the outgoing
 * workspace's tab rendering against the incoming workspace's data for
 * the frame before the tab session resyncs). The editor takes the
 * entity, so its hook chain never forks on absence.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type React from 'react';
import { useMemo } from 'react';
import EditorNotFound from '../shared/EditorNotFound';
import MqttRequestEditor, { type MqttRequestEditorProps } from './MqttRequestEditor';

interface MqttRequestEditorTabProps extends Omit<MqttRequestEditorProps, 'entity'> {
  mqttRequestUid: string;
}

const MqttRequestEditorTab: React.FC<MqttRequestEditorTabProps> = ({ mqttRequestUid, ...editorProps }) => {
  const t = useT();
  const { mqttRequests } = useRequests();
  const entity = useMemo(
    () => mqttRequests.find((r) => r.uid === mqttRequestUid) ?? null,
    [mqttRequests, mqttRequestUid],
  );
  if (entity === null) return <EditorNotFound message={t('workbench.editors.mqtt.notFound')} />;
  return <MqttRequestEditor entity={entity} {...editorProps} />;
};

export default MqttRequestEditorTab;
