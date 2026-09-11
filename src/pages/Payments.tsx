import { Fragment, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal';
import { ViewPaymentModal } from '@/components/payments/ViewPaymentModal';
import { ViewInvoiceModal } from '@/components/invoices/ViewInvoiceModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { useServerPagination } from '@/hooks/useServerPagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Filter,
  Eye,
  DollarSign,
  Download,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { usePayments, useDeletePayment, usePaymentSummary } from '@/hooks/useDatabase';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { generatePaymentReceiptPDF } from '@/utils/pdfGenerator';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currencyFormatter';
import { getReceiptBalances } from '@/utils/paymentReceiptBalances';
import { toCollection } from '@/utils/collection';

interface Payment {
  id: string;
  payment_number: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'cash' | 'mpesa' | 'mobile_money' | 'bank_transfer' | 'cheque';
  reference_number?: string;
  notes?: string;
  created_at?: string | null;
  customers?: {
    name: string;
    email?: string;
  };
  payment_allocations?: {
    id: string;
    invoice_number: string;
    allocated_amount: number;
    invoice_total: number;
    paid_amount?: number;
    balance_due?: number;
    allocation_created_at?: string | null;
    invoice_id?: string | null;
    project_title?: string | null;
  }[];
}

function getStatusColor(status: 'Fully allocated' | 'Partially allocated' | 'Unallocated') {
  if (status === 'Fully allocated') return 'bg-success-light text-success border-success/20';
  if (status === 'Partially allocated') return 'bg-warning-light text-warning border-warning/20';
  return 'bg-muted text-muted-foreground border-muted-foreground/20';
}

function getInvoiceStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
    case 'sent':
      return 'bg-warning-light text-warning border-warning/20';
    case 'paid':
      return 'bg-success-light text-success border-success/20';
    case 'partial':
      return 'bg-primary-light text-primary border-primary/20';
    case 'overdue':
      return 'bg-destructive-light text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

function getMethodColor(method: string) {
  switch (method) {
    case 'cash':
      return 'bg-success-light text-success border-success/20';
    case 'mpesa':
    case 'mobile_money':
      return 'bg-primary-light text-primary border-primary/20';
    case 'bank_transfer':
      return 'bg-primary-light text-primary border-primary/20';
    case 'cheque':
      return 'bg-warning-light text-warning border-warning/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

function formatPaymentMethod(method: string) {
  if (method === 'mpesa' || method === 'mobile_money') return 'M-Pesa';
  if (method === 'bank_transfer') return 'Bank Transfer';
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function formatCurrency(amount: number, currency: string = 'KES') {
  return formatCurrencyUtil(amount, currency);
}

export default function Payments() {
  const [searchParams] = useSearchParams();
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Set method filter from URL params
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter && ['all', 'thisMonth', 'cash', 'mpesa', 'bank_transfer', 'cheque'].includes(filter)) {
      setMethodFilter(filter);
    }
  }, [searchParams]);

  // Fetch live payments data and company details
  const { currentCompany: company } = useCurrentCompany();

  const pagination = useServerPagination({ initialPageSize: 10 });
  const { data: paymentData, isLoading, error } = usePayments(company?.id, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
    fetchAll: false,
  });
  const payments = toCollection(paymentData);
  const totalPayments = paymentData?.total || 0;
  const { data: invoicesData } = useInvoices(company?.id, { fetchAll: false, page: 1, pageSize: 500 });
  const invoices = toCollection(invoicesData);
  const deletePayment = useDeletePayment();
  const { data: paymentSummary } = usePaymentSummary(company?.id);


  const handleRecordPayment = () => {
    setShowRecordModal(true);
  };

  const handleViewPayment = (payment: Payment) => {
    // Payment data is already in the correct format from the database
    setSelectedPayment(payment);
    setShowViewModal(true);
  };

  const handleViewInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setShowInvoiceModal(true);
    }
  };

  const handleDeleteClick = (payment: Payment) => {
    setPaymentToDelete(payment);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!paymentToDelete || !company?.id) {
      toast.error('Missing required information for deletion');
      return;
    }

    try {
      await deletePayment.mutateAsync({
        paymentId: paymentToDelete.id,
        companyId: company.id
      });
      toast.success(`Payment ${paymentToDelete.payment_number} deleted successfully`);
      setShowDeleteConfirm(false);
      setPaymentToDelete(null);
    } catch (error) {
      console.error('Delete error caught:', error);

      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any)?.message || JSON.stringify(error);
      }

      // Clean up any [object Object] messages
      if (errorMessage.includes('[object Object]')) {
        errorMessage = 'Failed to delete payment. Please try again or contact support.';
      }

      toast.error(errorMessage, {
        duration: 6000
      });
    }
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    try {
      if (!payment.payment_allocations || payment.payment_allocations.length === 0) {
        toast.warning('No invoices associated with this payment. Receipt will be generated without invoice particulars.');
      }

      const invoiceTotals = new Map(
        invoices.map(invoice => [invoice.id, Number(invoice.total_amount || 0)]),
      );
      const receiptBalances = getReceiptBalances(payments, invoiceTotals);

      const enrichedPayment = {
        ...payment,
        payment_allocations: payment.payment_allocations?.map(alloc => {
          const invoice = invoices.find(inv => inv.invoice_number === alloc.invoice_number);
          const balance = receiptBalances.get(`${payment.id}:${alloc.id}`);

          return {
            ...alloc,
            paid_amount: invoice?.paid_amount || 0,
            balance_due: invoice?.balance_due || 0,
            previous_balance: balance?.previous_balance ?? Number(alloc.invoice_total || 0),
            due_amount: balance?.current_balance ?? Math.max(0, Number(alloc.invoice_total || 0) - Number(alloc.allocated_amount || 0))
          };
        }) || []
      };

      // Use the utility function with company details
      const companyDetails = company ? {
        name: company.name,
        address: company.address,
        city: company.city,
        country: company.country,
        phone: company.phone,
        email: company.email,
        tax_number: company.tax_number,
        logo_url: company.logo_url,
        header_image: company.header_image,
        stamp_image: company.stamp_image,
        company_services: company.company_services
      } : undefined;

      await generatePaymentReceiptPDF(enrichedPayment, companyDetails);
      toast.success(`Receipt downloaded for payment ${payment.payment_number}`);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt. Please try again.');
    }
  };

  // Removed inline PDF generation function - now using utility function

  const sortedPayments = [...payments].sort((a, b) => {
    const paymentDateDifference = new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
    if (paymentDateDifference !== 0) return paymentDateDifference;

    const createdAtDifference = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    if (createdAtDifference !== 0) return createdAtDifference;

    return b.id.localeCompare(a.id);
  });

  const filteredPayments = sortedPayments.filter(payment => {
    let matchesFilter = true;
    if (methodFilter === 'all') {
      matchesFilter = true;
    } else if (methodFilter === 'thisMonth') {
      const paymentDate = new Date(payment.payment_date);
      const now = new Date();
      matchesFilter = paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    } else {
      matchesFilter = methodFilter === 'mpesa'
        ? payment.payment_method === 'mpesa' || payment.payment_method === 'mobile_money'
        : payment.payment_method === methodFilter;
    }

    return matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground">Loading payment data...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const errorMsg = parseErrorMessage(error);
    const isNetworkError = errorMsg?.toLowerCase().includes('network') ||
                          errorMsg?.toLowerCase().includes('failed to fetch') ||
                          errorMsg?.toLowerCase().includes('unable to connect');

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          </div>
        </div>

        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive mb-1">
                    {isNetworkError ? 'Connection Error' : 'Error Loading Payments'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {errorMsg}
                  </p>

                  {isNetworkError && (
                    <div className="bg-background border border-muted rounded-md p-3 text-sm space-y-2">
                      <p className="font-medium text-foreground">Troubleshooting steps:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Check your internet connection</li>
                        <li>Try refreshing the page (Ctrl+R or Cmd+R)</li>
                        <li>Clear your browser cache</li>
                        <li>Wait a moment and try again</li>
                        <li>If the problem persists, Supabase service may be temporarily unavailable</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Retry Loading Payments
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  }

  // Summary stats from server-side aggregation queries
  const summary = paymentSummary || { todayTotal: 0, monthTotal: 0, monthCount: 0 };
  const totalReceivedToday = summary.todayTotal;
  const totalThisMonth = summary.monthTotal;
  const completedThisMonth = summary.monthCount;
  
  const pendingAmount = 0; // All payments in system are completed when recorded

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">
            Track and manage customer payments (All amounts in KES)
          </p>
        </div>
        <Button className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card" size="lg" onClick={handleRecordPayment}>
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>


      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Received Today</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalReceivedToday)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Badge className="bg-success-light text-success">{completedThisMonth}</Badge>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed This Month</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Badge className="bg-warning-light text-warning">0</Badge>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['all', 'cash', 'mpesa', 'bank_transfer'].map((method) => {
          let count = 0;
          let label = method;
          if (method === 'all') {
            count = payments.length;
            label = 'All Payments';
          } else if (method === 'mpesa') {
            count = payments.filter(p => p.payment_method === 'mpesa' || p.payment_method === 'mobile_money').length;
            label = 'M-Pesa';
          } else if (method === 'bank_transfer') {
            count = payments.filter(p => p.payment_method === 'bank_transfer').length;
            label = 'Bank Transfer';
          } else {
            count = payments.filter(p => p.payment_method === method).length;
            label = method.charAt(0).toUpperCase() + method.slice(1);
          }
          const isActive = methodFilter === method;
          return (
            <Card
              key={method}
              className={`shadow-card cursor-pointer hover:shadow-lg transition-shadow ${isActive ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setMethodFilter(isActive ? 'all' : method)}
            >
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{isActive ? 'Filtering...' : 'Click to filter'}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={pagination.debouncedSearch}
                onChange={(e) => pagination.setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No payments found</h3>
              <p className="text-muted-foreground mb-4">
                {pagination.debouncedSearch 
                  ? 'Try adjusting your search criteria'
                  : 'Record your first payment to get started'
                }
              </p>
              {!pagination.debouncedSearch && (
                <Button onClick={handleRecordPayment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Payment Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Invoice Total</TableHead>
                    <TableHead>Invoice Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount (KES)</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference / Notes</TableHead>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const allocations = payment.payment_allocations || [];
                    const totalAllocated = allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_amount || 0), 0);
                    const unallocatedAmount = Math.max(0, payment.amount - totalAllocated);
                    const status = totalAllocated <= 0
                      ? 'Unallocated'
                      : unallocatedAmount > 0.01
                        ? 'Partially allocated'
                        : 'Fully allocated';
                    const isExpanded = expandedPayments.has(payment.id);
                    const firstAllocation = allocations.length > 0 ? allocations[0] : null;
                    const firstInvoice = firstAllocation ? invoices.find(inv => inv.invoice_number === firstAllocation.invoice_number) : null;

                    return (
                      <Fragment key={payment.id}>
                        <TableRow className="hover:bg-muted/50">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setExpandedPayments((current) => {
                                const next = new Set(current);
                                if (next.has(payment.id)) next.delete(payment.id); else next.add(payment.id);
                                return next;
                              })}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} allocation details for ${payment.payment_number}`}
                              title={`${isExpanded ? 'Hide' : 'Show'} invoice allocations`}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{payment.payment_number}</TableCell>
                          <TableCell>{payment.customers?.name || 'N/A'}</TableCell>
                          <TableCell>
                            {firstAllocation ? (
                              <Button
                                variant="link"
                                className="p-0 h-auto font-medium text-primary hover:underline"
                                onClick={() => firstInvoice && handleViewInvoice(firstInvoice.id)}
                                disabled={!firstInvoice}
                              >
                                {firstAllocation.invoice_number}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {allocations.length > 1 && <div className="text-xs text-muted-foreground">+{allocations.length - 1} more</div>}
                          </TableCell>
                          <TableCell>
                            {firstInvoice ? new Date(firstInvoice.invoice_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            {firstInvoice ? formatCurrency(firstInvoice.total_amount) : '—'}
                          </TableCell>
                          <TableCell>
                            {firstInvoice ? (
                              <Badge variant="outline" className={getInvoiceStatusColor(firstInvoice.status)}>
                                {firstInvoice.status}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-semibold text-success">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getMethodColor(payment.payment_method)}>
                              {formatPaymentMethod(payment.payment_method)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-48">
                            {payment.reference_number && <div className="truncate font-mono text-xs">{payment.reference_number}</div>}
                            {payment.notes && <div className="truncate text-xs text-muted-foreground" title={payment.notes}>{payment.notes}</div>}
                            {!payment.reference_number && !payment.notes && <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{formatCurrency(totalAllocated)}</div>
                            <div className="text-xs text-muted-foreground">{allocations.length} invoice{allocations.length === 1 ? '' : 's'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(status)}>{status}</Badge>
                            {unallocatedAmount > 0.01 && <div className="mt-1 text-xs text-muted-foreground">{formatCurrency(unallocatedAmount)} open</div>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => handleViewPayment(payment)} title="View payment details"><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(payment)} title="Download receipt"><Download className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(payment)} title="Delete payment" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deletePayment.isPending}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={14} className="p-4">
                              {allocations.length > 0 ? (
                                <div className="rounded-md border">
                                  <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 text-sm font-medium"><FileText className="h-4 w-4" />Invoice applications</div>
                                  <Table>
                                    <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Invoice total</TableHead><TableHead>Previously paid</TableHead><TableHead>This payment</TableHead><TableHead>Balance due</TableHead><TableHead>Applied at</TableHead></TableRow></TableHeader>
                                    <TableBody>{allocations.map((allocation) => (
                                      <TableRow key={allocation.id}>
                                        <TableCell className="font-medium text-primary">{allocation.invoice_number}</TableCell>
                                        <TableCell>{formatCurrency(allocation.invoice_total)}</TableCell>
                                        <TableCell>{formatCurrency(Math.max(0, Number(allocation.paid_amount || 0) - Number(allocation.allocated_amount || 0)))}</TableCell>
                                        <TableCell className="font-medium text-success">{formatCurrency(Number(allocation.allocated_amount || 0))}</TableCell>
                                        <TableCell>{formatCurrency(allocation.balance_due ?? Math.max(0, allocation.invoice_total - Number(allocation.paid_amount || 0)))}</TableCell>
                                        <TableCell>{allocation.allocation_created_at ? new Date(allocation.allocation_created_at).toLocaleString() : '—'}</TableCell>
                                      </TableRow>
                                    ))}</TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" />This payment has not been applied to an invoice.</div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.page}
                totalPages={Math.ceil(totalPayments / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalPayments}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={showRecordModal}
        onOpenChange={setShowRecordModal}
        onSuccess={() => {
          setShowRecordModal(false);
          toast.success('Payment recorded successfully!');
        }}
        invoice={undefined} // For standalone payment recording
      />



      {/* View Payment Modal */}
      <ViewPaymentModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        payment={selectedPayment}
        onDownloadReceipt={handleDownloadReceipt}
        onSendReceipt={(payment) => toast.info(`Sending receipt for payment ${payment.payment_number}`)}
      />

      {/* View Invoice Modal */}
      {selectedInvoice && (
        <ViewInvoiceModal
          open={showInvoiceModal}
          onOpenChange={setShowInvoiceModal}
          invoice={selectedInvoice}
          onEdit={() => {
            setShowInvoiceModal(false);
            toast.info(`Editing invoice ${selectedInvoice.invoice_number}`);
          }}
          onDownload={() => toast.info(`Downloading invoice ${selectedInvoice.invoice_number}`)}
          onSend={() => toast.info(`Sending invoice ${selectedInvoice.invoice_number}`)}
          onRecordPayment={() => {
            setShowInvoiceModal(false);
            toast.info(`Recording payment for invoice ${selectedInvoice.invoice_number}`);
          }}
        />
      )}

      {/* Delete Payment Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete payment {paymentToDelete?.payment_number}? This will reverse all allocations and update invoice balances. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deletePayment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePayment.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
