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
  Slider,
  InputNumber,
  Tabs,
  List,
  Tag,
  Tooltip,
  message,
  notification,
  Progress,
  Statistic,
  Timeline,
  Switch as AntSwitch
} from 'antd';
import {
  RobotOutlined,
  SettingOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  UserOutlined,
  PlusOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const iconFixProps = {
  onPointerEnterCapture: undefined,
  onPointerLeaveCapture: undefined,
} as const;

interface AIConfigPanelProps {
  businessId: string;
  onConfigUpdate?: (config: any) => void;
}

interface AIConfig {
  provider: string;
  isActive: boolean;
  settings: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    paymentDetection?: boolean;
    autoResponse?: boolean;
    responseDelay?: number;
    confidenceThreshold?: number;
  };
  status: 'active' | 'inactive' | 'error';
  stats?: {
    totalInteractions: number;
    successfulResponses: number;
    averageResponseTime: number;
    paymentDetections: number;
    lastActivity: Date;
  };
}

export const AIConfigPanel: React.FC<AIConfigPanelProps> = ({
  businessId,
  onConfigUpdate
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [promptModalVisible, setPromptModalVisible] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<any[]>([]);

  // Mock data - En producción vendría de la API
  const mockProviders = [
    {
      provider: 'OPENAI',
      name: 'OpenAI GPT',
      description: 'Modelo de lenguaje más avanzado con capacidades de razonamiento',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/openai/openai-original.svg',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      features: ['Razonamiento avanzado', 'Comprensión contextual', 'Generación creativa', 'Soporte multi-idioma'],
      pricing: '$0.03 - $0.06 / 1K tokens',
      isActive: false,
      status: 'inactive' as const,
      settings: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 500,
        paymentDetection: true,
        autoResponse: true,
        responseDelay: 1,
        confidenceThreshold: 0.8
      }
    },
    {
      provider: 'GOOGLE',
      name: 'Google Gemini',
      description: 'Modelo de Google con capacidades multimodales',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg',
      models: ['gemini-pro', 'gemini-pro-vision'],
      features: ['Procesamiento multimodal', 'Integración con Google', 'Análisis de imágenes', 'Respuestas rápidas'],
      pricing: 'Gratis - $0.00025 / 1K characters',
      isActive: false,
      status: 'inactive' as const,
      settings: {
        model: 'gemini-pro',
        temperature: 0.5,
        maxTokens: 800,
        paymentDetection: true,
        autoResponse: true,
        responseDelay: 0.5,
        confidenceThreshold: 0.7
      }
    },
    {
      provider: 'CLAUDE',
      name: 'Anthropic Claude',
      description: 'Modelo enfocado en seguridad y alineación',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/anthropic/anthropic-original.svg',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      features: ['Seguridad mejorada', 'Contexto largo', 'Razonamiento ético', 'Conversaciones naturales'],
      pricing: '$0.015 - $0.075 / 1K tokens',
      isActive: false,
      status: 'inactive' as const,
      settings: {
        model: 'claude-3-sonnet',
        temperature: 0.6,
        maxTokens: 1000,
        paymentDetection: true,
        autoResponse: true,
        responseDelay: 0.8,
        confidenceThreshold: 0.75
      }
    }
  ];

  const mockPrompts = [
    {
      id: '1',
      name: 'Bienvenida Estándar',
      type: 'welcome',
      content: '¡Hola! Bienvenido a [NEGOCIO]. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
      isActive: true,
      usage: 156
    },
    {
      id: '2',
      name: 'Detección de Pagos',
      type: 'payment',
      content: 'Entiendo que deseas realizar un pago. Por favor, indícame el monto y el concepto del pago para generar el enlace de pago.',
      isActive: true,
      usage: 89
    },
    {
      id: '3',
      name: 'Confirmación de Cita',
      type: 'appointment',
      content: '¡Perfecto! He agendado tu cita para [FECHA] a [HORA]. Te enviaré un recordatorio 30 minutos antes. ¿Hay algo más en lo que pueda ayudarte?',
      isActive: false,
      usage: 45
    }
  ];

  useEffect(() => {
    loadAIConfigs();
    loadCustomPrompts();
  }, [businessId]);

  const loadAIConfigs = async () => {
    try {
      // Simulación de carga de configuraciones
      const configs = mockProviders.map(provider => ({
        ...provider,
        status: 'inactive' as const,
        stats: {
          totalInteractions: Math.floor(Math.random() * 1000),
          successfulResponses: Math.floor(Math.random() * 900),
          averageResponseTime: Math.random() * 2 + 0.5,
          paymentDetections: Math.floor(Math.random() * 100),
          lastActivity: new Date()
        }
      }));
      setAiConfigs(configs);
    } catch (error) {
      message.error('Error al cargar configuraciones de IA');
    }
  };

  const loadCustomPrompts = () => {
    setCustomPrompts(mockPrompts);
  };

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
    setConfigModalVisible(true);
    
    const providerConfig = mockProviders.find(p => p.provider === provider);
    if (providerConfig) {
      form.setFieldsValue({
        provider: providerConfig.provider,
        ...providerConfig.settings
      });
    }
  };

  const handleConfigSave = async (values: any) => {
    setLoading(true);
    try {
      // Simulación de guardado
      const updatedConfigs = aiConfigs.map(config => 
        config.provider === values.provider 
          ? { ...config, settings: { ...config.settings, ...values }, status: 'active' as const }
          : config
      );
      
      setAiConfigs(updatedConfigs);
      setConfigModalVisible(false);
      
      notification.success({
        message: 'Configuración guardada',
        description: `La configuración de ${values.provider} ha sido actualizada exitosamente.`
      });
      
      onConfigUpdate?.(updatedConfigs);
    } catch (error) {
      message.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAI = async (provider: string) => {
    setTesting(true);
    try {
      // Simulación de prueba
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      notification.success({
        message: 'Prueba exitosa',
        description: `El modelo ${provider} está funcionando correctamente.`
      });
    } catch (error) {
      notification.error({
        message: 'Error en la prueba',
        description: `No se pudo probar el modelo ${provider}.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleAI = async (provider: string, isActive: boolean) => {
    try {
      const updatedConfigs = aiConfigs.map(config => 
        config.provider === provider 
          ? { ...config, isActive, status: isActive ? 'active' as const : 'inactive' as const }
          : config
      );
      
      setAiConfigs(updatedConfigs);
      
      message.success(
        isActive 
          ? `${provider} ha sido activado` 
          : `${provider} ha sido desactivado`
      );
      
      onConfigUpdate?.(updatedConfigs);
    } catch (error) {
      message.error('Error al actualizar el estado del modelo');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge status="success" text="Activo" />;
      case 'inactive':
        return <Badge status="default" text="Inactivo" />;
      case 'error':
        return <Badge status="error" text="Error" />;
      default:
        return <Badge status="default" text="Desconocido" />;
    }
  };

  const renderConfigForm = () => (
    <>
      <Form.Item
        name="model"
        label="Modelo"
        rules={[{ required: true, message: 'El modelo es requerido' }]}
      >
        <Select placeholder="Selecciona un modelo">
          {mockProviders.find(p => p.provider === selectedProvider)?.models.map(model => (
            <Select.Option key={model} value={model}>{model}</Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="temperature"
        label="Creatividad (Temperature)"
        tooltip="Controla la aleatoriedad de las respuestas. 0 = determinista, 1 = muy creativo"
      >
        <Slider
          min={0}
          max={1}
          step={0.1}
          marks={{
            0: 'Determinista',
            0.5: 'Balanceado',
            1: 'Creativo'
          }}
        />
      </Form.Item>

      <Form.Item
        name="maxTokens"
        label="Tokens Máximos"
        tooltip="Longitud máxima de las respuestas"
      >
        <InputNumber
          min={100}
          max={4000}
          step={100}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Divider>Opciones de Pagos</Divider>

      <Form.Item
        name="paymentDetection"
        label="Detección Automática de Pagos"
        valuePropName="checked"
      >
        <AntSwitch />
      </Form.Item>

      <Form.Item
        name="autoResponse"
        label="Respuestas Automáticas"
        valuePropName="checked"
      >
        <AntSwitch />
      </Form.Item>

      <Form.Item
        name="responseDelay"
        label="Retardo de Respuesta (segundos)"
        tooltip="Tiempo de espera antes de responder para simular escritura humana"
      >
        <Slider
          min={0}
          max={5}
          step={0.5}
          marks={{
            0: 'Instantáneo',
            2: 'Normal',
            5: 'Lento'
          }}
        />
      </Form.Item>

      <Form.Item
        name="confidenceThreshold"
        label="Umbral de Confianza"
        tooltip="Confianza mínima para responder automáticamente"
      >
        <Slider
          min={0.5}
          max={1}
          step={0.05}
          marks={{
            0.5: 'Bajo',
            0.75: 'Medio',
            1: 'Alto'
          }}
        />
      </Form.Item>
    </>
  );

  return (
    <div>
      <Title level={2}>Configuración de Inteligencia Artificial</Title>
      
      <Alert
        message="Configura tus asistentes de IA"
        description="Personaliza los modelos de IA para mejorar la experiencia de tus clientes y automatizar procesos."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Tabs defaultActiveKey="providers">
        <TabPane tab="Proveedores de IA" key="providers">
          <Row gutter={[16, 16]}>
            {mockProviders.map((provider) => {
              const config = aiConfigs.find(c => c.provider === provider.provider);
              
              return (
                <Col xs={24} md={8} key={provider.provider}>
                  <Card
                    hoverable
                    className={`ai-card ${config?.isActive ? 'active' : ''}`}
                    actions={[
                      <Button
                        key="config"
                        type="primary"
                        icon={<SettingOutlined {...iconFixProps} />}
                        onClick={() => handleProviderSelect(provider.provider)}
                      >
                        Configurar
                      </Button>,
                      <Button
                        key="test"
                        icon={<PlayCircleOutlined {...iconFixProps} />}
                        onClick={() => handleTestAI(provider.provider)}
                        loading={testing}
                      >
                        Probar
                      </Button>,
                      <AntSwitch
                        key="toggle"
                        checked={config?.isActive || false}
                        onChange={(checked) => handleToggleAI(provider.provider, checked)}
                      />
                    ]}
                  >
                    <Card.Meta
                      avatar={
                        <img
                          src={provider.icon}
                          alt={provider.name}
                          style={{ width: 48, height: 48 }}
                        />
                      }
                      title={
                        <Space>
                          <span>{provider.name}</span>
                          {getStatusBadge(config?.status || 'inactive')}
                        </Space>
                      }
                      description={
                        <div>
                          <Paragraph style={{ marginBottom: '8px' }}>
                            {provider.description}
                          </Paragraph>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Text strong>Características:</Text>
                            <div style={{ marginTop: '4px' }}>
                              {provider.features.map((feature, index) => (
                                <Tag key={index} style={{ margin: '2px' }}>
                                  {feature}
                                </Tag>
                              ))}
                            </div>
                          </div>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Text type="secondary">
                              <InfoCircleOutlined {...iconFixProps} /> Precios: {provider.pricing}
                            </Text>
                          </div>
                          
                          {config?.stats && (
                            <div style={{ marginTop: '12px' }}>
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <Statistic
                                  title="Interacciones"
                                  value={config.stats.totalInteractions}
                                  prefix={<MessageOutlined {...iconFixProps} />}
                                  valueStyle={{ fontSize: '14px' }}
                                />
                                <Statistic
                                  title="Tasa de Éxito"
                                  value={config.stats.successfulResponses}
                                  suffix={`/ ${config.stats.totalInteractions}`}
                                  prefix={<CheckCircleOutlined {...iconFixProps} />}
                                  valueStyle={{ fontSize: '14px' }}
                                />
                                <Statistic
                                  title="Detecciones de Pago"
                                  value={config.stats.paymentDetections}
                                  prefix={<DollarCircleOutlined {...iconFixProps} />}
                                  valueStyle={{ fontSize: '14px' }}
                                />
                              </Space>
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
        </TabPane>

        <TabPane tab="Prompts Personalizados" key="prompts">
          <div style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              icon={<PlusOutlined {...iconFixProps} />}
              onClick={() => setPromptModalVisible(true)}
            >
              Nuevo Prompt
            </Button>
          </div>

          <List
            dataSource={customPrompts}
            renderItem={(prompt) => (
              <List.Item
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    icon={<EditOutlined {...iconFixProps} />}
                    onClick={() => {/* Editar prompt */}}
                  />,
                  <Button
                    key="delete"
                    type="text"
                    danger
                    icon={<DeleteOutlined {...iconFixProps} />}
                    onClick={() => {/* Eliminar prompt */}}
                  />,
                  <AntSwitch
                    key="toggle"
                    checked={prompt.isActive}
                    size="small"
                  />
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{prompt.name}</span>
                      <Tag color={prompt.type === 'welcome' ? 'blue' : prompt.type === 'payment' ? 'green' : 'orange'}>
                        {prompt.type}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph ellipsis={{ rows: 2 }}>
                        {prompt.content}
                      </Paragraph>
                      <Text type="secondary">
                        Usado {prompt.usage} veces
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </TabPane>

        <TabPane tab="Estadísticas de IA" key="stats">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Card>
                <Statistic
                  title="Interacciones Totales"
                  value={2547}
                  prefix={<MessageOutlined {...iconFixProps} />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} md={6}>
              <Card>
                <Statistic
                  title="Tasa de Éxito"
                  value={94.2}
                  suffix="%"
                  prefix={<CheckCircleOutlined {...iconFixProps} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} md={6}>
              <Card>
                <Statistic
                  title="Tiempo Promedio"
                  value={1.2}
                  suffix="seg"
                  prefix={<ClockCircleOutlined {...iconFixProps} />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} md={6}>
              <Card>
                <Statistic
                  title="Pagos Detectados"
                  value={156}
                  prefix={<DollarCircleOutlined {...iconFixProps} />}
                  valueStyle={{ color: '#eb2f96' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Actividad Reciente" style={{ marginTop: '16px' }}>
            <Timeline>
              <Timeline.Item color="green">
                Detección de pago automática - Cliente: Juan Pérez - Hace 2 minutos
              </Timeline.Item>
              <Timeline.Item color="blue">
                Respuesta automática generada - Hace 5 minutos
              </Timeline.Item>
              <Timeline.Item color="orange">
                Cambio de modelo a GPT-4 - Hace 1 hora
              </Timeline.Item>
              <Timeline.Item>
                Configuración actualizada - Hace 3 horas
              </Timeline.Item>
            </Timeline>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={`Configurar ${selectedProvider}`}
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

          {renderConfigForm()}

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
        .ai-card {
          transition: all 0.3s ease;
        }
        
        .ai-card.active {
          border-color: #52c41a;
          box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.2);
        }
        
        .ai-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

export default AIConfigPanel;
