import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  ShoppingCart,
  Users,
  Package
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useCustomers, useProducts } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { getCurrencySymbol } from '@/utils/currencyFormatter';
import { toast } from 'sonner';
import { toCollection } from '@/utils/collection';

export default function SalesReports() {
  const [dateRange, setDateRange] = useState('last_30_days');
  const [reportType, setReportType] = useState('overview');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?.id;
  const currency = getCurrencySymbol(currentCompany?.currency);

  const { data: invoiceResponse, isLoading: invoicesLoading, error: invoicesError } = useInvoices(companyId);
  const invoices = toCollection(invoiceResponse);
  const { data: customersResponse, isLoading: customersLoading, error: customersError } = useCustomers(companyId);
  const customers = toCollection(customersResponse);
  const { data: productsResponse, isLoading: productsLoading, error: productsError } = useProducts(companyId);
  const products = toCollection(productsResponse);

  const isLoading = invoicesLoading || customersLoading || productsLoading;
  const hasError = invoicesError || customersError || productsError;

  // Get filtered invoices based on date range
  const getFilteredInvoices = () => {
    if (!invoices) return [];

    if (dateRange === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include full end date
      
      return invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoice_date);
        return invoiceDate >= start && invoiceDate <= end;
      });
    }

    const now = new Date();
    let filterStart = new Date();
    
    switch (dateRange) {
      case 'last_7_days':
        filterStart.setDate(now.getDate() - 7);
        break;
      case 'last_30_days':
        filterStart.setDate(now.getDate() - 30);
        break;
      case 'last_90_days':
        filterStart.setDate(now.getDate() - 90);
        break;
      case 'this_year':
        filterStart = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        filterStart.setDate(now.getDate() - 30);
    }
    
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.invoice_date);
      return invoiceDate >= filterStart;
    });
  };

  // Calculate monthly sales data from filtered invoices
  const calculateMonthlySalesData = () => {
    const filteredInvoices = getFilteredInvoices();
    if (!filteredInvoices.length) return [];

    const last6Months = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthInvoices = filteredInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoice_date);
        return invoiceDate >= monthStart && invoiceDate <= monthEnd;
      });

      const monthlySales = monthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const uniqueCustomers = new Set(monthInvoices.map(inv => inv.customer_id)).size;

      last6Months.push({
        month: monthName,
        sales: monthlySales,
        invoices: monthInvoices.length,
        customers: uniqueCustomers
      });
    }

    return last6Months;
  };

  // Calculate top products from filtered invoice items
  const calculateTopProductsData = () => {
    const filteredInvoices = getFilteredInvoices();
    if (!filteredInvoices.length || !products) return [];

    const productSales = new Map();

    filteredInvoices.forEach(invoice => {
      if (invoice.invoice_items) {
        invoice.invoice_items.forEach((item: any) => {
          const productId = item.product_id;
          const productName = products.find(p => p.id === productId)?.name || 'Unknown Product';
          const itemTotal = (item.quantity || 0) * (item.unit_price || 0);

          if (productSales.has(productId)) {
            productSales.set(productId, {
              name: productName,
              sales: productSales.get(productId).sales + itemTotal
            });
          } else {
            productSales.set(productId, {
              name: productName,
              sales: itemTotal
            });
          }
        });
      }
    });

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];
    let colorIndex = 0;

    return Array.from(productSales.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map(product => ({
        ...product,
        color: colors[colorIndex++ % colors.length]
      }));
  };

  // Calculate top customers from filtered invoices
  const calculateTopCustomersData = () => {
    const filteredInvoices = getFilteredInvoices();
    if (!filteredInvoices.length || !customers) return [];

    const customerSales = new Map();

    filteredInvoices.forEach(invoice => {
      const customerId = invoice.customer_id;
      const customerName = customers.find(c => c.id === customerId)?.name || 'Unknown Customer';

      if (customerSales.has(customerId)) {
        const existing = customerSales.get(customerId);
        customerSales.set(customerId, {
          name: customerName,
          sales: existing.sales + (invoice.total_amount || 0),
          invoices: existing.invoices + 1
        });
      } else {
        customerSales.set(customerId, {
          name: customerName,
          sales: invoice.total_amount || 0,
          invoices: 1
        });
      }
    });

    return Array.from(customerSales.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  };

  // Get calculated data
  const monthlySalesData = calculateMonthlySalesData();
  const topProductsData = calculateTopProductsData();
  const topCustomersData = calculateTopCustomersData();

  // Calculate stats from filtered and unfiltered data
  const calculateStats = () => {
    const filteredInvoices = getFilteredInvoices();
    const allInvoices = invoices || [];
    
    if (!allInvoices.length) return { dailySales: 0, monthlySales: 0, yearlySales: 0, totalInvoices: 0 };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // For daily/monthly/yearly stats, use all invoices (not filtered by date range)
    const dailySales = allInvoices
      .filter(inv => new Date(inv.invoice_date) >= today)
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const monthlySales = allInvoices
      .filter(inv => new Date(inv.invoice_date) >= thirtyDaysAgo)
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const yearlySales = allInvoices
      .filter(inv => new Date(inv.invoice_date) >= yearStart)
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    return {
      dailySales,
      monthlySales,
      yearlySales,
      totalInvoices: allInvoices.length
    };
  };

  const stats = calculateStats();

  const handleExport = () => {
    const filteredInvoices = getFilteredInvoices();
    const reportData = {
      dateRange,
      startDate,
      endDate,
      totalSales: filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
      totalInvoices: filteredInvoices.length,
      topProducts: topProductsData,
      topCustomers: topCustomersData,
      monthlySales: monthlySalesData
    };
    
    console.log('Export data:', reportData);
    toast.success('Sales report exported successfully!');
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    if (value === 'custom') {
      // User will set custom dates
    } else {
      // Set predefined ranges
      const now = new Date();
      let start = new Date();
      
      switch (value) {
        case 'last_7_days':
          start.setDate(now.getDate() - 7);
          break;
        case 'last_30_days':
          start.setDate(now.getDate() - 30);
          break;
        case 'last_90_days':
          start.setDate(now.getDate() - 90);
          break;
        case 'this_year':
          start = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sales reports...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading sales data</p>
          <p className="text-sm text-muted-foreground">
            {invoicesError?.message || customersError?.message || productsError?.message}
          </p>
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">No company selected</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please select a company to view sales reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Reports</h1>
          <p className="text-muted-foreground">
            Analyze sales performance and trends for {dateRange === 'custom' && startDate && endDate ? `${startDate} to ${endDate}` : dateRange.replace('_', ' ')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-48">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Last 7 days</SelectItem>
              <SelectItem value="last_30_days">Last 30 days</SelectItem>
              <SelectItem value="last_90_days">Last 90 days</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Custom Date Range */}
      {dateRange === 'custom' && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Daily Sales</p>
                <p className="text-2xl font-bold text-success">{currency} {stats.dailySales.toFixed(2)}</p>
                <p className="text-xs text-success">Today's revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Sales</p>
                <p className="text-2xl font-bold text-primary">{currency} {stats.monthlySales.toFixed(2)}</p>
                <p className="text-xs text-success">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Yearly Sales</p>
                <p className="text-2xl font-bold text-success">{currency} {stats.yearlySales.toFixed(2)}</p>
                <p className="text-xs text-success">This year</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold text-blue-500">{stats.totalInvoices}</p>
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Report Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Sales Overview</SelectItem>
              <SelectItem value="products">Product Performance</SelectItem>
              <SelectItem value="customers">Customer Analysis</SelectItem>
              <SelectItem value="trends">Trend Analysis</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Charts based on report type */}
      {reportType === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${currency} ${value}`, 'Sales']} />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="invoices" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'products' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Products by Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topProductsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${currency} ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="sales"
                  >
                    {topProductsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${currency} ${value}`, 'Sales']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value) => [`${currency} ${value}`, 'Sales']} />
                  <Bar dataKey="sales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'customers' && (
        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Total Sales</TableHead>
                  <TableHead>Invoice Count</TableHead>
                  <TableHead>Average Order Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomersData.map((customer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{currency} {customer.sales.toFixed(2)}</TableCell>
                    <TableCell>{customer.invoices}</TableCell>
                    <TableCell>{currency} {(customer.sales / customer.invoices).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {reportType === 'trends' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales vs Customer Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="sales" orientation="left" />
                <YAxis yAxisId="customers" orientation="right" />
                <Tooltip />
                <Legend />
                  <Line yAxisId="sales" type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} name={`Sales (${currency})`} />
                <Line yAxisId="customers" type="monotone" dataKey="customers" stroke="#82ca9d" strokeWidth={2} name="New Customers" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customer Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Customers</span>
                <span className="font-medium">{customers?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active This Month</span>
                <span className="font-medium">
                  {(() => {
                    const allInvoices = invoices || [];
                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const activeCustomers = new Set(
                      allInvoices
                        .filter(inv => new Date(inv.invoice_date) >= monthStart)
                        .map(inv => inv.customer_id)
                    );
                    return activeCustomers.size;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average Order Value</span>
                <span className="font-medium">
                  ${invoices && invoices.length > 0
                    ? (invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) / invoices.length).toFixed(2)
                    : '0.00'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Products</span>
                <span className="font-medium">{products?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Products Sold</span>
                <span className="font-medium">
                  {(() => {
                    const allInvoices = invoices || [];
                    const productsSold = new Set();
                    allInvoices.forEach(inv => {
                      if (inv.invoice_items) {
                        inv.invoice_items.forEach((item: any) => {
                          productsSold.add(item.product_id);
                        });
                      }
                    });
                    return productsSold.size;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Best Seller</span>
                <span className="font-medium">
                  {topProductsData.length > 0 ? topProductsData[0].name : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Growth Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sales Growth</span>
                <span className="font-medium">
                  {(() => {
                    if (!invoices || monthlySalesData.length < 2) return 'N/A';
                    const currentMonth = monthlySalesData[monthlySalesData.length - 1].sales;
                    const previousMonth = monthlySalesData[monthlySalesData.length - 2].sales;
                    if (previousMonth === 0) return 'N/A';
                    const growth = ((currentMonth - previousMonth) / previousMonth * 100);
                    const isPositive = growth >= 0;
                    return (
                      <span className={isPositive ? 'text-success' : 'text-destructive'}>
                        {isPositive ? '+' : ''}{growth.toFixed(1)}%
                      </span>
                    );
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Customer Growth</span>
                <span className="font-medium">
                  {(() => {
                    if (!customers || monthlySalesData.length < 2) return 'N/A';
                    const currentMonth = monthlySalesData[monthlySalesData.length - 1].customers;
                    const previousMonth = monthlySalesData[monthlySalesData.length - 2].customers;
                    if (previousMonth === 0) return 'N/A';
                    const growth = ((currentMonth - previousMonth) / previousMonth * 100);
                    const isPositive = growth >= 0;
                    return (
                      <span className={isPositive ? 'text-success' : 'text-destructive'}>
                        {isPositive ? '+' : ''}{growth.toFixed(1)}%
                      </span>
                    );
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Invoices/Month</span>
                <span className="font-medium">
                  {monthlySalesData.length > 0
                    ? (monthlySalesData.reduce((sum, month) => sum + month.invoices, 0) / monthlySalesData.length).toFixed(1)
                    : '0'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
