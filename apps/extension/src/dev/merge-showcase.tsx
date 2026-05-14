/**
 * Merge editor showcase — bundled developer tool, accessible at
 * `chrome-extension://<id>/merge-showcase.html`. Walks every shape
 * of header-rule conflict (add / delete / modify / reorder + their
 * cross-products) so the merge editor's behavior can be reviewed
 * end-to-end without manually reproducing each case.
 *
 * NOT shipped to end users — kept under `src/dev/` to make the
 * dev-only intent obvious. Bundled into the extension build only
 * because chrome-extension URLs are the easiest way to share a
 * deterministic test surface across machines.
 */

import { App as AntApp, ConfigProvider, Layout, Menu, theme as antdTheme, Typography } from 'antd';
import { type ReactElement, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MergeConflictModal } from '@openheaders/ui/shared/merge-editor';
import { type ShowcaseScenario, SCENARIOS } from './merge-showcase-scenarios';

const { Sider, Content, Header } = Layout;
const { Title, Text, Paragraph } = Typography;

function ShowcaseApp(): ReactElement {
  const [activeId, setActiveId] = useState<string>(SCENARIOS[0].id);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  const active = useMemo<ShowcaseScenario | undefined>(
    () => SCENARIOS.find((s) => s.id === activeId),
    [activeId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, ShowcaseScenario[]>();
    for (const s of SCENARIOS) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, []);

  const session = useMemo(
    () => active?.buildSession(() => setModalOpen(false)),
    [active, modalKey],
  );

  return (
    <ConfigProvider theme={{ algorithm: antdTheme.defaultAlgorithm }}>
      <AntApp>
        <Layout style={{ height: '100vh' }}>
          <Header style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 16px' }}>
            <Title level={4} style={{ margin: '14px 0' }}>
              Merge editor — scenario showcase
            </Title>
          </Header>
          <Layout>
            <Sider width={320} style={{ background: '#fafafa', overflowY: 'auto' }}>
              <Menu
                mode="inline"
                selectedKeys={[activeId]}
                onSelect={(e) => setActiveId(e.key as string)}
                items={Array.from(groups.entries()).map(([category, items]) => ({
                  key: category,
                  type: 'group',
                  label: category,
                  children: items.map((s) => ({ key: s.id, label: s.title })),
                }))}
                style={{ background: 'transparent', borderRight: 'none', paddingTop: 8 }}
              />
            </Sider>
            <Content style={{ padding: 24, overflowY: 'auto' }}>
              {active ? (
                <>
                  <Title level={3}>{active.title}</Title>
                  <Text type="secondary">
                    <code>{active.id}</code> · category: {active.category}
                  </Text>
                  <Paragraph style={{ marginTop: 12, fontSize: 14 }}>{active.description}</Paragraph>
                  <button
                    type="button"
                    style={{
                      padding: '8px 16px',
                      fontSize: 14,
                      cursor: 'pointer',
                      borderRadius: 4,
                      border: '1px solid #1677ff',
                      background: '#1677ff',
                      color: '#fff',
                      marginTop: 8,
                    }}
                    onClick={() => {
                      setModalKey((n) => n + 1);
                      setModalOpen(true);
                    }}
                  >
                    Open merge editor
                  </button>
                </>
              ) : (
                <Text type="secondary">Pick a scenario from the sidebar.</Text>
              )}
            </Content>
          </Layout>
          {modalOpen && session ? (
            <MergeConflictModal
              key={`session-${modalKey}`}
              open={modalOpen}
              session={session}
              surfaceId="merge-showcase"
              onClose={() => setModalOpen(false)}
            />
          ) : null}
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<ShowcaseApp />);
}
