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
  InputNumber,
  Progress,
  Badge,
  Dropdown,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Timeline,
  Divider
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  MoreOutlined,
  FilterOutlined,
  ExportOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

interface Deal {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  amount: number;
  currency: string;
  stage: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
  probability: number;
  expectedCloseDate: string;
  actualCloseDate?: string;
  assignedTo: string;
  source: string;
  description: string;
  tags: string[];
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'PAYMENT' | 'TASK';
  description: string;
  createdAt: string;
  createdBy: string;
}

interface DealsTableProps {
  businessId: string;
}

export const DealsTable: React.FC<DealsTableProps> = ({ businessId }) => {
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    stage: '',
    assignedTo: '',
    dateRange: null as any
  });
  const [dealModalVisible, setDealModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [form] = Form.useForm();

  // Mock data - En producción vendría de la API
  const mockDeals: Deal[] = [
    {
      id: '1',
      name: 'Consultoría SEO - Tech Solutions',
      contactId: '1',
      contactName: 'Juan Pérez',
      contactEmail: 'juan.perez@email.com',
      amount: 5000,
      currency: 'PEN',
      stage: 'CLOSED_WON',
      probability: 100,
      expectedCloseDate: '2024-01-20T00:00:00Z',
      actualCloseDate: '2024-01-18T15:30:00Z',
      assignedTo: 'Ana García',
      source: 'WHATSAPP',
      description: 'Paquete completo de optimización SEO para sitio web corporativo',
      tags: ['SEO', 'Consultoría', 'VIP'],
      activities: [
        {
          id: '1',
          type: 'CALL',
          description: 'Llamada inicial con cliente',
          createdAt: '2024-01-10T10:00:00Z',
          createdBy: 'Ana García'
        },
        {
          id: '2',
          type: 'MEETING',
          description: 'Reunión de presentación',
          createdAt: '2024-01-12T14:00:00Z',
          createdBy: 'Ana García'
        },
        {
          id: '3',
          type: 'PAYMENT',
          description: 'Pago recibido - S/ 5,000',
          createdAt: '2024-01-18T15:30:00Z',
          createdBy: 'Sistema'
        }
      ],
      createdAt: '2024-01-08T09:00:00Z',
      updatedAt: '2024-01-18T15:30:00Z'
    },
    {
      id: '2',
      name: 'Marketing Digital - Marketing Digital LTDA',
      contactId: '2',
      contactName: 'María García',
      contactEmail: 'maria.garcia@email.com',
      amount: 3500,
      currency: 'PEN',
      stage: 'PROPOSAL',
      probability: 75,
      expectedCloseDate: '2024-01-25T00:00:00Z',
      assignedTo: 'Carlos López',
      source: 'INSTAGRAM',
      description: 'Campaña completa de marketing digital para redes sociales',
      tags: ['Marketing', 'Social Media', 'Propuesta'],
      activities: [
        {
          id: '4',
          type: 'EMAIL',
          description: 'Envío de propuesta comercial',
          createdAt: '2024-01-15T11:00:00Z',
          createdBy: 'Carlos López'
        }
      ],
      createdAt: '2024-01-12T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z'
    },
    {
      id: '3',
      name: 'Desarrollo Web - Consultoría ABC',
      contactId: '3',
      contactName: 'Carlos López',
      contactEmail: 'carlos.lopez@email.com',
      amount: 8000,
      currency: 'PEN',
      stage: 'NEGOTIATION',
      probability: 60,
      expectedCloseDate: '2024-02-01T00:00:00Z',
      assignedTo: 'Ana García',
      source: 'WEB',
      description: 'Desarrollo de sitio web e-commerce con integración de pagos',
      tags: ['Desarrollo', 'E-commerce', 'Negociación'],
      activities: [
        {
          id: '5',
          type: 'MEETING',
          description: 'Reunión de negociación',
          createdAt: '2024-01-14T16:00:00Z',
          createdBy: 'Ana García'
        }
      ],
      createdAt: '2024-01-10T14:00:00Z',
      updatedAt: '2024-01-14T16:00:00Z'
    },
    {
      id: '4',
      name: 'Mantenimiento Sistema - StartUp Tech',
      contactId: '5',
      contactName: 'Roberto Silva',
      contactEmail: 'roberto.silva@email.com',
      amount: 1500,
      currency: 'PEN',
      stage: 'QUALIFIED',
      probability: 40,
      expectedCloseDate: '2024-01-30T00:00:00Z',
      assignedTo: 'Carlos López',
      source: 'MANUAL',
      description: 'Servicio de mantenimiento mensual para sistema interno',
      tags: ['Mantenimiento', 'Soporte', 'Mensual'],
      activities: [
        {
          id: '6',
          type: 'CALL',
          description: 'Llamada de calificación',
          createdAt: '2024-01-13T10:30:00Z',
          createdBy: 'Carlos López'
        }
      ],
      createdAt: '2024-01-11T09:00:00Z',
      updatedAt: '2024-01-13T10:30:00Z'
    },
    {
      id: '5',
      name: 'Capacitación Equipo - Ana Martínez',
      contactId: '4',
      contactName: 'Ana Martínez',
      contactEmail: 'ana.martinez@email.com',
      amount: 2000,
      currency: 'PEN',
      stage: 'CLOSED_LOST',
      probability: 0,
      expectedCloseDate: '2023-12-20T00:00:00Z',
      actualCloseDate: '2023-12-20T10:00:00Z',
      assignedTo: 'Carlos López',
      source: 'TELEGRAM',
      description: 'Capacitación en uso de herramientas digitales',
      tags: ['Capacitación', 'Perdido'],
      activities: [
        {
          id: '7',
          type: 'NOTE',
          description: 'Cliente decidió no continuar',
          createdAt: '2023-12-20T10:00:00Z',
          createdBy: 'Carlos López'
        }
      ],
      createdAt: '2023-11-20T14:00:00Z',
      updatedAt: '2023-12-20T10:00:00Z'
    }
  ];

  useEffect(() => {
    loadDeals();
  }, [businessId]);

  useEffect(() => {
    applyFilters();
  }, [deals, filters]);

  const loadDeals = async () => {
    setLoading(true);
    try {
      // Simulación de carga desde API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDeals(mockDeals);
    } catch (error) {
      message.error('Error al cargar negocios');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...deals];

    // Filtro de búsqueda
    if (filters.search) {
      filtered = filtered.filter(deal =>
        deal.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        deal.contactName.toLowerCase().includes(filters.search.toLowerCase()) ||
        deal.description.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Filtro de etapa
    if (filters.stage) {
      filtered = filtered.filter(deal => deal.stage === filters.stage);
    }

    // Filtro de asignado
    if (filters.assignedTo) {
      filtered = filtered.filter(deal => deal.assignedTo === filters.assignedTo);
    }

    // Filtro de rango de fechas
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      filtered = filtered.filter(deal => {
        const dealDate = dayjs(deal.createdAt);
        return dealDate.isAfter(start) && dealDate.isBefore(end);
      });
    }

    setFilteredDeals(filtered);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'CLOSED_WON': return 'green';
      case 'CLOSED_LOST': return 'red';
      case 'NEGOTIATION': return 'orange';
      case 'PROPOSAL': return 'blue';
      case 'QUALIFIED': return 'purple';
      case 'LEAD': return 'default';
      default: return 'default';
    }
  };

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'CLOSED_WON': return 'Ganado';
      case 'CLOSED_LOST': return 'Perdido';
      case 'NEGOTIATION': return 'Negociación';
      case 'PROPOSAL': return 'Propuesta';
      case 'QUALIFIED': return 'Calificado';
      case 'LEAD': return 'Lead';
      default: return stage;
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'CLOSED_WON': return <TrophyOutlined style={{ color: '#52c41a' }} />;
      case 'CLOSED_LOST': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'NEGOTIATION': return <ClockCircleOutlined style={{ color: '#fa8c16' }} />;
      case 'PROPOSAL': return <DollarCircleOutlined style={{ color: '#1890ff' }} />;
      case 'QUALIFIED': return <CheckCircleOutlined style={{ color: '#722ed1' }} />;
      case 'LEAD': return <UserOutlined style={{ color: '#8c8c8c' }} />;
      default: return <UserOutlined />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CALL': return 'Teléfono';
      case 'EMAIL': return 'Email';
      case 'MEETING': return 'Reunión';
      case 'NOTE': return 'Nota';
      case 'PAYMENT': return 'Pago';
      case 'TASK': return 'Tarea';
      default: return type;
    }
  };

  const handleEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    form.setFieldsValue(deal);
    setDealModalVisible(true);
  };

  const handleDeleteDeal = (deal: Deal) => {
    Modal.confirm({
      title: '¿Eliminar negocio?',
      content: `¿Estás seguro de que quieres eliminar el negocio "${deal.name}"?`,
      onOk: () => {
        setDeals(deals.filter(d => d.id !== deal.id));
        message.success('Negocio eliminado');
      }
    });
  };

  const handleViewDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setDetailModalVisible(true);
  };

  const handleSaveDeal = async (values: any) => {
    try {
      if (editingDeal) {
        // Editar negocio existente
        setDeals(deals.map(d => 
          d.id === editingDeal.id ? { ...d, ...values, updatedAt: new Date().toISOString() } : d
        ));
        message.success('Negocio actualizado');
      } else {
        // Crear nuevo negocio
        const newDeal: Deal = {
          ...values,
          id: Date.now().toString(),
          activities: [],
          probability: values.probability || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setDeals([...deals, newDeal]);
        message.success('Negocio creado');
      }
      setDealModalVisible(false);
      setEditingDeal(null);
      form.resetFields();
    } catch (error) {
      message.error('Error al guardar negocio');
    }
  };

  const columns: ColumnsType<Deal> = [
    {
      title: 'Negocio',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.contactName}
          </div>
        </div>
      )
    },
    {
      title: 'Contacto',
      key: 'contact',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
            {record.contactName}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {record.contactEmail}
          </div>
        </div>
      )
    },
    {
      title: 'Etapa',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (stage) => (
        <Space>
          {getStageIcon(stage)}
          <Tag color={getStageColor(stage)}>
            {getStageText(stage)}
          </Tag>
        </Space>
      ),
      filters: [
        { text: 'Lead', value: 'LEAD' },
        { text: 'Calificado', value: 'QUALIFIED' },
        { text: 'Propuesta', value: 'PROPOSAL' },
        { text: 'Negociación', value: 'NEGOTIATION' },
        { text: 'Ganado', value: 'CLOSED_WON' },
        { text: 'Perdido', value: 'CLOSED_LOST' }
      ],
      onFilter: (value, record) => record.stage === value
    },
    {
      title: 'Monto',
      key: 'amount',
      width: 120,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
            S/ {record.amount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {record.probability}% probabilidad
          </div>
        </div>
      ),
      sorter: (a, b) => a.amount - b.amount
    },
    {
      title: 'Cierre Estimado',
      dataIndex: 'expectedCloseDate',
      key: 'expectedCloseDate',
      width: 120,
      render: (date) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            {dayjs(date).format('DD/MM/YYYY')}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            {dayjs(date).format('hace X días')}
          </div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.expectedCloseDate).unix() - dayjs(b.expectedCloseDate).unix()
    },
    {
      title: 'Asignado a',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
      render: (assignedTo) => (
        <Badge text={assignedTo} />
      )
    },
    {
      title: 'Etiquetas',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags) => (
        <div>
          {tags.map((tag: string, index: number) => (
            <Tag key={index} style={{ margin: '1px' }}>
              {tag}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Actualización',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 100,
      render: (date) => (
        <div style={{ fontSize: '11px', color: '#666' }}>
          {dayjs(date).format('DD/MM HH:mm')}
        </div>
      ),
      sorter: (a, b) => dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix()
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
                onClick: () => handleViewDeal(record)
              },
              {
                key: 'edit',
                icon: <EditOutlined />,
                label: 'Editar',
                onClick: () => handleEditDeal(record)
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Eliminar',
                danger: true,
                onClick: () => handleDeleteDeal(record)
              }
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
    total: deals.length,
    won: deals.filter(d => d.stage === 'CLOSED_WON').length,
    lost: deals.filter(d => d.stage === 'CLOSED_LOST').length,
    pipeline: deals.filter(d => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage)).reduce((sum, d) => sum + d.amount, 0),
    revenue: deals.filter(d => d.stage === 'CLOSED_WON').reduce((sum, d) => sum + d.amount, 0)
  };

  return (
    <div>
      <Title level={2}>Negocios y Oportunidades</Title>
      
      {/* Estadísticas */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Negocios"
              value={stats.total}
              prefix={<DollarCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ganados"
              value={stats.won}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pipeline"
              value={stats.pipeline}
              prefix="S/"
              precision={0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ingresos"
              value={stats.revenue}
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
              placeholder="Buscar negocios..."
              allowClear
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Etapa"
              allowClear
              value={filters.stage}
              onChange={(value) => setFilters({ ...filters, stage: value })}
              style={{ width: '100%' }}
            >
              <Option value="LEAD">Lead</Option>
              <Option value="QUALIFIED">Calificado</Option>
              <Option value="PROPOSAL">Propuesta</Option>
              <Option value="NEGOTIATION">Negociación</Option>
              <Option value="CLOSED_WON">Ganado</Option>
              <Option value="CLOSED_LOST">Perdido</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Asignado a"
              allowClear
              value={filters.assignedTo}
              onChange={(value) => setFilters({ ...filters, assignedTo: value })}
              style={{ width: '100%' }}
            >
              <Option value="Ana García">Ana García</Option>
              <Option value="Carlos López">Carlos López</Option>
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
              onClick={loadDeals}
              loading={loading}
            >
              Recargar
            </Button>
          </Col>
        </Row>
        
        <Row style={{ marginTop: '16px' }}>
          <Col span={24}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingDeal(null);
                  form.resetFields();
                  setDealModalVisible(true);
                }}
              >
                Nuevo Negocio
              </Button>
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
        </Row>
      </Card>

      {/* Tabla de negocios */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredDeals}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            total: filteredDeals.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} negocios`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Modal de negocio */}
      <Modal
        title={editingDeal ? 'Editar Negocio' : 'Nuevo Negocio'}
        open={dealModalVisible}
        onCancel={() => {
          setDealModalVisible(false);
          setEditingDeal(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveDeal}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Nombre del Negocio"
                rules={[{ required: true, message: 'El nombre es requerido' }]}
              >
                <Input placeholder="Ej: Consultoría SEO - Cliente X" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contactName"
                label="Nombre del Contacto"
                rules={[{ required: true, message: 'El nombre del contacto es requerido' }]}
              >
                <Input placeholder="Nombre del contacto" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="amount"
                label="Monto"
                rules={[{ required: true, message: 'El monto es requerido' }]}
              >
                <InputNumber
                  placeholder="0.00"
                  style={{ width: '100%' }}
                  formatter={value => `S/ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/S\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="probability"
                label="Probabilidad (%)"
                rules={[{ required: true, message: 'La probabilidad es requerida' }]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  placeholder="0"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="stage"
                label="Etapa"
                rules={[{ required: true, message: 'La etapa es requerida' }]}
              >
                <Select placeholder="Seleccionar etapa">
                  <Option value="LEAD">Lead</Option>
                  <Option value="QUALIFIED">Calificado</Option>
                  <Option value="PROPOSAL">Propuesta</Option>
                  <Option value="NEGOTIATION">Negociación</Option>
                  <Option value="CLOSED_WON">Ganado</Option>
                  <Option value="CLOSED_LOST">Perdido</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="expectedCloseDate"
                label="Fecha de Cierre Estimada"
                rules={[{ required: true, message: 'La fecha es requerida' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="assignedTo"
                label="Asignado a"
              >
                <Select placeholder="Seleccionar responsable">
                  <Option value="Ana García">Ana García</Option>
                  <Option value="Carlos López">Carlos López</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Descripción"
            rules={[{ required: true, message: 'La descripción es requerida' }]}
          >
            <TextArea rows={3} placeholder="Descripción del negocio..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingDeal ? 'Actualizar' : 'Crear'}
              </Button>
              <Button onClick={() => {
                setDealModalVisible(false);
                setEditingDeal(null);
                form.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de detalles */}
      <Modal
        title={`Detalles del Negocio - ${selectedDeal?.name}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedDeal && (
          <div>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Monto"
                    value={selectedDeal.amount}
                    prefix="S/"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Probabilidad"
                    value={selectedDeal.probability}
                    suffix="%"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider />

            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text strong>Contacto:</Text> {selectedDeal.contactName}<br />
                  <Text strong>Email:</Text> {selectedDeal.contactEmail}<br />
                  <Text strong>Etapa:</Text> <Tag color={getStageColor(selectedDeal.stage)}>
                    {getStageText(selectedDeal.stage)}
                  </Tag><br />
                  <Text strong>Asignado a:</Text> {selectedDeal.assignedTo}<br />
                  <Text strong>Cierre Estimado:</Text> {dayjs(selectedDeal.expectedCloseDate).format('DD/MM/YYYY')}
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>Descripción:</Text><br />
                  <Text>{selectedDeal.description}</Text><br /><br />
                  <Text strong>Etiquetas:</Text><br />
                  <div>
                    {selectedDeal.tags.map((tag, index) => (
                      <Tag key={index} style={{ margin: '2px' }}>
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Col>
            </Row>

            <Divider />

            <Title level={4}>Actividad Reciente</Title>
            <Timeline>
              {selectedDeal.activities.map((activity) => (
                <Timeline.Item key={activity.id}>
                  <div>
                    <Text strong>{getActivityIcon(activity.type)}</Text> - {activity.description}<br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {activity.createdBy} - {dayjs(activity.createdAt).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DealsTable;
