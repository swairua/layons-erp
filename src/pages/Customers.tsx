import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { useServerPagination } from '@/hooks/useServerPagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
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
  Mail,
  Phone,
  FileText,
  DollarSign,
  Building2,
  MapPin
} from 'lucide-react';
import { useCustomers, useCompanies } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/currencyFormatter';
import { EditCustomerModal } from '@/components/customers/EditCustomerModal';
import { ViewCustomerModal } from '@/components/customers/ViewCustomerModal';
import { CreateCustomerModal } from '@/components/customers/CreateCustomerModal';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { generateCustomerStatementPDF } from '@/utils/pdfGenerator';
import { toCollection } from '@/utils/collection';

interface Customer {
  id: string;
  customer_code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  credit_limit?: number;
  payment_terms?: number;
  is_active?: boolean;
  created_at?: string;
}

function getStatusColor(isActive: boolean) {
  return isActive 
    ? 'bg-success-light text-success border-success/20'
    : 'bg-muted text-muted-foreground border-muted-foreground/20';
}

export default function Customers() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [creditLimitFilter, setCreditLimitFilter] = useState('all');
  
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];

  const pagination = useServerPagination({ initialPageSize: 10 });
  const { data: customersData, isLoading, error } = useCustomers(currentCompany?.id, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
    fetchAll: false,
  });
  const customers = toCollection(customersData);
  const totalCustomers = customersData?.total || 0;

  // Client-side filters for status/city/creditLimit (small dataset, applied on top of server results)
  const filteredCustomers = customers.filter(customer => {
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && customer.is_active !== false) ||
      (statusFilter === 'inactive' && customer.is_active === false);
    const matchesCity = cityFilter === 'all' || customer.city === cityFilter;
    const matchesCreditLimit = creditLimitFilter === 'all' ||
      (creditLimitFilter === 'no_limit' && !customer.credit_limit) ||
      (creditLimitFilter === 'with_limit' && customer.credit_limit);
    return matchesStatus && matchesCity && matchesCreditLimit;
  });

  const displayCurrency = (amount: number) => {
    return formatCurrency(amount, currentCompany?.currency || 'KES');
  };


  const handleCreateCustomer = () => {
    setShowCreateModal(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  const handleCreateInvoice = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowInvoiceModal(true);
  };

  const handleViewStatement = async (customer: Customer) => {
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
  };

  const handleEditSuccess = () => {
    // Customer list will refresh automatically due to React Query cache invalidation
    setSelectedCustomer(null);
  };

  const handleCreateSuccess = () => {
    // Customer list will refresh automatically due to React Query cache invalidation
    setShowCreateModal(false);
  };

  const handleSendEmail = (email: string) => {
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
  };

  const handleCall = (phone: string) => {
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
  };

  const [showFilters, setShowFilters] = useState(false);

  const handleFilter = () => {
    setShowFilters(!showFilters);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCityFilter('all');
    setCreditLimitFilter('all');
    pagination.setSearch('');
    toast.success('Filters cleared');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Manage your customer database</p>
          </div>
        </div>
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive">Error loading customers: {error.message}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer database and relationships
          </p>
        </div>
        <Button
          className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card"
          size="lg"
          onClick={handleCreateCustomer}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Customer
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, code, or email..."
                value={pagination.debouncedSearch}
                onChange={(e) => pagination.setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filter Customers</h4>
                    <p className="text-sm text-muted-foreground">
                      Filter customers by status, location, and credit settings.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="inactive">Inactive Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="city-filter">City</Label>
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All cities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {Array.from(new Set(customers?.map(c => c.city).filter(Boolean))).map(city => (
                          <SelectItem key={city} value={city!}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="credit-filter">Credit Limit</Label>
                    <Select value={creditLimitFilter} onValueChange={setCreditLimitFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All credit settings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="with_limit">With Credit Limit</SelectItem>
                        <SelectItem value="no_limit">No Credit Limit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleClearFilters} variant="outline" className="w-full">
                    Clear All Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Customers List</span>
            {!isLoading && (
              <Badge variant="outline" className="ml-auto">
                {totalCustomers} customers
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No customers found</h3>
              <p className="text-muted-foreground mb-6">
                {pagination.debouncedSearch 
                  ? 'Try adjusting your search criteria'
                  : 'Get started by adding your first customer'
                }
              </p>
              {!pagination.debouncedSearch && (
                <Button
                  onClick={handleCreateCustomer}
                  className="gradient-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Customer
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
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
                {filteredCustomers.map((customer: Customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50 transition-smooth">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                            {customer.name.charAt(0).toUpperCase()}
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
                      {displayCurrency(customer.credit_limit || 0)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {customer.payment_terms || 30} days
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(customer.is_active !== false)}>
                        {customer.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Icon Actions */}
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewCustomer(customer)}
                            title="View customer details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCustomer(customer)}
                            title="Edit customer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {customer.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSendEmail(customer.email!)}
                              title="Send email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          {customer.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCall(customer.phone!)}
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
                            onClick={() => handleCreateInvoice(customer)}
                            className="bg-primary-light text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Invoice</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewStatement(customer)}
                            className="bg-secondary-light text-secondary border-secondary/20 hover:bg-secondary hover:text-secondary-foreground"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Statement</span>
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              <PaginationControls
                currentPage={pagination.page}
                totalPages={Math.ceil(totalCustomers / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalCustomers}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Modals */}
      <CreateCustomerModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
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
        onSuccess={handleEditSuccess}
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
