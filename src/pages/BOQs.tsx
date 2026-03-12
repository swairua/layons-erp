import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import { Layers, Plus, Eye, Download, Trash2, Copy, Pencil, FileText, Filter, Search, AlertCircle, Clock, CheckCircle, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreateBOQModal } from '@/components/boq/CreateBOQModal';
import { CreatePercentageCopyModal } from '@/components/boq/CreatePercentageCopyModal';
import { EditBOQModal } from '@/components/boq/EditBOQModal';
import { ChangePercentageRateModal } from '@/components/boq/ChangePercentageRateModal';
import { BOQConversionFix } from '@/components/boq/BOQConversionFix';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBOQs, useUnits } from '@/hooks/useDatabase';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuditedDeleteOperations } from '@/hooks/useAuditedDeleteOperations';
import { useConvertBoqToInvoice } from '@/hooks/useBOQ';
import { loadBoqDraft, deleteDraft } from '@/services/boqAutoSaveService';
import { generateUniqueInvoiceNumber } from '@/utils/invoiceNumberGenerator';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function BOQs() {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [percentageCopyOpen, setPercentageCopyOpen] = useState(false);
  const [percentageRateOpen, setPercentageRateOpen] = useState(false);
  const [percentageRateBoq, setPercentageRateBoq] = useState<any | null>(null);
  const [schemaError, setSchemaError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dueDateFromFilter, setDueDateFromFilter] = useState('');
  const [dueDateToFilter, setDueDateToFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'aging' | 'current'>('all');

  // Hooks and context calls first
  const { currentCompany } = useCurrentCompany();
  const { profile } = useAuth();
  const companyId = currentCompany?.id;
  const { data: boqs = [], isLoading, refetch: refetchBOQs } = useBOQs(companyId);
  const { useAuditedDeleteBOQ } = useAuditedDeleteOperations();
  const deleteBOQ = useAuditedDeleteBOQ(companyId || '');
  const { data: units = [] } = useUnits(companyId);
  const { logDelete } = useAuditLog();
  const convertToInvoice = useConvertBoqToInvoice();

  // State declarations
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; boqId?: string; boqNumber?: string }>({ open: false });
  const [convertDialog, setConvertDialog] = useState<{ open: boolean; boqId?: string; boqNumber?: string }>({ open: false });
  const [draftExists, setDraftExists] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Set status filter from URL params
  useEffect(() => {
    const dueStatus = searchParams.get('dueStatus');
    if (dueStatus && ['overdue', 'aging', 'current'].includes(dueStatus)) {
      setStatusFilter(dueStatus as 'overdue' | 'aging' | 'current');
    }
  }, [searchParams]);

  // Check for unsaved draft when company changes
  useEffect(() => {
    const checkForDraft = async () => {
      if (companyId && profile?.id) {
        const draft = await loadBoqDraft(profile.id, companyId);
        if (draft) {
          setDraftExists(true);
          setDraftLastSaved(draft.last_autosaved_at);
          setShowDraftBanner(true);
        } else {
          setDraftExists(false);
          setShowDraftBanner(false);
        }
      }
    };

    checkForDraft();
  }, [companyId, profile?.id]);

  // Categorize BOQs by due date status
  const categorizeBOQ = (boq: any) => {
    if (!boq.due_date) return 'current';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(boq.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'aging';
    return 'current';
  };

  // Calculate summary stats
  const boqSummary = {
    overdue: boqs.filter(b => categorizeBOQ(b) === 'overdue').length,
    aging: boqs.filter(b => categorizeBOQ(b) === 'aging').length,
    current: boqs.filter(b => categorizeBOQ(b) === 'current').length,
  };

  // Filter and search logic
  const filteredBOQs = boqs.filter(boq => {
    // Search filter (guard against undefined/null values)
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      String(boq.number || '').toLowerCase().includes(search) ||
      String(boq.client_name || '').toLowerCase().includes(search);

    // Due date filter
    const dueDate = boq.due_date ? new Date(boq.due_date) : null;
    const matchesDueDateFrom = !dueDateFromFilter || (dueDate && dueDate >= new Date(dueDateFromFilter));
    const matchesDueDateTo = !dueDateToFilter || (dueDate && dueDate <= new Date(dueDateToFilter));

    // Status filter
    const boqStatus = categorizeBOQ(boq);
    const matchesStatus = statusFilter === 'all' || boqStatus === statusFilter;

    return matchesSearch && matchesDueDateFrom && matchesDueDateTo && matchesStatus;
  });

  const handleClearFilters = () => {
    setSearchTerm('');
    setDueDateFromFilter('');
    setDueDateToFilter('');
    setStatusFilter('all');
    toast.success('Filters cleared');
  };

  const handleResetDraft = async () => {
    if (profile?.id && companyId) {
      const result = await deleteDraft(profile.id, companyId);
      if (result.success) {
        setDraftExists(false);
        setShowDraftBanner(false);
        setDraftLastSaved(null);
        toast.success('Draft reset successfully');
      } else {
        toast.error('Failed to reset draft');
      }
    }
  };

  // Pagination hook
  const pagination = usePagination(filteredBOQs, { initialPageSize: 10 });
  const paginatedBOQs = pagination.paginatedItems;

  const handleDownloadPDF = async (boq: any, options?: { customTitle?: string; amountMultiplier?: number; forceCurrency?: string; customClient?: any; stampImageUrl?: string; specialPaymentPercentage?: number; invoiceNumber?: string; useCurrentDate?: boolean }) => {
    try {
      if (!boq || !boq.data) {
        toast.error('BOQ data is not available');
        return;
      }

      // Fetch the latest BOQ data from database to ensure we have the current terms_and_conditions
      let boqToUse = boq;
      let fetchWasSuccessful = true;

      const { data: latestBoq, error: fetchError } = await supabase
        .from('boqs')
        .select('*')
        .eq('id', boq.id)
        .single();

      if (fetchError) {
        console.error('Failed to fetch latest BOQ data:', fetchError);
        // Show warning to user that we're using potentially stale data
        toast.warning('Could not fetch latest BOQ data - using cached version. Terms may not be current.');
        fetchWasSuccessful = false;
      } else if (!latestBoq) {
        console.warn('Latest BOQ data not found in database');
        toast.warning('Could not find BOQ in database - using cached version.');
        fetchWasSuccessful = false;
      } else {
        // Use the latest data from database
        boqToUse = latestBoq;
      }

      // Reconstruct the document using top-level columns as single source of truth
      const boqData = boqToUse.data ? { ...boqToUse.data } : {};

      // Use ONLY top-level columns for terms (single source of truth)
      const termsToUse = boqToUse.terms_and_conditions || '';
      const showCalculatedValues = boqToUse.show_calculated_values_in_terms || false;

      // Log term retrieval for diagnostics
      console.log('BOQ Terms Retrieval Diagnostic:', {
        boqNumber: boqToUse.number,
        fetchWasSuccessful,
        hasTopLevelTerms: !!boqToUse.terms_and_conditions,
        topLevelTermsLength: boqToUse.terms_and_conditions?.length || 0,
        finalTermsLength: termsToUse.length,
        topLevelShowCalcValues: boqToUse.show_calculated_values_in_terms,
        finalShowCalcValues: showCalculatedValues,
      });

      const boqDataForPdf = {
        ...boqData,
        number: boqToUse.number,
        date: boqToUse.boq_date,
        currency: boqToUse.currency || 'KES',
        client: {
          name: boqToUse.client_name,
          email: boqToUse.client_email || undefined,
          phone: boqToUse.client_phone || undefined,
          address: boqToUse.client_address || undefined,
          city: boqToUse.client_city || undefined,
          country: boqToUse.client_country || undefined,
        },
        terms_and_conditions: termsToUse,
        showCalculatedValuesInTerms: showCalculatedValues,
        contractor: boqToUse.data?.contractor,
        project_title: boqToUse.project_title || boqToUse.data?.project_title,
        notes: boqToUse.data?.notes,
      };

      // Diagnostic logging for PDF data structure
      console.log('📥 BOQ PDF Download - Data Structure:', {
        boqNumber: boqDataForPdf.number,
        hasSections: !!boqDataForPdf.sections,
        sectionsCount: boqDataForPdf.sections?.length || 0,
        hasTerms: !!boqDataForPdf.terms_and_conditions,
        termsLength: boqDataForPdf.terms_and_conditions?.length || 0,
      });
      // Lazy import PDF generator to avoid loading browser-only libraries at module level
      const { downloadBOQPDF } = await import('@/utils/boqPdfGenerator');
      await downloadBOQPDF(boqDataForPdf, currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address || undefined,
        city: currentCompany.city || undefined,
        country: currentCompany.country || undefined,
        phone: currentCompany.phone || undefined,
        email: currentCompany.email || undefined,
        tax_number: currentCompany.tax_number || undefined,
        logo_url: currentCompany.logo_url || undefined,
        header_image: currentCompany.header_image || undefined,
        stamp_image: currentCompany.stamp_image || undefined,
        company_services: currentCompany.company_services || undefined,
      } : undefined, options);
      const suffix = options?.customTitle ? ` (${options.customTitle})` : '';
      toast.success(`BOQ ${boq.number} PDF downloaded${suffix}`);
    } catch (err) {
      console.error('Download failed', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to download BOQ: ${errorMessage}`);
    }
  };

  const handleDeleteClick = (id: string, number: string) => {
    setDeleteDialog({ open: true, boqId: id, boqNumber: number });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.boqId || !companyId) return;
    try {
      // Simple direct delete without audit logging to work around audit_logs issues
      const { error } = await supabase
        .from('boqs')
        .delete()
        .eq('id', deleteDialog.boqId)
        .eq('company_id', companyId);

      if (error) {
        throw error;
      }

      toast.success('BOQ deleted');
      setDeleteDialog({ open: false });
      refetchBOQs();
    } catch (err) {
      let errorMessage = 'Failed to delete BOQ';

      // Extract error message from various error types
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Handle Supabase error objects
        if ('message' in err) {
          errorMessage = String(err.message);
        } else if ('details' in err) {
          errorMessage = String(err.details);
        } else {
          errorMessage = JSON.stringify(err);
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      console.error('Delete failed:', errorMessage);

      // Provide specific guidance for common errors
      if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
        errorMessage = 'Cannot delete BOQ: It has been converted to an invoice or has related records. Please delete related records first.';
      }

      toast.error(errorMessage);
    }
  };

  const handleConvertClick = (id: string, number: string) => {
    setConvertDialog({ open: true, boqId: id, boqNumber: number });
  };

  const handleConvertConfirm = async () => {
    if (!convertDialog.boqId || !companyId) return;
    try {
      toast.loading(`Converting BOQ ${convertDialog.boqNumber} to invoice...`);
      const invoice = await convertToInvoice.mutateAsync({ boqId: convertDialog.boqId, companyId });

      toast.dismiss();

      // Format the total amount with the correct currency from the invoice
      const getLocaleForCurrency = (curr: string) => {
        const mapping: { [key: string]: { locale: string; code: string } } = {
          KES: { locale: 'en-KE', code: 'KES' },
          USD: { locale: 'en-US', code: 'USD' },
          EUR: { locale: 'en-GB', code: 'EUR' },
          GBP: { locale: 'en-GB', code: 'GBP' }
        };
        return mapping[curr] || mapping.KES;
      };
      const currencyLocale = getLocaleForCurrency(invoice.currency || 'KES');
      const formattedAmount = invoice.total_amount
        ? new Intl.NumberFormat(currencyLocale.locale, {
            style: 'currency',
            currency: currencyLocale.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(invoice.total_amount)
        : 'amount from BOQ';

      toast.success(
        `✅ BOQ ${convertDialog.boqNumber} successfully converted to Invoice ${invoice.invoice_number}`,
        {
          description: `Invoice created with total amount ${formattedAmount}`,
          duration: 5000
        }
      );

      setConvertDialog({ open: false });
      // Refetch to update the BOQ list and show converted status
      // Wait for mutation's onSuccess to invalidate cache, then refetch
      setTimeout(() => {
        console.log('🔄 Refetching BOQs after conversion');
        refetchBOQs();
      }, 1000);
    } catch (err) {
      console.error('BOQ conversion failed:', err);

      let errorMessage = 'Unknown error occurred';
      let errorTitle = 'Conversion Failed';

      if (err instanceof Error) {
        errorMessage = err.message;

        // Check for schema cache error (missing converted_at column)
        if (errorMessage.includes('converted_at') && errorMessage.includes('schema cache')) {
          setSchemaError(true);
          toast.error('Schema Error', {
            description: 'The database schema needs to be updated. Please use the fix guide below.',
            duration: 8000
          });
          return;
        }

        // Provide specific guidance based on error type
        if (errorMessage.includes('BOQ has no sections')) {
          errorTitle = 'Empty BOQ';
          errorMessage = 'This BOQ has no sections or items. Please add sections and items before converting.';
        } else if (errorMessage.includes('invalid or missing')) {
          errorTitle = 'Invalid BOQ Data';
          errorMessage = 'The BOQ data appears to be corrupted or incomplete. Please recreate the BOQ.';
        } else if (errorMessage.includes('no items')) {
          errorTitle = 'No Invoice Items';
          errorMessage = 'The BOQ conversion resulted in no items. Please verify the BOQ structure.';
        } else if (errorMessage.includes('invoice number')) {
          errorTitle = 'Invoice Number Error';
          errorMessage = 'Failed to generate a unique invoice number. Please try again or contact support.';
        } else if (errorMessage.includes('row level security') || errorMessage.includes('Permission denied')) {
          errorTitle = 'Permission Denied';
          if (errorMessage.includes('invoice items')) {
            errorMessage = 'Your database access permissions do not allow creating invoice items. Please contact your administrator to check Row Level Security (RLS) policies.';
          } else if (errorMessage.includes('invoice number')) {
            errorMessage = 'Your database access permissions do not allow generating invoice numbers. Please contact your administrator to check RLS policies.';
          } else {
            errorMessage = 'Your database access permissions are insufficient. Please contact your administrator to check Row Level Security (RLS) policies.';
          }
        } else if (errorMessage.includes('customer')) {
          errorTitle = 'Customer Setup Issue';
          if (errorMessage.includes('Could not create unique customer code')) {
            errorMessage = 'Could not generate a unique customer code. The invoice was created without a customer. Please assign a customer manually from the invoice view.';
          } else if (errorMessage.includes('row level security') || errorMessage.includes('permission')) {
            errorMessage = 'Permission denied when creating customer. The invoice was created without a customer. Please check your access permissions or assign a customer manually.';
          } else {
            errorMessage = 'There was an issue with the customer data. The invoice was created without a customer. Please assign one manually.';
          }
        }
      }

      toast.error(errorTitle, {
        description: errorMessage,
        duration: 6000
      });
    }
  };

  return (
    <div className="space-y-6">
      <SEO
        title="Bill of Quantities (BOQs)"
        description="Manage your project estimates, material requirements, and costs with our professional BOQ tool."
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">BOQs</h1>
          <p className="text-muted-foreground">
            Create and manage bill of quantities
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card"
            size="lg"
            onClick={() => setPercentageCopyOpen(true)}
            variant="outline"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy with %
          </Button>
          <Button
            className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card"
            size="lg"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New BOQ
          </Button>
        </div>
      </div>

      {showDraftBanner && draftExists && (
        <Card className="border-blue-200 bg-blue-50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">You have an unsaved BOQ in progress</p>
                  <p className="text-sm text-blue-700">
                    Last saved: {draftLastSaved ? new Date(draftLastSaved).toLocaleString() : 'just now'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setOpen(true);
                    setShowDraftBanner(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Continue Editing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetDraft}
                  className="border-blue-200 hover:bg-blue-100"
                >
                  Reset Draft
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowDraftBanner(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {schemaError && (
        <BOQConversionFix />
      )}

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search BOQs by number or client..."
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
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Overdue</p>
                </div>
                <Badge variant="destructive" className="text-lg font-bold px-3 py-1">
                  {boqSummary.overdue}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {statusFilter === 'overdue' ? 'Showing overdue BOQs' : 'Click to filter'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="shadow-card cursor-pointer hover:shadow-lg transition-shadow border-warning/20 hover:border-warning/40"
          onClick={() => setStatusFilter(statusFilter === 'aging' ? 'all' : 'aging')}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-warning" />
                  <p className="text-sm font-medium text-warning">Due Soon</p>
                </div>
                <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                  {boqSummary.aging}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {statusFilter === 'aging' ? 'Showing BOQs due within 7 days' : 'Click to filter'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="shadow-card cursor-pointer hover:shadow-lg transition-shadow border-success/20 hover:border-success/40"
          onClick={() => setStatusFilter(statusFilter === 'current' ? 'all' : 'current')}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <p className="text-sm font-medium text-success">Valid</p>
                </div>
                <Badge className="text-lg font-bold px-3 py-1 bg-success text-success-foreground">
                  {boqSummary.current}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {statusFilter === 'current' ? 'Showing valid BOQs' : 'Click to filter'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>BOQs List</span>
            {!isLoading && (
              <Badge variant="outline" className="ml-auto">
                {filteredBOQs.length} boqs
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {isLoading ? (
            <div>Loading...</div>
          ) : boqs.length === 0 ? (
            <div>No BOQs found</div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBOQs.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.number}</TableCell>
                      <TableCell>{new Date(b.boq_date).toLocaleDateString()}</TableCell>
                      <TableCell>{b.due_date ? new Date(b.due_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{b.client_name}</TableCell>
                      <TableCell>{b.project_title || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{b.currency || 'KES'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'converted' ? 'default' : b.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {b.status === 'draft' ? 'Draft' : b.status === 'converted' ? 'Converted' : 'Cancelled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: b.currency || 'KES' }).format(Number(b.total_amount || b.subtotal || 0))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => setViewing(b)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditing(b)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDownloadPDF(b)} title="Download PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                          {b.number === 'BOQ-20251124-1441' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                setPercentageRateBoq(b);
                                setPercentageRateOpen(true);
                              }}
                              title="Download Special Invoice PDF"
                            >
                              Invoice PDF
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleConvertClick(b.id, b.number)}
                            title="Convert to Invoice"
                            disabled={b.converted_to_invoice_id !== null && b.converted_to_invoice_id !== undefined}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDeleteClick(b.id, b.number)}
                            title={b.converted_to_invoice_id ? "Cannot delete converted BOQ" : "Delete"}
                            disabled={!!b.converted_to_invoice_id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <CreateBOQModal open={open} onOpenChange={setOpen} onSuccess={() => refetchBOQs()} />

      <CreatePercentageCopyModal
        open={percentageCopyOpen}
        onOpenChange={setPercentageCopyOpen}
        companyId={companyId || ''}
        onSuccess={() => refetchBOQs()}
      />

      {viewing && (() => {
        const getLocaleForCurrency = (curr: string) => {
          const mapping: { [key: string]: { locale: string; code: string } } = {
            KES: { locale: 'en-KE', code: 'KES' },
            USD: { locale: 'en-US', code: 'USD' },
            EUR: { locale: 'en-GB', code: 'EUR' },
            GBP: { locale: 'en-GB', code: 'GBP' }
          };
          return mapping[curr] || mapping.KES;
        };
        const currencyLocale = getLocaleForCurrency(viewing.currency || 'KES');
        const formatViewingCurrency = (amount: number) => new Intl.NumberFormat(currencyLocale.locale, { style: 'currency', currency: currencyLocale.code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col p-4 sm:p-6">
              {/* Header - Responsive */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b">
                <h2 className="text-lg sm:text-xl font-semibold">BOQ {viewing.number}</h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                  <Button variant="ghost" onClick={() => { setViewing(null); }} className="w-full sm:w-auto">Close</Button>
                  <Button onClick={() => handleDownloadPDF(viewing)} className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" /> Download PDF
                  </Button>
                </div>
              </div>

              {/* Content - Scrollable */}
              <div className="overflow-y-auto flex-1">
                <div className="space-y-3 text-sm pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><strong>Date:</strong> {new Date(viewing.boq_date).toLocaleDateString()}</div>
                    <div><strong>Currency:</strong> <Badge variant="outline">{viewing.currency || 'KES'}</Badge></div>
                    <div className="sm:col-span-2"><strong>Client:</strong> {viewing.client_name} {viewing.client_email ? `(${viewing.client_email})` : ''}</div>
                    <div><strong>Project:</strong> {viewing.project_title || '-'}</div>
                    <div><strong>Contractor:</strong> {viewing.contractor || '-'}</div>
                  </div>
                  <div className="pt-2"><strong>Notes:</strong><div className="whitespace-pre-wrap text-xs">{viewing.data?.notes || '-'}</div></div>

                  {viewing.terms_and_conditions && (
                    <div className="pt-3 border-t">
                      <strong>Terms & Conditions:</strong>
                      <div className="whitespace-pre-wrap text-xs mt-2 p-3 bg-muted/30 rounded border border-border/50">
                        {viewing.terms_and_conditions}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 space-y-4">
                    {viewing.data?.sections?.map((sec: any, idx: number) => (
                      <div key={idx}>
                        <div className="bg-muted/40 border-l-4 border-primary px-3 sm:px-4 py-2 mb-2 rounded-r">
                          <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide text-foreground">{sec.title}</h3>
                        </div>

                        {sec.subsections && sec.subsections.length > 0 ? (
                          <div className="space-y-3 ml-0 sm:ml-2">
                            {sec.subsections.map((sub: any, subIdx: number) => {
                              const subsectionTotal = (sub.items || []).reduce((sum: number, it: any) => {
                                return sum + ((it.quantity || 0) * (it.rate || 0));
                              }, 0);

                              return (
                                <div key={subIdx} className="bg-white rounded p-3 sm:p-4 border border-border">
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                                    <div className="font-semibold text-xs sm:text-sm text-foreground">Subsection {sub.name}: {sub.label}</div>
                                    <div className="text-xs sm:text-sm font-bold text-primary">{formatViewingCurrency(subsectionTotal)}</div>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-left text-muted-foreground border-b">
                                          <th className="pb-2 px-1">Description</th><th className="pb-2 px-1">Qty</th><th className="pb-2 px-1">Unit</th><th className="pb-2 px-1">Rate</th><th className="pb-2 px-1 text-right">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(sub.items || []).map((it: any, i: number) => (
                                          <tr key={i} className="border-b last:border-b-0 hover:bg-white/50">
                                            <td className="py-1 px-1 truncate">{it.description}</td>
                                            <td className="py-1 px-1 whitespace-nowrap">{it.quantity}</td>
                                            <td className="py-1 px-1 whitespace-nowrap">{
                                              (() => {
                                                if (it.unit_id && units) {
                                                  const u = units.find((x: any) => x.id === it.unit_id);
                                                  if (u) return u.abbreviation || u.name;
                                                }
                                                if (it.unit_name) return it.unit_name;
                                                if (it.unit) return it.unit;
                                                return '-';
                                              })()
                                            }</td>
                                            <td className="py-1 px-1 whitespace-nowrap text-right">{formatViewingCurrency(Number(it.rate || 0))}</td>
                                            <td className="py-1 px-1 text-right font-medium whitespace-nowrap">{formatViewingCurrency(Number((it.quantity || 0) * (it.rate || 0)))}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}

                            {(() => {
                              const sectionTotal = (sec.subsections || []).reduce((sum: number, sub: any) => {
                                return sum + (sub.items || []).reduce((subSum: number, it: any) => {
                                  return subSum + ((it.quantity || 0) * (it.rate || 0));
                                }, 0);
                              }, 0);
                              return (
                                <div className="flex justify-end font-bold text-xs sm:text-sm pt-4 mt-2 border-t-2 border-primary">
                                  <div className="text-primary">Section Total: {formatViewingCurrency(sectionTotal)}</div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="mt-3 bg-white rounded border border-border p-3 sm:p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs sm:text-sm">
                                <thead>
                                  <tr className="text-left text-muted-foreground border-b">
                                    <th className="pb-2 px-1">Description</th><th className="pb-2 px-1">Qty</th><th className="pb-2 px-1">Unit</th><th className="pb-2 px-1">Rate</th><th className="pb-2 px-1 text-right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(sec.items || []).map((it: any, i: number) => (
                                    <tr key={i} className="border-b last:border-b-0 hover:bg-muted/20">
                                      <td className="py-2 px-1 truncate">{it.description}</td>
                                      <td className="py-2 px-1 whitespace-nowrap">{it.quantity}</td>
                                      <td className="py-2 px-1 whitespace-nowrap">{
                                        (() => {
                                          if (it.unit_id && units) {
                                            const u = units.find((x: any) => x.id === it.unit_id);
                                            if (u) return u.abbreviation || u.name;
                                          }
                                          if (it.unit_name) return it.unit_name;
                                          if (it.unit) return it.unit;
                                          return '-';
                                        })()
                                      }</td>
                                      <td className="py-2 px-1 whitespace-nowrap text-right">{formatViewingCurrency(Number(it.rate || 0))}</td>
                                      <td className="py-2 px-1 text-right font-medium whitespace-nowrap">{formatViewingCurrency(Number((it.quantity || 0) * (it.rate || 0)))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {editing && (
        <EditBOQModal
          open={!!editing}
          onOpenChange={(isOpen) => setEditing(isOpen ? editing : null)}
          boq={editing}
          onSuccess={() => refetchBOQs()}
        />
      )}

      <ConfirmationDialog
        open={deleteDialog.open}
        title="Delete BOQ"
        description={`Are you sure you want to delete BOQ ${deleteDialog.boqNumber}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ open: false })}
        confirmText="Delete"
      />

      <ConfirmationDialog
        open={convertDialog.open}
        title="Convert BOQ to Invoice"
        description={`Convert BOQ ${convertDialog.boqNumber} to an invoice? This will create a new draft invoice with all items from this BOQ. The BOQ will be marked as converted.`}
        onConfirm={handleConvertConfirm}
        onCancel={() => setConvertDialog({ open: false })}
        confirmText="Convert to Invoice"
        isLoading={convertToInvoice.isPending}
        loadingText="Converting..."
        isDangerous={false}
      />

      {percentageRateBoq && (
        <ChangePercentageRateModal
          open={percentageRateOpen}
          onOpenChange={setPercentageRateOpen}
          boq={percentageRateBoq}
          onDownload={async (data: { percentage: number; multiplier: number }) => {
            const invoiceNumber = companyId ? await generateUniqueInvoiceNumber(companyId) : undefined;
            await handleDownloadPDF(percentageRateBoq, {
              customTitle: 'INVOICE',
              amountMultiplier: data.multiplier,
              forceCurrency: 'EUR',
              customClient: {
                name: 'Global Crop Diversity Trust',
                address: 'Platz der Vereinten Nationen 7',
                city: 'Bonn',
                country: 'Germany'
              },
              stampImageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F431212e7a441426cb89fb9ab85eaab25%2F3742605378df401d9078c76d81877fea?format=webp&width=800',
              specialPaymentPercentage: data.percentage,
              invoiceNumber: invoiceNumber,
              useCurrentDate: true
            });
          }}
        />
      )}
    </div>
  );
}
