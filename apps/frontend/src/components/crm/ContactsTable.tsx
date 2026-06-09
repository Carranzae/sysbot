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
  Statistic
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
  MessageOutlined,
  MoreOutlined,
  FilterOutlined,
  ExportOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { contactsApi } from '@/lib/api';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const iconFixProps = {
  onPointerEnterCapture: undefined,
  onPointerLeaveCapture: undefined,
} as const;

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  status: 'LEAD' | 'CONTACT' | 'CUSTOMER' | 'CHURNED';
  source: 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM' | 'WEB' | 'MANUAL';
  lastActivity: string;
  totalSpent: number;
  dealCount: number;
  lastPayment?: string;
  nextAppointment?: string;
  tags: string[];
  assignedTo?: string;
  createdAt: string;
}

interface ContactsTableProps {
  businessId: string;
}

export const ContactsTable: React.FC<ContactsTableProps> = ({ businessId }) => {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    source: '',
    dateRange: null as any
  });
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form] = Form.useForm();



  useEffect(() => {
    loadContacts();
  }, [businessId]);

  useEffect(() => {
    applyFilters();
  }, [contacts, filters]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const response = await contactsApi.getAll(businessId);
      const data = response.data;
      
      const mapped = data.map((c: any) => {
        const meta = c.metadata || {};
        return {
          id: c.id,
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          company: meta.company || '',
          status: meta.status || 'CONTACT',
          source: c.source || 'MANUAL',
          lastActivity: c.updatedAt || c.createdAt || new Date().toISOString(),
          totalSpent: Number(meta.totalSpent || 0),
          dealCount: Number(meta.dealCount || 0),
          lastPayment: meta.lastPayment || undefined,
          nextAppointment: meta.nextAppointment || undefined,
          tags: c.tags?.map((t: any) => t.label) || [],
          assignedTo: meta.assignedTo || '',
          createdAt: c.createdAt || new Date().toISOString()
        };
      });
      setContacts(mapped);
    } catch (error) {
      message.error('Error al cargar contactos');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...contacts];

    // Filtro de búsqueda
    if (filters.search) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        contact.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        contact.phone.includes(filters.search) ||
        (contact.company && contact.company.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }

    // Filtro de estado
    if (filters.status) {
      filtered = filtered.filter(contact => contact.status === filters.status);
    }

    // Filtro de fuente
    if (filters.source) {
      filtered = filtered.filter(contact => contact.source === filters.source);
    }

    // Filtro de rango de fechas
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      filtered = filtered.filter(contact => {
        const contactDate = dayjs(contact.createdAt);
        return contactDate.isAfter(start) && contactDate.isBefore(end);
      });
    }

    setFilteredContacts(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CUSTOMER': return 'green';
      case 'LEAD': return 'blue';
      case 'CONTACT': return 'orange';
      case 'CHURNED': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CUSTOMER': return 'Cliente';
      case 'LEAD': return 'Lead';
      case 'CONTACT': return 'Contacto';
      case 'CHURNED': return 'Perdido';
      default: return status;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'WHATSAPP': return 'WhatsApp';
      case 'INSTAGRAM': return 'Instagram';
      case 'TELEGRAM': return 'Telegram';
      case 'WEB': return 'Web';
      case 'MANUAL': return 'Manual';
      default: return source;
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    form.setFieldsValue(contact);
    setContactModalVisible(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    Modal.confirm({
      title: '¿Eliminar contacto?',
      content: `¿Estás seguro de que quieres eliminar a ${contact.name}?`,
      onOk: async () => {
        try {
          await contactsApi.delete(contact.id);
          message.success('Contacto eliminado');
          loadContacts();
        } catch (error) {
          message.error('Error al eliminar contacto');
        }
      }
    });
  };

  const handleSaveContact = async (values: any) => {
    try {
      const meta = {
        company: values.company || '',
        status: values.status || 'CONTACT',
        assignedTo: values.assignedTo || '',
        totalSpent: editingContact ? editingContact.totalSpent : 0,
        dealCount: editingContact ? editingContact.dealCount : 0,
        lastPayment: editingContact ? editingContact.lastPayment : undefined,
        nextAppointment: editingContact ? editingContact.nextAppointment : undefined,
      };

      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        source: values.source || 'MANUAL',
        tags: values.tags || [],
        metadata: meta
      };

      if (editingContact) {
        // Editar contacto existente
        await contactsApi.update(editingContact.id, payload);
        message.success('Contacto actualizado');
      } else {
        // Crear nuevo contacto
        await contactsApi.create(businessId, payload);
        message.success('Contacto creado');
      }
      
      await loadContacts();
      setContactModalVisible(false);
      setEditingContact(null);
      form.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al guardar contacto');
    }
  };

  const columns: ColumnsType<Contact> = [
    {
      title: 'Contacto',
      key: 'contact',
      width: 250,
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined {...iconFixProps} />} />
          <div>
            <div style={{ fontWeight: 'bold' }}>{record.name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.company && <div>{record.company}</div>}
            </div>
          </div>
        </Space>
      )
    },
    {
      title: 'Contacto',
      key: 'contact_info',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <MailOutlined {...iconFixProps} style={{ marginRight: '4px', color: '#666' }} />
            <Text style={{ fontSize: '12px' }}>{record.email}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <PhoneOutlined {...iconFixProps} style={{ marginRight: '4px', color: '#666' }} />
            <Text style={{ fontSize: '12px' }}>{record.phone}</Text>
          </div>
        </div>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
      filters: [
        { text: 'Cliente', value: 'CUSTOMER' },
        { text: 'Lead', value: 'LEAD' },
        { text: 'Contacto', value: 'CONTACT' },
        { text: 'Perdido', value: 'CHURNED' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'Fuente',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source) => (
        <Tag>{getSourceIcon(source)}</Tag>
      ),
      filters: [
        { text: 'WhatsApp', value: 'WHATSAPP' },
        { text: 'Instagram', value: 'INSTAGRAM' },
        { text: 'Telegram', value: 'TELEGRAM' },
        { text: 'Web', value: 'WEB' },
        { text: 'Manual', value: 'MANUAL' }
      ],
      onFilter: (value, record) => record.source === value
    },
    {
      title: 'Métricas',
      key: 'metrics',
      width: 150,
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <DollarCircleOutlined {...iconFixProps} style={{ marginRight: '4px', color: '#52c41a' }} />
            <Text style={{ fontSize: '12px' }}>S/ {record.totalSpent}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <MessageOutlined {...iconFixProps} style={{ marginRight: '4px', color: '#1890ff' }} />
            <Text style={{ fontSize: '12px' }}>{record.dealCount} negocios</Text>
          </div>
        </div>
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
      title: 'Última Actividad',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
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
      sorter: (a, b) => dayjs(a.lastActivity).unix() - dayjs(b.lastActivity).unix()
    },
    {
      title: 'Asignado a',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
      render: (assignedTo) => (
        <Badge text={assignedTo || 'Sin asignar'} />
      )
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
                icon: <EyeOutlined {...iconFixProps} />,
                label: 'Ver detalles',
                onClick: () => message.info('Ver detalles de ' + record.name)
              },
              {
                key: 'edit',
                icon: <EditOutlined {...iconFixProps} />,
                label: 'Editar',
                onClick: () => handleEditContact(record)
              },
              {
                key: 'delete',
                icon: <DeleteOutlined {...iconFixProps} />,
                label: 'Eliminar',
                danger: true,
                onClick: () => handleDeleteContact(record)
              }
            ]
          }}
        >
          <Button type="text" icon={<MoreOutlined {...iconFixProps} />} />
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
    total: contacts.length,
    customers: contacts.filter(c => c.status === 'CUSTOMER').length,
    leads: contacts.filter(c => c.status === 'LEAD').length,
    totalRevenue: contacts.reduce((sum, c) => sum + c.totalSpent, 0)
  };

  return (
    <div>
      <Title level={2}>Contactos</Title>
      
      {/* Estadísticas */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Contactos"
              value={stats.total}
              prefix={<UserOutlined {...iconFixProps} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Clientes"
              value={stats.customers}
              prefix={<UserOutlined {...iconFixProps} />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Leads"
              value={stats.leads}
              prefix={<UserOutlined {...iconFixProps} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ingresos Totales"
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
              placeholder="Buscar contactos..."
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
              <Option value="CUSTOMER">Cliente</Option>
              <Option value="LEAD">Lead</Option>
              <Option value="CONTACT">Contacto</Option>
              <Option value="CHURNED">Perdido</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Fuente"
              allowClear
              value={filters.source}
              onChange={(value) => setFilters({ ...filters, source: value })}
              style={{ width: '100%' }}
            >
              <Option value="WHATSAPP">WhatsApp</Option>
              <Option value="INSTAGRAM">Instagram</Option>
              <Option value="TELEGRAM">Telegram</Option>
              <Option value="WEB">Web</Option>
              <Option value="MANUAL">Manual</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              placeholder={['Fecha inicio', 'Fecha fin']}
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
            />
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined {...iconFixProps} />}
                onClick={() => {
                  setEditingContact(null);
                  form.resetFields();
                  setContactModalVisible(true);
                }}
              >
                Nuevo Contacto
              </Button>
              <Button icon={<ExportOutlined {...iconFixProps} />}>
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

      {/* Tabla de contactos */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredContacts}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            total: filteredContacts.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} contactos`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Modal de contacto */}
      <Modal
        title={editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
        open={contactModalVisible}
        onCancel={() => {
          setContactModalVisible(false);
          setEditingContact(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveContact}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Nombre"
                rules={[{ required: true, message: 'El nombre es requerido' }]}
              >
                <Input placeholder="Nombre completo" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: 'email', message: 'Email inválido' }]}
              >
                <Input placeholder="email@ejemplo.com" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Teléfono"
                rules={[{ required: true, message: 'El teléfono es requerido' }]}
              >
                <Input placeholder="+51 987 654 321" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="company"
                label="Empresa"
              >
                <Input placeholder="Nombre de la empresa" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Estado"
                rules={[{ required: true, message: 'El estado es requerido' }]}
              >
                <Select placeholder="Seleccionar estado">
                  <Option value="LEAD">Lead</Option>
                  <Option value="CONTACT">Contacto</Option>
                  <Option value="CUSTOMER">Cliente</Option>
                  <Option value="CHURNED">Perdido</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="source"
                label="Fuente"
                rules={[{ required: true, message: 'La fuente es requerida' }]}
              >
                <Select placeholder="Seleccionar fuente">
                  <Option value="WHATSAPP">WhatsApp</Option>
                  <Option value="INSTAGRAM">Instagram</Option>
                  <Option value="TELEGRAM">Telegram</Option>
                  <Option value="WEB">Web</Option>
                  <Option value="MANUAL">Manual</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="assignedTo"
            label="Asignado a"
          >
            <Select placeholder="Seleccionar responsable">
              <Option value="Ana García">Ana García</Option>
              <Option value="Carlos López">Carlos López</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingContact ? 'Actualizar' : 'Crear'}
              </Button>
              <Button onClick={() => {
                setContactModalVisible(false);
                setEditingContact(null);
                form.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ContactsTable;
