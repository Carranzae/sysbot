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
import { useBusinessStore } from '@/store/business';
import { contactsApi, leadsApi, paymentsApi } from '@/lib/api';

const { Title } = Typography;
const { Search: AntSearch } = Input;
const { TabPane } = Tabs;

export default function UnifiedCRMDashboard() {
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  const businessId = selectedBusiness?.id || '';
  const [activeTab, setActiveTab] = useState('contacts');
  const [loading, setLoading] = useState(false);

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
  }, [businessId]);

  const loadCRMStats = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [contactsRes, leadsRes, paymentsRes] = await Promise.all([
        contactsApi.getAll(businessId),
        leadsApi.getAll(businessId),
        paymentsApi.getAll(businessId)
      ]);

      const contacts = contactsRes.data || [];
      const leads = leadsRes.data || [];
      const payments = paymentsRes.data.payments || [];

      // Calculate stats
      const contactsTotal = contacts.length;
      const contactsCustomers = contacts.filter((c: any) => (c.metadata?.status || c.status) === 'CUSTOMER').length;
      const contactsLeads = contacts.filter((c: any) => (c.metadata?.status || c.status) === 'LEAD').length;
      const contactsActive = contacts.filter((c: any) => (c.metadata?.status || c.status) !== 'CHURNED').length;

      const dealsTotal = leads.length;
      const dealsWon = leads.filter((l: any) => l.status === 'CONVERTED' || l.metadata?.stage === 'CLOSED_WON').length;
      const dealsInProgress = leads.filter((l: any) => !['CONVERTED', 'LOST'].includes(l.status) && !['CLOSED_WON', 'CLOSED_LOST'].includes(l.metadata?.stage)).length;
      const dealsLost = leads.filter((l: any) => l.status === 'LOST' || l.metadata?.stage === 'CLOSED_LOST').length;
      const dealsTotalValue = leads.reduce((sum: number, l: any) => sum + Number(l.metadata?.amount || 0), 0);

      const paymentsTotal = payments.length;
      const paymentsCompleted = payments.filter((p: any) => p.status === 'COMPLETED').length;
      const paymentsPending = payments.filter((p: any) => p.status === 'PENDING').length;
      const paymentsFailed = payments.filter((p: any) => p.status === 'FAILED').length;
      const paymentsTotalAmount = payments.filter((p: any) => p.status === 'COMPLETED').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      setCrmStats({
        contacts: {
          total: contactsTotal,
          customers: contactsCustomers,
          leads: contactsLeads,
          active: contactsActive
        },
        deals: {
          total: dealsTotal,
          won: dealsWon,
          inProgress: dealsInProgress,
          lost: dealsLost,
          totalValue: dealsTotalValue
        },
        payments: {
          total: paymentsTotal,
          completed: paymentsCompleted,
          pending: paymentsPending,
          failed: paymentsFailed,
          totalAmount: paymentsTotalAmount
        }
      });
    } catch (error) {
      console.error(error);
      message.error('Error al cargar estadísticas reales del CRM');
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
