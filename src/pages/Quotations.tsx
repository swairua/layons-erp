import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  FileText,
  Download,
  Calendar,
  Send,
  Trash2
} from 'lucide-react';
import { useQuotations, useDeleteQuotation } from '@/hooks/useDatabase';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currencyFormatter';
import { useConvertQuotationToInvoice } from '@/hooks/useQuotationItems';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateQuotationModal } from '@/components/quotations/CreateQuotationModal';
import { ViewQuotationModal } from '@/components/quotations/ViewQuotationModal';
import { EditQuotationModal } from '@/components/quotations/EditQuotationModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { downloadQuotationPDF } from '@/utils/pdfGenerator';
import { toCollection } from '@/utils/collection';

interface Quotation {
  id: string;
  quotation_number: string;
  customers: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  quotation_date: string;
  valid_until?: string;
  total_amount: number;
  currency?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'processed';
  quotation_items?: any[];
  subtotal?: number;
  tax_amount?: number;
  notes?: string;
  terms_and_conditions?: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
    case 'sent':
      return 'bg-warning-light text-warning border-warning/20';
    case 'accepted':
      return 'bg-success-light text-success border-success/20';
    case 'processed':
      return 'bg-success-light text-success border-success/20';
    case 'rejected':
      return 'bg-destructive-light text-destructive border-destructive/20';
    case 'expired':
      return 'bg-destructive-light text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

export default function Quotations() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [convertingQuotationId, setConvertingQuotationId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; quotation?: Quotation }>({ open: false });
  const [autoDownloadTriggered, setAutoDownloadTriggered] = useState(false);

  const { profile, loading: authLoading } = useAuth();
  const { currentCompany } = useCurrentCompany();

