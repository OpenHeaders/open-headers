/**
 * LandingScreen — one-tab body for the three `general.openTo` variants
 * that are not "last session". Renders home / rules / collections.
 *
 * Every view uses the existing RuleContext as its data source so it
 * stays live when the user creates or deletes rules in another tab.
 */

import {
  ApartmentOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { Button, Card, Col, Empty, Row, Space, Statistic, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '../i18n';
import type { LandingView } from '../types';
import { buildRuleIcon } from './shared/rule-icon';

const { Title, Text, Paragraph } = Typography;

interface LandingScreenProps {
  view: LandingView;
  onCreateRule: (type: string) => void;
  onSelectRule: (uid: string) => void;
  onOpenCollectionOverview: (uid: string, name: string) => void;
  onOpenSettings: () => void;
}

function countRulesIn(nodes: V5.TreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === 'rule') n++;
    else if (node.type === 'folder') n += countRulesIn(node.children);
  }
  return n;
}

// ── Home ─────────────────────────────────────────────────────────────

const HomeView: React.FC<Omit<LandingScreenProps, 'view'>> = ({
  onCreateRule,
  onSelectRule,
  onOpenCollectionOverview,
  onOpenSettings,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { rules, localCollections, localCollectionTrees, templates } = useRules();

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);
  const recentRules = useMemo(() => rules.slice(0, 6), [rules]);
  const ruleCount = (count: number): string =>
    count === 1 ? t('landing.home.ruleCount_one', { count }) : t('landing.home.ruleCount_other', { count });

  return (
    <div style={{ padding: 32, overflowY: 'auto', height: '100%' }}>
      <Title level={2} style={{ marginBottom: 4 }}>
        {t('landing.home.welcomeTitle')}
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        {t('landing.home.welcomeDescription')}
      </Paragraph>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={t('landing.home.stats.rules')} value={rules.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('landing.home.stats.active')}
              value={activeCount}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={t('landing.home.stats.collections')} value={localCollections.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={t('landing.home.stats.templates')} value={templates.length} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('landing.home.quickActions')} size="small">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Button icon={<PlusOutlined />} onClick={() => onCreateRule('header')} block>
                {t('landing.home.newHeaderRule')}
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => onCreateRule('redirect')} block>
                {t('landing.home.newRedirectRule')}
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => onCreateRule('block')} block>
                {t('landing.home.newBlockRule')}
              </Button>
              <Button icon={<SettingOutlined />} onClick={onOpenSettings} block>
                {t('landing.home.openSettings')}
              </Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={
              <>
                <ClockCircleOutlined /> {t('landing.home.recentRules')}
              </>
            }
            size="small"
          >
            {recentRules.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('landing.home.noRules')} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                {recentRules.map((r) => (
                  <Button
                    key={r.uid}
                    type="text"
                    block
                    onClick={() => onSelectRule(r.uid)}
                    style={{ textAlign: 'left' }}
                  >
                    <Space>
                      {buildRuleIcon({ ruleType: r.type, rule: r, isActive: r.enabled })}
                      <span>{r.name}</span>
                    </Space>
                  </Button>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {localCollections.length > 0 && (
        <Card title={t('landing.home.collections')} size="small" style={{ marginTop: 16 }}>
          <Row gutter={[12, 12]}>
            {localCollections.map((c) => {
              const tree = localCollectionTrees.find((tr) => tr.uid === c.uid);
              const count = tree ? countRulesIn(tree.tree) : 0;
              return (
                <Col key={c.uid} xs={24} sm={12} md={8}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => onOpenCollectionOverview(c.uid, c.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Space>
                      <ApartmentOutlined style={{ color: token.colorPrimary }} />
                      <strong>{c.name}</strong>
                    </Space>
                    <div style={{ marginTop: 4, color: token.colorTextTertiary, fontSize: 12 }}>{ruleCount(count)}</div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}
    </div>
  );
};

// ── Rules list ───────────────────────────────────────────────────────

const RulesView: React.FC<Omit<LandingScreenProps, 'view'>> = ({ onCreateRule, onSelectRule }) => {
  const { rules } = useRules();
  const t = useT();

  const columns = useMemo<ColumnsType<V5.Rule>>(
    () => [
      {
        title: '',
        dataIndex: 'type',
        width: 40,
        render: (_type, record) => buildRuleIcon({ ruleType: record.type, rule: record, isActive: record.enabled }),
      },
      {
        title: t('landing.rules.column.name'),
        dataIndex: 'name',
        render: (name: string, record) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => onSelectRule(record.uid)}>
            {name}
          </Button>
        ),
      },
      {
        title: t('landing.rules.column.type'),
        dataIndex: 'type',
        width: 140,
        render: (type: string) => <Tag>{type}</Tag>,
      },
      {
        title: t('landing.rules.column.status'),
        dataIndex: 'enabled',
        width: 100,
        render: (enabled: boolean) =>
          enabled ? (
            <Tag color="success">{t('landing.rules.status.active')}</Tag>
          ) : (
            <Tag color="default">{t('landing.rules.status.disabled')}</Tag>
          ),
      },
    ],
    [onSelectRule, t],
  );

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('landing.rules.title')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onCreateRule('header')}>
          {t('landing.rules.newRule')}
        </Button>
      </Space>
      <Table<V5.Rule>
        rowKey="uid"
        columns={columns}
        dataSource={rules}
        size="small"
        pagination={rules.length > 20 ? { pageSize: 20 } : false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('landing.home.noRules')} /> }}
      />
    </div>
  );
};

// ── Collections list ─────────────────────────────────────────────────

const CollectionsView: React.FC<Omit<LandingScreenProps, 'view'>> = ({ onOpenCollectionOverview }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { localCollections, localCollectionTrees } = useRules();
  const ruleCount = (count: number): string =>
    count === 1 ? t('landing.home.ruleCount_one', { count }) : t('landing.home.ruleCount_other', { count });

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        {t('landing.collections.title')}
      </Title>
      {localCollections.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('landing.collections.empty')} />
      ) : (
        <Row gutter={[16, 16]}>
          {localCollections.map((c) => {
            const tree = localCollectionTrees.find((tr) => tr.uid === c.uid);
            const count = tree ? countRulesIn(tree.tree) : 0;
            return (
              <Col key={c.uid} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => onOpenCollectionOverview(c.uid, c.name)}
                  style={{ cursor: 'pointer', height: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <FolderOpenOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
                      <strong style={{ fontSize: 15 }}>{c.name}</strong>
                    </Space>
                    {c.description && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {c.description}
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {ruleCount(count)}
                    </Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

// ── Router ───────────────────────────────────────────────────────────

const LandingScreen: React.FC<LandingScreenProps> = (props) => {
  if (props.view === 'rules') return <RulesView {...props} />;
  if (props.view === 'collections') return <CollectionsView {...props} />;
  return <HomeView {...props} />;
};

export default LandingScreen;
