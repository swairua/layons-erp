import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
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
  DollarSign,
  Download,
  Send,
  Calendar,
  Receipt,
  Truck,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useCompanies, useDeleteInvoice } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { EditInvoiceModal } from '@/components/invoices/EditInvoiceModal';
import { ViewInvoiceModal } from '@/components/invoices/ViewInvoiceModal';
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal';
import { CreateDeliveryNoteModal } from '@/components/delivery/CreateDeliveryNoteModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { RLSErrorDialog } from '@/components/RLSErrorDialog';
import { fixRLSWithProperOrder } from '@/utils/fixRLSProperOrder';
import { isRLSError } from '@/utils/RLSError';
import { downloadInvoicePDF } from '@/utils/pdfGenerator';
import { fixInvoiceColumns, calculateInvoiceStatus } from '@/utils/fixInvoiceColumns';
import { supabase } from '@/integrations/supabase/client';

interface Invoice {
  id: string;
  invoice_number: string;
  customers: {
    name: string;
    email?: string;
  };
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';
  invoice_items?: any[];
  currency?: string;
  terms_and_conditions?: string;
  notes?: string;
  subtotal?: number;
  tax_amount?: number;
}

function getStatusColor(status: string) {
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

export default function Invoices() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeliveryNoteModal, setShowDeliveryNoteModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; invoice?: Invoice }>({ open: false });
  const [isFixingData, setIsFixingData] = useState(false);
  const [showRLSErrorDialog, setShowRLSErrorDialog] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueDateStatusFilter, setDueDateStatusFilter] = useState<'all' | 'overdue' | 'aging' | 'current'>('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [dueDateFromFilter, setDueDateFromFilter] = useState('');
  const [dueDateToFilter, setDueDateToFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [amountFromFilter, setAmountFromFilter] = useState('');
  const [amountToFilter, setAmountToFilter] = useState('');

  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { logDelete } = useAuditLog();

  // Use the fixed invoices hook
  const { data: invoices, isLoading, error, refetch } = useInvoices(currentCompany?.id);
  const deleteInvoice = useDeleteInvoice();

  // Set dueStatus filter from URL params
  useEffect(() => {
    const dueStatus = searchParams.get('dueStatus');
    if (dueStatus && ['overdue', 'aging', 'current'].includes(dueStatus)) {
      setDueDateStatusFilter(dueStatus as 'all' | 'overdue' | 'aging' | 'current');
    }
  }, [searchParams]);

  // Fix invoice data on page load
  useEffect(() => {
    if (currentCompany?.id && !isFixingData) {
      const performFix = async () => {
        setIsFixingData(true);
        try {
          const result = await fixInvoiceColumns(currentCompany.id);
          if (result.success) {
            console.log('Invoice columns fixed successfully:', result.message);
          } else {
            console.warn('Invoice column fix had issues but continuing:', result.message);
          }
          refetch();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
          console.error('Error fixing invoice columns:', errorMsg);
          // Don't show error toast, silently continue - invoices will still load with calculated values
        } finally {
          setIsFixingData(false);
        }
      };
      performFix();
    }
  }, [currentCompany?.id]);

  const handleDeleteClick = (invoice: Invoice) => {
    setDeleteDialog({ open: true, invoice });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.invoice || !currentCompany?.id) return;
    try {
      await deleteInvoice.mutateAsync(deleteDialog.invoice.id);

      // Log the delete action
      await logDelete(
        currentCompany.id,
        'invoice',
        deleteDialog.invoice.id,
        deleteDialog.invoice.invoice_number,
        deleteDialog.invoice.invoice_number,
        {
          customerName: deleteDialog.invoice.customers?.name,
          totalAmount: deleteDialog.invoice.total_amount,
          deletedAt: new Date().toISOString(),
        }
      );

      toast.success('Invoice deleted successfully');
      refetch();
      setDeleteDialog({ open: false });
    } catch (err) {
      console.error('Delete failed', err);

      // Check if this is an RLS error using our custom error type
      if (isRLSError(err)) {
        console.log('🔧 RLS Error Detected - showing fix dialog');
        setShowRLSErrorDialog(true);
      } else {
        const errorMessage = parseErrorMessage(err);
        toast.error(`Failed to delete invoice: ${errorMessage}`);
      }
    }
  };

  // Categorize invoices by due date status
  const categorizeInvoice = (invoice: Invoice) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'aging';
    return 'current';
  };

  // Calculate summary stats
  const invoiceSummary = {
    overdue: invoices?.filter(inv => categorizeInvoice(inv) === 'overdue').length || 0,
    aging: invoices?.filter(inv => categorizeInvoice(inv) === 'aging').length || 0,
    current: invoices?.filter(inv => categorizeInvoice(inv) === 'current').length || 0,
  };

  // Filter and search logic
  const filteredInvoices = invoices?.filter(invoice => {
    // Search filter
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customers?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter - use calculated status
    const calculatedStatus = calculateInvoiceStatus(invoice);
    const matchesStatus = statusFilter === 'all' || calculatedStatus === statusFilter;

    // Invoice Date filter
    const invoiceDate = new Date(invoice.invoice_date);
    const matchesDateFrom = !dateFromFilter || invoiceDate >= new Date(dateFromFilter);
    const matchesDateTo = !dateToFilter || invoiceDate <= new Date(dateToFilter);

    // Due Date filter
    const dueDate = new Date(invoice.due_date);
    const matchesDueDateFrom = !dueDateFromFilter || dueDate >= new Date(dueDateFromFilter);
    const matchesDueDateTo = !dueDateToFilter || dueDate <= new Date(dueDateToFilter);

    // Due Date Status filter (Overdue, Aging, Current)
    const invoiceDueDateStatus = categorizeInvoice(invoice);
    const matchesDueDateStatus = dueDateStatusFilter === 'all' || invoiceDueDateStatus === dueDateStatusFilter;

    // Amount filter
    const matchesAmountFrom = !amountFromFilter || (invoice.total_amount || 0) >= parseFloat(amountFromFilter);
    const matchesAmountTo = !amountToFilter || (invoice.total_amount || 0) <= parseFloat(amountToFilter);

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo && matchesDueDateFrom && matchesDueDateTo && matchesDueDateStatus && matchesAmountFrom && matchesAmountTo;
  }) || [];

  // Pagination hook
  const pagination = usePagination(filteredInvoices, { initialPageSize: 10 });
  const paginatedInvoices = pagination.paginatedItems;

  const formatCurrency = (amount: number, currency: string = 'KES') => {
    const localeMap: { [key: string]: string } = {
      'KES': 'en-KE',
      'USD': 'en-US',
      'EUR': 'en-GB',
      'GBP': 'en-GB',
      'JPY': 'ja-JP',
      'INR': 'en-IN',
    };

    return new Intl.NumberFormat(localeMap[currency] || 'en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };


  const handleCreateSuccess = () => {
    refetch();
    toast.success('Invoice created successfully!');
  };

  const handleEditSuccess = () => {
    refetch();
    setSelectedInvoice(null);
    toast.success('Invoice updated successfully!');
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    try {
      console.log('🔍 handleEditInvoice called for:', invoice.invoice_number);
      console.log('📋 Invoice ID:', invoice.id, 'Type:', typeof invoice.id, 'Length:', invoice.id?.length);
      console.log('📋 Current invoice_items count:', invoice.invoice_items?.length || 0);

      // Validate that invoice.id is a valid UUID (should be 36 characters with dashes)
      const isValidUUID = invoice.id && typeof invoice.id === 'string' && invoice.id.length === 36 && invoice.id.includes('-');
      console.log('✔️ Is valid UUID?', isValidUUID);

      if (!isValidUUID) {
        console.error('❌ Invalid invoice ID format:', invoice.id);
        toast.error('Invalid invoice ID format. Cannot load items for editing.');
        return;
      }

      // Ensure invoice has items; if not, fetch them
      let enrichedInvoice: any = invoice;

      if (!invoice.invoice_items || invoice.invoice_items.length === 0) {
        console.log('⚠️ No invoice items found, fetching from database for ID:', invoice.id);
        const { data: items, error } = await supabase
          .from('invoice_items')
          .select(`
            id,
            invoice_id,
            product_id,
            description,
            quantity,
            unit_price,
            discount_percentage,
            discount_before_vat,
            tax_percentage,
            tax_amount,
            tax_inclusive,
            line_total,
            sort_order,
            unit_of_measure,
            section_name,
            section_labor_cost,
            products(id, name, product_code, unit_of_measure)
          `)
          .eq('invoice_id', invoice.id)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('❌ Failed to fetch invoice items - Error:', error);
          toast.error(`Failed to load invoice items: ${error.message}`);
          return;
        }

        console.log('✅ Invoice items fetched from DB:', items?.length || 0);
        enrichedInvoice = { ...invoice, invoice_items: items || [] };
      } else {
        console.log('✅ Invoice already has items:', invoice.invoice_items.length);
      }

      console.log('🔐 Setting selected invoice with items:', enrichedInvoice.invoice_items?.length || 0);
      setSelectedInvoice(enrichedInvoice);
      setShowEditModal(true);
    } catch (error) {
      console.error('❌ Error in handleEditInvoice:', error);
      toast.error('Failed to load invoice for editing');
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      // Ensure invoice has items; if not, fetch them on demand
      let enrichedInvoice: any = invoice;

      console.log('📄 Starting invoice PDF download for:', invoice.invoice_number);
      console.log('📋 Invoice items present:', invoice.invoice_items?.length || 0);

      if (!invoice.invoice_items || invoice.invoice_items.length === 0) {
        console.log('⚠️ No invoice items found, fetching from database...');
        const { data: items, error } = await supabase
          .from('invoice_items')
          .select(`
            id,
            invoice_id,
            product_id,
            description,
            quantity,
            unit_price,
            discount_percentage,
            discount_before_vat,
            tax_percentage,
            tax_amount,
            tax_inclusive,
            line_total,
            sort_order,
            unit_of_measure,
            section_name,
            section_labor_cost,
            products(id, name, product_code, unit_of_measure)
          `)
          .eq('invoice_id', invoice.id)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('❌ Failed to fetch invoice items:', error);
          toast.error('Failed to load invoice items for PDF');
          return;
        }

        console.log('✅ Invoice items fetched:', items?.length || 0);
        enrichedInvoice = { ...invoice, invoice_items: items || [] };
      }

      console.log('📦 Final invoice items for PDF:', enrichedInvoice.invoice_items?.length || 0);

      // Get current company details for PDF
      const companyDetails = currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        phone: currentCompany.phone,
        email: currentCompany.email,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        header_image: currentCompany.header_image,
        stamp_image: currentCompany.stamp_image,
        company_services: currentCompany.company_services
      } : undefined;

      await downloadInvoicePDF(enrichedInvoice, 'INVOICE', companyDetails);
      toast.success(`Invoice ${invoice.invoice_number} PDF downloaded`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to download PDF: ${errorMessage}`);
    }
  };

  const handleSendInvoice = async (invoice: Invoice | string) => {
    const invoiceData = typeof invoice === 'string'
      ? invoices?.find(inv => inv.id === invoice)
      : invoice;

    if (!invoiceData) {
      toast.error('Invoice not found');
      return;
    }

    if (!invoiceData.customers?.email) {
      toast.error('Customer email not available');
      return;
    }

    try {
      // Create email content
      const subject = `Invoice ${invoiceData.invoice_number} from Layons Construction Limited`;
      const body = `Dear ${invoiceData.customers.name},

Please find attached your invoice ${invoiceData.invoice_number} dated ${new Date(invoiceData.invoice_date).toLocaleDateString()}.

Invoice Summary:
- Invoice Amount: ${formatCurrency(invoiceData.total_amount || 0, invoiceData.currency || 'KES')}
- Due Date: ${new Date(invoiceData.due_date).toLocaleDateString()}
- Balance Due: ${formatCurrency(invoiceData.balance_due || 0, invoiceData.currency || 'KES')}

Payment can be made via:
- Bank Transfer
- Mobile Money (M-Pesa)
- Cheque

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
Layons Construction Limited Team
Tel: 0720717463
Email: layonscoltd@gmail.com
Website:`;

      // Open email client with pre-filled content
      const emailUrl = `mailto:${invoiceData.customers.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(emailUrl, '_blank');

      toast.success(`Email client opened with invoice ${invoiceData.invoice_number} for ${invoiceData.customers.email}`);

      // TODO: In a real app, update invoice status to 'sent'

    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice email. Please try again.');
    }
  };

  const handleRecordPayment = (invoice: Invoice | string) => {
    const invoiceData = typeof invoice === 'string'
      ? invoices?.find(inv => inv.id === invoice)
      : invoice;

    if (!invoiceData) {
      toast.error('Invoice not found');
      return;
    }

    setSelectedInvoice(invoiceData);
    setShowPaymentModal(true);
  };

  const handleCreateDeliveryNote = (invoice: Invoice) => {
    if (!invoice) {
      toast.error('Invoice not found');
      return;
    }

    setSelectedInvoice(invoice);
    setShowDeliveryNoteModal(true);
    toast.info(`Creating delivery note for invoice ${invoice.invoice_number}`);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setDueDateStatusFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setDueDateFromFilter('');
    setDueDateToFilter('');
    setCustomerFilter('all');
    setAmountFromFilter('');
    setAmountToFilter('');
    setSearchTerm('');
    toast.success('Filters cleared');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground">Create and manage customer invoices</p>
          </div>
        </div>
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive">Error loading invoices: {parseErrorMessage(error)}</p>
              <Button 
                variant="outline" 
                onClick={() => refetch()}
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
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage customer invoices
          </p>
        </div>
        <Button
          className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card"
          size="lg"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices by customer or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="date-from">Invoice Date From</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date-to">Invoice Date To</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="due-date-from">Due Date From</Label>
                      <Input
                        id="due-date-from"
                        type="date"
                        value={dueDateFromFilter}
                        onChange={(e) => setDueDateFromFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due-date-to">Due Date To</Label>
                      <Input
                        id="due-date-to"
                        type="date"
                        value={dueDateToFilter}
                        onChange={(e) => setDueDateToFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="amount-from">Amount From</Label>
                      <Input
                        id="amount-from"
                        type="number"
                        placeholder="0.00"
                        value={amountFromFilter}
                        onChange={(e) => setAmountFromFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount-to">Amount To</Label>
                      <Input
                        id="amount-to"
                        type="number"
                        placeholder="0.00"
                        value={amountToFilter}
                        onChange={(e) => setAmountToFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="shadow-card cursor-pointer hover:shadow-lg transition-shadow border-destructive/20 hover:border-destructive/40"
          onClick={() => setDueDateStatusFilter(dueDateStatusFilter === 'overdue' ? 'all' : 'overdue')}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Overdue</p>
                </div>
                <Badge variant="destructive" className="text-lg font-bold px-3 py-1">
                  {invoiceSummary.overdue}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {dueDateStatusFilter === 'overdue' ? 'Showing overdue invoices' : 'Click to filter'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="shadow-card cursor-pointer hover:shadow-lg transition-shadow border-warning/20 hover:border-warning/40"
          onClick={() => setDueDateStatusFilter(dueDateStatusFilter === 'aging' ? 'all' : 'aging')}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-warning" />
                  <p className="text-sm font-medium text-warning">Due Soon</p>
                </div>
                <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                  {invoiceSummary.aging}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {dueDateStatusFilter === 'aging' ? 'Showing invoices due within 7 days' : 'Click to filter'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="shadow-card cursor-pointer hover:shadow-lg transition-shadow border-success/20 hover:border-success/40"
          onClick={() => setDueDateStatusFilter(dueDateStatusFilter === 'current' ? 'all' : 'current')}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <p className="text-sm font-medium text-success">Valid</p>
                </div>
                <Badge className="text-lg font-bold px-3 py-1 bg-success text-success-foreground">
                  {invoiceSummary.current}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {dueDateStatusFilter === 'current' ? 'Showing valid invoices' : 'Click to filter'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="h-5 w-5 text-primary" />
            <span>Invoices List</span>
            {!isLoading && (
              <Badge variant="outline" className="ml-auto">
                {filteredInvoices.length} invoices
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No invoices found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm 
                  ? 'Try adjusting your search criteria'
                  : 'Get started by creating your first invoice'
                }
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="gradient-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice: Invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          <span>{invoice.invoice_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.customers?.name || 'Unknown Customer'}</div>
                          {invoice.customers?.email && (
                            <div className="text-sm text-muted-foreground">{invoice.customers.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(invoice.total_amount || 0, invoice.currency || 'KES')}
                      </TableCell>
                      <TableCell className="text-success">
                        {formatCurrency(invoice.paid_amount ?? 0, invoice.currency || 'KES')}
                      </TableCell>
                      <TableCell className={`font-medium ${((invoice.balance_due ?? (invoice.total_amount || 0) - (invoice.paid_amount ?? 0)) || 0) > 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCurrency(invoice.balance_due ?? (invoice.total_amount || 0) - (invoice.paid_amount ?? 0), invoice.currency || 'KES')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(calculateInvoiceStatus(invoice))}>
                          {calculateInvoiceStatus(invoice).charAt(0).toUpperCase() + calculateInvoiceStatus(invoice).slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewInvoice(invoice)}
                            title="View invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditInvoice(invoice)}
                              title="Edit invoice"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadInvoice(invoice)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {/* Create Delivery Note - Available for sent/paid invoices */}
                          {(invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'partial') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCreateDeliveryNote(invoice)}
                              title="Create delivery note"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(invoice)}
                            title="Delete invoice"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {invoice.status !== 'paid' && (
                            <>
                              {invoice.status === 'draft' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendInvoice(invoice.id)}
                                  className="bg-primary-light text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground"
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Send
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRecordPayment(invoice)}
                                className="bg-success-light text-success border-success/20 hover:bg-success hover:text-success-foreground"
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                {(invoice.balance_due || 0) > 0 ? 'Record Payment' : 'Payment Adjustment'}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={pagination.setCurrentPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />

      {/* View Invoice Modal */}
      {selectedInvoice && (
        <ViewInvoiceModal
          open={showViewModal}
          onOpenChange={setShowViewModal}
          invoice={selectedInvoice}
          onEdit={() => {
            setShowViewModal(false);
            setShowEditModal(true);
          }}
          onDownload={() => handleDownloadInvoice(selectedInvoice)}
          onSend={() => handleSendInvoice(selectedInvoice.id)}
          onRecordPayment={() => handleRecordPayment(selectedInvoice.id)}
        />
      )}

      {/* Edit Invoice Modal */}
      {selectedInvoice && (
        <EditInvoiceModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSuccess={handleEditSuccess}
          invoice={selectedInvoice}
        />
      )}

      {/* Record Payment Modal */}
      {selectedInvoice && (
        <RecordPaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          onSuccess={() => {
            refetch();
            setSelectedInvoice(null);
            toast.success('Payment recorded successfully!');
          }}
          invoice={selectedInvoice}
        />
      )}

      {/* Create Delivery Note Modal */}
      <CreateDeliveryNoteModal
        open={showDeliveryNoteModal}
        onOpenChange={setShowDeliveryNoteModal}
        invoiceId={selectedInvoice?.id}
        onSuccess={() => {
          setShowDeliveryNoteModal(false);
          toast.success('Delivery note created successfully!');
        }}
      />

      <ConfirmationDialog
        open={deleteDialog.open}
        title="Delete Invoice"
        description={deleteDialog.invoice ? `Are you sure you want to delete invoice ${deleteDialog.invoice.invoice_number}? This action cannot be undone.` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ open: false })}
        confirmText="Delete"
      />

      <RLSErrorDialog
        open={showRLSErrorDialog}
        onOpenChange={setShowRLSErrorDialog}
        onSuccess={() => {
          refetch();
          setDeleteDialog({ open: false });
        }}
        invoiceName={deleteDialog.invoice?.invoice_number}
      />
    </div>
  );
}
