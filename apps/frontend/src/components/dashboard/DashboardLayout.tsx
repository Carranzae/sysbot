import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Badge,
  Button,
  Space,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tabs,
  Alert
} from 'antd';
import ContactsTable from '../crm/ContactsTable';
import DealsTable from '../crm/DealsTable';
import PaymentsTable from '../payment/PaymentsTable';
import {
  DashboardOutlined,
  CreditCardOutlined,
  UserOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarCircleOutlined,
  TeamOutlined,
  MessageOutlined,
  RobotOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface DashboardLayoutProps {
  businessId: string;
  businessName: string;
  onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  businessId,
  businessName,
  onLogout
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [notifications, setNotifications] = useState(3);

  // Mock data - En producción vendría de la API
  const mockData = {
    stats: {
      totalRevenue: 125000,
      revenueGrowth: 23.5,
      conversionRate: 78.2,
      averageTransactionValue: 450,
      pendingPayments: 12,
      completedPayments: 234,
      failedPayments: 3,
      totalCustomers: 156,
      activeCustomers: 142
    },
    recentPayments: [
      {
        id: '1',
        customerName: 'Juan Pérez',
        customerEmail: 'juan@email.com',
        amount: 350,
        currency: 'PEN',
        status: 'COMPLETED',
        gateway: 'STRIPE',
        createdAt: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        customerName: 'María García',
        customerEmail: 'maria@email.com',
        amount: 200,
        currency: 'PEN',
        status: 'PENDING',
        gateway: 'IZIPAY',
        createdAt: '2024-01-15T09:15:00Z'
      },
      {
        id: '3',
        customerName: 'Carlos López',
        customerEmail: 'carlos@email.com',
        amount: 500,
        currency: 'PEN',
        status: 'COMPLETED',
        gateway: 'STRIPE',
        createdAt: '2024-01-15T08:45:00Z'
      }
    ],
    gatewayStats: {
      STRIPE: { count: 180, amount: 85000 },
      IZIPAY: { count: 57, amount: 40000 }
    }
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard Principal'
    },
    {
      key: 'payments',
      icon: <CreditCardOutlined />,
      label: 'Pagos',
      children: [
        { key: 'payments-overview', label: 'Resumen de Pagos' },
        { key: 'payments-automation', label: 'Automatización' },
        { key: 'payments-validation', label: 'Validación' },
        { key: 'payments-gateways', label: 'Gateways' }
      ]
    },
    {
      key: 'crm',
      icon: <UserOutlined />,
      label: 'CRM',
      children: [
        { key: 'crm-contacts', label: 'Contactos' },
        { key: 'crm-deals', label: 'Negocios' },
        { key: 'crm-integrations', label: 'Integraciones' }
      ]
    },
    {
      key: 'ai',
      icon: <RobotOutlined />,
      label: 'IA y Automatización',
      children: [
        { key: 'ai-config', label: 'Configuración IA' },
        { key: 'ai-analytics', label: 'Análisis IA' },
        { key: 'ai-flows', label: 'Flujos Automáticos' }
      ]
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Configuración',
      children: [
        { key: 'settings-business', label: 'Mi Negocio' },
        { key: 'settings-payments', label: 'Configuración Pagos' },
        { key: 'settings-crm', label: 'Configuración CRM' },
        { key: 'settings-notifications', label: 'Notificaciones' }
      ]
    }
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Perfil',
      onClick: () => console.log('Profile clicked')
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Configuración',
      onClick: () => console.log('Settings clicked')
    },
    {
      type: 'divider' as const
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      onClick: onLogout
    }
  ];

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <DashboardContent stats={mockData.stats} />;
      case 'payments-overview':
        return <PaymentsOverview data={mockData} />;
      case 'payments-automation':
        return <PaymentsAutomation />;
      case 'payments-validation':
        return <PaymentsValidation />;
      case 'payments-gateways':
        return <PaymentGateways />;
      case 'crm-contacts':
        return <ContactsTable businessId={businessId} />;
      case 'crm-deals':
        return <DealsTable businessId={businessId} />;
      case 'crm-integrations':
        return <CRMIntegrations />;
      case 'ai-config':
        return <AIConfig />;
      case 'ai-analytics':
        return <AIAnalytics />;
      case 'ai-flows':
        return <AIFlows />;
      case 'settings-business':
        return <BusinessSettings />;
      case 'settings-payments':
        return <PaymentSettings />;
      case 'settings-crm':
        return <CRMSettings />;
      case 'settings-notifications':
        return <NotificationSettings />;
      default:
        return <DashboardContent stats={mockData.stats} />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="dark"
        width={250}
      >
        <div style={{ 
          padding: '16px', 
          textAlign: 'center',
          borderBottom: '1px solid #303030'
        }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            {collapsed ? 'SYST' : 'SYST Dashboard'}
          </Title>
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedMenu]}
          items={menuItems}
          onSelect={({ key }) => setSelectedMenu(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {businessName}
            </Title>
          </div>
          
          <Space size="middle">
            <Badge count={notifications}>
              <Button 
                type="text" 
                icon={<BellOutlined />} 
                size="large"
              />
            </Badge>
            
            <Dropdown 
              menu={{ items: userMenuItems }}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <Text>Administrador</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ 
          margin: '24px',
          padding: '24px',
          background: '#fff',
          borderRadius: '8px'
        }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

// Componentes de contenido
const DashboardContent: React.FC<{ stats: any }> = ({ stats }) => (
  <div>
    <Title level={2}>Dashboard Principal</Title>
    
    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Ingresos Totales"
            value={stats.totalRevenue}
            prefix="S/"
            precision={0}
            valueStyle={{ color: '#3f8600' }}
            suffix={
              <span style={{ fontSize: '14px', color: '#52c41a' }}>
                <ArrowUpOutlined /> +{stats.revenueGrowth}%
              </span>
            }
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Tasa de Conversión"
            value={stats.conversionRate}
            suffix="%"
            precision={1}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Valor Promedio"
            value={stats.averageTransactionValue}
            prefix="S/"
            precision={0}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Clientes Activos"
            value={stats.activeCustomers}
            suffix={`/ ${stats.totalCustomers}`}
            valueStyle={{ color: '#eb2f96' }}
          />
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card title="Pagos Recientes" extra={<Button type="link">Ver todos</Button>}>
          <Table
            dataSource={[]}
            columns={[
              { title: 'Cliente', dataIndex: 'customerName', key: 'customer' },
              { title: 'Monto', dataIndex: 'amount', key: 'amount', render: (val) => `S/ ${val}` },
              { title: 'Estado', dataIndex: 'status', key: 'status', render: (status) => (
                <Tag color={status === 'COMPLETED' ? 'green' : status === 'PENDING' ? 'orange' : 'red'}>
                  {status}
                </Tag>
              )},
              { title: 'Gateway', dataIndex: 'gateway', key: 'gateway' },
              { title: 'Fecha', dataIndex: 'createdAt', key: 'createdAt' }
            ]}
            pagination={false}
          />
        </Card>
      </Col>
      
      <Col xs={24} lg={8}>
        <Card title="Estado de Pagos">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text>Completados</Text>
              <Progress 
                percent={85} 
                status="success" 
                format={() => `${stats.completedPayments}`}
              />
            </div>
            <div>
              <Text>Pendientes</Text>
              <Progress 
                percent={10} 
                status="active" 
                format={() => `${stats.pendingPayments}`}
              />
            </div>
            <div>
              <Text>Fallidos</Text>
              <Progress 
                percent={5} 
                status="exception" 
                format={() => `${stats.failedPayments}`}
              />
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  </div>
);

const PaymentsOverview: React.FC<{ data: any }> = ({ data }) => (
  <div>
    <Title level={2}>Resumen de Pagos</Title>
    <Alert
      message="Sistema de Pagos Activo"
      description="Todos los gateways están funcionando correctamente. La validación automática está habilitada."
      type="success"
      showIcon
      style={{ marginBottom: '24px' }}
    />
    
    <Tabs defaultActiveKey="overview">
      <TabPane tab="Resumen" key="overview">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="Pagos por Gateway">
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(data.gatewayStats).map(([gateway, stats]: [string, any]) => (
                  <div key={gateway}>
                    <Text strong>{gateway}</Text>
                    <div>
                      <Text>{stats.count} transacciones</Text>
                      <Progress 
                        percent={(stats.amount / data.stats.totalRevenue) * 100} 
                        format={() => `S/ ${stats.amount}`}
                      />
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
          
          <Col span={12}>
            <Card title="Métricas Clave">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Statistic title="Ingresos del Mes" value={data.stats.totalRevenue} prefix="S/" />
                <Statistic title="Transacciones Totales" value={data.stats.completedPayments} />
                <Statistic title="Tasa de Éxito" value={95.6} suffix="%" />
                <Statistic title="Tiempo Promedio de Pago" value={2.3} suffix="min" />
              </Space>
            </Card>
          </Col>
        </Row>
      </TabPane>
      
      <TabPane tab="Transacciones" key="transactions">
        <Card title="Historial de Transacciones">
          <Table
            dataSource={data.recentPayments}
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id' },
              { title: 'Cliente', dataIndex: 'customerName', key: 'customer' },
              { title: 'Email', dataIndex: 'customerEmail', key: 'email' },
              { title: 'Monto', dataIndex: 'amount', key: 'amount', render: (val) => `S/ ${val}` },
              { title: 'Estado', dataIndex: 'status', key: 'status' },
              { title: 'Gateway', dataIndex: 'gateway', key: 'gateway' },
              { title: 'Fecha', dataIndex: 'createdAt', key: 'createdAt' }
            ]}
          />
        </Card>
      </TabPane>
    </Tabs>
  </div>
);

// Componentes placeholder para las otras secciones
const PaymentsAutomation = () => (
  <div>
    <Title level={2}>Automatización de Pagos</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const PaymentsValidation = () => (
  <div>
    <Title level={2}>Validación de Pagos</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const PaymentGateways = () => (
  <div>
    <Title level={2}>Configuración de Gateways</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const CRMContacts = () => (
  <div>
    <Title level={2}>Contactos CRM</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const CRMDeals = () => (
  <div>
    <Title level={2}>Negocios CRM</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const CRMIntegrations = () => (
  <div>
    <Title level={2}>Integraciones CRM</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const AIConfig = () => (
  <div>
    <Title level={2}>Configuración de IA</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const AIAnalytics = () => (
  <div>
    <Title level={2}>Análisis de IA</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const AIFlows = () => (
  <div>
    <Title level={2}>Flujos Automáticos</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const BusinessSettings = () => (
  <div>
    <Title level={2}>Configuración del Negocio</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const PaymentSettings = () => (
  <div>
    <Title level={2}>Configuración de Pagos</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const CRMSettings = () => (
  <div>
    <Title level={2}>Configuración de CRM</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

const NotificationSettings = () => (
  <div>
    <Title level={2}>Configuración de Notificaciones</Title>
    <Alert message="En desarrollo" description="Esta funcionalidad estará disponible próximamente." type="info" />
  </div>
);

export default DashboardLayout;
