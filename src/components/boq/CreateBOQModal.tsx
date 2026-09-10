import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FloatingItemPreview } from '@/components/ui/floating-item-preview';
import { toNumber, toInteger } from '@/utils/numericFormHelpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calculator, Layers, Check, Loader2 } from 'lucide-react';
import { useCustomers, useUnits, useBOQs } from '@/hooks/useDatabase';
import { CreateUnitModal } from '@/components/units/CreateUnitModal';
import { BOQSaveIndicator } from '@/components/boq/BOQSaveIndicator';
import { toast } from 'sonner';
import { downloadBOQPDF, BoqDocument } from '@/utils/boqPdfGenerator';
import { generateNextBOQNumber, invalidateBOQNumberCache } from '@/utils/boqNumberGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { saveBoqDraft, loadBoqDraft, deleteDraft, isDraftStale } from '@/services/boqAutoSaveService';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { useExchangeRate } from '@/hooks/useExchangeRate';

// Safe UUID generator that works in all environments
const generateSafeUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
};

interface CreateBOQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  company: any;
  initialDraftToken?: string | null;
}


interface BOQItemRow {
  id: string;
  description: string;
  quantity: number | '';
  unit: string; // will store unit id
  rate: number | '';
}

interface BOQSubsectionRow {
  id: string;
  name: string; // "A", "B", "C", etc.
  label: string; // "Materials", "Labor", etc.
  items: BOQItemRow[];
}

interface BOQSectionRow {
  id: string;
  title: string;
  subsections: BOQSubsectionRow[];
}

const defaultItem = (): BOQItemRow => ({
  id: `item-${generateSafeUUID()}`,
  description: '',
  quantity: '',
  unit: '',
  rate: '',
});

const defaultSubsection = (name: string, label: string): BOQSubsectionRow => ({
  id: `subsection-${generateSafeUUID()}`,
  name,
  label,
  items: [defaultItem()],
});

const defaultSection = (): BOQSectionRow => ({
  id: `section-${generateSafeUUID()}`,
  title: 'General',
  subsections: [
    defaultSubsection('A', 'Materials'),
    defaultSubsection('B', 'Labor'),
  ],
});

