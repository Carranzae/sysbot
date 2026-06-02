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
  notification
} from 'antd';
import {
  CreditCardOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

interface PaymentGatewayConfigProps {
  businessId: string;
  onConfigUpdate?: (config: any) => void;
}

interface GatewayConfig {
  provider: string;
  isActive: boolean;
  config: {
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
    webhookUrl?: string;
    stripeAccountId?: string;
    izipayMerchantId?: string;
  };
  status: 'connected' | 'disconnected' | 'error';
  lastTest?: Date;
}

export const PaymentGatewayConfig: React.FC<PaymentGatewayConfigProps> = ({
  businessId,
  onConfigUpdate
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [gatewayConfigs, setGatewayConfigs] = useState<GatewayConfig[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [configModalVisible, setConfigModalVisible] = useState(false);

  // Mock data - En producción vendría de la API
  const mockGateways = [
    {
      provider: 'STRIPE',
      name: 'Stripe',
      description: 'Gateway global con soporte para tarjetas, Yape y Plin',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/stripe/stripe-original.svg',
      features: ['Tarjetas crédito/débito', 'Yape', 'Plin', 'Apple Pay', 'Google Pay'],
      fees: '2.9% + S/. 0.30',
      isActive: false,
      status: 'disconnected' as const,
      config: {}
    },
    {
      provider: 'IZIPAY',
      name: 'IziPay',
      description: 'Gateway peruano especializado en métodos locales',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Izipay_logo.svg/256px-Izipay_logo.svg.png',
      features: ['Yape', 'Plin', 'Transferencias', 'Tarjetas', 'Cuotas hasta 12 meses'],
      fees: '3.5% + S/. 0.50',
      isActive: false,
      status: 'disconnected' as const,
      config: {}
    }
  ];

  useEffect(() => {
    loadGatewayConfigs();
  }, [businessId]);

  const loadGatewayConfigs = async () => {
    try {
      // Simulación de carga de configuraciones
      const configs = mockGateways.map(gateway => ({
        ...gateway,
        isActive: false,
        status: 'disconnected' as const,
        config: {}
      }));
      setGatewayConfigs(configs);
    } catch (error) {
      message.error('Error al cargar configuraciones de gateways');
    }
  };

  const handleGatewaySelect = (provider: string) => {
    setSelectedGateway(provider);
    setConfigModalVisible(true);
    
    const gateway = mockGateways.find(g => g.provider === provider);
    if (gateway) {
      form.setFieldsValue({
        provider: gateway.provider,
        isActive: false,
        ...gateway.config
      });
    }
  };

  const handleConfigSave = async (values: any) => {
    setLoading(true);
    try {
      // Simulación de guardado
      const updatedConfigs = gatewayConfigs.map(config => 
        config.provider === values.provider 
          ? { ...config, ...values, status: 'disconnected' as const }
          : config
      );
      
      setGatewayConfigs(updatedConfigs);
      setConfigModalVisible(false);
      
      notification.success({
        message: 'Configuración guardada',
        description: `La configuración de ${values.provider} ha sido guardada exitosamente.`
      });
      
      onConfigUpdate?.(updatedConfigs);
    } catch (error) {
      message.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (provider: string) => {
    setTesting(true);
    try {
      // Simulación de prueba de conexión
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedConfigs = gatewayConfigs.map(config => 
        config.provider === provider 
          ? { ...config, status: 'connected' as const, lastTest: new Date() }
          : config
      );
      
      setGatewayConfigs(updatedConfigs);
      
      notification.success({
        message: 'Conexión exitosa',
        description: `La conexión con ${provider} ha sido establecida correctamente.`
      });
    } catch (error) {
      notification.error({
        message: 'Error de conexión',
        description: `No se pudo establecer conexión con ${provider}.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleGateway = async (provider: string, isActive: boolean) => {
    try {
      const updatedConfigs = gatewayConfigs.map(config => 
        config.provider === provider 
          ? { ...config, isActive }
          : config
      );
      
      setGatewayConfigs(updatedConfigs);
      
      message.success(
        isActive 
          ? `${provider} ha sido activado` 
          : `${provider} ha sido desactivado`
      );
      
      onConfigUpdate?.(updatedConfigs);
    } catch (error) {
      message.error('Error al actualizar el estado del gateway');
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
      case 'STRIPE':
        return (
          <>
            <Form.Item
              name="apiKey"
              label="API Key (Public Key)"
              rules={[{ required: true, message: 'La API Key es requerida' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="pk_test_..."
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
              label="Secret Key"
              rules={[{ required: true, message: 'La Secret Key es requerida' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="sk_test_..."
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
              name="webhookSecret"
              label="Webhook Secret"
              tooltip="Opcional pero recomendado para seguridad"
            >
              <Input
                prefix={<LinkOutlined />}
                placeholder="whsec_..."
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
              initialValue={`https://api.syst.bot/payments/webhooks/stripe`}
              tooltip="URL donde Stripe enviará los eventos de pago"
            >
              <Input
                prefix={<LinkOutlined />}
                placeholder="https://api.syst.bot/payments/webhooks/stripe"
              />
            </Form.Item>
          </>
        );

      case 'IZIPAY':
        return (
          <>
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[{ required: true, message: 'La API Key es requerida' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="IZIPAY_API_KEY"
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
              label="API Secret"
              rules={[{ required: true, message: 'El API Secret es requerido' }]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="IZIPAY_API_SECRET"
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
              name="izipayMerchantId"
              label="Merchant ID"
              rules={[{ required: true, message: 'El Merchant ID es requerido' }]}
            >
              <Input
                prefix={<SettingOutlined />}
                placeholder="merchant_123456789"
              />
            </Form.Item>

            <Form.Item
              name="webhookUrl"
              label="Webhook URL"
              initialValue={`https://api.syst.bot/payments/webhooks/izipay`}
              tooltip="URL donde IziPay enviará los eventos de pago"
            >
              <Input
                prefix={<LinkOutlined />}
                placeholder="https://api.syst.bot/payments/webhooks/izipay"
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
      <Title level={2}>Configuración de Gateways de Pago</Title>
      
      <Alert
        message="Configura tus métodos de pago"
        description="Activa y configura los gateways de pago para comenzar a recibir pagos automáticos."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Row gutter={[16, 16]}>
        {mockGateways.map((gateway) => {
          const config = gatewayConfigs.find(c => c.provider === gateway.provider);
          
          return (
            <Col xs={24} md={12} key={gateway.provider}>
              <Card
                hoverable
                className={`gateway-card ${config?.isActive ? 'active' : ''}`}
                actions={[
                  <Button
                    key="config"
                    type="primary"
                    icon={<SettingOutlined />}
                    onClick={() => handleGatewaySelect(gateway.provider)}
                  >
                    Configurar
                  </Button>,
                  <Button
                    key="test"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleTestConnection(gateway.provider)}
                    loading={testing}
                    disabled={!config || config.status !== 'disconnected'}
                  >
                    Probar
                  </Button>,
                  <Switch
                    key="toggle"
                    checked={config?.isActive || false}
                    onChange={(checked) => handleToggleGateway(gateway.provider, checked)}
                    disabled={config?.status !== 'connected'}
                  />
                ]}
              >
                <Card.Meta
                  avatar={
                    <img
                      src={gateway.icon}
                      alt={gateway.name}
                      style={{ width: 48, height: 48 }}
                    />
                  }
                  title={
                    <Space>
                      <span>{gateway.name}</span>
                      {getStatusBadge(config?.status || 'disconnected')}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph style={{ marginBottom: '8px' }}>
                        {gateway.description}
                      </Paragraph>
                      
                      <div style={{ marginBottom: '8px' }}>
                        <Text strong>Características:</Text>
                        <div style={{ marginTop: '4px' }}>
                          {gateway.features.map((feature, index) => (
                            <Tag key={index} style={{ margin: '2px' }}>
                              {feature}
                            </Tag>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Text type="secondary">
                          <InfoCircleOutlined /> Tarifa: {gateway.fees}
                        </Text>
                      </div>
                      
                      {config?.lastTest && (
                        <div style={{ marginTop: '8px' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Última prueba: {config.lastTest.toLocaleString()}
                          </Text>
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
        title={`Configurar ${selectedGateway}`}
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
            <Step title="Activación" icon={<CheckCircleOutlined />} />
          </Steps>

          {renderConfigForm(selectedGateway)}

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
        .gateway-card {
          transition: all 0.3s ease;
        }
        
        .gateway-card.active {
          border-color: #52c41a;
          box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.2);
        }
        
        .gateway-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

export default PaymentGatewayConfig;
