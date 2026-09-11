import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Eye,
  Edit,
  Mail,
  Phone,
  FileText,
  DollarSign,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import {
  useOptimizedCustomers,
  useCustomerStats,
  useCustomerCities,
  useCurrencyFormatter,
  getCustomerStatusColor,
  getCustomerInitials,
  OptimizedCustomer
} from '@/hooks/useOptimizedCustomers';
import { useCompanies } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditCustomerModal } from '@/components/customers/EditCustomerModal';
import { ViewCustomerModal } from '@/components/customers/ViewCustomerModal';
import { CreateCustomerModal } from '@/components/customers/CreateCustomerModal';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { generateCustomerStatementPDF } from '@/utils/pdfGenerator';

// Memoized customer row component for better performance
const CustomerRow = React.memo(({ 
  customer, 
  formatter, 
  onView, 
  onEdit, 
  onCreateInvoice,
  onViewStatement,
  onSendEmail,
  onCall
}: {
  customer: OptimizedCustomer;
  formatter: Intl.NumberFormat;
  onView: (customer: OptimizedCustomer) => void;
  onEdit: (customer: OptimizedCustomer) => void;
  onCreateInvoice: (customer: OptimizedCustomer) => void;
  onViewStatement: (customer: OptimizedCustomer) => void;
  onSendEmail: (email: string) => void;
  onCall: (phone: string) => void;
}) => {
  const isActive = customer.is_active !== false;
  const initials = getCustomerInitials(customer.name);

  return (
    <TableRow className="hover:bg-muted/50 transition-smooth">
      <TableCell>
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{customer.name}</div>
            <div className="text-sm text-muted-foreground">{customer.customer_code}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="space-y-1">
          {customer.email && (
            <div className="flex items-center space-x-2 text-sm">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[150px]">{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center space-x-2 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{customer.phone}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="flex items-center space-x-2 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{customer.city || 'N/A'}, {customer.country || 'Kenya'}</span>
        </div>
      </TableCell>
      <TableCell className="font-medium hidden lg:table-cell">
        {customer.credit_limit ? formatter.format(customer.credit_limit) : 'No limit'}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {customer.payment_terms || 30} days
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={getCustomerStatusColor(isActive)}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-1">
          {/* Icon Actions */}
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onView(customer)}
              title="View customer details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(customer)}
              title="Edit customer"
            >
              <Edit className="h-4 w-4" />
            </Button>
            {customer.email && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSendEmail(customer.email!)}
                title="Send email"
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
            {customer.phone && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCall(customer.phone!)}
                title="Call customer"
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 ml-2 border-l pl-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateInvoice(customer)}
              className="bg-primary-light text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground"
            >
              <FileText className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Invoice</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewStatement(customer)}
              className="bg-secondary-light text-secondary border-secondary/20 hover:bg-secondary hover:text-secondary-foreground"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Statement</span>
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
});

CustomerRow.displayName = 'CustomerRow';

