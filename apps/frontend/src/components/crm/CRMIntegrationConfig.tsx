import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Alert,
  Divider,
  Typography,
  Row,
  Col,
  Badge,
  Modal,
  Steps,
  List,
  Tag,
  Tooltip,
  message,
  notification,
  Progress,
  Avatar
} from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  TeamOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { crmApi } from '@/lib/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

interface CRMIntegrationConfigProps {
  businessId: string;
  onConfigUpdate?: (config: any) => void;
}

interface CRMConfig {
  provider: string;
  isActive: boolean;
  config: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
    webhookUrl?: string;
  };
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  syncStats?: {
    contacts?: number;
    deals?: number;
    lastSyncAt: Date;
  };
}

export const CRMIntegrationConfig: React.FC<CRMIntegrationConfigProps> = ({
  businessId,
  onConfigUpdate
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedCRM, setSelectedCRM] = useState<string>('');
  const [crmConfigs, setCrmConfigs] = useState<CRMConfig[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [configModalVisible, setConfigModalVisible] = useState(false);

  const crmProviderCatalog = [
    {
      provider: 'HUBSPOT',
      name: 'HubSpot',
      description: 'CRM líder para marketing y ventas con automatización avanzada',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/hubspot/hubspot-original.svg',
      features: ['Marketing Automation', 'Sales Pipeline', 'Email Marketing', 'Analytics', 'Live Chat'],
      pricing: 'Gratis - $3,200/mes',
      isActive: false,
      status: 'disconnected' as const,
      config: {}
    },
    {
      provider: 'SALESFORCE',
      name: 'Salesforce',
      description: 'CRM empresarial más potente del mercado',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/salesforce/salesforce-original.svg',
      features: ['Custom Objects', 'Advanced Analytics', 'AppExchange', 'Lightning Platform', 'AI Einstein'],
      pricing: '$25 - $300/user/mes',
      isActive: false,
      status: 'disconnected' as const,
      config: {}
    },
    {
      provider: 'ZOHO',
      name: 'Zoho CRM',
      description: 'CRM económico y completo para PYMES',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/zoho/zoho-original.svg',
      features: ['Sales Force Automation', 'Inventory Management', 'Analytics', 'Zia AI', 'Multi-channel'],
      pricing: 'Gratis - $45/user/mes',
      isActive: false,
      status: 'disconnected' as const,
      config: {}
    },
    {
      provider: 'META_CRM',
      name: 'Meta CRM',
      description: 'CRM nativo para redes sociales de Meta',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/facebook/facebook-original.svg',
      features: ['Instagram Integration', 'Messenger Integration', 'Social Media Analytics', 'Lead Ads'],
      pricing: 'Gratis con anuncios',
      isActive: false,
      status: 'disconnected' as const,
      config: {}
    }
  ];

  useEffect(() => {
    loadCRMConfigs();
  }, [businessId]);

  const loadCRMConfigs = async () => {
    setLoading(true);
    try {
      const response = await crmApi.getConnection(businessId);
      const connection = response.data;
      
      const configs = crmProviderCatalog.map(crm => {
        const isCurrent = connection.provider === crm.provider;
        const isActive = isCurrent && connection.isActive;
        const configData = isCurrent ? {
          accessToken: connection.accessToken || '',
          refreshToken: connection.refreshToken || '',
          apiKey: connection.apiKey || '',
          apiSecret: connection.apiSecret || '',
          baseUrl: connection.baseUrl || '',
          config: connection.config || {}
        } : {};
        
        return {
          ...crm,
          isActive,
          status: (isCurrent && connection.isConnected) ? ('connected' as const) : ('disconnected' as const),
          config: configData,
          syncStats: (isCurrent && connection.lastSyncAt) ? {
            lastSyncAt: new Date(connection.lastSyncAt)
          } : undefined
        };
      });
      setCrmConfigs(configs);
    } catch (error) {
      message.error('Error al cargar configuraciones de CRM');
    } finally {
      setLoading(false);
    }
  };

  const handleCRMSelect = (provider: string) => {
    setSelectedCRM(provider);
    setConfigModalVisible(true);
    
    const crm = crmConfigs.find(c => c.provider === provider);
    if (crm) {
      form.setFieldsValue({
        provider: crm.provider,
        isActive: crm.isActive,
        ...crm.config
      });
    }
  };

  const handleConfigSave = async (values: any) => {
    setLoading(true);
    try {
      const { provider, ...config } = values;
      
      await crmApi.createConnection(businessId, {
        provider,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        baseUrl: config.baseUrl,
        config: config.config || {},
        syncEnabled: true,
        syncDirection: 'BIDIRECTIONAL'
      });
      
      await loadCRMConfigs();
      setConfigModalVisible(false);
      
      notification.success({
        message: 'Configuración guardada',
        description: `La configuración de ${provider} ha sido guardada exitosamente.`
      });
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (provider: string) => {
    setTesting(true);
    try {
      const response = await crmApi.testConnection(businessId);
      const { success, message: resMessage } = response.data;
      
      if (!success) {
        throw new Error(resMessage || `No se pudo conectar con ${provider}.`);
      }
      
      await loadCRMConfigs();
      
      notification.success({
        message: 'Conexión exitosa',
        description: resMessage || `La conexión con ${provider} ha sido establecida correctamente.`
      });
    } catch (error: any) {
      notification.error({
        message: 'Error de conexión',
        description: error.message || `No se pudo establecer conexión con ${provider}.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncData = async (provider: string) => {
    setSyncing(true);
    try {
      const response = await crmApi.triggerSync(businessId);
      const { success, message: resMessage, synced } = response.data;
      
      if (!success) {
        throw new Error(resMessage || 'Error al sincronizar datos');
      }
      
      await loadCRMConfigs();
      
      notification.success({
        message: 'Sincronización completada',
        description: `Sincronizados: ${synced?.contacts || 0} contactos y ${synced?.leads || 0} oportunidades.`
      });
    } catch (error: any) {
      message.error(error.message || 'Error al sincronizar datos');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleCRM = async (provider: string, isActive: boolean) => {
    try {
      await crmApi.updateConnection(businessId, {
        provider,
        isActive
      });
      
      await loadCRMConfigs();
      
      message.success(
        isActive 
          ? `${provider} ha sido activado` 
          : `${provider} ha sido desactivado`
      );
    } catch (error) {
      message.error('Error al actualizar el estado del CRM');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge status="success" text="Conectado" />;
      case 'disconnected':
        return <Badge status="default" text="Desconectado" />;
      case 'error':
        return <Badge status="error" text="Error" />;
      default:
        return <Badge status="default" text="Desconocido" />;
    }
  };

  const renderConfigForm = (provider: string) => {
    switch (provider) {
      case 'HUBSPOT':
        return (
          <>
            <Form.Item
              name="apiKey"
              label="Client ID"
              rules={[{ required: true, message: 'El Client ID es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="HubSpot Client ID"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="apiSecret"
              label="Client Secret"
              rules={[{ required: true, message: 'El Client Secret es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="HubSpot Client Secret"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="accessToken"
              label="Access Token"
              tooltip="Token de acceso OAuth 2.0"
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="HubSpot Access Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="refreshToken"
              label="Refresh Token"
              tooltip="Token para refrescar el access token"
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="HubSpot Refresh Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>
          </>
        );

      case 'SALESFORCE':
        return (
          <>
            <Form.Item
              name="apiKey"
              label="Consumer Key"
              rules={[{ required: true, message: 'El Consumer Key es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Salesforce Consumer Key"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="apiSecret"
              label="Consumer Secret"
              rules={[{ required: true, message: 'El Consumer Secret es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Salesforce Consumer Secret"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="baseUrl"
              label="Salesforce Instance URL"
              initialValue="https://login.salesforce.com"
              rules={[{ required: true, message: 'La URL de instancia es requerida' }]}
            >
              <Input
                prefix={<GlobalOutlined />}
                placeholder="https://your-instance.salesforce.com"
              />
            </Form.Item>

            <Form.Item
              name="accessToken"
              label="Access Token"
              tooltip="Token de acceso OAuth 2.0"
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Salesforce Access Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="refreshToken"
              label="Refresh Token"
              tooltip="Token para refrescar el access token"
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Salesforce Refresh Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>
          </>
        );

      case 'ZOHO':
        return (
          <>
            <Form.Item
              name="apiKey"
              label="Client ID"
              rules={[{ required: true, message: 'El Client ID es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Zoho Client ID"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="apiSecret"
              label="Client Secret"
              rules={[{ required: true, message: 'El Client Secret es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Zoho Client Secret"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="accessToken"
              label="Access Token"
              tooltip="Token de acceso OAuth 2.0"
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Zoho Access Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="refreshToken"
              label="Refresh Token"
              tooltip="Token para refrescar el access token"
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Zoho Refresh Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>
          </>
        );

      case 'META_CRM':
        return (
          <>
            <Form.Item
              name="apiKey"
              label="Facebook App ID"
              rules={[{ required: true, message: 'El App ID es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Facebook App ID"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="apiSecret"
              label="App Secret"
              rules={[{ required: true, message: 'El App Secret es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Facebook App Secret"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="accessToken"
              label="Access Token"
              rules={[{ required: true, message: 'El Access Token es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="Facebook Access Token"
                type={showSecrets[provider] ? 'text' : 'password'}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    icon={showSecrets[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] })}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="webhookUrl"
              label="Webhook URL"
              initialValue={`https://api.syst.bot/crm/webhooks/meta`}
              tooltip="URL donde Facebook enviará los eventos"
            >
              <Input
                prefix={<LinkOutlined />}
                placeholder="https://api.syst.bot/crm/webhooks/meta"
              />
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <Title level={2}>Configuración de Integraciones CRM</Title>
      
      <Alert
        message="Conecta tus sistemas CRM"
        description="Integra tus sistemas CRM para sincronizar contactos, negocios y automatizar tu proceso de ventas."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Row gutter={[16, 16]}>
        {crmProviderCatalog.map((crm) => {
          const config = crmConfigs.find(c => c.provider === crm.provider);
          
          return (
            <Col xs={24} md={12} key={crm.provider}>
              <Card
                hoverable
                className={`crm-card ${config?.isActive ? 'active' : ''}`}
                actions={[
                  <Button
                    key="config"
                    type="primary"
                    icon={<SettingOutlined />}
                    onClick={() => handleCRMSelect(crm.provider)}
                  >
                    Configurar
                  </Button>,
                  <Button
                    key="test"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleTestConnection(crm.provider)}
                    loading={testing}
                    disabled={!config || config.status !== 'disconnected'}
                  >
                    Probar
                  </Button>,
                  <Button
                    key="sync"
                    icon={<DatabaseOutlined />}
                    onClick={() => handleSyncData(crm.provider)}
                    loading={syncing}
                    disabled={!config || config.status !== 'connected'}
                  >
                    Sincronizar
                  </Button>,
                  <Switch
                    key="toggle"
                    checked={config?.isActive || false}
                    onChange={(checked) => handleToggleCRM(crm.provider, checked)}
                    disabled={config?.status !== 'connected'}
                  />
                ]}
              >
                <Card.Meta
                  avatar={
                    <Avatar
                      src={crm.icon}
                      alt={crm.name}
                      style={{ backgroundColor: '#f56a00' }}
                    />
                  }
                  title={
                    <Space>
                      <span>{crm.name}</span>
                      {getStatusBadge(config?.status || 'disconnected')}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph style={{ marginBottom: '8px' }}>
                        {crm.description}
                      </Paragraph>
                      
                      <div style={{ marginBottom: '8px' }}>
                        <Text strong>Características:</Text>
                        <div style={{ marginTop: '4px' }}>
                          {crm.features.map((feature, index) => (
                            <Tag key={index} style={{ margin: '2px' }}>
                              {feature}
                            </Tag>
                          ))}
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '8px' }}>
                        <Text type="secondary">
                          <InfoCircleOutlined /> Precios: {crm.pricing}
                        </Text>
                      </div>
                      
                      {config?.syncStats && (
                        <div style={{ marginBottom: '8px' }}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {typeof config.syncStats.contacts === 'number' && (
                              <div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  <TeamOutlined /> Contactos: {config.syncStats.contacts}
                                </Text>
                              </div>
                            )}
                            {typeof config.syncStats.deals === 'number' && (
                              <div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  <DatabaseOutlined /> Negocios: {config.syncStats.deals}
                                </Text>
                              </div>
                            )}
                            <div>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                Última sincronización: {config.syncStats.lastSyncAt.toLocaleString()}
                              </Text>
                            </div>
                          </Space>
                        </div>
                      )}
                      
                      {config?.status === 'connected' && (
                        <div style={{ marginTop: '8px' }}>
                          <Progress 
                            percent={100} 
                            size="small" 
                            status="success"
                            format={() => 'Sincronizado'}
                          />
                        </div>
                      )}
                    </div>
                  }
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title={`Configurar ${selectedCRM}`}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleConfigSave}
        >
          <Form.Item name="provider" hidden>
            <Input />
          </Form.Item>

          <Steps current={0} style={{ marginBottom: '24px' }}>
            <Step title="Configuración" icon={<SettingOutlined />} />
            <Step title="Prueba" icon={<PlayCircleOutlined />} />
            <Step title="Sincronización" icon={<DatabaseOutlined />} />
          </Steps>

          {renderConfigForm(selectedCRM)}

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Guardar Configuración
              </Button>
              <Button onClick={() => setConfigModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <style jsx>{`
        .crm-card {
          transition: all 0.3s ease;
        }
        
        .crm-card.active {
          border-color: #52c41a;
          box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.2);
        }
        
        .crm-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

export default CRMIntegrationConfig;
