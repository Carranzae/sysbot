'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Input,
  Button,
  Space,
  Tag,
  Avatar,
  Dropdown,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Badge,
  Table,
  Modal,
  Form,
  Select,
  DatePicker
} from 'antd';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  User,
  MoreHorizontal,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
  CreditCard,
  BarChart3,
  DollarSign,
  Phone,
  Mail,
  Globe
} from 'lucide-react';
import dayjs from 'dayjs';
import ContactsTable from '../crm/ContactsTable';
import DealsTable from '../crm/DealsTable';
import PaymentsTable from '../payment/PaymentsTable';

const { Title } = Typography;
const { Search: AntSearch } = Input;
const { TabPane } = Tabs;

export default function UnifiedCRMDashboard() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [loading, setLoading] = useState(false);
  const [businessId] = useState('demo-business-123');

  // Estadísticas combinadas del CRM
  const [crmStats, setCrmStats] = useState({
    contacts: {
      total: 0,
      customers: 0,
      leads: 0,
      active: 0
    },
    deals: {
      total: 0,
      won: 0,
      inProgress: 0,
      lost: 0,
      totalValue: 0
    },
    payments: {
      total: 0,
      completed: 0,
      pending: 0,
      failed: 0,
      totalAmount: 0
    }
  });

  useEffect(() => {
    loadCRMStats();
  }, []);

  const loadCRMStats = async () => {
    setLoading(true);
    try {
      // Simular carga de estadísticas
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCrmStats({
        contacts: {
          total: 156,
          customers: 89,
          leads: 45,
          active: 67
        },
        deals: {
          total: 78,
          won: 34,
          inProgress: 28,
          lost: 16,
          totalValue: 125000
        },
        payments: {
          total: 234,
          completed: 189,
          pending: 35,
          failed: 10,
          totalAmount: 45680
        }
      });
    } catch (error) {
      message.error('Error al cargar estadísticas del CRM');
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Resumen CRM
        </span>
      ),
      children: (
        <div className="p-6">
          <Title level={2}>Resumen del CRM</Title>
          
          {/* Estadísticas Generales */}
          <Row gutter={[16, 16]} className="mb-8">
            <Col xs={24} sm={12} md={8}>
              <Card className="text-center">
                <Statistic
                  title="Total Contactos"
                  value={crmStats.contacts.total}
                  prefix={<Users className="w-5 h-5 text-blue-500" />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card className="text-center">
                <Statistic
                  title="Total Negocios"
                  value={crmStats.deals.total}
                  prefix={<TrendingUp className="w-5 h-5 text-green-500" />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card className="text-center">
                <Statistic
                  title="Total Pagos"
                  value={crmStats.payments.total}
                  prefix={<CreditCard className="w-5 h-5 text-purple-500" />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Métricas Detalladas */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Métricas de Contactos" className="mb-4">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Clientes"
                      value={crmStats.contacts.customers}
                      prefix={<CheckCircle className="w-4 h-4 text-green-500" />}
                      valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Leads"
                      value={crmStats.contacts.leads}
                      prefix={<AlertCircle className="w-4 h-4 text-orange-500" />}
                      valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Métricas de Negocios" className="mb-4">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Ganados"
                      value={crmStats.deals.won}
                      prefix={<CheckCircle className="w-4 h-4 text-green-500" />}
                      valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="En Progreso"
                      value={crmStats.deals.inProgress}
                      prefix={<Clock className="w-4 h-4 text-blue-500" />}
                      valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                    />
                  </Col>
                </Row>
                <div className="mt-4">
                  <Statistic
                    title="Valor Total de Negocios"
                    value={crmStats.deals.totalValue}
                    prefix={<DollarSign className="w-4 h-4 text-green-600" />}
                    precision={2}
                    valueStyle={{ color: '#52c41a', fontSize: '18px' }}
                  />
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Métricas de Pagos" className="mb-4">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Completados"
                      value={crmStats.payments.completed}
                      prefix={<CheckCircle className="w-4 h-4 text-green-500" />}
                      valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Pendientes"
                      value={crmStats.payments.pending}
                      prefix={<Clock className="w-4 h-4 text-orange-500" />}
                      valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
                    />
                  </Col>
                </Row>
                <div className="mt-4">
                  <Statistic
                    title="Monto Total de Pagos"
                    value={crmStats.payments.totalAmount}
                    prefix={<DollarSign className="w-4 h-4 text-green-600" />}
                    precision={2}
                    valueStyle={{ color: '#52c41a', fontSize: '18px' }}
                  />
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: 'contacts',
      label: (
        <span className="flex items-center gap-2">
          <User className="w-4 h-4" />
          Contactos
        </span>
      ),
      children: <ContactsTable businessId={businessId} />
    },
    {
      key: 'deals',
      label: (
        <span className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Negocios
        </span>
      ),
      children: <DealsTable businessId={businessId} />
    },
    {
      key: 'payments',
      label: (
        <span className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Pagos
        </span>
      ),
      children: <PaymentsTable businessId={businessId} />
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Title level={2} className="mb-2">Dashboard CRM Unificado</Title>
        <p className="text-gray-600">
          Gestión completa de Contactos, Negocios y Pagos en un solo lugar
        </p>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="large"
          items={tabItems}
          className="crm-dashboard-tabs"
        />
      </Card>

      <style jsx>{`
        .crm-dashboard-tabs .ant-tabs-tab {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .crm-dashboard-tabs .ant-tabs-tab-active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-color: #667eea;
        }
        
        .crm-dashboard-tabs .ant-tabs-tab-active span {
          color: white;
        }
      `}</style>
    </div>
  );
}