export default function OptimizedCustomers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [creditLimitFilter, setCreditLimitFilter] = useState<'all' | 'with_limit' | 'no_limit'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20); // Fixed page size for better performance
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<OptimizedCustomer | null>(null);

  // Data fetching
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  
  const { 
    data: customersData, 
    isLoading: loadingCustomers, 
    error: customersError,
    refetch: refetchCustomers 
  } = useOptimizedCustomers(currentCompany?.id, {
    page: currentPage,
    pageSize,
    searchTerm,
    statusFilter,
    cityFilter,
    creditLimitFilter
  });

  const { 
    data: stats, 
    isLoading: loadingStats 
  } = useCustomerStats(currentCompany?.id);

  const { 
    data: cities 
  } = useCustomerCities(currentCompany?.id);

  // Memoized values
  const formatter = useCurrencyFormatter();
  
  const totalPages = useMemo(() => {
    if (!customersData) return 0;
    return Math.ceil(customersData.totalCount / pageSize);
  }, [customersData, pageSize]);

  // Event handlers with useCallback for better performance
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  const handleStatusFilter = useCallback((value: 'all' | 'active' | 'inactive') => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleCityFilter = useCallback((value: string) => {
    setCityFilter(value);
    setCurrentPage(1);
  }, []);

  const handleCreditLimitFilter = useCallback((value: 'all' | 'with_limit' | 'no_limit') => {
    setCreditLimitFilter(value);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchCustomers();
    toast.success('Customer list refreshed');
  }, [refetchCustomers]);

  // Modal handlers
  const handleViewCustomer = useCallback((customer: OptimizedCustomer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  }, []);

  const handleEditCustomer = useCallback((customer: OptimizedCustomer) => {
    setSelectedCustomer(customer);
    setShowEditModal(true);
  }, []);

  const handleCreateInvoice = useCallback((customer: OptimizedCustomer) => {
    setSelectedCustomer(customer);
    setShowInvoiceModal(true);
  }, []);

  const handleViewStatement = useCallback(async (customer: OptimizedCustomer) => {
    try {
      // Fetch real invoices and payments for this customer
      const [invoicesResponse, paymentsResponse] = await Promise.all([
        supabase
          .from('invoices')
          .select('invoice_date, invoice_number, total_amount, due_date, status')
          .eq('customer_id', customer.id)
          .eq('company_id', currentCompany?.id || '550e8400-e29b-41d4-a716-446655440000')
          .order('invoice_date', { ascending: true }),
        supabase
          .from('payments')
          .select('payment_date, payment_number, amount, payment_method')
          .eq('customer_id', customer.id)
          .eq('company_id', currentCompany?.id || '550e8400-e29b-41d4-a716-446655440000')
          .order('payment_date', { ascending: true })
      ]);

      if (invoicesResponse.error) throw invoicesResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      const invoices = invoicesResponse.data || [];
      const payments = paymentsResponse.data?.map(payment => ({
        ...payment,
        method: payment.payment_method || 'Cash'
      })) || [];

      generateCustomerStatementPDF(customer, invoices, payments);
      toast.success(`Statement generated for ${customer.name}`);
    } catch (error) {
      console.error('Error generating statement:', error);
      toast.error('Failed to generate statement. Please try again.');
    }
  }, [currentCompany?.id]);

  const handleSendEmail = useCallback((email: string) => {
    if (email && email !== 'customer@example.com') {
      try {
        window.open(`mailto:${email}`, '_blank');
        toast.success(`Opening email client to send to ${email}`);
      } catch (error) {
        toast.error('Failed to open email client');
      }
    } else {
      toast.error('No valid email address available');
    }
  }, []);

  const handleCall = useCallback((phone: string) => {
    if (phone && phone !== '+254 700 000000') {
      try {
        window.open(`tel:${phone}`, '_blank');
        toast.success(`Initiating call to ${phone}`);
      } catch (error) {
        toast.error('Failed to initiate call');
      }
    } else {
      toast.error('No valid phone number available');
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setCityFilter('all');
    setCreditLimitFilter('all');
    setSearchTerm('');
    setCurrentPage(1);
    toast.success('Filters cleared');
  }, []);

  // Loading state
  if (loadingCustomers && currentPage === 1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Loading customer data...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (customersError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Error loading customers</p>
          </div>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Failed to load customers</p>
            <p className="text-muted-foreground text-sm">{customersError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const customers = customersData?.customers || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer database and relationships
            {customersData && ` (${customersData.totalCount} customers)`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleRefresh} disabled={loadingCustomers}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingCustomers ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card"
            size="lg"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid min-w-0 gap-4 md:grid-cols-4">
        <Card className="min-w-0 overflow-hidden shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Total Customers</p>
                <p className="min-w-0 break-words text-lg font-bold tabular-nums text-primary sm:text-2xl">
                  {loadingStats ? '...' : stats?.totalCustomers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="min-w-0 overflow-hidden shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Active</p>
                <p className="min-w-0 break-words text-lg font-bold tabular-nums text-success sm:text-2xl">
                  {loadingStats ? '...' : stats?.activeCustomers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <CreditCard className="h-5 w-5 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">With Credit Limit</p>
                <p className="min-w-0 break-words text-lg font-bold tabular-nums text-blue-600 sm:text-2xl">
                  {loadingStats ? '...' : stats?.customersWithCreditLimit || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden shadow-card">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-center gap-2">
              <DollarSign className="h-5 w-5 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-muted-foreground">Total Credit</p>
                <p className="min-w-0 break-words text-lg font-bold tabular-nums text-green-600 sm:text-2xl">
                  {loadingStats ? '...' : formatter.format(stats?.totalCreditLimit || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="min-w-0 overflow-hidden shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4 flex-wrap gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, email, or phone..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cityFilter} onValueChange={handleCityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities?.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={creditLimitFilter} onValueChange={handleCreditLimitFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Credit Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Credit</SelectItem>
                <SelectItem value="with_limit">With Limit</SelectItem>
                <SelectItem value="no_limit">No Limit</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleClearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="min-w-0 overflow-hidden shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Customers List</span>
            {loadingCustomers && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Credit Limit</TableHead>
                <TableHead className="hidden md:table-cell">Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right min-w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-2">
                      <Building2 className="h-12 w-12 text-muted-foreground" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No customers found</h3>
                      <p className="text-muted-foreground mb-6">
                        {searchTerm || statusFilter !== 'all' || cityFilter !== 'all' || creditLimitFilter !== 'all'
                          ? 'Try adjusting your search criteria'
                          : 'Get started by adding your first customer'
                        }
                      </p>
                      {!searchTerm && statusFilter === 'all' && cityFilter === 'all' && creditLimitFilter === 'all' && (
                        <Button
                          onClick={() => setShowCreateModal(true)}
                          className="gradient-primary text-primary-foreground hover:opacity-90"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Customer
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    formatter={formatter}
                    onView={handleViewCustomer}
                    onEdit={handleEditCustomer}
                    onCreateInvoice={handleCreateInvoice}
                    onViewStatement={handleViewStatement}
                    onSendEmail={handleSendEmail}
                    onCall={handleCall}
                  />
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, customersData?.totalCount || 0)} of {customersData?.totalCount || 0} customers
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loadingCustomers}
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
                  disabled={currentPage === totalPages || loadingCustomers}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Modals */}
      <CreateCustomerModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          setShowCreateModal(false);
          toast.success('Customer created successfully!');
        }}
      />

      <ViewCustomerModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        customer={selectedCustomer}
        onEdit={() => {
          setShowViewModal(false);
          setShowEditModal(true);
        }}
        onCreateInvoice={() => {
          setShowViewModal(false);
          if (selectedCustomer) {
            handleCreateInvoice(selectedCustomer);
          }
        }}
      />

      <EditCustomerModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        customer={selectedCustomer}
        onSuccess={() => {
          setShowEditModal(false);
          setSelectedCustomer(null);
          toast.success('Customer updated successfully!');
        }}
      />

      <CreateInvoiceModal
        open={showInvoiceModal}
        onOpenChange={setShowInvoiceModal}
        onSuccess={() => {
          setShowInvoiceModal(false);
          setSelectedCustomer(null);
          toast.success('Invoice created successfully!');
        }}
        preSelectedCustomer={selectedCustomer}
      />
    </div>
  );
}
