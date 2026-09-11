import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { Layers, Plus, Eye, Download, Trash2, Copy, Pencil, FileText, Receipt, Filter, Search, AlertCircle, Clock, CheckCircle, X, Lock } from 'lucide-react';
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
import { fetchBOQDetails, usePaginatedBOQs, useUnits } from '@/hooks/useDatabase';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useConvertBoqToInvoice } from '@/hooks/useBOQ';
import { convertLCLBOQToInvoice } from '@/services/lclBoqService';
import { listCreateDrafts, deleteDraft } from '@/services/boqAutoSaveService';
import { generateUniqueInvoiceNumber } from '@/utils/invoiceNumberGenerator';
import { BOQData } from '@/utils/boqHelper';
import { BOQDraftRecord } from '@/services/boqAutoSaveService';
import { BOQ_STATUS, sanitizeBOQStatus } from '@/utils/boqConstants';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

type BOQ = Database['public']['Tables']['boqs']['Row'];

const formatCurrencyLocales: Record<string, string> = {
  KES: 'en-KE',
  USD: 'en-US',
  EUR: 'en-GB',
  GBP: 'en-GB',
};

export default function BOQs() {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [percentageCopyOpen, setPercentageCopyOpen] = useState(false);
  const [percentageRateOpen, setPercentageRateOpen] = useState(false);
  const [percentageRateBoq, setPercentageRateBoq] = useState<BOQData | null>(null);
  const [schemaError, setSchemaError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dueDateFromFilter, setDueDateFromFilter] = useState('');
  const [dueDateToFilter, setDueDateToFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'aging' | 'current'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('');
  const [conversionStatusFilter, setConversionStatusFilter] = useState<'all' | 'converted' | 'unconverted'>('all');
  const [linkedBOQIds, setLinkedBOQIds] = useState<Set<string>>(new Set());

  // Hooks and context calls first
  const { currentCompany } = useCurrentCompany();
  const { profile } = useAuth();
  const companyId = currentCompany?.id;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const boqFilters = {
    page,
    pageSize,
    search: searchTerm,
    dueDateFrom: dueDateFromFilter,
    dueDateTo: dueDateToFilter,
    dueStatus: statusFilter,
    currency: currencyFilter,
    conversionStatus: conversionStatusFilter,
  } as const;
  const { data: boqResult, isLoading, refetch: refetchBOQs, error: boqsError } = usePaginatedBOQs(companyId, boqFilters);
  const boqs = boqResult?.rows || [];
  const { data: units = [] } = useUnits(companyId);
  const { logDelete } = useAuditLog();
  const convertToInvoice = useConvertBoqToInvoice();

  // State declarations
  const [viewing, setViewing] = useState<BOQData | null>(null);
  const [editing, setEditing] = useState<BOQData | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; boqId?: string; boqNumber?: string }>({ open: false });
  const [convertDialog, setConvertDialog] = useState<{ open: boolean; boqId?: string; boqNumber?: string; isLCL?: boolean }>({ open: false });
  const [createDrafts, setCreateDrafts] = useState<BOQDraftRecord[]>([]);
  const [continueDraftToken, setContinueDraftToken] = useState<string | null>(null);

  // Helper function to refresh linked BOQ IDs (with timeout to prevent blocking)
  const refreshLinkedBOQIds = async () => {
    if (!companyId) return;
    try {
      // Wrap in Promise.race to timeout after 5 seconds
      const fetchPromise = supabase
        .from('lcl_boqs')
        .select('boq_id')
        .eq('company_id', companyId)
        .not('boq_id', 'is', null);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Linked BOQs fetch timeout')), 5000)
      );

      const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as { data: Array<{ boq_id: string }> | null; error: Error | null };

      if (error) {
        console.warn('⚠️ Failed to fetch linked BOQ IDs (continuing):', error);
        return;
      }

      const ids = new Set(data?.map((record) => record.boq_id).filter(Boolean) || []);
      setLinkedBOQIds(ids);
    } catch (err) {
      console.warn('⚠️ Error fetching linked BOQ IDs (continuing):', err);
      // Continue without linked BOQ data - don't block the page
    }
  };

  // Fetch linked BOQ IDs from lcl_boqs table (debounced to avoid race conditions)
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshLinkedBOQIds();
    }, 500); // Delay to let primary queries complete first
    return () => clearTimeout(timer);
  }, [companyId]);

  // Set status filter from URL params
  useEffect(() => {
    const dueStatus = searchParams.get('dueStatus');
    if (dueStatus && ['overdue', 'aging', 'current'].includes(dueStatus)) {
      setStatusFilter(dueStatus as 'overdue' | 'aging' | 'current');
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, dueDateFromFilter, dueDateToFilter, statusFilter, currencyFilter, conversionStatusFilter]);

  // Fetch all create drafts when company changes (with timeout to prevent blocking)
  useEffect(() => {
    const checkForDrafts = async () => {
      if (companyId && profile?.id) {
        try {
          // Wrap in Promise.race to timeout after 5 seconds
          const draftsPromise = listCreateDrafts(profile.id, companyId);
          const timeoutPromise = new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('Draft fetch timeout')), 5000)
          );
          const drafts = await Promise.race([draftsPromise, timeoutPromise]);
          setCreateDrafts(drafts);
        } catch (err) {
          console.warn('⚠️ Failed to load create drafts (continuing without):', err);
          // Continue without drafts - don't block the page
          setCreateDrafts([]);
        }
      }
    };

    checkForDrafts();
  }, [companyId, profile?.id]);

  const boqSummary = boqResult?.summary || { overdue: 0, aging: 0, current: 0 };
  const totalBOQs = boqResult?.total || 0;

  const handleClearFilters = () => {
    setPage(1);
    setSearchTerm('');
    setDueDateFromFilter('');
    setDueDateToFilter('');
    setStatusFilter('all');
    setCurrencyFilter('');
    setConversionStatusFilter('all');
    toast.success('Filters cleared');
  };

  const refreshCreateDrafts = useCallback(async () => {
    if (companyId && profile?.id) {
      try {
        const draftsPromise = listCreateDrafts(profile.id, companyId);
        const timeoutPromise = new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error('Draft refresh timeout')), 5000)
        );
        const drafts = await Promise.race([draftsPromise, timeoutPromise]);
        setCreateDrafts(drafts);
      } catch (err) {
        console.warn('⚠️ Failed to refresh create drafts:', err);
        // Continue without refreshing - don't block interactions
      }
    }
  }, [companyId, profile?.id]);

  const handleResetDraft = async () => {
    if (profile?.id && companyId) {
      let allSuccess = true;
      let hasUntokenized = false;
      for (const draft of createDrafts) {
        if (draft.draft_token) {
          const result = await deleteDraft(profile.id, companyId, draft.draft_token);
          if (!result.success) allSuccess = false;
        } else {
          hasUntokenized = true;
        }
      }
      // Blanket delete for legacy drafts without a token
      if (hasUntokenized) {
        const result = await deleteDraft(profile.id, companyId);
        if (!result.success) allSuccess = false;
      }
      if (allSuccess) {
        setCreateDrafts([]);
        toast.success('Drafts reset successfully');
      } else {
        toast.error('Failed to reset some drafts');
      }
    }
  };

  // Show error toast if BOQs query fails
  useEffect(() => {
    if (boqsError) {
      console.error('❌ BOQs query error:', boqsError);
      toast.error('Failed to load BOQs', {
        description: boqsError instanceof Error ? boqsError.message : 'An error occurred while loading BOQs',
        duration: 5000
      });
    }
  }, [boqsError]);

  // Debug logging for query state and company
  useEffect(() => {
    console.log('📊 BOQs Query Debug Info:', {
      currentCompanyId: companyId,
      isLoading,
      hasError: !!boqsError,
      boqsCount: boqs.length,
      boqsQuery: 'SELECT * FROM boqs WHERE company_id = ?',
      timestamp: new Date().toISOString()
    });
    if (boqs.length > 0) {
      console.log('📋 First BOQ sample:', {
        id: boqs[0].id,
        number: boqs[0].number,
        company_id: boqs[0].company_id,
        client: boqs[0].client_name
      });
    }
  }, [companyId, isLoading, boqsError, boqs]);

  const handleDeleteSingleDraft = async (draft: BOQDraftRecord) => {
    if (!profile?.id || !companyId) return;
    if (!draft.draft_token) { toast.error('Cannot delete draft without a token'); return; }
    const result = await deleteDraft(profile.id, companyId, draft.draft_token);
    if (result.success) {
      setCreateDrafts(prev => prev.filter(d => d.draft_token !== draft.draft_token));
      toast.success('Draft deleted');
    } else {
      toast.error('Failed to delete draft');
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const openBOQDetails = async (boq: BOQ, mode: 'view' | 'edit') => {
    if (!companyId) return;
    try {
      const details = await fetchBOQDetails(companyId, boq.id);
      if (mode === 'view') setViewing(details as BOQData);
      else setEditing(details as BOQData);
    } catch (error) {
      toast.error(`Failed to load BOQ details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownloadPDF = async (boq: BOQ, options?: { customTitle?: string; amountMultiplier?: number; forceCurrency?: string; customClient?: any; stampImageUrl?: string; specialPaymentPercentage?: number; invoiceNumber?: string; useCurrentDate?: boolean }) => {
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
      const showCalculatedValues = boqToUse.showCalculatedValuesInTerms || false;

      // Log term retrieval for diagnostics
      console.log('BOQ Terms Retrieval Diagnostic:', {
        boqNumber: boqToUse.number,
        fetchWasSuccessful,
        hasTopLevelTerms: !!boqToUse.terms_and_conditions,
        topLevelTermsLength: boqToUse.terms_and_conditions?.length || 0,
        finalTermsLength: termsToUse.length,
        topLevelShowCalcValues: boqToUse.showCalculatedValuesInTerms,
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
        default_terms_and_conditions: currentCompany.default_terms_and_conditions || undefined,
      } : undefined, options);
      const suffix = options?.customTitle ? ` (${options.customTitle})` : '';
      toast.success(`BOQ ${boq.number} PDF downloaded${suffix}`);
    } catch (err) {
      console.error('Download failed', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to download BOQ: ${errorMessage}`);
    }
  };

  const handleDownloadInvoicePDF = (boq: BOQ) => {
    if (linkedBOQIds.has(boq.id)) return;
    setPercentageRateBoq(boq as BOQData);
    setPercentageRateOpen(true);
  };

  const handleDeleteClick = (id: string, number: string) => {
    if (linkedBOQIds.has(id)) {
      toast.error('Cannot delete BOQ', {
        description: `This BOQ is linked to an LCL template. Edit it in the LCL Template instead.`,
        duration: 5000
      });
      return;
    }
    setDeleteDialog({ open: true, boqId: id, boqNumber: number });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.boqId || !companyId) return;

    const doDelete = async (includeCompanyId: boolean) => {
      let q = supabase.from('boqs').delete().eq('id', deleteDialog.boqId);
      if (includeCompanyId) q = q.eq('company_id', companyId);
      const { error } = await q;
      if (error) throw error;
    };

    try {
      await doDelete(true);
      afterDelete();
    } catch (err) {
      const errorMessage = extractErrorMessage(err);
      console.error('Delete failed:', errorMessage);

      if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
        toast.error('Cannot delete BOQ: It has been converted to an invoice or has related records. Please delete related records first.');
        return;
      }

      if (errorMessage.includes('company_id') && errorMessage.includes('does not exist')) {
        try {
          await doDelete(false);
          afterDelete();
          return;
        } catch (fallbackErr) {
          const fallbackErrMsg = typeof fallbackErr === 'object' && fallbackErr !== null && 'message' in fallbackErr
            ? String(fallbackErr.message) : String(fallbackErr);
          if (fallbackErrMsg.includes('company_id') && fallbackErrMsg.includes('does not exist')) {
            const alterSQL = "ALTER TABLE boqs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;";
            navigator.clipboard.writeText(alterSQL).catch(() => {});
            toast.error('Missing company_id column on boqs table', {
              description: 'SQL to fix copied to clipboard. Run this in Supabase SQL Editor:\n' + alterSQL,
              duration: 15000,
            });
            return;
          }
          toast.error(fallbackErrMsg);
          return;
        }
      }

      toast.error(errorMessage);
    }
  };

  const afterDelete = () => {
    toast.success('BOQ deleted');
    setDeleteDialog({ open: false });
    refetchBOQs();
    setLinkedBOQIds(prev => {
      const updated = new Set(prev);
      updated.delete(deleteDialog.boqId || '');
      return updated;
    });
  };

  const extractErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null) {
      if ('message' in err) return String(err.message);
      if ('details' in err) return String(err.details);
      return JSON.stringify(err);
    }
    if (typeof err === 'string') return err;
    return 'Failed to delete BOQ';
  };

  const handleConvertClick = (id: string, number: string, isLCL: boolean = false) => {
    setConvertDialog({ open: true, boqId: id, boqNumber: number, isLCL });
  };

  const handleConvertConfirm = async () => {
    if (!convertDialog.boqId || !companyId) return;
    try {
      toast.loading(`Converting BOQ ${convertDialog.boqNumber} to invoice...`);
      const isLCL = convertDialog.isLCL;
      const invoice = isLCL
        ? await convertLCLBOQToInvoice({ boqId: convertDialog.boqId, companyId })
        : await convertToInvoice.mutateAsync({ boqId: convertDialog.boqId, companyId });

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
      refetchBOQs();
    } catch (err) {
      toast.dismiss();
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">BOQs</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Create and manage bill of quantities
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 w-full sm:w-auto">
          <Button
            className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card w-full sm:w-auto"
            size="sm"
            onClick={() => setPercentageCopyOpen(true)}
            variant="outline"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy with %
          </Button>
          <Button
            className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card w-full sm:w-auto"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New BOQ
          </Button>
        </div>
      </div>

      {createDrafts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="font-medium text-blue-900 text-sm mb-3">
              {createDrafts.length === 1
                ? 'Unsaved BOQ draft'
                : `Unsaved BOQ drafts (${createDrafts.length})`}
            </p>
            <div className="space-y-2">
              {createDrafts.map(draft => (
                <div key={draft.id} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 border border-blue-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-blue-900 text-sm truncate">
                        {draft.number || 'Unnumbered'}{draft.client_name ? ` — ${draft.client_name}` : ''}
                      </p>
                      <p className="text-xs text-blue-600 truncate">
                        {draft.project_title || 'No project title'}
                        <span className="text-blue-400 ml-2">
                          {new Date(draft.last_autosaved_at).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <Button
                      size="sm"
                      onClick={() => { setContinueDraftToken(draft.draft_token); setOpen(true); }}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                    >
                      Continue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSingleDraft(draft)}
                      className="border-blue-200 hover:bg-blue-100 h-8 text-xs"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {createDrafts.length > 1 && (
              <div className="mt-3 text-right">
                <Button size="sm" variant="ghost" onClick={handleResetDraft} className="text-blue-700 hover:text-blue-900 h-8 text-xs">
                  Reset All Drafts
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {schemaError && (
        <BOQConversionFix />
      )}

      {boqsError && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive mb-1">Failed to Load BOQs</p>
                <p className="text-sm text-muted-foreground">
                  {boqsError instanceof Error ? boqsError.message : 'An error occurred while loading BOQs. Please try again.'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Company ID: <code className="bg-muted px-1 py-0.5 rounded">{companyId || 'not loaded'}</code>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchBOQs()}
                className="flex-shrink-0"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search BOQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 sm:w-80">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="due-date-from" className="text-xs sm:text-sm">Due Date From</Label>
                      <Input
                        id="due-date-from"
                        type="date"
                        value={dueDateFromFilter}
                        onChange={(e) => setDueDateFromFilter(e.target.value)}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due-date-to" className="text-xs sm:text-sm">Due Date To</Label>
                      <Input
                        id="due-date-to"
                        type="date"
                        value={dueDateToFilter}
                        onChange={(e) => setDueDateToFilter(e.target.value)}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency-filter" className="text-xs sm:text-sm">Currency</Label>
                    <select
                      id="currency-filter"
                      value={currencyFilter}
                      onChange={(e) => setCurrencyFilter(e.target.value)}
                      className="w-full px-2 py-1 text-xs sm:text-sm border rounded"
                    >
                      <option value="">All</option>
                      <option value="KES">KES</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conversion-status" className="text-xs sm:text-sm">Conversion Status</Label>
                    <select
                      id="conversion-status"
                      value={conversionStatusFilter}
                      onChange={(e) => setConversionStatusFilter(e.target.value as 'all' | 'converted' | 'unconverted')}
                      className="w-full px-2 py-1 text-xs sm:text-sm border rounded"
                    >
                      <option value="all">All</option>
                      <option value="converted">Converted to Invoice</option>
                      <option value="unconverted">Not Converted</option>
                    </select>
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
          <CardContent className="min-w-0 pt-6">
            <div className="space-y-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center space-x-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="min-w-0 break-words text-sm font-medium text-destructive">Overdue</p>
                </div>
                <Badge variant="destructive" className="shrink-0 whitespace-nowrap px-2 py-1 text-base font-bold sm:px-3 sm:text-lg">
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
          <CardContent className="min-w-0 pt-6">
            <div className="space-y-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center space-x-2">
                  <Clock className="h-5 w-5 shrink-0 text-warning" />
                  <p className="min-w-0 break-words text-sm font-medium text-warning">Due Soon</p>
                </div>
                <Badge variant="secondary" className="shrink-0 whitespace-nowrap px-2 py-1 text-base font-bold sm:px-3 sm:text-lg">
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
          <CardContent className="min-w-0 pt-6">
            <div className="space-y-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center space-x-2">
                  <CheckCircle className="h-5 w-5 shrink-0 text-success" />
                  <p className="min-w-0 break-words text-sm font-medium text-success">Valid</p>
                </div>
                <Badge className="shrink-0 whitespace-nowrap bg-success px-2 py-1 text-base font-bold text-success-foreground sm:px-3 sm:text-lg">
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
                {totalBOQs} boqs
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
              <div className="overflow-x-auto -mx-6 px-6 md:overflow-x-visible md:mx-0 md:px-0">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Number</TableHead>
                      <TableHead className="text-xs md:text-sm">Date</TableHead>
                      <TableHead className="text-xs md:text-sm">Due Date</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs md:text-sm">Client</TableHead>
                      <TableHead className="hidden lg:table-cell text-xs md:text-sm">Project</TableHead>
                      <TableHead className="hidden md:table-cell text-xs md:text-sm">Contractor</TableHead>
                      <TableHead className="text-xs md:text-sm">Currency</TableHead>
                      <TableHead className="text-xs md:text-sm">Status</TableHead>
                      <TableHead className="hidden lg:table-cell text-right text-xs md:text-sm">Subtotal</TableHead>
                      <TableHead className="hidden lg:table-cell text-right text-xs md:text-sm">Tax</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Total</TableHead>
                      <TableHead className="hidden lg:table-cell text-xs md:text-sm">Created By</TableHead>
                      <TableHead className="text-xs md:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boqs.map((b: BOQ) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs md:text-sm">{b.number}</TableCell>
                        <TableCell className="text-xs md:text-sm">{new Date(b.boq_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs md:text-sm">{b.due_date ? new Date(b.due_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs md:text-sm">{b.client_name}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs md:text-sm">{b.project_title || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs md:text-sm">{b.contractor || '-'}</TableCell>
                        <TableCell className="text-xs md:text-sm"><Badge variant="outline" className="text-xs">{b.currency || 'KES'}</Badge></TableCell>
                        <TableCell className="text-xs md:text-sm">
                          <div className="flex flex-col gap-1">
                            {(() => {
                              const validStatus = sanitizeBOQStatus(b.status);
                              const statusLabel = validStatus === BOQ_STATUS.DRAFT ? 'Draft' : validStatus === BOQ_STATUS.CONVERTED ? 'Converted' : 'Cancelled';
                              const badgeVariant = validStatus === BOQ_STATUS.CONVERTED ? 'default' : validStatus === BOQ_STATUS.CANCELLED ? 'destructive' : 'secondary';
                              return (
                                <Badge variant={badgeVariant} className="text-xs w-fit">
                                  {statusLabel}
                                </Badge>
                              );
                            })()}
                            {b.converted_to_invoice_id && (
                              <Badge variant="outline" className="text-xs w-fit">
                                Invoice #...
                              </Badge>
                            )}
                            {linkedBOQIds.has(b.id) && (
                              <Badge variant="outline" className="text-xs w-fit flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Linked to LCL
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-xs md:text-sm">{new Intl.NumberFormat(formatCurrencyLocales[b.currency] || 'en-KE', { style: 'currency', currency: b.currency || 'KES' }).format(Number(b.subtotal || 0))}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-xs md:text-sm">{new Intl.NumberFormat(formatCurrencyLocales[b.currency] || 'en-KE', { style: 'currency', currency: b.currency || 'KES' }).format(Number(b.tax_amount || 0))}</TableCell>
                        <TableCell className="text-right text-xs md:text-sm">{new Intl.NumberFormat(formatCurrencyLocales[b.currency] || 'en-KE', { style: 'currency', currency: b.currency || 'KES' }).format(Number(b.total_amount || b.subtotal || 0))}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs md:text-sm">{b.created_by ? '✓' : '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => !linkedBOQIds.has(b.id) && openBOQDetails(b, 'view')}
                              title={linkedBOQIds.has(b.id) ? "View unavailable: Linked to LCL template" : "View"}
                              disabled={linkedBOQIds.has(b.id)}
                              className="h-8 w-8 md:h-9 md:w-9"
                            >
                              <Eye className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => !linkedBOQIds.has(b.id) && openBOQDetails(b, 'edit')}
                              title={linkedBOQIds.has(b.id) ? "Read-only: Linked to LCL template" : "Edit"}
                              disabled={linkedBOQIds.has(b.id)}
                              className="h-8 w-8 md:h-9 md:w-9"
                            >
                              <Pencil className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => !linkedBOQIds.has(b.id) && handleDownloadPDF(b)}
                              title={linkedBOQIds.has(b.id) ? "Download unavailable: Linked to LCL template" : "Download PDF"}
                              disabled={linkedBOQIds.has(b.id)}
                              className="h-8 w-8 md:h-9 md:w-9"
                            >
                              <Download className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleDownloadInvoicePDF(b)}
                              title={linkedBOQIds.has(b.id) ? "Download unavailable: Linked to LCL template" : "Download Invoice PDF"}
                              disabled={linkedBOQIds.has(b.id)}
                              className="h-8 w-8 md:h-9 md:w-9"
                            >
                              <Receipt className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleConvertClick(b.id, b.number, linkedBOQIds.has(b.id))}
                              title="Convert to Invoice"
                              disabled={!!b.converted_to_invoice_id}
                              className="h-8 w-8 md:h-9 md:w-9"
                            >
                              <FileText className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={() => handleDeleteClick(b.id, b.number)}
                              title={linkedBOQIds.has(b.id) ? "Cannot delete: Linked to LCL template" : b.converted_to_invoice_id ? "Cannot delete converted BOQ" : "Delete"}
                              disabled={!!b.converted_to_invoice_id || linkedBOQIds.has(b.id)}
                              className="h-8 w-8 md:h-9 md:w-9"
                            >
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(totalBOQs / pageSize))}
                pageSize={pageSize}
                totalItems={totalBOQs}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <CreateBOQModal open={open} initialDraftToken={continueDraftToken} onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setContinueDraftToken(null);
          refreshCreateDrafts();
        }
      }} onSuccess={() => {
        refetchBOQs();
        refreshLinkedBOQIds();
        refreshCreateDrafts();
      }} company={currentCompany} />


      <CreatePercentageCopyModal
        open={percentageCopyOpen}
        onOpenChange={setPercentageCopyOpen}
        companyId={companyId || ''}
        onSuccess={() => {
          refetchBOQs();
          refreshLinkedBOQIds();
        }}
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
                  <Button onClick={() => handleDownloadInvoicePDF(viewing)} variant="outline" className="w-full sm:w-auto">
                    <Receipt className="h-4 w-4 mr-2" /> Download Invoice PDF
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
          onSuccess={() => {
            refetchBOQs();
            refreshLinkedBOQIds();
          }}
          company={currentCompany}
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
        title={`Convert ${convertDialog.isLCL ? 'LCL ' : ''}BOQ to Invoice`}
        description={`Convert ${convertDialog.isLCL ? 'LCL ' : ''}BOQ ${convertDialog.boqNumber} to an invoice? This will create a new draft invoice with all items from this BOQ. The BOQ will be marked as converted.`}
        onConfirm={handleConvertConfirm}
        onCancel={() => setConvertDialog({ open: false })}
        confirmText="Convert to Invoice"
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
