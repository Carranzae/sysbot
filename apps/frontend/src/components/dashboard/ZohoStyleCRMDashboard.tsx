'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Plus,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Target,
  Activity,
  ChevronRight,
  MoreVertical,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Building2,
  FileText,
  MessageSquare,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

export default function ZohoStyleCRMDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Datos mock para el dashboard
  const stats = [
    {
      title: 'Total Leads',
      value: '1,234',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Conversion Rate',
      value: '24.8%',
      change: '+3.2%',
      trend: 'up',
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Active Deals',
      value: '89',
      change: '-2.1%',
      trend: 'down',
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Revenue',
      value: '$45.2K',
      change: '+18.7%',
      trend: 'up',
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  const recentLeads = [
    {
      id: 1,
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1 234-567-8900',
      company: 'Tech Corp',
      status: 'new',
      score: 85,
      lastActivity: '2 hours ago',
      source: 'Website'
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah.j@example.com',
      phone: '+1 234-567-8901',
      company: 'Marketing Pro',
      status: 'contacted',
      score: 92,
      lastActivity: '1 day ago',
      source: 'Referral'
    },
    {
      id: 3,
      name: 'Mike Wilson',
      email: 'mike.w@example.com',
      phone: '+1 234-567-8902',
      company: 'Sales Inc',
      status: 'qualified',
      score: 78,
      lastActivity: '3 days ago',
      source: 'LinkedIn'
    }
  ];

  const deals = [
    {
      id: 1,
      name: 'Enterprise Software Deal',
      company: 'Global Tech',
      value: '$125,000',
      stage: 'Proposal',
      probability: '75%',
      closeDate: '2024-03-15',
      owner: 'John Doe'
    },
    {
      id: 2,
      name: 'Marketing Automation',
      company: 'Ad Agency',
      value: '$45,000',
      stage: 'Negotiation',
      probability: '90%',
      closeDate: '2024-02-28',
      owner: 'Jane Smith'
    },
    {
      id: 3,
      name: 'CRM Implementation',
      company: 'Startup Co',
      value: '$28,000',
      stage: 'Discovery',
      probability: '25%',
      closeDate: '2024-04-10',
      owner: 'Bob Johnson'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-green-100 text-green-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Discovery':
        return 'bg-purple-100 text-purple-800';
      case 'Proposal':
        return 'bg-blue-100 text-blue-800';
      case 'Negotiation':
        return 'bg-orange-100 text-orange-800';
      case 'Closed Won':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your sales pipeline and customer relationships</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search leads, deals, contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="deals">Deals</SelectItem>
                <SelectItem value="contacts">Contacts</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Lead
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <div className="flex items-center mt-2">
                      {stat.trend === 'up' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Leads */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Leads</CardTitle>
                    <CardDescription>Latest leads added to your pipeline</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentLeads.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{lead.name}</p>
                            <p className="text-sm text-gray-500">{lead.company}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{lead.score}</p>
                            <p className="text-xs text-gray-500">Score</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Deals */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Active Deals</CardTitle>
                    <CardDescription>Deals currently in your pipeline</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {deals.map((deal) => (
                      <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{deal.name}</p>
                          <p className="text-sm text-gray-500">{deal.company}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStageColor(deal.stage)}>
                              {deal.stage}
                            </Badge>
                            <span className="text-sm text-gray-500">{deal.probability}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{deal.value}</p>
                          <p className="text-xs text-gray-500">{deal.closeDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Leads</CardTitle>
                    <CardDescription>Manage and track all your leads</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lead
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-gray-700">Lead</th>
                        <th className="text-left p-3 font-medium text-gray-700">Company</th>
                        <th className="text-left p-3 font-medium text-gray-700">Status</th>
                        <th className="text-left p-3 font-medium text-gray-700">Score</th>
                        <th className="text-left p-3 font-medium text-gray-700">Last Activity</th>
                        <th className="text-left p-3 font-medium text-gray-700">Source</th>
                        <th className="text-left p-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeads.map((lead) => (
                        <tr key={lead.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-gray-900">{lead.name}</p>
                              <p className="text-sm text-gray-500">{lead.email}</p>
                            </div>
                          </td>
                          <td className="p-3 text-gray-900">{lead.company}</td>
                          <td className="p-3">
                            <Badge className={getStatusColor(lead.status)}>
                              {lead.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-full bg-gray-200 rounded-full max-w-16">
                                <div 
                                  className="h-2 bg-green-500 rounded-full"
                                  style={{ width: `${lead.score}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{lead.score}</span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 text-sm">{lead.lastActivity}</td>
                          <td className="p-3 text-gray-900">{lead.source}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Deals Pipeline</CardTitle>
                    <CardDescription>Track your deals through the sales process</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {['Discovery', 'Proposal', 'Negotiation', 'Closed Won'].map((stage) => (
                    <div key={stage} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">{stage}</h3>
                        <Badge variant="outline">
                          {deals.filter(d => d.stage === stage).length} deals
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {deals
                          .filter(deal => deal.stage === stage)
                          .map(deal => (
                            <div key={deal.id} className="bg-gray-50 rounded p-3 hover:bg-gray-100 cursor-pointer">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{deal.name}</p>
                                  <p className="text-sm text-gray-500">{deal.company}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-gray-900">{deal.value}</p>
                                  <p className="text-sm text-gray-500">{deal.probability}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { stage: 'New Leads', count: 1234, color: 'bg-blue-500' },
                      { stage: 'Qualified', count: 456, color: 'bg-green-500' },
                      { stage: 'Proposal', count: 234, color: 'bg-yellow-500' },
                      { stage: 'Closed Won', count: 89, color: 'bg-purple-500' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-24 text-sm text-gray-600">{item.stage}</div>
                        <div className="flex-1">
                          <div className="h-6 bg-gray-200 rounded-full">
                            <div 
                              className={`h-6 ${item.color} rounded-full flex items-center justify-center text-white text-xs font-medium`}
                              style={{ width: `${(item.count / 1234) * 100}%` }}
                            >
                              {item.count}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { month: 'January', revenue: 45000, target: 50000 },
                      { month: 'February', revenue: 52000, target: 50000 },
                      { month: 'March', revenue: 48000, target: 55000 },
                      { month: 'April', revenue: 61000, target: 60000 }
                    ].map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{item.month}</span>
                          <span className="font-medium">${item.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full">
                          <div 
                            className="h-4 bg-green-500 rounded-full"
                            style={{ width: `${(item.revenue / item.target) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
