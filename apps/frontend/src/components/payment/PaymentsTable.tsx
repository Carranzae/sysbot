import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Input,
  Button,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Modal,
  Form,
  Select,
  DatePicker,
  Badge,
  Dropdown,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Alert,
  Switch
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  UserOutlined,
  MoreOutlined,
  FilterOutlined,
  ExportOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  QrcodeOutlined,
  BankOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { paymentsApi } from '@/lib/api';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface Payment {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';
  gateway: 'STRIPE' | 'IZIPAY' | 'YAPE' | 'PLIN';
  gatewayPaymentId: string;
  description: string;
  paymentUrl?: string;
  qrCode?: string;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
  refundedAt?: string;
  metadata: any;
  businessId: string;
}

interface PaymentsTableProps {
  businessId: string;
}

export const PaymentsTable: React.FC<PaymentsTableProps> = ({ businessId }) => {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    gateway: '',
    dateRange: null as any
  });
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [form] = Form.useForm();



  useEffect(() => {
    loadPayments();
  }, [businessId]);

  useEffect(() => {
    applyFilters();
  }, [payments, filters]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadPayments();
      }, 30000); // Refrescar cada 30 segundos
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, businessId]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentsApi.getAll(businessId);
      const data = response.data.payments || [];
      
      const mapped = data.map((p: any) => {
        const meta = p.metadata || {};
        return {
          id: p.id,
          customerName: p.customerName || meta.customerName || 'Cliente Anónimo',
          customerEmail: p.customerEmail || '',
          customerPhone: p.customerPhone || '',
          amount: Number(p.amount || 0),
          currency: p.currency || 'PEN',
          status: p.status || 'PENDING',
          gateway: p.gateway || 'STRIPE',
          gatewayPaymentId: p.gatewayPaymentId || '',
          description: p.description || meta.description || 'Cobro de servicio',
          paymentUrl: p.paymentUrl || undefined,
          qrCode: p.qrCode || undefined,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt || undefined,
          completedAt: p.status === 'COMPLETED' ? p.updatedAt : undefined,
          refundedAt: p.status === 'REFUNDED' ? p.updatedAt : undefined,
          metadata: meta,
          businessId: p.businessId
        };
      });
      setPayments(mapped);
    } catch (error) {
      message.error('Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...payments];

    // Filtro de búsqueda
    if (filters.search) {
      filtered = filtered.filter(payment =>
        payment.customerName.toLowerCase().includes(filters.search.toLowerCase()) ||
        payment.customerEmail.toLowerCase().includes(filters.search.toLowerCase()) ||
        payment.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        payment.gatewayPaymentId.includes(filters.search)
      );
    }

    // Filtro de estado
    if (filters.status) {
      filtered = filtered.filter(payment => payment.status === filters.status);
    }

    // Filtro de gateway
    if (filters.gateway) {
      filtered = filtered.filter(payment => payment.gateway === filters.gateway);
    }

    // Filtro de rango de fechas
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      filtered = filtered.filter(payment => {
        const paymentDate = dayjs(payment.createdAt);
        return paymentDate.isAfter(start) && paymentDate.isBefore(end);
      });
    }

    setFilteredPayments(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PROCESSING': return 'processing';
      case 'PENDING': return 'processing';
      case 'FAILED': return 'error';
      case 'REFUNDED': return 'warning';
      case 'CANCELLED': return 'default';
      case 'EXPIRED': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Completado';
      case 'PROCESSING': return 'Procesando';
      case 'PENDING': return 'Pendiente';
      case 'FAILED': return 'Fallido';
      case 'REFUNDED': return 'Reembolsado';
      case 'CANCELLED': return 'Cancelado';
      case 'EXPIRED': return 'Expirado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'PROCESSING': return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'PENDING': return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'FAILED': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'REFUNDED': return <DollarCircleOutlined style={{ color: '#fa8c16' }} />;
      case 'CANCELLED': return <ExclamationCircleOutlined style={{ color: '#8c8c8c' }} />;
      case 'EXPIRED': return <ExclamationCircleOutlined style={{ color: '#8c8c8c' }} />;
      default: return <ClockCircleOutlined />;
    }
  };

  const getGatewayIcon = (gateway: string) => {
    switch (gateway) {
      case 'STRIPE': return 'Stripe';
      case 'IZIPAY': return 'IziPay';
      case 'YAPE': return 'Yape';
      case 'PLIN': return 'Plin';
      default: return gateway;
    }
  };

  const getGatewayColor = (gateway: string) => {
    switch (gateway) {
      case 'STRIPE': return 'blue';
      case 'IZIPAY': return 'green';
      case 'YAPE': return 'purple';
      case 'PLIN': return 'orange';
      default: return 'default';
    }
  };

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailModalVisible(true);
  };

  const handleVerifyPayment = async (payment: Payment) => {
    try {
      message.loading('Verificando pago...', 0);
      const response = await paymentsApi.verify(payment.id);
      message.destroy();
      const { result } = response.data;
      if (result && result.status === 'COMPLETED') {
        message.success('El pago ha sido verificado y completado exitosamente.');
      } else {
        message.info(`El pago sigue pendiente o falló (Estado: ${result?.status || 'PENDING'})`);
      }
      loadPayments();
    } catch (error: any) {
      message.destroy();
      message.error(error.response?.data?.message || 'Error al verificar el pago');
    }
  };

  const handleRefundPayment = async (payment: Payment) => {
    Modal.confirm({
      title: '¿Reembolsar pago?',
      content: `¿Estás seguro de que quieres reembolsar S/ ${payment.amount} a ${payment.customerName}?`,
      onOk: async () => {
        try {
          message.loading('Procesando reembolso...', 0);
          const response = await paymentsApi.refund(payment.id, {
            amount: payment.amount,
            reason: 'requested_from_dashboard'
          });

          message.destroy();
          if (response.data?.result?.status === 'REFUNDED') {
            message.success('Reembolso procesado exitosamente');
          } else {
            message.info('Reembolso enviado al gateway. El estado quedo en procesamiento.');
          }
          loadPayments();
        } catch (error: any) {
          message.destroy();
          message.error(error.response?.data?.message || 'Error al procesar reembolso');
        }
      }
    });
  };

  const columns: ColumnsType<Payment> = [
    {
      title: 'Cliente',
      key: 'customer',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{record.customerName}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.customerEmail}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {record.customerPhone}
          </div>
        </div>
      )
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (description) => (
        <Tooltip title={description}>
          <Text>{description}</Text>
        </Tooltip>
      )
    },
    {
      title: 'Monto',
      key: 'amount',
      width: 120,
      render: (_, record) => (
        <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
          S/ {record.amount.toLocaleString()}
        </div>
      ),
      sorter: (a, b) => a.amount - b.amount
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Space>
          {getStatusIcon(status)}
          <Badge status={getStatusColor(status) as any} text={getStatusText(status)} />
        </Space>
      ),
      filters: [
        { text: 'Completado', value: 'COMPLETED' },
        { text: 'Procesando', value: 'PROCESSING' },
        { text: 'Pendiente', value: 'PENDING' },
        { text: 'Fallido', value: 'FAILED' },
        { text: 'Cancelado', value: 'CANCELLED' },
        { text: 'Reembolsado', value: 'REFUNDED' },
        { text: 'Expirado', value: 'EXPIRED' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'Gateway',
      dataIndex: 'gateway',
      key: 'gateway',
      width: 100,
      render: (gateway) => (
        <Tag color={getGatewayColor(gateway)}>
          {getGatewayIcon(gateway)}
        </Tag>
      ),
      filters: [
        { text: 'Stripe', value: 'STRIPE' },
        { text: 'IziPay', value: 'IZIPAY' },
        { text: 'Yape', value: 'YAPE' },
        { text: 'Plin', value: 'PLIN' }
      ],
      onFilter: (value, record) => record.gateway === value
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            {dayjs(date).format('DD/MM/YYYY')}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            {dayjs(date).format('HH:mm')}
          </div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix()
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                icon: <EyeOutlined />,
                label: 'Ver detalles',
                onClick: () => handleViewPayment(record)
              },
              ...(record.status === 'PENDING' ? [
                {
                  key: 'verify',
                  icon: <CheckCircleOutlined />,
                  label: 'Verificar Pago',
                  onClick: () => handleVerifyPayment(record)
                }
              ] : []),
              ...(record.status === 'COMPLETED' ? [
                {
                  key: 'refund',
                  icon: <DollarCircleOutlined />,
                  label: 'Reembolsar',
                  onClick: () => handleRefundPayment(record)
                }
              ] : [])
            ]
          }}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    }
  };

  const stats = {
    total: payments.length,
    completed: payments.filter(p => p.status === 'COMPLETED').length,
    pending: payments.filter(p => p.status === 'PENDING').length,
    failed: payments.filter(p => p.status === 'FAILED').length,
    totalRevenue: payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0),
    pendingRevenue: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0)
  };

  return (
    <div>
      <Title level={2}>Pagos</Title>
      
      {/* Alerta de auto-refresh */}
      {autoRefresh && (
        <Alert
          message="Actualización automática activada"
          description="Los datos se refrescan cada 30 segundos"
          type="info"
          showIcon
          closable
          style={{ marginBottom: '16px' }}
        />
      )}
      
      {/* Estadísticas */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Pagos"
              value={stats.total}
              prefix={<CreditCardOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Completados"
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pendientes"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ingresos"
              value={stats.totalRevenue}
              prefix="S/"
              precision={0}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filtros y acciones */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Search
              placeholder="Buscar pagos..."
              allowClear
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Estado"
              allowClear
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
            >
              <Option value="COMPLETED">Completado</Option>
              <Option value="PROCESSING">Procesando</Option>
              <Option value="PENDING">Pendiente</Option>
              <Option value="FAILED">Fallido</Option>
              <Option value="CANCELLED">Cancelado</Option>
              <Option value="REFUNDED">Reembolsado</Option>
              <Option value="EXPIRED">Expirado</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Gateway"
              allowClear
              value={filters.gateway}
              onChange={(value) => setFilters({ ...filters, gateway: value })}
              style={{ width: '100%' }}
            >
              <Option value="STRIPE">Stripe</Option>
              <Option value="IZIPAY">IziPay</Option>
              <Option value="YAPE">Yape</Option>
              <Option value="PLIN">Plin</Option>
            </Select>
          </Col>
          <Col span={6}>
            <DatePicker.RangePicker
              placeholder={['Fecha inicio', 'Fecha fin']}
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={2}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadPayments}
              loading={loading}
            >
              Recargar
            </Button>
          </Col>
        </Row>
        
        <Row style={{ marginTop: '16px' }}>
          <Col span={12}>
            <Space>
              <Button icon={<ExportOutlined />}>
                Exportar
              </Button>
              {selectedRowKeys.length > 0 && (
                <Button>
                  Acciones ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Text>Auto-refresh:</Text>
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                size="small"
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabla de pagos */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredPayments}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            total: filteredPayments.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} pagos`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Modal de detalles */}
      <Modal
        title={`Detalles del Pago - ${selectedPayment?.customerName}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedPayment && (
          <div>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Monto"
                    value={selectedPayment.amount}
                    prefix="S/"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    {getStatusIcon(selectedPayment.status)}
                    <div style={{ marginTop: '8px' }}>
                      <Text strong>{getStatusText(selectedPayment.status)}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Tag color={getGatewayColor(selectedPayment.gateway)}>
                      {getGatewayIcon(selectedPayment.gateway)}
                    </Tag>
                    <div style={{ marginTop: '8px' }}>
                      <Text strong>{selectedPayment.gateway}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text strong>Cliente:</Text> {selectedPayment.customerName}<br />
                  <Text strong>Email:</Text> {selectedPayment.customerEmail}<br />
                  <Text strong>Teléfono:</Text> {selectedPayment.customerPhone}<br />
                  <Text strong>ID Gateway:</Text> {selectedPayment.gatewayPaymentId}
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>Descripción:</Text><br />
                  <Text>{selectedPayment.description}</Text><br /><br />
                  <Text strong>Fecha Creación:</Text> {dayjs(selectedPayment.createdAt).format('DD/MM/YYYY HH:mm')}<br />
                  {selectedPayment.completedAt && (
                    <>
                      <Text strong>Fecha Completado:</Text> {dayjs(selectedPayment.completedAt).format('DD/MM/YYYY HH:mm')}<br />
                    </>
                  )}
                  {selectedPayment.expiresAt && (
                    <>
                      <Text strong>Fecha Expiración:</Text> {dayjs(selectedPayment.expiresAt).format('DD/MM/YYYY HH:mm')}<br />
                    </>
                  )}
                </div>
              </Col>
            </Row>

            {selectedPayment.paymentUrl && (
              <div style={{ marginTop: '16px' }}>
                <Text strong>URL de Pago:</Text><br />
                <a href={selectedPayment.paymentUrl} target="_blank" rel="noopener noreferrer">
                  {selectedPayment.paymentUrl}
                </a>
              </div>
            )}

            {selectedPayment.qrCode && (
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Text strong>Código QR:</Text><br />
                <img src={selectedPayment.qrCode} alt="QR Code" style={{ maxWidth: '200px' }} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsTable;
