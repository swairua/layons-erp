import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Trash2, 
  Search,
  Calculator,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useCustomers, useProducts, useTaxSettings } from '@/hooks/useDatabase';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { toCollection } from '@/utils/collection';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { toNumber, toInteger } from '@/utils/numericFormHelpers';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';

interface QuotationItem {
  id: string;
  product_id: string;
  product_name: string;
  description: string;
  quantity: number | '';
  unit_price: number | '';
  tax_percentage: number | '';
  tax_amount: number;
  tax_inclusive: boolean;
  line_total: number;
  section_name?: string;
  section_labor_cost?: number;
  unit_of_measure?: string;
}

interface QuotationSection {
  id: string;
  name: string;
  items: QuotationItem[];
  labor_cost: number | '';
  expanded: boolean;
}

interface EditQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  quotation: any;
}

export function EditQuotationModal({ open, onOpenChange, onSuccess, quotation }: EditQuotationModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [currency, setCurrency] = useState(quotation?.currency || 'KES');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  
  const [sections, setSections] = useState<QuotationSection[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [previewItem, setPreviewItem] = useState<{ sectionId: string; itemId: string } | null>(null);

  const { currentCompany } = useCurrentCompany();
  const { data: customersResponse, isLoading: loadingCustomers } = useCustomers(currentCompany?.id);
  const customers = toCollection(customersResponse);
  const { data: productsResponse, isLoading: loadingProducts } = useProducts(currentCompany?.id);
  const products = toCollection(productsResponse);
  const { data: taxSettings } = useTaxSettings(currentCompany?.id);
  const { rate: fetchedRate, isLoading: rateLoading, isForeignCurrency } = useExchangeRate(currency, currentCompany?.currency || 'KES');

  useEffect(() => {
    if (!rateLoading && fetchedRate > 0) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate, rateLoading]);

  useCurrencyConversion({ exchangeRate, isOpen: open, setSections, sections });

  const defaultTax = taxSettings?.find(tax => tax.is_default && tax.is_active);
  const defaultTaxRate = defaultTax?.rate || 16;

  // Load quotation data when modal opens
  useEffect(() => {
    if (quotation && open) {
      setSelectedCustomerId(quotation.customers?.id || '');
      setQuotationDate(quotation.quotation_date || '');
      setValidUntil(quotation.valid_until || '');
      setCurrency(quotation.currency || currentCompany?.currency || 'KES');
      setNotes(quotation.notes || '');
      setTermsAndConditions(quotation.terms_and_conditions || '');

      // Group items into sections
      const quotationItems = (quotation.quotation_items || []).map((item: any, index: number) => ({
        id: item.id || `existing-${index}`,
        product_id: item.product_id || '',
        product_name: item.products?.name || item.product_name || 'Unknown Product',
        description: item.description || '',
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        tax_percentage: item.tax_percentage || 0,
        tax_amount: item.tax_amount || 0,
        tax_inclusive: item.tax_inclusive || false,
        line_total: item.line_total || 0,
        section_name: item.section_name || 'General Items',
        section_labor_cost: item.section_labor_cost || 0,
      }));

      // Group by section
      const sectionMap = new Map<string, any>();
      quotationItems.forEach((item: any) => {
        const sectionName = item.section_name || 'General Items';
        if (!sectionMap.has(sectionName)) {
          sectionMap.set(sectionName, {
            id: `section-${Date.now()}-${Math.random()}`,
            name: sectionName,
            items: [],
            labor_cost: item.section_labor_cost || 0,
            expanded: true
          });
        }
        sectionMap.get(sectionName)!.items.push(item);
      });

      const initialSections = Array.from(sectionMap.values());
      setSections(initialSections.length > 0 ? initialSections : []);
    }
  }, [quotation, open, currentCompany?.currency]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchProduct.toLowerCase())
  ) || [];

  const calculateLineTotal = (item: QuotationItem, quantity?: number, unitPrice?: number, taxPercentage?: number, taxInclusive?: boolean) => {
    const qty = quantity ?? item.quantity;
    const price = unitPrice ?? item.unit_price;
    const tax = taxPercentage ?? item.tax_percentage;

    const subtotal = qty * price;
    let taxAmount = 0;
    let lineTotal = 0;

    if (tax === 0) {
      lineTotal = subtotal;
      taxAmount = 0;
    } else {
      taxAmount = subtotal * (tax / 100);
      lineTotal = subtotal + taxAmount;
    }

    return { lineTotal, taxAmount };
  };

  const updateItemQuantity = (sectionId: string, itemId: string, quantity: number | '') => {
    const numQuantity = quantity === '' ? 0 : Number(quantity);
    if (numQuantity < 0) {
      removeItem(sectionId, itemId);
      return;
    }

    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.map(item => {
          if (item.id === itemId) {
            const { lineTotal, taxAmount } = calculateLineTotal(item, numQuantity);
            return { ...item, quantity, line_total: lineTotal, tax_amount: taxAmount };
          }
          return item;
        })
      };
    }));
  };

  const updateItemPrice = (sectionId: string, itemId: string, unitPrice: number | '') => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.map(item => {
          if (item.id === itemId) {
            const price = unitPrice === '' ? 0 : Number(unitPrice);
            const { lineTotal, taxAmount } = calculateLineTotal(item, undefined, price);
            return { ...item, unit_price: unitPrice, line_total: lineTotal, tax_amount: taxAmount };
          }
          return item;
        })
      };
    }));
  };

  const updateItemVAT = (sectionId: string, itemId: string, vatPercentage: number | '') => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.map(item => {
          if (item.id === itemId) {
            const vat = vatPercentage === '' ? 0 : Number(vatPercentage);
            const { lineTotal, taxAmount } = calculateLineTotal(item, undefined, undefined, vat);
            return { ...item, tax_percentage: vatPercentage, line_total: lineTotal, tax_amount: taxAmount };
          }
          return item;
        })
      };
    }));
  };

  const updateItemVATInclusive = (sectionId: string, itemId: string, vatInclusive: boolean) => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.map(item => {
          if (item.id === itemId) {
            let newVatPercentage = item.tax_percentage;
            if (vatInclusive && item.tax_percentage === 0) {
              newVatPercentage = defaultTaxRate;
            }
            if (!vatInclusive) {
              newVatPercentage = 0;
            }
            const { lineTotal, taxAmount } = calculateLineTotal(item, undefined, undefined, newVatPercentage);
            return { ...item, tax_inclusive: vatInclusive, tax_percentage: newVatPercentage, line_total: lineTotal, tax_amount: taxAmount };
          }
          return item;
        })
      };
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.filter(item => item.id !== itemId)
      };
    }).filter(s => s.items.length > 0)); // Remove empty sections
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, expanded: !s.expanded } : s
    ));
  };

  const updateSectionName = (sectionId: string, name: string) => {
    if (!name || name.trim() === '') return;
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, name } : s
    ));
  };

  const updateSectionLaborCost = (sectionId: string, laborCost: number | '') => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, labor_cost: laborCost } : s
    ));
  };

  const removeSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    const newSection: QuotationSection = {
      id: `section-${Date.now()}-${Math.random()}`,
      name: newSectionName.trim(),
      items: [],
      labor_cost: 0,
      expanded: true,
    };
    setSections([...sections, newSection]);
    setNewSectionName('');
  };

  const moveItemBetweenSections = (fromSectionId: string, toSectionId: string, itemId: string) => {
    if (fromSectionId === toSectionId) return;
    let movedItem: QuotationItem | null = null;
    const next = sections.map(sec => {
      if (sec.id === fromSectionId) {
        const remaining = sec.items.filter(it => {
          if (it.id === itemId) { movedItem = it; return false; }
          return true;
        });
        return { ...sec, items: remaining };
      }
      return sec;
    });
    if (movedItem) {
      setSections(next.map(sec => sec.id === toSectionId ? { ...sec, items: [...sec.items, { ...movedItem!, section_name: sec.name, section_labor_cost: toNumber(sec.labor_cost, 0) }] } : sec));
    } else {
      setSections(next);
    }
  };

  const handleRowDragStart = (sectionId: string, itemId: string, ev: React.DragEvent) => {
    ev.dataTransfer.setData('application/json', JSON.stringify({ sectionId, itemId }));
    ev.dataTransfer.effectAllowed = 'move';
  };

  const allowDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSection = (targetSectionId: string, ev: React.DragEvent) => {
    ev.preventDefault();
    try {
      const data = JSON.parse(ev.dataTransfer.getData('application/json'));
      if (data && data.sectionId && data.itemId) {
        moveItemBetweenSections(data.sectionId, targetSectionId, data.itemId);
      }
    } catch {}
  };

  const addItemToSection = (sectionId: string, product: any) => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;

      const existingItem = section.items.find(item => item.product_id === product.id);

      if (existingItem) {
        return {
          ...section,
          items: section.items.map(item =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + 1, line_total: item.quantity + 1 * item.unit_price }
              : item
          )
        };
      }

      const { lineTotal, taxAmount } = calculateLineTotal({
        quantity: 1,
        unit_price: product.selling_price,
        tax_percentage: 0,
        tax_inclusive: false
      } as any);

      const newItem: QuotationItem = {
        id: `temp-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        description: product.description || product.name,
        quantity: 1,
        unit_price: product.selling_price,
        tax_percentage: 0,
        tax_amount: 0,
        tax_inclusive: false,
        line_total: lineTotal,
        section_name: section.name,
        section_labor_cost: toNumber(section.labor_cost, 0),
        unit_of_measure: product.unit_of_measure || 'Each',
      };

      return {
        ...section,
        items: [...section.items, newItem]
      };
    }));

    setSearchProduct('');
  };

  const getCurrencyLocale = (curr: string) => {
    const mapping: { [key: string]: { locale: string; code: string } } = {
      KES: { locale: 'en-KE', code: 'KES' },
      USD: { locale: 'en-US', code: 'USD' },
      GBP: { locale: 'en-GB', code: 'GBP' }
    };
    return mapping[curr] || mapping.KES;
  };

  const formatCurrency = (amount: number) => {
    const currencyLocale = getCurrencyLocale(currency);
    return new Intl.NumberFormat(currencyLocale.locale, {
      style: 'currency',
      currency: currencyLocale.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const calculateSectionMaterialsTotal = (section: QuotationSection) => {
    return section.items.reduce((sum, item) => sum + item.line_total, 0);
  };

  const calculateSectionTotalWithLabor = (section: QuotationSection) => {
    return calculateSectionMaterialsTotal(section) + toNumber(section.labor_cost, 0);
  };

  const calculateGrandTotal = () => {
    return sections.reduce((sum, section) => sum + calculateSectionTotalWithLabor(section), 0);
  };

  const calculateTotalMaterials = () => {
    return sections.reduce((sum, section) => sum + calculateSectionMaterialsTotal(section), 0);
  };

  const calculateTotalLabor = () => {
    return sections.reduce((sum, section) => sum + toNumber(section.labor_cost, 0), 0);
  };

  const getTotalTax = () => {
    return sections.reduce((sum, section) => {
      const sectionTax = section.items.reduce((itemSum, item) => itemSum + item.tax_amount, 0);
      return sum + sectionTax;
    }, 0);
  };

  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    if (sections.length === 0 || sections.every(s => s.items.length === 0)) {
      toast.error('Please add at least one item to a section');
      return;
    }

    setIsSubmitting(true);
    try {
      const totalMaterials = calculateTotalMaterials();
      const totalLabor = calculateTotalLabor();
      const totalTax = getTotalTax();
      const grandTotal = calculateGrandTotal();

      const updatedQuotation: any = {
        customer_id: selectedCustomerId,
        quotation_date: quotationDate,
        valid_until: validUntil || null,
        currency,
        notes,
        terms_and_conditions: termsAndConditions,
        subtotal: totalMaterials,
        tax_amount: totalTax,
        total_amount: grandTotal,
        display_as_percentage: quotation.display_as_percentage ?? false
      };

      const { data: updatedData, error: updateError } = await supabase
        .from('quotations')
        .update(updatedQuotation)
        .eq('id', quotation.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', quotation.id);

      if (deleteError) throw deleteError;

      // Insert new items with section information
      const itemsToInsert = sections.flatMap((section, sectionIndex) =>
        section.items.map((item, itemIndex) => ({
          quotation_id: quotation.id,
          product_id: item.product_id || null,
          description: item.description || '',
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
          tax_percentage: item.tax_percentage || 0,
          tax_amount: item.tax_amount || 0,
          tax_inclusive: item.tax_inclusive || false,
          line_total: item.line_total || 0,
          section_name: section.name,
          section_labor_cost: toNumber(section.labor_cost, 0),
          sort_order: sectionIndex * 100 + itemIndex,
          unit_of_measure: item.unit_of_measure || 'Each'
        }))
      );

      let { error: insertError } = await supabase
        .from('quotation_items')
        .insert(itemsToInsert);

      // Fallback for DBs that don't accept section fields
      if (insertError && (insertError.code === 'PGRST204' || String(insertError.message || '').toLowerCase().includes('section'))) {
        const minimalItems = itemsToInsert.map(({ section_name, section_labor_cost, ...rest }) => rest);
        const retry = await supabase
          .from('quotation_items')
          .insert(minimalItems);
        insertError = retry.error as any;
      }

      if (insertError) throw insertError;

      toast.success(`Quotation ${quotation.quotation_number} updated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating quotation:', error);

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
        } else {
          errorMessage = JSON.stringify(error);
        }
      }

      toast.error(`Failed to update quotation: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Edit Quotation {quotation?.quotation_number}</span>
          </DialogTitle>
          <DialogDescription>
            Update quotation details with sections, items, and labor costs
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quotation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCustomers ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading customers...</div>
                      ) : (
                        customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.customer_code})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quotation_date">Quotation Date *</Label>
                    <Input
                      id="quotation_date"
                      type="date"
                      value={quotationDate}
                      onChange={(e) => setQuotationDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valid_until">Valid Until</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
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
                        <span>Fetching exchange rate...</span>
                      ) : (
                        <span>
                          1 {currency} = {exchangeRate.toFixed(4)} {currentCompany?.currency || 'KES'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes for this quotation..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Terms and Conditions</Label>
                  <Textarea
                    id="terms"
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search products by name or code..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {searchProduct && (
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      {loadingProducts ? (
                        <div className="p-4 text-center text-muted-foreground">Loading products...</div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">No products found</div>
                      ) : (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-muted-foreground">{product.product_code}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{formatCurrency(product.selling_price)}</div>
                              </div>
                            </div>
                            {sections.length > 0 && (
                              <div className="mt-2 flex gap-2 flex-wrap">
                                {sections.map(section => (
                                  <Button
                                    key={section.id}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addItemToSection(section.id, product)}
                                    className="text-xs"
                                  >
                                    Add to {section.name}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quotation Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Section name (e.g., Roofing)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSection()}
              />
              <Button onClick={addSection} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" /> Add Section
              </Button>
            </div>

            {sections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sections in this quotation. Create one to start adding items.
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section, sectionIndex) => {
                  const sectionMaterialsTotal = calculateSectionMaterialsTotal(section);
                  const sectionTotal = calculateSectionTotalWithLabor(section);

                  return (
                    <Card key={section.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleSectionExpanded(section.id)}
                              className="h-6 w-6"
                            >
                              {section.expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Input
                              value={section.name}
                              onChange={(e) => updateSectionName(section.id, e.target.value)}
                              className="text-base font-semibold"
                              placeholder="Section name"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSection(section.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>

                      {section.expanded && (
                        <CardContent className="space-y-4">
                          {section.items.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              No items in this section. Search and add products above.
                            </div>
                          ) : (
                            <Table className="text-sm"
                                   onDragOver={allowDrop}
                                   onDrop={(e) => handleDropOnSection(section.id, e)}>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead className="w-32">Qty</TableHead>
                                  <TableHead className="w-40">Unit Price</TableHead>
                                  <TableHead className="w-32">VAT %</TableHead>
                                  <TableHead className="w-24">VAT Incl.</TableHead>
                                  <TableHead className="w-40">Line Total</TableHead>
                                  <TableHead className="w-12"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {section.items.map((item) => (
                                  <TableRow key={item.id}
                                            className="text-xs cursor-move"
                                            draggable
                                            onDragStart={(e) => handleRowDragStart(section.id, item.id, e)}>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium">{item.product_name}</div>
                                        <div className="text-xs text-muted-foreground">{item.description}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="relative">
                                        <Input
                                          type="number"
                                          value={item.quantity ?? ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            updateItemQuantity(section.id, item.id, value === '' ? '' : parseInt(value) || 0);
                                          }}
                                          onFocus={() => setPreviewItem({ sectionId: section.id, itemId: item.id })}
                                          onBlur={() => setPreviewItem(null)}
                                          className="w-40 h-10 text-sm px-2"
                                          min="1"
                                          placeholder="1"
                                        />
                                        {previewItem?.itemId === item.id && (
                                          <FloatingItemPreview quantity={item.quantity} rate={item.unit_price} formatCurrency={formatCurrency} showTax={true} taxPercentage={item.tax_percentage} description={item.product_name} />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="relative">
                                        <Input
                                          type="number"
                                          value={item.unit_price ?? ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            updateItemPrice(section.id, item.id, value === '' ? '' : parseFloat(value) || 0);
                                          }}
                                          onFocus={() => setPreviewItem({ sectionId: section.id, itemId: item.id })}
                                          onBlur={() => setPreviewItem(null)}
                                          className="w-48 h-10 text-sm px-2"
                                          step="0.01"
                                          placeholder="0.00"
                                        />
                                        {previewItem?.itemId === item.id && (
                                          <FloatingItemPreview quantity={item.quantity} rate={item.unit_price} formatCurrency={formatCurrency} showTax={true} taxPercentage={item.tax_percentage} description={item.product_name} />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={item.tax_percentage ?? ''}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          updateItemVAT(section.id, item.id, value === '' ? '' : parseFloat(value) || 0);
                                        }}
                                        className="w-28 h-10 text-sm px-2"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        disabled={item.tax_inclusive}
                                        placeholder="0"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Checkbox
                                        checked={item.tax_inclusive}
                                        onCheckedChange={(checked) => updateItemVATInclusive(section.id, item.id, !!checked)}
                                      />
                                    </TableCell>
                                    <TableCell className="font-semibold text-right text-sm">
                                      {formatCurrency(item.line_total)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeItem(section.id, item.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}

                          <div className="space-y-2 border-t pt-4">
                            <div className="flex justify-between">
                              <span>Materials Subtotal:</span>
                              <span className="font-semibold">{formatCurrency(sectionMaterialsTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <Label htmlFor={`labor-${section.id}`} className="font-medium">Labor Cost:</Label>
                              <Input
                                id={`labor-${section.id}`}
                                type="number"
                                value={section.labor_cost ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  updateSectionLaborCost(section.id, value === '' ? '' : parseFloat(value) || 0);
                                }}
                                className="w-32 h-8"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="font-bold">Section Total:</span>
                              <span className="font-bold text-primary">{formatCurrency(sectionTotal)}</span>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {sections.length > 0 && sections.some(s => s.items.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Quotation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between">
                    <span>Total Materials:</span>
                    <span className="font-semibold">{formatCurrency(calculateTotalMaterials())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Labor:</span>
                    <span className="font-semibold">{formatCurrency(calculateTotalLabor())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span className="font-semibold">{formatCurrency(getTotalTax())}</span>
                  </div>
                  <div className="flex justify-between text-lg border-t pt-2">
                    <span className="font-bold">Grand Total:</span>
                    <span className="font-bold text-primary">{formatCurrency(calculateGrandTotal())}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedCustomerId || sections.length === 0 || sections.every(s => s.items.length === 0)}>
            <Calculator className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Updating...' : 'Update Quotation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
