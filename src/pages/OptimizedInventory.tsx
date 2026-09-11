import React, { useState, useMemo, useCallback } from 'react';
import { AddInventoryItemModal } from '@/components/inventory/AddInventoryItemModal';
import { EditInventoryItemModal } from '@/components/inventory/EditInventoryItemModal';
import { ViewInventoryItemModal } from '@/components/inventory/ViewInventoryItemModal';
import { RestockItemModal } from '@/components/inventory/RestockItemModal';
import { StockAdjustmentModal } from '@/components/inventory/StockAdjustmentModal';
import { 
  useOptimizedProducts, 
  useInventoryStats, 
  useProductCategories,
  useCurrencyFormatter,
  useStockStatus,
  OptimizedProduct 
} from '@/hooks/useOptimizedProducts';
import { useCompanies } from '@/hooks/useDatabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  Filter,
  Eye,
  Edit,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

function getStatusColor(status: string) {
  switch (status) {
    case 'in_stock':
      return 'bg-success-light text-success border-success/20';
    case 'low_stock':
      return 'bg-warning-light text-warning border-warning/20';
    case 'out_of_stock':
      return 'bg-destructive-light text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

// Memoized product row component for better performance
const ProductRow = React.memo(({ 
  product, 
  formatter, 
  onView, 
  onEdit, 
  onRestock 
}: {
  product: OptimizedProduct;
  formatter: Intl.NumberFormat;
  onView: (product: OptimizedProduct) => void;
  onEdit: (product: OptimizedProduct) => void;
  onRestock: (product: OptimizedProduct) => void;
}) => {
  const stockQuantity = product.stock_quantity || 0;
  const minimumStock = product.minimum_stock_level || 0;
  const sellingPrice = product.selling_price || 0;
  const status = useStockStatus(stockQuantity, minimumStock);
  
  const totalValue = useMemo(() => 
    stockQuantity * sellingPrice, 
    [stockQuantity, sellingPrice]
  );

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{product.product_code}</TableCell>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell>{product.product_categories?.name || '-'}</TableCell>
      <TableCell className={`font-semibold ${stockQuantity <= minimumStock ? 'text-warning' : 'text-foreground'}`}>
        {stockQuantity}
      </TableCell>
      <TableCell className="text-muted-foreground">{minimumStock}</TableCell>
      <TableCell>{formatter.format(sellingPrice)}</TableCell>
      <TableCell className="font-semibold text-success">{formatter.format(totalValue)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onView(product)}
            title="View item details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(product)}
            title="Edit item"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {status === 'low_stock' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestock(product)}
              className="bg-warning-light text-warning border-warning/20 hover:bg-warning hover:text-warning-foreground ml-2"
            >
              <Package className="h-4 w-4 mr-1" />
              Restock
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

ProductRow.displayName = 'ProductRow';

export default function OptimizedInventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20); // Fixed page size for better performance
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OptimizedProduct | null>(null);

  // Data fetching
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  
  const { 
    data: productsData, 
    isLoading: loadingProducts, 
    error: productsError,
    refetch: refetchProducts 
  } = useOptimizedProducts(currentCompany?.id, {
    page: currentPage,
    pageSize,
    searchTerm,
    lowStockOnly: showLowStockOnly,
    categoryId: selectedCategory || undefined
  });

  const { 
    data: stats, 
    isLoading: loadingStats 
  } = useInventoryStats(currentCompany?.id);

  const { 
    data: categories 
  } = useProductCategories(currentCompany?.id);

  // Memoized values
  const formatter = useCurrencyFormatter();
  
  const totalPages = useMemo(() => {
    if (!productsData) return 0;
    return Math.ceil(productsData.total / pageSize);
  }, [productsData, pageSize]);

  // Event handlers with useCallback for better performance
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  const handleCategoryFilter = useCallback((value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  }, []);

  const handleLowStockFilter = useCallback((checked: boolean) => {
    setShowLowStockOnly(checked);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchProducts();
    toast.success('Inventory refreshed');
  }, [refetchProducts]);

  // Modal handlers
  const handleViewItem = useCallback((item: OptimizedProduct) => {
    setSelectedItem(item);
    setShowViewModal(true);
  }, []);

  const handleEditItem = useCallback((item: OptimizedProduct) => {
    setSelectedItem(item);
    setShowEditModal(true);
  }, []);

  const handleRestockItem = useCallback((item: OptimizedProduct) => {
    setSelectedItem(item);
    setShowRestockModal(true);
  }, []);

  const handleModalSuccess = useCallback(() => {
    toast.success('Operation completed successfully!');
  }, []);

  const handleStockAdjustment = useCallback((item?: OptimizedProduct) => {
    if (item) {
      setSelectedItem(item);
      setShowAdjustmentModal(true);
    } else {
      toast.info('Please select an item for stock adjustment');
    }
  }, []);

  // Loading state
  if (loadingProducts && currentPage === 1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground">Loading inventory items...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (productsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground">Error loading inventory</p>
          </div>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Failed to load products</p>
            <p className="text-muted-foreground text-sm">{productsError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const products = productsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">
            Manage stock levels and inventory items
            {productsData && ` (${productsData.total} items)`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleRefresh} disabled={loadingProducts}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingProducts ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => handleStockAdjustment()}>
            <Package className="h-4 w-4 mr-2" />
            Stock Adjustment
          </Button>
          <Button className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card" size="lg" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <Package className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="break-all text-lg font-bold text-primary sm:text-2xl">
                  {loadingStats ? '...' : stats?.totalItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <TrendingUp className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="break-all text-lg font-bold text-success sm:text-2xl">
                  {loadingStats ? '...' : formatter.format(stats?.totalValue || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="break-all text-lg font-bold text-warning sm:text-2xl">
                  {loadingStats ? '...' : stats?.lowStockItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <TrendingDown className="h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Out of Stock</p>
                <p className="break-all text-lg font-bold text-destructive sm:text-2xl">
                  {loadingStats ? '...' : stats?.outOfStockItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4 flex-wrap gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or product code..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant={showLowStockOnly ? "default" : "outline"}
              onClick={() => handleLowStockFilter(!showLowStockOnly)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Low Stock Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inventory Items</span>
            {loadingProducts && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Code</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Min Stock</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center space-y-2">
                      <Package className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm || selectedCategory || showLowStockOnly 
                          ? 'No products found matching your filters.' 
                          : 'No products in inventory yet.'}
                      </p>
                      {!searchTerm && !selectedCategory && !showLowStockOnly && (
                        <Button onClick={() => setShowAddModal(true)} className="mt-2">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Product
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    formatter={formatter}
                    onView={handleViewItem}
                    onEdit={handleEditItem}
                    onRestock={handleRestockItem}
                  />
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, productsData?.totalCount || 0)} of {productsData?.totalCount || 0} items
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loadingProducts}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loadingProducts}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Modals */}
      <AddInventoryItemModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={handleModalSuccess}
      />

      {selectedItem && (
        <ViewInventoryItemModal
          open={showViewModal}
          onOpenChange={setShowViewModal}
          item={selectedItem}
          onEdit={() => {
            setShowViewModal(false);
            handleEditItem(selectedItem);
          }}
          onRestock={() => {
            setShowViewModal(false);
            setShowRestockModal(true);
          }}
        />
      )}

      {selectedItem && (
        <RestockItemModal
          open={showRestockModal}
          onOpenChange={setShowRestockModal}
          onSuccess={handleModalSuccess}
          item={selectedItem}
        />
      )}

      {selectedItem && (
        <EditInventoryItemModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedItem(null);
            handleModalSuccess();
          }}
          item={selectedItem}
        />
      )}

      {selectedItem && (
        <StockAdjustmentModal
          open={showAdjustmentModal}
          onOpenChange={setShowAdjustmentModal}
          onSuccess={() => {
            setShowAdjustmentModal(false);
            setSelectedItem(null);
            handleModalSuccess();
          }}
          item={selectedItem}
        />
      )}
    </div>
  );
}
