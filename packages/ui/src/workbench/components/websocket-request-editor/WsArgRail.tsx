/**
 * WsArgRail — the Socket.IO compose surface's argument rail: one pill
 * per argument over the same stored arguments-array text, a remove
 * control per pill, and the add-argument affordance.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button } from 'antd';
import type React from 'react';
import type { SocketIoArgs } from './useSocketIoArgs';

interface WsArgRailProps {
  args: SocketIoArgs;
  argTexts: string[];
}

const WsArgRail: React.FC<WsArgRailProps> = ({ args, argTexts }) => {
  const t = useT();
  const { activeArg, setActiveArg, composeArgs } = args;
  return (
    <div
      style={{
        width: 88,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        paddingRight: 8,
        overflow: 'auto',
      }}
      data-testid="ws-arg-rail"
    >
      {argTexts.map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: args are positional by wire contract
          key={index}
          style={{ display: 'flex', alignItems: 'center', gap: 2 }}
        >
          <Button
            size="small"
            type={index === activeArg ? 'default' : 'text'}
            style={{ flex: 1, fontSize: 11, justifyContent: 'flex-start' }}
            onClick={() => setActiveArg(index)}
            data-testid="ws-arg-pill"
          >
            {t('workbench.editors.websocket.event.argTab', { index: index + 1 })}
          </Button>
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined style={{ fontSize: 9 }} />}
            aria-label={t('workbench.editors.websocket.event.removeArg', { index: index + 1 })}
            onClick={() => {
              const next = argTexts.filter((_t, i) => i !== index);
              composeArgs(next);
              setActiveArg((a) => Math.max(0, Math.min(a > index ? a - 1 : a, next.length - 1)));
            }}
            data-testid="ws-arg-remove"
          />
        </div>
      ))}
      <Button
        size="small"
        type="dashed"
        icon={<PlusOutlined style={{ fontSize: 10 }} />}
        style={{ fontSize: 11 }}
        onClick={() => {
          const next = [...(argTexts.length === 0 ? [] : argTexts), '""'];
          composeArgs(next);
          setActiveArg(next.length - 1);
        }}
        data-testid="ws-arg-add"
      >
        {t('workbench.editors.websocket.event.addArg')}
      </Button>
    </div>
  );
};

export default WsArgRail;
