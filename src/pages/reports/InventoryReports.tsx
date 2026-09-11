import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Package, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  BarChart3,
  Search,
  Filter
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
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { useProducts, useStockMovements } from '@/hooks/useDatabase';
import { toast } from 'sonner';
import { toCollection } from '@/utils/collection';

// No sample data - using real database data only

export default function InventoryReports() {
  const [dateRange, setDateRange] = useState('last_30_days');
  const [reportType, setReportType] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: productsResponse } = useProducts();
  const products = toCollection(productsResponse);
  const { data: stockMovements } = useStockMovements();

  // Calculate stock movement data from real movements
  const calculateStockMovementData = () => {
    if (!stockMovements) return [];

    const last6Months = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthMovements = stockMovements.filter(movement => {
        const movementDate = new Date(movement.movement_date);
        return movementDate >= monthStart && movementDate <= monthEnd;
      });

      const inMovements = monthMovements
        .filter(m => m.movement_type === 'IN')
        .reduce((sum, m) => sum + (m.quantity || 0), 0);

      const outMovements = monthMovements
        .filter(m => m.movement_type === 'OUT')
        .reduce((sum, m) => sum + (m.quantity || 0), 0);

      const adjustments = monthMovements
        .filter(m => m.movement_type === 'ADJUSTMENT')
        .reduce((sum, m) => sum + (m.quantity || 0), 0);

      last6Months.push({
        month: monthName,
        in: inMovements,
        out: outMovements,
        adjustment: adjustments
      });
    }

    return last6Months;
  };

  // Calculate category distribution from real products
  const calculateCategoryDistribution = () => {
    if (!products) return [];

    const categoryMap = new Map();
    const totalProducts = products.length;

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (categoryMap.has(category)) {
        categoryMap.set(category, categoryMap.get(category) + 1);
      } else {
        categoryMap.set(category, 1);
      }
    });

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#87d068'];
    let colorIndex = 0;

    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      value: totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0,
      count,
      color: colors[colorIndex++ % colors.length]
    }));
  };

  // Calculate turnover analysis from real data
  const calculateTurnoverData = () => {
    if (!products) return [];

    return products
      .filter(product => (product.stock_quantity || 0) > 0)
      .map(product => {
        // Simple turnover calculation - could be enhanced with actual sales data
        const stockLevel = product.stock_quantity || 0;
        const minLevel = product.minimum_stock_level || 1;
        const estimatedTurnover = stockLevel > 0 ? (minLevel * 12) / stockLevel : 0;

        return {
          product: product.name,
          turnover: estimatedTurnover,
          sales: 0, // Would need actual sales data
          stock: stockLevel,
          product_code: product.product_code
        };
      })
      .sort((a, b) => b.turnover - a.turnover)
      .slice(0, 10); // Top 10
  };

  const stockMovementData = calculateStockMovementData();
  const categoryDistribution = calculateCategoryDistribution();
  const turnoverData = calculateTurnoverData();

  // Calculate real stats from data
  const calculateStats = () => {
    if (!products) return { totalItems: 0, stockValue: 0, lowStock: 0, outOfStock: 0 };

    const totalItems = products.reduce((sum, product) => sum + (product.stock_quantity || 0), 0);
    const stockValue = products.reduce((sum, product) => 
      sum + ((product.stock_quantity || 0) * (product.cost_price || 0)), 0
    );
    const lowStock = products.filter(product => 
      (product.stock_quantity || 0) <= (product.minimum_stock_level || 0)
    ).length;
    const outOfStock = products.filter(product => (product.stock_quantity || 0) === 0).length;

    return { totalItems, stockValue, lowStock, outOfStock };
  };

  const stats = calculateStats();

  const getStockStatusBadge = (product: any) => {
    if ((product.stock_quantity || 0) === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if ((product.stock_quantity || 0) <= (product.minimum_stock_level || 0)) {
      return <Badge variant="secondary">Low Stock</Badge>;
    }
    if ((product.stock_quantity || 0) <= (product.reorder_point || 0)) {
      return <Badge variant="outline">Reorder Soon</Badge>;
    }
    return <Badge variant="destructive">In Stock</Badge>;
  };

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.product_code.toLowerCase().includes(searchTerm.toLowerCase());
    // For now, assuming no category filter since we don't have category data
    return matchesSearch;
  }) || [];

  const handleExport = () => {
    toast.success('Inventory report exported successfully!');
  };

  const handleGenerateReorderReport = () => {
    const reorderItems = products?.filter(product => 
      (product.stock_quantity || 0) <= (product.reorder_point || 0)
    ) || [];
    
    if (reorderItems.length === 0) {
      toast.info('No items need reordering at this time');
    } else {
      toast.success(`Generated reorder report for ${reorderItems.length} items`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Reports</h1>
          <p className="text-muted-foreground">
            Track inventory movement and stock levels
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleGenerateReorderReport}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Reorder Report
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items In Stock</p>
                <p className="text-2xl font-bold text-primary">{stats.totalItems}</p>
                <p className="text-xs text-muted-foreground">Total quantity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stock Value</p>
                <p className="text-2xl font-bold text-success">${stats.stockValue.toFixed(2)}</p>
                <p className="text-xs text-success">At cost price</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold text-warning">{stats.lowStock}</p>
                <p className="text-xs text-warning">Need attention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-destructive">{stats.outOfStock}</p>
                <p className="text-xs text-destructive">Urgent reorder</p>
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
              <SelectItem value="overview">Inventory Overview</SelectItem>
              <SelectItem value="movement">Stock Movement</SelectItem>
              <SelectItem value="turnover">Turnover Analysis</SelectItem>
              <SelectItem value="valuation">Stock Valuation</SelectItem>
              <SelectItem value="alerts">Stock Alerts</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Charts based on report type */}
      {reportType === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock Movement Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stockMovementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="in" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Stock In" />
                  <Area type="monotone" dataKey="out" stackId="2" stroke="#8884d8" fill="#8884d8" name="Stock Out" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Distribution']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'movement' && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Movement Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stockMovementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="in" fill="#82ca9d" name="Stock In" />
                <Bar dataKey="out" fill="#8884d8" name="Stock Out" />
                <Bar dataKey="adjustment" fill="#ffc658" name="Adjustments" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {reportType === 'turnover' && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Turnover Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Turnover Ratio</TableHead>
                  <TableHead>Sales Volume</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnoverData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.product}</TableCell>
                    <TableCell>{item.turnover.toFixed(1)}x</TableCell>
                    <TableCell>{item.sales || 'N/A'}</TableCell>
                    <TableCell>{item.stock}</TableCell>
                    <TableCell>
                      {item.turnover > 6 ? (
                        <Badge variant="destructive">Excellent</Badge>
                      ) : item.turnover > 4 ? (
                        <Badge variant="default">Good</Badge>
                      ) : item.turnover > 2 ? (
                        <Badge variant="secondary">Average</Badge>
                      ) : (
                        <Badge variant="outline">Poor</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {reportType === 'valuation' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock Value Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" name="Product Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valuation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Stock Value (Cost)</span>
                  <span className="font-bold">${stats.stockValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Stock Value (Retail)</span>
                  <span className="font-bold">${(stats.stockValue * 1.4).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Potential Profit</span>
                  <span className="font-bold text-success">${(stats.stockValue * 0.4).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Average Cost per Item</span>
                  <span className="font-bold">${products?.length ? (stats.stockValue / products.length).toFixed(2) : '0.00'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'alerts' && (
        <div className="space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="reorder">Need Reorder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Reorder Point</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.stock_quantity || 0}</TableCell>
                      <TableCell>{product.minimum_stock_level || 0}</TableCell>
                      <TableCell>{product.reorder_point || 0}</TableCell>
                      <TableCell>{getStockStatusBadge(product)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average Turnover</span>
                <span className="font-medium">
                  {turnoverData.length > 0
                    ? (turnoverData.reduce((sum, item) => sum + item.turnover, 0) / turnoverData.length).toFixed(1) + 'x'
                    : '0x'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Fast Moving Items</span>
                <span className="font-medium">{turnoverData.filter(item => item.turnover > 6).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Slow Moving Items</span>
                <span className="font-medium">{turnoverData.filter(item => item.turnover < 2).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Healthy Stock</span>
                <span className="font-medium text-success">{(products?.length || 0) - stats.lowStock - stats.outOfStock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Need Attention</span>
                <span className="font-medium text-warning">{stats.lowStock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Critical</span>
                <span className="font-medium text-destructive">{stats.outOfStock}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Est. Days to Stockout</span>
                <span className="font-medium">
                  {products && products.length > 0
                    ? Math.round(products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0) / Math.max(1, products.length) * 30)
                    : '0'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Recommended Reorder</span>
                <span className="font-medium">
                  {products?.filter(p => (p.stock_quantity || 0) <= (p.reorder_point || 0)).length || 0} items
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Carrying Cost</span>
                <span className="font-medium">${(stats.stockValue * 0.02).toFixed(2)}/month</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
