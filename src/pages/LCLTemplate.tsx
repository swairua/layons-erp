import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useDatabase';
import { lclTemplateService } from '@/services/lclTemplateService';
import { LCLHierarchicalData, LCLTemplateStructure } from '@/types/lclTemplate';
import { toCollection } from '@/utils/collection';
import { LCLBOQItemEditor, LCLBOQItemEditorHandle, ItemSnapshot } from '@/components/lcl/LCLBOQItemEditor';
import { lclBoqService, LCLBOQRecord } from '@/services/lclBoqService';
import { generateNextBOQNumber } from '@/utils/boqNumberGenerator';
import { downloadLCLBOQPDF, reconstructHierarchicalDataFromSnapshot } from '@/utils/lclBoqPdfGenerator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Save, AlertCircle } from 'lucide-react';

export default function LCLTemplate() {
  console.log('[LCLTemplate] ✅ Component MOUNTED - render started');
  const { currentCompany, isLoading: isCompanyLoading } = useCurrentCompany();
  const companyId = currentCompany?.id || '';
  const { toast } = useToast();
  const { data: customersResponse } = useCustomers(companyId);
  const customers = toCollection(customersResponse);
  const { loading: authLoading, isAuthenticated } = useAuth();

  console.log(`[LCLTemplate] Company context loaded - isLoading: ${isCompanyLoading}, companyId: "${companyId}", currentCompany: ${currentCompany ? currentCompany.name : 'null'}`);

  const [hierarchicalData, setHierarchicalData] =
    useState<LCLHierarchicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // BOQ Header fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [boqNumber, setBoqNumber] = useState<string>('');
  const [boqDate, setBoqDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lclBoqRecord, setLclBoqRecord] = useState<LCLBOQRecord | null>(null);
  const editorRef = useRef<LCLBOQItemEditorHandle>(null);
  const headerAutosaveRef = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedRestoreRef = useRef(false);

  const [initialItems, setInitialItems] = useState<ItemSnapshot[]>([]);
  const [structureId, setStructureId] = useState<string>('');
  const [templateStructure, setTemplateStructure] = useState<LCLTemplateStructure | null>(null);
  const loadCompletedRef = useRef(false);

  // Prevent accidental unmounting/cleanup
  useEffect(() => {
    return () => {
      console.log('[LCLTemplate] ⚠️ Component UNMOUNTING - this should not happen unless navigating away');
    };
  }, []);

  const loadLCLBOQData = useCallback(async () => {
    if (!companyId) {
      console.log('[LCLTemplate] Company ID not set yet, skipping data load');
      setLoading(false);
      return;
    }

    setLoading(true);
    setTemplateError(null);
    setTemplateStructure(null);
    console.log(`[LCLTemplate] Loading LCL BOQ data for company: ${companyId}`);
    try {
      // Phase 1: Load structures (critical path blocker)
      const structures = await lclTemplateService.getStructures(companyId);
      console.log(`[LCLTemplate] Loaded structures: ${structures.length} structure(s) - ${structures.map((s) => s.name).join(', ')}`);

      const lclDefaultStructure = structures.find(
        (s) => s.name === 'LCL Default BOQ'
      );

      if (!lclDefaultStructure) {
        const structureNames = structures.length > 0
          ? structures.map((s) => s.name).join(', ')
          : 'none';
        const errorMsg = `The LCL Default BOQ template structure is missing. Found ${structures.length} structure(s): ${structureNames}. Please contact your administrator to set up the required template structure.`;
        console.error(`[LCLTemplate] ${errorMsg}`);
        setTemplateError(errorMsg);
        setLoading(false);
        return;
      }

      setTemplateStructure(lclDefaultStructure);

      // Phase 2: Load hierarchical data and secondary data (latest BOQ + next number) in parallel
      loadCompletedRef.current = false;
      console.log(`[LCLTemplate] Loading hierarchical data for structure ID: ${lclDefaultStructure.id}`);
      try {
        const [data, latestBoq, nextNumber] = await Promise.all([
          lclTemplateService.getHierarchicalData(lclDefaultStructure.id, lclDefaultStructure),
          lclBoqService.getLCLBOQLatest(companyId),
          generateNextBOQNumber(undefined, companyId),
        ]);

        console.log(`[LCLTemplate] Hierarchical data loaded successfully`);
        loadCompletedRef.current = true;
        setHierarchicalData(data);
        setStructureId(lclDefaultStructure.id);

        if (latestBoq && latestBoq.items_snapshot && latestBoq.items_snapshot.length > 0) {
          setInitialItems(latestBoq.items_snapshot);
        }

        setBoqNumber(nextNumber);
      } catch (parallelError) {
        console.log('Note: Error loading hierarchical data or generating BOQ number:', parallelError);
        setBoqNumber('BOQ-001');
        throw parallelError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load LCL BOQ template';
      console.error(`[LCLTemplate] Error loading LCL BOQ for company ${companyId}:`, error);
      setTemplateError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const handleSaveLCLBOQ = async () => {
    if (!hierarchicalData || !companyId) return;

    if (authLoading) {
      toast({
        title: 'Authenticating',
        description: 'Please wait, authenticating user...',
      });
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in and try again.',
        variant: 'destructive',
      });
      return;
    }

    const itemsSnapshot = editorRef.current?.getSnapshot();
    if (!itemsSnapshot || itemsSnapshot.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'No items in the BOQ. Please add items before saving.',
        variant: 'destructive',
      });
      return;
    }

    const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);
    if (!selectedCustomerId || !selectedCustomer) {
      toast({
        title: 'Validation Error',
        description: 'Please select a customer.',
        variant: 'destructive',
      });
      return;
    }

    if (!projectTitle.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a project title.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const boqData: LCLBOQRecord = {
        id: lclBoqRecord?.id,
        company_id: companyId,
        number: boqNumber,
        customer_id: selectedCustomerId,
        project_title: projectTitle,
        boq_date: boqDate,
        items_snapshot: itemsSnapshot,
        status: 'saved',
      };

      // Save to lcl_boqs table
      const saved = await lclBoqService.saveLCLBOQ(boqData);
      setLclBoqRecord(saved);
      editorRef.current?.markAsSaved();
      try { localStorage.removeItem('lcl_boq_creation_header'); } catch { /* ignore */ }

      // Create or update corresponding BOQ record in boqs table
      try {
        const customerInfo = {
          name: selectedCustomer.name,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
          city: selectedCustomer.city,
          country: selectedCustomer.country,
        };

        const boqRecord = await lclBoqService.createBOQFromLCLBOQ(saved, customerInfo);

        // Store the boq_id in lcl_boqs to maintain the relationship
        if (boqRecord?.id && boqRecord.id !== saved.boq_id) {
          await lclBoqService.saveLCLBOQ({
            ...saved,
            boq_id: boqRecord.id,
          });
          // Update local state to reflect the boq_id
          setLclBoqRecord({
            ...saved,
            boq_id: boqRecord.id,
          });
        }
      } catch (boqCreateError) {
        console.error('Warning: Failed to create corresponding BOQ record:', boqCreateError);
        // Don't fail the save if BOQ creation fails, but warn the user
        toast({
          title: 'Partial Success',
          description: 'LCL BOQ saved, but failed to create corresponding BOQ record. Please contact support.',
          variant: 'destructive',
        });
        try { localStorage.removeItem('lcl_boq_creation_header'); } catch { /* ignore */ }
        return;
      }

      toast({
        title: 'Success',
        description: 'LCL BOQ and corresponding BOQ record saved successfully.',
      });
    } catch (error) {
      console.error('Error saving LCL BOQ:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save LCL BOQ. Please ensure the database is properly configured.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!hierarchicalData || !companyId) return;

    const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);
    if (!selectedCustomer) {
      toast({
        title: 'Validation Error',
        description: 'Please select a customer.',
        variant: 'destructive',
      });
      return;
    }

    if (!projectTitle.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a project title.',
        variant: 'destructive',
      });
      return;
    }

    const itemsSnapshot = editorRef.current?.getSnapshot();
    if (!itemsSnapshot || itemsSnapshot.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'No items in the BOQ. Please add items before downloading.',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);
    try {
      const pdfData = reconstructHierarchicalDataFromSnapshot(itemsSnapshot);
      await downloadLCLBOQPDF(
        pdfData,
        boqNumber,
        boqDate,
        selectedCustomer.name,
        projectTitle,
        {
          name: currentCompany?.name || '',
          logo_url: currentCompany?.logo_url,
          address: currentCompany?.address,
          city: currentCompany?.city,
          country: currentCompany?.country,
          phone: currentCompany?.phone,
          email: currentCompany?.email,
        }
      );

      toast({
        title: 'Success',
        description: 'LCL BOQ PDF downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    console.log(`[LCLTemplate] useEffect triggered - isCompanyLoading: ${isCompanyLoading}, companyId: "${companyId}"`);
    if (isCompanyLoading) {
      console.log('[LCLTemplate] ⏳ Company still loading, skipping loadLCLBOQData until company context ready');
      return;
    }
    console.log('[LCLTemplate] 📊 Calling loadLCLBOQData');
    loadLCLBOQData();
  }, [isCompanyLoading, companyId]);

  // Autosave header fields to localStorage (2s debounce)
  useEffect(() => {
    if (!hasAttemptedRestoreRef.current) {
      return;
    }

    if (headerAutosaveRef.current) {
      clearTimeout(headerAutosaveRef.current);
    }
    headerAutosaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem('lcl_boq_creation_header', JSON.stringify({
          selectedCustomerId,
          projectTitle,
          boqDate,
          lastSavedAt: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
    }, 2000);
    return () => {
      if (headerAutosaveRef.current) clearTimeout(headerAutosaveRef.current);
    };
  }, [selectedCustomerId, projectTitle, boqDate]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 15000);
    return () => clearTimeout(t);
  }, []);

  // Restore header fields from localStorage after data loads
  useEffect(() => {
    if (!hierarchicalData) return;

    let hasRestored = false;
    try {
      const raw = localStorage.getItem('lcl_boq_creation_header');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.selectedCustomerId) {
          setSelectedCustomerId(saved.selectedCustomerId);
          hasRestored = true;
        }
        if (saved.projectTitle) {
          setProjectTitle(saved.projectTitle);
          hasRestored = true;
        }
        if (saved.boqDate) {
          setBoqDate(saved.boqDate);
          hasRestored = true;
        }
      }
    } catch { /* ignore */ }

    // Mark that we've attempted restoration so autosave can begin
    hasAttemptedRestoreRef.current = true;

    if (hasRestored) {
      console.log('[LCLTemplate] ✅ Header fields restored from draft');
    }
  }, [hierarchicalData]);

  // Show auth-flashing guard while session is still being restored
  if (authLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (loading || isCompanyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Loading LCL BOQ...</p>
          {isCompanyLoading && <p className="text-xs text-muted-foreground/70">Waiting for company context...</p>}
        </div>
      </div>
    );
  }

  if (templateError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div>
            <h2 className="text-xl font-semibold mb-2">Unable to Load Template</h2>
            <p className="text-muted-foreground mb-4">{templateError}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button
              variant="default"
              onClick={() => {
                setTemplateError(null);
                loadLCLBOQData();
              }}
            >
              Retry
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hierarchicalData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Unable to Load LCL BOQ Template</h2>
          <p className="text-muted-foreground">The LCL BOQ template could not be loaded. This may be due to a missing template setup or a slow connection. Please try again or contact your administrator if the problem persists.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="default" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">LCL BOQ</h1>
      </div>

      {/* BOQ Header Section */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">BOQ Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input
              id="projectTitle"
              placeholder="e.g., Proposed Development - House Renovations"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>

          {/* BOQ Number (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="boqNumber">BOQ Number</Label>
            <Input
              id="boqNumber"
              value={boqNumber}
              disabled
              className="bg-muted"
            />
          </div>

          {/* BOQ Date */}
          <div className="space-y-2">
            <Label htmlFor="boqDate">BOQ Date</Label>
            <Input
              id="boqDate"
              type="date"
              value={boqDate}
              onChange={(e) => setBoqDate(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSaveLCLBOQ}
            disabled={saving || !selectedCustomerId || !projectTitle.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save LCL BOQ
          </Button>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            disabled={downloading || !selectedCustomerId || !projectTitle.trim()}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <LCLBOQItemEditor
        ref={editorRef}
        data={hierarchicalData}
        templateStructure={templateStructure}
        companyId={companyId}
        initialItems={initialItems}
        structureId={structureId}
      />
    </div>
  );
}