export function CreateBOQModal({ open, onOpenChange, onSuccess, company, initialDraftToken }: CreateBOQModalProps) {
  const currentCompany = company;
  const { data: customers = [] } = useCustomers(currentCompany?.id);
  const { data: units = [] } = useUnits(currentCompany?.id);
  const { data: existingBOQs = [] } = useBOQs(currentCompany?.id, 'id, number');
  const { profile, loading: authLoading } = useAuth();

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<{ sectionId: string; subsectionId: string; itemId: string } | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [authReadyError, setAuthReadyError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingFormDataRef = useRef<any>(null);
  const lastProfileRef = useRef(profile);
  const formStateRef = useRef<any>({});
  const draftTokenRef = useRef<string>(generateSafeUUID());
  const draftIdRef = useRef<string | null>(null);
  const loadedDraftTokenRef = useRef<string | null>(null);

  const todayISO = new Date().toISOString().split('T')[0];
  const defaultNumber = useMemo(() => {
    return generateNextBOQNumber(existingBOQs);
  }, [existingBOQs]);

  const [boqNumber, setBoqNumber] = useState(defaultNumber);
  const [boqDate, setBoqDate] = useState(todayISO);
  const [dueDate, setDueDate] = useState(todayISO);
  const [clientId, setClientId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [contractor, setContractor] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [previousTermsLoaded, setPreviousTermsLoaded] = useState(false);
  const [showCalculatedValuesInTerms, setShowCalculatedValuesInTerms] = useState(false);
  const [currency, setCurrency] = useState(currentCompany?.currency || 'KES');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [taxAmount, setTaxAmount] = useState<number | ''>('');
  const { rate: fetchedRate, isLoading: rateLoading, isForeignCurrency } = useExchangeRate(currency, currentCompany?.currency || 'KES');

  useEffect(() => {
    if (!rateLoading && fetchedRate > 0) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate, rateLoading]);
  const [boqStatus, setBoqStatus] = useState('draft');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [sections, setSections] = useState<BOQSectionRow[]>([defaultSection()]);
  const [submitting, setSubmitting] = useState(false);

  // Update BOQ number when modal opens
  useEffect(() => {
    if (open) {
      setBoqNumber(defaultNumber);
      setDueDate(todayISO);
    }
  }, [open, defaultNumber, todayISO]);

  // Set hydration state based on modal opening
  useEffect(() => {
    if (open) {
      setIsHydrating(true);
      setHydrationError(null);
    }
  }, [open]);

  // Load company default terms when modal opens
  useEffect(() => {
    if (open && currentCompany?.id && !previousTermsLoaded) {
      // Use company's default terms if available
      if (currentCompany.default_terms_and_conditions) {
        setTermsAndConditions(currentCompany.default_terms_and_conditions);
      } else {
        // Otherwise start with blank terms
        setTermsAndConditions('');
      }
      setPreviousTermsLoaded(true);
    }
  }, [open, currentCompany?.id, currentCompany?.default_terms_and_conditions, previousTermsLoaded]);

  // Load draft from database when modal opens (after previous terms are loaded)
  useEffect(() => {
    if (open && previousTermsLoaded && currentCompany?.id && profile?.id) {
      const needsLoad = !draftLoaded || (initialDraftToken && initialDraftToken !== loadedDraftTokenRef.current);
      if (!needsLoad) return;
      const loadDraft = async () => {
        try {
          if (initialDraftToken) {
            draftTokenRef.current = initialDraftToken;
          }
          const token = draftTokenRef.current;
          let draft = await loadBoqDraft(profile.id, currentCompany.id, token);
          // Fallback: no draft matched current token, try most recent
          if (!draft) {
            draft = await loadBoqDraft(profile.id, currentCompany.id);
            if (draft) {
              if (draft.draft_token) {
                draftTokenRef.current = draft.draft_token;
              } else {
                // Legacy draft without token: assign current token so future saves update it
                await supabase.from('boq_drafts').update({ draft_token: draftTokenRef.current }).eq('id', draft.id);
              }
            }
          }
          if (draft && draft.data) {
            draftIdRef.current = draft.id;
            // Check if draft is stale (>30 minutes old)
            if (isDraftStale(draft.last_autosaved_at, 30 * 60 * 1000)) {
              console.log('[CreateBOQModal] Draft is stale, deleting and starting fresh');
              const staleToken = draft.draft_token || token;
              draftIdRef.current = null;
              const deleteResult = await deleteDraft(profile.id, currentCompany.id, staleToken);
              if (!deleteResult.success) {
                console.error('[CreateBOQModal] Failed to delete stale draft:', deleteResult.error);
              }
              // Start with fresh form (no restoration)
            } else {
              // Draft is fresh, restore it
              setBoqNumber(draft.number || defaultNumber);
              setBoqDate(draft.boq_date || boqDate);
              setDueDate(draft.due_date || dueDate);
              setClientId(draft.customer_id || '');
              setProjectTitle(draft.project_title || '');
              setContractor(draft.contractor || '');
              setNotes(draft.data?.notes || '');
              setTermsAndConditions(draft.terms_and_conditions || termsAndConditions);
              setShowCalculatedValuesInTerms(draft.showCalculatedValuesInTerms || false);
              setCurrency(draft.currency || currency);
              setTaxAmount(draft.tax_amount || '');
              setAttachmentUrl(draft.attachment_url || '');
              setBoqStatus(draft.status || 'draft');
              setSections(draft.data?.sections || sections);
              setLastAutosavedAt(draft.last_autosaved_at || null);
            }
          }
        } catch (err) {
          console.log('Failed to load draft:', err);
          setHydrationError('Failed to load draft');
        } finally {
          setDraftLoaded(true);
          loadedDraftTokenRef.current = draftTokenRef.current;
          setIsHydrating(false);
        }
      };

      loadDraft();
    } else if (open && previousTermsLoaded && !draftLoaded) {
      setDraftLoaded(true);
      setIsHydrating(false);
    }
  }, [open, previousTermsLoaded, draftLoaded, currentCompany?.id, profile?.id, initialDraftToken]);

  // Cleanup pending autosaves on unmount
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  // Warn if user logs out with unsaved changes
  useEffect(() => {
    if (lastProfileRef.current && !profile && pendingFormDataRef.current) {
      console.warn('[CreateBOQModal] User logged out with pending autosave - data may not be saved');
    }
    lastProfileRef.current = profile;
  }, [profile]);

  // Autosave implementation with flush capability
  const performAutosave = useCallback(async (formData: any) => {
    if (!currentCompany?.id || !profile?.id) {
      const reason = !currentCompany?.id ? 'Company not loaded yet' : 'Auth not ready yet';
      console.warn('[CreateBOQModal] Autosave deferred: ' + reason, { companyId: currentCompany?.id, profileId: profile?.id });
      setAuthReadyError(reason);
      return;
    }

    try {
      setIsSavingDraft(true);
      setSaveError(null);
      setAuthReadyError(null);

      const selectedCustomer = customers.find(c => c.id === formData.clientId);
      const result = await saveBoqDraft(profile.id, currentCompany.id, {
        boqNumber: formData.boqNumber,
        boqDate: formData.boqDate,
        dueDate: formData.dueDate,
        clientId: formData.clientId,
        customerName: selectedCustomer?.name,
        customerEmail: selectedCustomer?.email,
        customerPhone: selectedCustomer?.phone,
        customerAddress: selectedCustomer?.address,
        customerCity: selectedCustomer?.city,
        customerCountry: selectedCustomer?.country,
        projectTitle: formData.projectTitle,
        contractor: formData.contractor,
        notes: formData.notes,
        termsAndConditions: formData.termsAndConditions,
        showCalculatedValuesInTerms: formData.showCalculatedValuesInTerms,
        currency: formData.currency,
        taxAmount: formData.taxAmount,
        attachmentUrl: formData.attachmentUrl,
        boqStatus: formData.boqStatus,
        sections: formData.sections,
      }, draftTokenRef.current, draftIdRef.current || undefined);

      if (result.success) {
        if (result.draftId) draftIdRef.current = result.draftId;
        setLastAutosavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setHasUnsavedChanges(false);
      } else {
        setSaveError(result.error || 'Failed to save draft');
        console.error('Autosave failed:', result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setSaveError(errorMsg);
      console.error('Failed to save draft:', err);
    } finally {
      setIsSavingDraft(false);
    }
  }, [currentCompany?.id, profile?.id, customers]);

  // Create debounced autosave function with manual flush capability (memoized for stability)
  const debouncedAutoSave = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }

    pendingTimeoutRef.current = setTimeout(() => {
      if (formStateRef.current) {
        performAutosave(formStateRef.current);
      }
    }, 5000);
  }, [performAutosave]);

  // Flush pending autosave when modal closes
  const flushPendingAutosave = useCallback(async () => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    if (formStateRef.current && Object.keys(formStateRef.current).length > 0) {
      await performAutosave(formStateRef.current);
    }
  }, [performAutosave]);

  // Sync form state to ref whenever it changes
  useEffect(() => {
    formStateRef.current = {
      boqNumber,
      boqDate,
      dueDate,
      clientId,
      projectTitle,
      contractor,
      notes,
      termsAndConditions,
      showCalculatedValuesInTerms,
      currency,
      taxAmount,
      attachmentUrl,
      boqStatus,
      sections,
    };
  }, [boqNumber, boqDate, dueDate, clientId, projectTitle, contractor, notes, termsAndConditions, showCalculatedValuesInTerms, currency, taxAmount, attachmentUrl, boqStatus, sections]);

  // Autosave whenever form state changes (after hydration is complete)
  useEffect(() => {
    if (open && draftLoaded && Object.keys(formStateRef.current).length > 0) {
      debouncedAutoSave();
    }
  }, [open, draftLoaded, boqNumber, boqDate, dueDate, clientId, projectTitle, contractor, notes, termsAndConditions, showCalculatedValuesInTerms, currency, taxAmount, attachmentUrl, boqStatus, sections, debouncedAutoSave]);

  // Helper to mark changes and clear any previous errors for auto-retry
  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true);
    if (saveError) setSaveError(null);
  }, [saveError]);

  const selectedClient = useMemo(() => customers.find(c => c.id === clientId), [customers, clientId]);

  const addSection = () => {
    setSections(prev => [...prev, defaultSection()]);
    markChanged();
  };

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    markChanged();
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title } : s));
    markChanged();
  };

  const addItem = (sectionId: string, subsectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, items: [...sub.items, defaultItem()] } : sub)
    } : s));
    markChanged();
  };

  const removeItem = (sectionId: string, subsectionId: string, itemId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, items: sub.items.filter(i => i.id !== itemId) } : sub)
    } : s));
    markChanged();
  };

  const updateItem = (sectionId: string, subsectionId: string, itemId: string, field: keyof BOQItemRow, value: string | number) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        subsections: s.subsections.map(sub => {
          if (sub.id !== subsectionId) return sub;
          return {
            ...sub,
            items: sub.items.map(i => {
              if (i.id !== itemId) return i;
              if (field === 'description' || field === 'unit') {
                return { ...i, [field]: String(value) };
              }
              // For numeric fields (quantity, rate), allow empty string
              return { ...i, [field]: value === '' ? '' : Number(value) };
            })
          };
        })
      };
    }));
    markChanged();
  };

  const updateSubsectionLabel = (sectionId: string, subsectionId: string, label: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, label } : sub)
    } : s));
    markChanged();
  };

  const addSubsection = (sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const nextLetter = String.fromCharCode(65 + s.subsections.length);
      return {
        ...s,
        subsections: [...s.subsections, defaultSubsection(nextLetter, `Subsection ${nextLetter}`)]
      };
    }));
    markChanged();
  };

  const removeSubsection = (sectionId: string, subsectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        subsections: s.subsections.filter(sub => sub.id !== subsectionId)
      };
    }));
    markChanged();
  };

  const formatCurrency = (amount: number) => {
    const currencyLocales: { [key: string]: { locale: string; code: string } } = {
      KES: { locale: 'en-KE', code: 'KES' },
      USD: { locale: 'en-US', code: 'USD' },
      EUR: { locale: 'en-GB', code: 'EUR' },
      GBP: { locale: 'en-GB', code: 'GBP' }
    };
    const curr = currencyLocales[currency] || currencyLocales.KES;
    return new Intl.NumberFormat(curr.locale, { style: 'currency', currency: curr.code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const calculateSubsectionTotal = (subsection: BOQSubsectionRow): number => {
    return subsection.items.reduce((sum, item) => {
      const qty = item.quantity === '' ? 0 : Number(item.quantity);
      const rate = item.rate === '' ? 0 : Number(item.rate);
      return sum + (qty * rate);
    }, 0);
  };

  const calculateSectionTotal = (section: BOQSectionRow): number => {
    return section.subsections.reduce((sum, sub) => sum + calculateSubsectionTotal(sub), 0);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    sections.forEach(sec => { subtotal += calculateSectionTotal(sec); });
    const tax = typeof taxAmount === 'number' ? taxAmount : 0;
    return { subtotal, tax, total: subtotal + tax };
  }, [sections, taxAmount]);

  const isItemEmpty = (item: BOQItemRow): boolean => {
    return !item.description.trim() && (item.quantity === '' || item.quantity === 0) && (item.rate === '' || item.rate === 0);
  };

  const isItemPartiallyFilled = (item: BOQItemRow): boolean => {
    const hasDescription = item.description.trim().length > 0;
    const hasQuantity = item.quantity !== '' && Number(item.quantity) > 0;
    const hasRate = item.rate !== '' && Number(item.rate) > 0;
    const filledFields = [hasDescription, hasQuantity, hasRate].filter(Boolean).length;
    return filledFields > 0 && filledFields < 3;
  };

  const getFilledItems = () => {
    return sections.map(s => ({
      ...s,
      subsections: s.subsections.map(sub => ({
        ...sub,
        items: sub.items.filter(i => !isItemEmpty(i))
      }))
    }));
  };

  const validate = () => {
    if (!clientId) { toast.error('Please select a client'); return false; }
    if (!boqNumber || !boqDate) { toast.error('BOQ number and date are required'); return false; }

    const filledSections = getFilledItems();
    const hasItems = filledSections.some(s => s.subsections.some(sub => sub.items.length > 0));
    if (!hasItems) { toast.error('Add at least one item'); return false; }

    const hasPartiallyFilled = filledSections.some(s => s.subsections.some(sub => sub.items.some(i => isItemPartiallyFilled(i))));
    if (hasPartiallyFilled) { toast.error('Each item needs description, quantity > 0, and rate > 0'); return false; }

    return true;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    if (!selectedClient) { toast.error('Invalid client'); return; }

    if (authLoading) {
      toast.info('Please wait, authenticating user...');
      return;
    }
    if (!profile?.id) {
      toast.error('User not authenticated. Please sign in and try again.');
      return;
    }

    setSubmitting(true);
    const filledSections = getFilledItems();

    // Calculate subtotal from filled items only
    let filledSubtotal = 0;
    filledSections.forEach(sec => {
      sec.subsections.forEach(sub => {
        sub.items.forEach(item => {
          const qty = item.quantity === '' ? 0 : Number(item.quantity);
          const rate = item.rate === '' ? 0 : Number(item.rate);
          filledSubtotal += qty * rate;
        });
      });
    });

    const doc: BoqDocument = {
      number: boqNumber,
      date: boqDate,
      currency: currency,
      client: {
        name: selectedClient.name,
        email: selectedClient.email || undefined,
        phone: selectedClient.phone || undefined,
        address: selectedClient.address || undefined,
        city: selectedClient.city || undefined,
        country: selectedClient.country || undefined,
      },
      contractor: contractor || undefined,
      project_title: projectTitle || undefined,
      sections: filledSections.map(s => ({
        title: s.title || undefined,
        subsections: s.subsections.map(sub => ({
          name: sub.name,
          label: sub.label,
          items: sub.items.map(i => {
            // lookup unit name from units list
            const unitObj = units.find((u: any) => u.id === i.unit);
            return {
              description: i.description,
              quantity: i.quantity,
              unit_id: i.unit || null,
              unit_name: unitObj ? unitObj.name : i.unit || null,
              rate: i.rate,
            };
          })
        }))
      })),
      notes: notes || undefined,
      // NOTE: Do NOT save terms to nested data - save only to top-level columns
      // This ensures single source of truth for terms_and_conditions and show_calculated_values_in_terms
    };

    // Validate required fields before inserting
    if (!currentCompany?.id) {
      console.error('Company ID is missing');
      toast.error('Company information is missing');
      return;
    }

    let currentNumber = boqNumber;
    let insertedId: string | null = null;
    let insertedDoc: BoqDocument = doc;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Build payload with current number
      const finalTaxAmount = typeof taxAmount === 'number' ? taxAmount : 0;
      const finalTotal = filledSubtotal + finalTaxAmount;
      const payload = {
        company_id: currentCompany.id,
        number: currentNumber,
        boq_date: boqDate,
        due_date: dueDate,
        client_name: selectedClient.name,
        client_email: selectedClient.email || null,
        client_phone: selectedClient.phone || null,
        client_address: selectedClient.address || null,
        client_city: selectedClient.city || null,
        client_country: selectedClient.country || null,
        contractor: contractor || null,
        project_title: projectTitle || null,
        currency: currency,
        exchange_rate: exchangeRate,
        subtotal: filledSubtotal,
        tax_amount: finalTaxAmount,
        total_amount: finalTotal,
        attachment_url: attachmentUrl || null,
        data: { ...insertedDoc, number: currentNumber },
        terms_and_conditions: termsAndConditions || null,
        showCalculatedValuesInTerms: showCalculatedValuesInTerms,
        created_by: profile?.id || null,
        status: boqStatus,
      };

      console.log(`[handleGenerate] Attempt ${attempt + 1}: Inserting BOQ with number ${currentNumber}`);

      const { data: insertedBOQ, error: insertError } = await supabase.from('boqs').insert([payload]).select('id');
      if (insertError) {
        let errorMsg = 'Unknown error';
        if (insertError instanceof Error) {
          errorMsg = insertError.message;
        } else if (typeof insertError === 'object' && insertError !== null) {
          errorMsg = (insertError as any).message || (insertError as any).details || JSON.stringify(insertError);
        }

        const isDuplicate = errorMsg.includes('duplicate') || errorMsg.includes('unique');
        if (isDuplicate && attempt < MAX_RETRIES - 1) {
          console.warn(`[handleGenerate] BOQ number "${currentNumber}" conflict, retrying with new number`);
          invalidateBOQNumberCache(currentCompany.id);
          currentNumber = await generateNextBOQNumber(existingBOQs, currentCompany.id);
          setBoqNumber(currentNumber);
          continue;
        }

        if (isDuplicate) {
          toast.error(`BOQ number "${currentNumber}" already exists — please try again`);
        } else {
          toast.error(`Failed to save BOQ: ${errorMsg}`);
        }
        return;
      }

      if (!insertedBOQ || insertedBOQ.length === 0) {
        console.error('BOQ created but no ID returned');
        toast.error('BOQ saved but no ID returned from database');
        return;
      }

      insertedId = insertedBOQ[0].id;
      break;
    }

    if (!insertedId) {
      toast.error('Failed to save BOQ — please try again');
      return;
    }

    const docForPdf = {
      ...insertedDoc,
      terms_and_conditions: termsAndConditions || undefined,
      showCalculatedValuesInTerms,
    };
    const companyForPdf = currentCompany ? {
      name: currentCompany.name,
      logo_url: currentCompany.logo_url || undefined,
      address: currentCompany.address || undefined,
      city: currentCompany.city || undefined,
      country: currentCompany.country || undefined,
      phone: currentCompany.phone || undefined,
      email: currentCompany.email || undefined,
      tax_number: currentCompany.tax_number || undefined,
      company_services: currentCompany.company_services || undefined,
    } : undefined;

    toast.success(`BOQ ${currentNumber} saved`);
    if (currentCompany?.id) invalidateBOQNumberCache(currentCompany.id);
    onSuccess?.();

    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    formStateRef.current = {};
    setSubmitting(false);
    await deleteDraft(profile.id, currentCompany.id, draftTokenRef.current);
    draftIdRef.current = null;
    handleOpenChange(false);

    void downloadBOQPDF(docForPdf, companyForPdf).catch((err) => {
      console.error('Failed to generate BOQ PDF', err);
      toast.error('BOQ saved but failed to generate PDF. You can download it later from the BOQ list.');
    });
  };

  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen) {
      // Flush any pending autosave before closing
      await flushPendingAutosave();
      setPreviousTermsLoaded(false);
      setDraftLoaded(false);
    }
    onOpenChange(newOpen);
  };

  const handleClearForm = async () => {
    // Reset all form fields to default values
    setBoqNumber(defaultNumber);
    setBoqDate(todayISO);
    setDueDate(todayISO);
    setClientId('');
    setProjectTitle('');
    setContractor('');
    setNotes('');
    setTermsAndConditions(currentCompany?.default_terms_and_conditions || '');
    setShowCalculatedValuesInTerms(false);
    setCurrency(currentCompany?.currency || 'KES');
    setExchangeRate(1);
    setSections([defaultSection()]);
    setLastAutosavedAt(null);

    // Clear draft from database
    if (profile?.id && currentCompany?.id) {
      const deleteResult = await deleteDraft(profile.id, currentCompany.id, draftTokenRef.current);

      if (deleteResult.success) {
        toast.success('Form cleared and draft reset');
      } else {
        toast.error('Failed to clear draft: ' + deleteResult.error);
      }
    } else {
      toast.success('Form cleared');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl md:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-2 md:space-x-4">
              <DialogTitle className="flex items-center space-x-2 text-lg md:text-base">
                <Layers className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="break-words">Create Bill of Quantities</span>
              </DialogTitle>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-4">
              <BOQSaveIndicator
                isSaving={isSavingDraft}
                lastSavedTime={lastAutosavedAt}
                hasUnsavedChanges={hasUnsavedChanges}
                saveError={saveError}
              />
              {lastAutosavedAt && (
                <Button variant="outline" size="sm" onClick={handleClearForm} className="w-full sm:w-auto">
                  Reset Draft
                </Button>
              )}
            </div>
          </div>
          <DialogDescription>
            Build a detailed BOQ, save it to the database and download a branded PDF.
          </DialogDescription>
        </DialogHeader>

        {isHydrating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-full space-y-3">
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-muted rounded animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground">Loading form...</p>
          </div>
        )}

        {hydrationError && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm font-medium text-destructive">Failed to load form</p>
            <p className="text-sm text-destructive/80 mt-1">{hydrationError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="mt-3"
            >
              Close
            </Button>
          </div>
        )}

        {!isHydrating && !hydrationError && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div>
              <Label>BOQ Number</Label>
              <Input value={boqNumber} onChange={e => { setBoqNumber(e.target.value); markChanged(); }} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={boqDate} onChange={e => { setBoqDate(e.target.value); markChanged(); }} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); markChanged(); }} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(val) => { setCurrency(val); markChanged(); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_SELECT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isForeignCurrency && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {rateLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Fetching exchange rate...</span>
                    </>
                  ) : (
                    <span>
                      1 {currency} = {exchangeRate.toFixed(4)} {currentCompany?.currency || 'KES'}
                      <span className="text-xs ml-1">(locked at creation)</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>Tax Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={taxAmount}
                onChange={e => { setTaxAmount(e.target.value === '' ? '' : Number(e.target.value)); markChanged(); }}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={boqStatus} onValueChange={(val) => { setBoqStatus(val); markChanged(); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(val) => { setClientId(val); markChanged(); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Project Title</Label>
              <Input value={projectTitle} onChange={e => { setProjectTitle(e.target.value); markChanged(); }} />
            </div>
            <div>
              <Label>Contractor</Label>
              <Input value={contractor} onChange={e => { setContractor(e.target.value); markChanged(); }} />
            </div>
            <div>
              <Label>Attachment URL</Label>
              <Input
                value={attachmentUrl}
                onChange={e => { setAttachmentUrl(e.target.value); markChanged(); }}
                placeholder="https://example.com/attachment.pdf"
              />
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sections & Items</CardTitle>
              <Button variant="outline" onClick={addSection}>
                <Plus className="h-4 w-4 mr-2" /> Add Section
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {sections.map((section, sIdx) => (
                <div key={section.id} className="space-y-3 border border-border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Input value={section.title} onChange={e => updateSectionTitle(section.id, e.target.value)} placeholder="Section title" />
                    <Button variant="destructive" onClick={() => removeSection(section.id)} disabled={sections.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="ml-auto text-sm text-muted-foreground">Section {sIdx + 1}</div>
                  </div>

                  {section.subsections.map((subsection, subIdx) => (
                    <div key={subsection.id} className="space-y-3 bg-muted/30 rounded-lg p-3 border border-border/50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">Subsection {subsection.name}:</div>
                          <Input
                            value={subsection.label}
                            onChange={e => updateSubsectionLabel(section.id, subsection.id, e.target.value)}
                            placeholder="Enter subsection name"
                            className="w-48"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground">Subtotal: {formatCurrency(calculateSubsectionTotal(subsection))}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubsection(section.id, subsection.id)}
                            disabled={section.subsections.length === 1}
                            title={section.subsections.length === 1 ? "Cannot remove the last subsection" : "Remove this subsection"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-2/5">Item Description</TableHead>
                            <TableHead className="w-20">Qty</TableHead>
                            <TableHead className="w-32">Unit</TableHead>
                            <TableHead className="w-28">Rate</TableHead>
                            <TableHead className="w-28 text-right">Amount</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subsection.items.map(row => (
                            <TableRow key={row.id} className="h-auto">
                              <TableCell className="py-3 pr-3">
                                <div className="relative">
                                  <Textarea value={row.description} onChange={e => updateItem(section.id, subsection.id, row.id, 'description', e.target.value)} onFocus={() => setPreviewItem({ sectionId: section.id, subsectionId: subsection.id, itemId: row.id })} onBlur={() => setPreviewItem(null)} placeholder="Describe item in detail..." className="text-sm px-3 py-2 min-h-16 resize-none" />
                                  {previewItem?.itemId === row.id && row.description && (
                                    <div className="fixed z-50 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground px-4 py-3 rounded-lg text-sm font-medium shadow-xl border border-primary/30 pointer-events-none backdrop-blur-sm max-w-xs" style={{ left: '20px', top: '-120px' }}>
                                      <div className="font-semibold mb-2 text-primary-foreground/90">Preview</div>
                                      <div className="text-primary-foreground/95 break-words whitespace-pre-wrap">{row.description}</div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-1">
                                <div className="relative">
                                  <Input type="number" min={0} value={row.quantity ?? ''} onChange={e => updateItem(section.id, subsection.id, row.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="h-10 text-sm text-center px-2 w-20" />
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-2">
                                <Select value={row.unit} onValueChange={(val) => {
                                  if (val === '__add_unit') {
                                    setPendingUnitTarget({ sectionId: section.id, itemId: row.id });
                                    setUnitModalOpen(true);
                                  } else {
                                    updateItem(section.id, subsection.id, row.id, 'unit', val);
                                  }
                                }}>
                                  <SelectTrigger className="h-10 text-sm">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {units.map((u: any) => (
                                      <SelectItem key={u.id} value={u.id}>{u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}</SelectItem>
                                    ))}
                                    <SelectItem value="__add_unit">+ Add unit...</SelectItem>
                                  </SelectContent>
                                </Select>

                                <CreateUnitModal open={unitModalOpen} onOpenChange={setUnitModalOpen} onCreated={(unitName) => {
                                  if (pendingUnitTarget) {
                                    updateItem(pendingUnitTarget.sectionId, subsection.id, pendingUnitTarget.itemId, 'unit', unitName);
                                    setPendingUnitTarget(null);
                                  }
                                }} />
                              </TableCell>
                              <TableCell className="py-3 px-1">
                                <div className="relative">
                                  <Input type="number" min={0} value={row.rate ?? ''} onChange={e => updateItem(section.id, subsection.id, row.id, 'rate', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="h-10 text-sm text-center px-2 w-28" />
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 px-2">
                                <div className="text-sm font-medium">
                                  {formatCurrency((row.quantity === '' ? 0 : Number(row.quantity)) * (row.rate === '' ? 0 : Number(row.rate)))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 px-1">
                                <Button variant="ghost" size="sm" onClick={() => removeItem(section.id, subsection.id, row.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Button variant="outline" size="sm" onClick={() => addItem(section.id, subsection.id)}>
                                <Plus className="h-4 w-4 mr-2" /> Add Item
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSubsection(section.id)}
                    className="mb-3"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Subsection
                  </Button>

                  <div className="flex items-center justify-end gap-6 pt-2 border-t border-border">
                    <div className="text-sm font-semibold">Section Total: {formatCurrency(calculateSectionTotal(section))}</div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-end gap-6 pt-4">
                <div className="space-y-2">
                  <div className="text-lg font-semibold">Subtotal: {formatCurrency(totals.subtotal)}</div>
                  <div className="text-lg font-semibold">Tax: {formatCurrency(totals.tax)}</div>
                  <div className="text-xl font-bold border-t pt-2">Total: {formatCurrency(totals.total)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => { setNotes(e.target.value); markChanged(); }} rows={4} placeholder="Any special notes or terms" />
          </div>

          <div>
            <Label>Terms and Conditions</Label>
            <Textarea
              value={termsAndConditions}
              onChange={e => { setTermsAndConditions(e.target.value); markChanged(); }}
              rows={6}
            />
            <div className="flex items-center space-x-2 mt-3">
              <Checkbox
                id="showCalculatedValues"
                checked={showCalculatedValuesInTerms}
                onCheckedChange={(checked) => { setShowCalculatedValuesInTerms(checked === true); markChanged(); }}
              />
              <Label htmlFor="showCalculatedValues" className="font-normal cursor-pointer">
                Show calculated values (e.g., 50% (KES 50,000))
              </Label>
            </div>
          </div>
        </div>
        )}

        {!isHydrating && !hydrationError && (
        <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <Button variant="destructive" onClick={handleClearForm} className="w-full sm:w-auto">
            Clear Form
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:space-x-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleGenerate} disabled={submitting} className="w-full sm:w-auto">
              <Calculator className="h-4 w-4 mr-2" />
              {submitting ? 'Generating...' : 'Download BOQ PDF'}
            </Button>
          </div>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
