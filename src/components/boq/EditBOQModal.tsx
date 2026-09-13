import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FloatingItemPreview } from '@/components/ui/floating-item-preview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calculator, Layers } from 'lucide-react';
import { useCustomers, useUnits } from '@/hooks/useDatabase';
import { CreateUnitModal } from '@/components/units/CreateUnitModal';
import { BOQSaveIndicator } from '@/components/boq/BOQSaveIndicator';
import { toast } from 'sonner';
import { downloadBOQPDF, BoqDocument } from '@/utils/boqPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { saveEditingDraft, loadEditDraft, deleteEditDraft } from '@/services/boqAutoSaveService';
import { toCollection } from '@/utils/collection';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';

// Safe UUID generator that works in all environments
const generateSafeUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
};

interface EditBOQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boq: any;
  onSuccess?: () => void;
  company: any;
}


interface BOQItemRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
}

interface BOQSubsectionRow {
  id: string;
  name: string;
  label: string;
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
  quantity: 1,
  unit: '',
  rate: 0,
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

export function EditBOQModal({ open, onOpenChange, boq, onSuccess, company }: EditBOQModalProps) {
  const currentCompany = company;
  const { data: customersResponse } = useCustomers(currentCompany?.id);
  const customers = toCollection(customersResponse);
  const { data: units = [] } = useUnits(currentCompany?.id);
  const { profile } = useAuth();

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<{ sectionId: string; subsectionId: string; itemId: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const unsavedChangesRef = useRef(false);
  const pendingChangesRef = useRef<any>({});

  const [boqNumber, setBoqNumber] = useState('');
  const [boqDate, setBoqDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [contractor, setContractor] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [showCalculatedValuesInTerms, setShowCalculatedValuesInTerms] = useState(false);
  const [currency, setCurrency] = useState(boq?.currency || 'KES');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [taxAmount, setTaxAmount] = useState<number | ''>('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [boqStatus, setBoqStatus] = useState('draft');
  const [sections, setSections] = useState<BOQSectionRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { rate: fetchedRate, isLoading: rateLoading, isForeignCurrency } = useExchangeRate(currency, currentCompany?.currency || 'KES');

  useEffect(() => {
    if (!rateLoading && fetchedRate > 0) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate, rateLoading]);

  useCurrencyConversion({ exchangeRate, isOpen: open, setSections, sections });

  const selectedClient = useMemo(() => customers.find(c => c.id === clientId), [customers, clientId]);

  // Autosave function - uses fresh data from pendingChangesRef
  const performAutosave = useCallback(async () => {
    if (!boq?.id || !profile?.id || !currentCompany?.id) return;

    setIsSaving(true);
    setEditSaveError(null);
    try {
      const changes = pendingChangesRef.current;

      // Build filled sections from the ref data
      const filledSections = (changes.sections || []).map((s: any) => ({
        ...s,
        subsections: (s.subsections || []).map((sub: any) => ({
          ...sub,
          items: (sub.items || []).filter((i: any) => {
            return i.description.trim() || (i.quantity && Number(i.quantity) > 0) || (i.rate && Number(i.rate) > 0);
          })
        }))
      }));

      let filledSubtotal = 0;
      filledSections.forEach((sec: any) => {
        sec.subsections.forEach((sub: any) => {
          sub.items.forEach((item: any) => {
            filledSubtotal += (item.quantity || 0) * (item.rate || 0);
          });
        });
      });

      const finalTaxAmount = typeof changes.taxAmount === 'number' ? changes.taxAmount : 0;
      const finalTotal = filledSubtotal + finalTaxAmount;
      const draftData = {
        number: changes.boqNumber,
        boq_date: changes.boqDate,
        due_date: changes.dueDate,
        customer_id: changes.clientId,
        client_name: changes.selectedClientName || '',
        client_email: changes.selectedClientEmail || null,
        client_phone: changes.selectedClientPhone || null,
        client_address: changes.selectedClientAddress || null,
        client_city: changes.selectedClientCity || null,
        client_country: changes.selectedClientCountry || null,
        contractor: changes.contractor || null,
        project_title: changes.projectTitle || null,
        currency: changes.currency,
        subtotal: filledSubtotal,
        tax_amount: finalTaxAmount,
        total_amount: finalTotal,
        attachment_url: changes.attachmentUrl || null,
        data: {
          sections: filledSections.map((s: any) => ({
            title: s.title,
            subsections: s.subsections.map((sub: any) => ({
              name: sub.name,
              label: sub.label,
              items: sub.items.map((i: any) => {
                const unitObj = changes.units.find((u: any) => u.id === i.unit);
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
          notes: changes.notes,
        },
        termsAndConditions: changes.termsAndConditions || null,
        showCalculatedValuesInTerms: changes.showCalculatedValuesInTerms,
        status: changes.boqStatus || 'draft',
      };

      const result = await saveEditingDraft(profile.id, currentCompany.id, boq.id, draftData);

      if (result.success) {
        setLastSavedTime(new Date().toISOString());
        setHasUnsavedChanges(false);
        unsavedChangesRef.current = false;
        setEditSaveError(null);
      } else {
        console.error('Autosave failed:', result.error);
        setEditSaveError(result.error || 'Failed to save draft');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error during autosave:', err);
      setEditSaveError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [boq?.id, profile?.id, currentCompany?.id]);

  // Keep pendingChangesRef in sync with all form state
  useEffect(() => {
    pendingChangesRef.current = {
      boqNumber,
      boqDate,
      dueDate,
      clientId,
      selectedClientName: selectedClient?.name,
      selectedClientEmail: selectedClient?.email,
      selectedClientPhone: selectedClient?.phone,
      selectedClientAddress: selectedClient?.address,
      selectedClientCity: selectedClient?.city,
      selectedClientCountry: selectedClient?.country,
      contractor,
      projectTitle,
      currency,
      taxAmount,
      attachmentUrl,
      boqStatus,
      units,
      notes,
      termsAndConditions,
      showCalculatedValuesInTerms,
      sections,
    };
  }, [boqNumber, boqDate, dueDate, clientId, selectedClient, contractor, projectTitle, currency, taxAmount, attachmentUrl, boqStatus, units, notes, termsAndConditions, showCalculatedValuesInTerms, sections]);

  // Debounce autosave to 5 seconds
  const debouncedAutosave = useDebounce(performAutosave, 5000);

  // Mark as changed and trigger autosave
  const triggerAutosave = useCallback(() => {
    setHasUnsavedChanges(true);
    unsavedChangesRef.current = true;
    debouncedAutosave();
  }, [debouncedAutosave]);

  // Handle browser unload with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (open && boq && profile?.id && currentCompany?.id) {
      setIsHydrating(true);
      setHydrationError(null);

      const checkAndLoadDraft = async () => {
        try {
          console.log('[EditBOQModal] Loading BOQ:', { id: boq.id, number: boq.number, hasData: !!boq.data });

          const editDraft = await loadEditDraft(profile.id, currentCompany.id, boq.id);
          console.log('[EditBOQModal] Edit draft found:', !!editDraft);

          // Load from draft if it exists and is newer than published version
          let dataToUse = boq;
          if (editDraft) {
            try {
              const draftUpdated = new Date(editDraft.updated_at);
              const boqUpdated = new Date(boq.updated_at);
              if (draftUpdated > boqUpdated) {
                dataToUse = editDraft;
              }
            } catch (err) {
              console.error('[EditBOQModal] Error comparing dates:', err);
            }
          }

          console.log('[EditBOQModal] Using data from:', dataToUse.id === editDraft?.id ? 'draft' : 'boq');

          const boqData = dataToUse.data || {};

          const boqNum = dataToUse.number || '';
          const boqDateVal = dataToUse.boq_date || '';
          const dueDateVal = dataToUse.due_date || '';

          setBoqNumber(boqNum);
          setBoqDate(boqDateVal);
          setDueDate(dueDateVal);

          setProjectTitle(dataToUse.project_title || boqData.project_title || '');
          setContractor(dataToUse.contractor || boqData.contractor || '');
          setNotes(boqData.notes || '');

          const termsToUse = (dataToUse.terms_and_conditions || dataToUse.termsAndConditions) || currentCompany?.default_terms_and_conditions || '';
          setTermsAndConditions(termsToUse);
          const showCalcValues = dataToUse.showCalculatedValuesInTerms || false;
          setShowCalculatedValuesInTerms(showCalcValues);

          const currencyToUse = dataToUse.currency || boqData.currency || 'KES';
          setCurrency(currencyToUse);

          setTaxAmount(dataToUse.tax_amount || '');
          setAttachmentUrl(dataToUse.attachment_url || '');
          setBoqStatus(dataToUse.status || 'draft');

          const clientName = dataToUse.client_name || boqData.client_name;
          const clientIdFromBoq = clientName ? customers.find(c => c.name === clientName)?.id : undefined;
          if (clientIdFromBoq) {
            setClientId(clientIdFromBoq);
          }

          const sections = boqData.sections;
          if (sections && Array.isArray(sections) && sections.length > 0) {
            try {
              const loadedSections: BOQSectionRow[] = sections.map((section: any) => {
                const subsectionsArray = Array.isArray(section.subsections) ? section.subsections : [];

                return {
                  id: `section-${generateSafeUUID()}`,
                  title: section.title || 'General',
                  subsections: subsectionsArray.map((subsection: any) => {
                    const itemsArray = Array.isArray(subsection.items) ? subsection.items : [];

                    return {
                      id: `subsection-${generateSafeUUID()}`,
                      name: subsection.name || '',
                      label: subsection.label || '',
                      items: itemsArray.map((item: any) => ({
                        id: `item-${generateSafeUUID()}`,
                        description: item.description || '',
                        quantity: Number(item.quantity) || 1,
                        unit: item.unit_id || '',
                        rate: Number(item.rate) || 0,
                      })),
                    };
                  }),
                };
              });
              setSections(loadedSections);
            } catch (err) {
              console.error('Error loading sections:', err);
              setSections([defaultSection()]);
            }
          } else {
            setSections([defaultSection()]);
          }

          if (editDraft) {
            setLastSavedTime(editDraft.last_autosaved_at);
          }

          if (!boqNum || !boqDateVal || !clientIdFromBoq) {
            console.warn('[EditBOQModal] Missing critical BOQ data:', {
              boqNumber: boqNum || 'MISSING',
              boqDate: boqDateVal || 'MISSING',
              clientId: clientIdFromBoq || 'MISSING',
              clientName: clientName,
            });
          }

          setHasUnsavedChanges(false);
          unsavedChangesRef.current = false;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load BOQ details';
          console.error('[EditBOQModal] Hydration error:', err);
          setHydrationError(errorMsg);
        } finally {
          setIsHydrating(false);
        }
      };

      checkAndLoadDraft();
    }
  }, [open, boq?.id, profile?.id, currentCompany?.id]);

  const addSection = () => {
    setSections(prev => [...prev, defaultSection()]);
    triggerAutosave();
  };

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    triggerAutosave();
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title } : s));
    triggerAutosave();
  };

  const addItem = (sectionId: string, subsectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, items: [...sub.items, defaultItem()] } : sub)
    } : s));
    triggerAutosave();
  };

  const removeItem = (sectionId: string, subsectionId: string, itemId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, items: sub.items.filter(i => i.id !== itemId) } : sub)
    } : s));
    triggerAutosave();
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
            items: sub.items.map(i => i.id === itemId ? { ...i, [field]: field === 'description' || field === 'unit' ? String(value) : Number(value) } : i)
          };
        })
      };
    }));
    triggerAutosave();
  };

  const updateSubsectionLabel = (sectionId: string, subsectionId: string, label: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, label } : sub)
    } : s));
    triggerAutosave();
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
    triggerAutosave();
  };

  const removeSubsection = (sectionId: string, subsectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        subsections: s.subsections.filter(sub => sub.id !== subsectionId)
      };
    }));
    triggerAutosave();
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
    return subsection.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
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

  const handleSave = async () => {
    if (!validate()) return;
    if (!selectedClient) { toast.error('Invalid client'); return; }
    if (!boq?.id) { toast.error('BOQ ID not found'); return; }

    setSubmitting(true);
    try {
      const filledSections = getFilledItems();

      // Calculate subtotal from filled items only
      let filledSubtotal = 0;
      filledSections.forEach(sec => {
        sec.subsections.forEach(sub => {
          sub.items.forEach(item => {
            filledSubtotal += (item.quantity || 0) * (item.rate || 0);
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

      const finalTaxAmount = typeof taxAmount === 'number' ? taxAmount : 0;
      const finalTotal = filledSubtotal + finalTaxAmount;
      const payload = {
        number: boqNumber,
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
        subtotal: filledSubtotal,
        tax_amount: finalTaxAmount,
        total_amount: finalTotal,
        attachment_url: attachmentUrl || null,
        data: doc,
        terms_and_conditions: termsAndConditions || null,
        showCalculatedValuesInTerms: showCalculatedValuesInTerms,
        status: boqStatus,
      };

      const { error: updateError } = await supabase.from('boqs').update(payload).eq('id', boq.id).eq('company_id', currentCompany?.id);
      if (updateError) {
        console.error('Failed to update BOQ:', updateError);
        toast.error('Failed to update BOQ');
        return;
      }

      // Delete the edit draft since we've successfully saved
      if (profile?.id && currentCompany?.id) {
        await deleteEditDraft(profile.id, currentCompany.id, boq.id);
      }

      setHasUnsavedChanges(false);
      unsavedChangesRef.current = false;
      toast.success(`BOQ ${boqNumber} updated`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to update BOQ', err);
      toast.error('Failed to update BOQ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && unsavedChangesRef.current) {
      setShowUnsavedDialog(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>Edit Bill of Quantities</span>
          </DialogTitle>
          <DialogDescription>
            Edit BOQ details and save changes to the database.
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
            <p className="text-sm text-muted-foreground">Loading BOQ details...</p>
          </div>
        )}

        {hydrationError && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm font-medium text-destructive">Failed to load BOQ details</p>
            <p className="text-sm text-destructive/80 mt-1">{hydrationError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="mt-3"
            >
              Close
            </Button>
          </div>
        )}

        {!isHydrating && !hydrationError && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>BOQ Number</Label>
              <Input value={boqNumber} onChange={e => { setBoqNumber(e.target.value); triggerAutosave(); }} disabled={isHydrating} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={boqDate} onChange={e => { setBoqDate(e.target.value); triggerAutosave(); }} disabled={isHydrating} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); triggerAutosave(); }} disabled={isHydrating} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={val => { setCurrency(val); triggerAutosave(); }} disabled={isHydrating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
              {isForeignCurrency && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {rateLoading ? (
                    <span>Fetching exchange rate...</span>
                  ) : (
                    <span>
                      1 {currency} = {exchangeRate.toFixed(4)} {currentCompany?.currency || 'KES'}
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
                onChange={e => { setTaxAmount(e.target.value === '' ? '' : Number(e.target.value)); triggerAutosave(); }}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={boqStatus} onValueChange={(val) => { setBoqStatus(val); triggerAutosave(); }}>
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
            <Select value={clientId} onValueChange={val => { setClientId(val); triggerAutosave(); }} disabled={isHydrating}>
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
              <Input value={projectTitle} onChange={e => { setProjectTitle(e.target.value); triggerAutosave(); }} />
            </div>
            <div>
              <Label>Contractor</Label>
              <Input value={contractor} onChange={e => { setContractor(e.target.value); triggerAutosave(); }} />
            </div>
            <div>
              <Label>Attachment URL</Label>
              <Input
                value={attachmentUrl}
                onChange={e => { setAttachmentUrl(e.target.value); triggerAutosave(); }}
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
                                  <Input type="number" min={0} value={row.quantity} onChange={e => updateItem(section.id, subsection.id, row.id, 'quantity', Number(e.target.value))} placeholder="0" className="h-10 text-sm text-center px-2 w-20" />
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
                                  <Input type="number" min={0} value={row.rate} onChange={e => updateItem(section.id, subsection.id, row.id, 'rate', Number(e.target.value))} placeholder="0" className="h-10 text-sm text-center px-2 w-28" />
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 px-2">
                                <div className="text-sm font-medium">
                                  {formatCurrency((row.quantity || 0) * (row.rate || 0))}
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
            <Textarea value={notes} onChange={e => { setNotes(e.target.value); triggerAutosave(); }} rows={4} placeholder="Any special notes or terms" />
          </div>

          <div>
            <Label>Terms and Conditions</Label>
            <Textarea
              value={termsAndConditions}
              onChange={e => { setTermsAndConditions(e.target.value); triggerAutosave(); }}
              rows={6}
            />
            <div className="flex items-center space-x-2 mt-3">
              <Checkbox
                id="showCalculatedValues"
                checked={showCalculatedValuesInTerms}
                onCheckedChange={(checked) => { setShowCalculatedValuesInTerms(checked === true); triggerAutosave(); }}
              />
              <Label htmlFor="showCalculatedValues" className="font-normal cursor-pointer">
                Show calculated values (e.g., 50% (KES 50,000))
              </Label>
            </div>
          </div>
        </div>
        )}

        {!isHydrating && !hydrationError && (
        <DialogFooter className="mt-6 flex items-center justify-between">
          <BOQSaveIndicator
            isSaving={isSaving}
            lastSavedTime={lastSavedTime}
            hasUnsavedChanges={hasUnsavedChanges}
            saveError={editSaveError}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              if (unsavedChangesRef.current) {
                setShowUnsavedDialog(true);
              } else {
                onOpenChange(false);
              }
            }} disabled={isHydrating}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || isHydrating}>
              <Calculator className="h-4 w-4 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
        )}

        <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to close without saving?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Editing</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setShowUnsavedDialog(false);
                onOpenChange(false);
              }}>
                Discard Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