  const pagination = useServerPagination({ initialPageSize: 10 });
  const { data: quotationData, isLoading, error, refetch } = useQuotations(currentCompany?.id, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
    fetchAll: false,
  });
  const quotations = toCollection(quotationData);
  const totalQuotations = Array.isArray(quotationData)
    ? quotationData.length
    : quotationData?.total || quotations.length;
  const deleteQuotation = useDeleteQuotation();

  // Set status filter from URL params
  useEffect(() => {
    const status = searchParams.get('status');
    if (status && ['draft', 'sent', 'accepted', 'rejected', 'expired', 'processed'].includes(status)) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const handleDeleteClick = (quotation: Quotation) => {
    setDeleteDialog({ open: true, quotation });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.quotation) return;
    try {
      await deleteQuotation.mutateAsync({
        id: deleteDialog.quotation.id,
        companyId: currentCompany?.id || ''
      });
      toast.success('Quotation deleted successfully');
      refetch();
      setDeleteDialog({ open: false });
    } catch (err: any) {
      console.error('Delete failed', err);
      const supabaseMessage = err?.message || err?.original?.message || (err?.details || null) || JSON.stringify(err);
      toast.error(`Failed to delete quotation: ${supabaseMessage}`);
    }
  };

  const formatCurrency = (amount: number, currency?: string | null) =>
    formatCurrencyUtil(amount, currency);

  const filteredQuotations = quotations.filter(quotation => {
    const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter;
    return matchesStatus;
  });

  const handleCreateSuccess = () => {
    refetch();
    toast.success('Quotation created successfully!');
  };

  const handleViewQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    refetch();
    setSelectedQuotation(null);
    toast.success('Quotation updated successfully!');
  };

  const handleDownloadQuotation = async (quotation: Quotation) => {
    try {
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

      await downloadQuotationPDF(quotation, companyDetails);
      toast.success(`Quotation ${quotation.quotation_number} PDF downloaded`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to download PDF: ${errorMessage}`);
    }
  };

  useEffect(() => {
    try {
      if (autoDownloadTriggered) return;
      const params = new URLSearchParams(window.location.search || '');
      const downloadParam = params.get('download_quotation') || params.get('download');
      if (!downloadParam) return;
      if (!quotations || quotations.length === 0) return;

      const found = quotations.find((q: any) => q.quotation_number === downloadParam || q.id === downloadParam);
      if (found) {
        handleDownloadQuotation(found as Quotation);
        setAutoDownloadTriggered(true);

        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('download_quotation');
          url.searchParams.delete('download');
          window.history.replaceState({}, document.title, url.toString());
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.error('Auto-download check failed', e);
    }
  }, [quotations, currentCompany, autoDownloadTriggered]);

  const handleSendQuotation = async (quotation: Quotation) => {
    if (!quotation.customers?.email) {
      toast.error('Customer email not available');
      return;
    }

    try {
      const subject = `Quotation ${quotation.quotation_number} from Layons Construction Limited`;
      const body = `Dear ${quotation.customers.name},

Please find attached your quotation ${quotation.quotation_number} dated ${new Date(quotation.quotation_date).toLocaleDateString()}.

Quotation Summary:
- Total Amount: ${formatCurrency(quotation.total_amount || 0, quotation.currency || 'KES')}
- Valid Until: ${quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : 'No expiry'}

If you have any questions about this quotation, please don't hesitate to contact us.

Best regards,
Biolegend Scientific Ltd Team
Tel: 0741 207 690/0780 165 490
Email: biolegend@biolegendscientific.co.ke/info@biolegendscientific.co.ke
Website: www.biolegendscientific.co.ke`;

      const emailUrl = `mailto:${quotation.customers.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(emailUrl, '_blank');

      toast.success(`Email client opened with quotation ${quotation.quotation_number} for ${quotation.customers.email}`);
    } catch (error) {
      console.error('Error sending quotation:', error);

      let errorMessage = 'Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
        }
      }

      toast.error(`Failed to send quotation email: ${errorMessage}`);
    }
  };

  const convertQuotationMutation = useConvertQuotationToInvoice();

  const handleConvertToInvoice = async (quotation: Quotation) => {
    try {
      if (!quotation.id) {
        toast.error('Invalid quotation. Cannot convert to invoice.');
        return;
      }

      if (!currentCompany?.id) {
        toast.error('Company ID is required');
        return;
      }

      setConvertingQuotationId(quotation.id);
      try {
        await convertQuotationMutation.mutateAsync({ quotationId: quotation.id, companyId: currentCompany.id });
        toast.success(`Quotation ${quotation.quotation_number} converted to invoice successfully!`);
        refetch();
      } finally {
        setConvertingQuotationId(null);
      }
    } catch (error) {
      console.error('Error converting quotation to invoice:', error);

      let errorMessage = 'Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
        }
      }

      toast.error(`Failed to convert quotation to invoice: ${errorMessage}`);
    }
  };

  const handleFilter = () => {
    toast.info('Advanced filter functionality coming soon!');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quotations</h1>
            <p className="text-muted-foreground">Create and manage customer quotations</p>
          </div>
        </div>
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive">Error loading quotations: {(error as any).message}</p>
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Create and manage customer quotations
          </p>
        </div>
        <Button
          className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card w-full md:w-auto"
          size="sm"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Quotation
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search quotations..."
                value={pagination.debouncedSearch}
                onChange={(e) => pagination.setSearch(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleFilter} className="w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['draft', 'sent', 'accepted', 'expired'].map((status) => {
          const count = quotations?.filter(q => q.status === status).length || 0;
          const isActive = statusFilter === status;
          return (
            <Card
              key={status}
              className={`shadow-card cursor-pointer hover:shadow-lg transition-shadow ${isActive ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter(isActive ? 'all' : status)}
            >
              <CardContent className="min-w-0 pt-6">
                <div className="min-w-0 space-y-2">
                  <p className="break-words text-sm font-medium text-muted-foreground capitalize">{status}</p>
                  <p className="break-all text-lg font-bold sm:text-2xl">{count}</p>
                  <p className="break-words text-xs text-muted-foreground">{isActive ? 'Filtering...' : 'Click to filter'}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Quotations List</span>
            {!isLoading && (
              <Badge variant="outline" className="ml-auto">
                {filteredQuotations.length} quotations
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
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No quotations found</h3>
              <p className="text-muted-foreground mb-6">
                {pagination.debouncedSearch 
                  ? 'Try adjusting your search criteria'
                  : 'Get started by creating your first quotation'
                }
              </p>
              {!pagination.debouncedSearch && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="gradient-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Quotation
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotations.map((quotation: Quotation) => (
                    <TableRow key={quotation.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{quotation.quotation_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{quotation.customers?.name || 'Unknown Customer'}</div>
                          {quotation.customers?.email && (
                            <div className="text-sm text-muted-foreground">{quotation.customers.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(quotation.quotation_date).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(quotation.total_amount || 0, quotation.currency || 'KES')}
                      </TableCell>
                      <TableCell>
                        {quotation.valid_until
                          ? new Date(quotation.valid_until).toLocaleDateString()
                          : 'No expiry'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(quotation.status)}>
                          {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewQuotation(quotation)}
                              title="View quotation"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditQuotation(quotation)}
                              title="Edit quotation"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadQuotation(quotation)}
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(quotation)}
                              title="Delete quotation"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex space-x-2 ml-2">
                            {quotation.status === 'draft' && quotation.customers?.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendQuotation(quotation)}
                                className="bg-primary-light text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground"
                              >
                                <Send className="h-4 w-4 mr-1" />
                                <span className="hidden sm:inline">Send</span>
                              </Button>
                            )}
                            {quotation.status !== 'processed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConvertToInvoice(quotation)}
                                disabled={convertingQuotationId === quotation.id || !quotation.quotation_items?.length}
                                title={!quotation.quotation_items?.length ? 'Quotation must have items to convert' : 'Convert to invoice'}
                                className="bg-success-light text-success border-success/20 hover:bg-success hover:text-success-foreground"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                <span className="hidden sm:inline">{convertingQuotationId === quotation.id ? 'Converting...' : 'Convert'}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.page}
                totalPages={Math.ceil(totalQuotations / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalQuotations}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <CreateQuotationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />

      <ViewQuotationModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        quotation={selectedQuotation}
        onEdit={() => selectedQuotation && handleEditQuotation(selectedQuotation)}
        onDownload={() => selectedQuotation && handleDownloadQuotation(selectedQuotation)}
        onSend={() => selectedQuotation && handleSendQuotation(selectedQuotation)}
      />

      <EditQuotationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        quotation={selectedQuotation}
        onSuccess={handleEditSuccess}
      />

      <ConfirmationDialog
        open={deleteDialog.open}
        title="Delete Quotation"
        description={deleteDialog.quotation ? `Are you sure you want to delete quotation ${deleteDialog.quotation.quotation_number}? This action cannot be undone.` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ open: false })}
        confirmText="Delete"
      />
    </div>
  );
}
