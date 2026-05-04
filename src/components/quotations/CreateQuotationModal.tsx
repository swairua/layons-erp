import { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useCustomers, useProducts, useGenerateDocumentNumber, useTaxSettings, useCompanies } from '@/hooks/useDatabase';
import { useCreateQuotationWithItems } from '@/hooks/useQuotationItems';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { toNumber, toInteger } from '@/utils/numericFormHelpers';
import { supabase } from '@/integrations/supabase/client';

interface QuotationItem {
  id: string;
  product_id: string;
  product_name: string;
  description: string;
  quantity: number | '';
  unit_price: number | '';
  vat_percentage: number | '';
  vat_inclusive: boolean;
  line_total: number;
  unit_of_measure?: string;
}

interface QuotationSection {
  id: string;
  name: string;
  items: QuotationItem[];
  labor_cost: number | '';
  expanded: boolean;
}

interface CreateQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateQuotationModal({ open, onOpenChange, onSuccess }: CreateQuotationModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState('KES');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('Payment due within 30 days of invoice date.');
  const [previousTermsLoaded, setPreviousTermsLoaded] = useState(false);
  const [displayAsPercentage, setDisplayAsPercentage] = useState(false);

  const [sections, setSections] = useState<QuotationSection[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [previewItem, setPreviewItem] = useState<{ sectionId: string; itemId: string } | null>(null);

  // Get current user and company from context
  const { profile, loading: authLoading } = useAuth();
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { data: customers, isLoading: loadingCustomers } = useCustomers(currentCompany?.id);
  const { data: products, isLoading: loadingProducts } = useProducts(currentCompany?.id);
  const { data: taxSettings } = useTaxSettings(currentCompany?.id);

  // Initialize with a default section when modal opens
  useEffect(() => {
    if (open && sections.length === 0) {
      const defaultSection: QuotationSection = {
        id: `section-${Date.now()}`,
        name: 'Materials',
        items: [],
        labor_cost: 0,
        expanded: true
      };
      setSections([defaultSection]);
    }
  }, [open]);

  // Load previous quotation's terms and conditions when modal opens
  useEffect(() => {
    if (open && currentCompany?.id && !previousTermsLoaded) {
      const fetchPreviousTerms = async () => {
        try {
          const { data, error } = await supabase
            .from('quotations')
            .select('terms_and_conditions')
            .eq('company_id', currentCompany.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!error && data?.terms_and_conditions) {
            setTermsAndConditions(data.terms_and_conditions);
          }
          setPreviousTermsLoaded(true);
        } catch (err) {
          console.log('No previous quotation found or error fetching terms:', err);
          setPreviousTermsLoaded(true);
        }
      };

      fetchPreviousTerms();
    }
  }, [open, currentCompany?.id, previousTermsLoaded]);

  // Log for debugging if needed
  if (process.env.NODE_ENV === 'development') {
    console.log('Company:', currentCompany?.name, 'Customers:', customers?.length || 0);
  }
  const createQuotationWithItems = useCreateQuotationWithItems();
  const generateDocNumber = useGenerateDocumentNumber();

  // Get default tax rate
  const defaultTax = taxSettings?.find(tax => tax.is_default && tax.is_active);
  const defaultTaxRate = defaultTax?.rate || 16;

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchProduct.toLowerCase())
  ) || [];

  const calculateItemTotal = (quantity: number, unitPrice: number, taxPercentage: number, taxInclusive: boolean) => {
    const baseAmount = quantity * unitPrice;

    if (taxPercentage === 0 || !taxInclusive) {
      return baseAmount;
    }

    const taxAmount = baseAmount * (taxPercentage / 100);
    return baseAmount + taxAmount;
  };

  const calculateTaxAmount = (item: QuotationItem) => {
    const baseAmount = item.quantity * item.unit_price;

    if (item.vat_percentage === 0 || !item.vat_inclusive) {
      return 0;
    }

    return baseAmount * (item.vat_percentage / 100);
  };

  const addSection = () => {
    if (!newSectionName.trim()) {
      toast.error('Please enter a section name');
      return;
    }

    const newSection: QuotationSection = {
      id: `section-${Date.now()}`,
      name: newSectionName,
      items: [],
      labor_cost: 0,
      expanded: true
    };

    setSections([...sections, newSection]);
    setNewSectionName('');
  };

  const removeSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const updateSectionName = (sectionId: string, name: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, name } : s
    ));
  };

  const updateSectionLaborCost = (sectionId: string, laborCost: number | '') => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, labor_cost: laborCost } : s
    ));
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, expanded: !s.expanded } : s
    ));
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
              ? { ...item, quantity: item.quantity + 1, line_total: calculateItemTotal(item.quantity + 1, item.unit_price, item.vat_percentage, item.vat_inclusive) }
              : item
          )
        };
      }

      const newItem: QuotationItem = {
        id: `temp-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        description: product.description || product.name,
        quantity: 1,
        unit_price: product.selling_price,
        vat_percentage: 0,
        vat_inclusive: false,
        line_total: calculateItemTotal(1, product.selling_price, 0, false),
        unit_of_measure: product.unit_of_measure || 'Each'
      };

      return {
        ...section,
        items: [...section.items, newItem]
      };
    }));

    setSearchProduct('');
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
            const price = item.unit_price === '' ? 0 : Number(item.unit_price);
            const vat = item.vat_percentage === '' ? 0 : Number(item.vat_percentage);
            const lineTotal = calculateItemTotal(numQuantity, price, vat, item.vat_inclusive);
            return { ...item, quantity, line_total: lineTotal };
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
            const qty = item.quantity === '' ? 0 : Number(item.quantity);
            const price = unitPrice === '' ? 0 : Number(unitPrice);
            const vat = item.vat_percentage === '' ? 0 : Number(item.vat_percentage);
            const lineTotal = calculateItemTotal(qty, price, vat, item.vat_inclusive);
            return { ...item, unit_price: unitPrice, line_total: lineTotal };
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
            const qty = item.quantity === '' ? 0 : Number(item.quantity);
            const price = item.unit_price === '' ? 0 : Number(item.unit_price);
            const vat = vatPercentage === '' ? 0 : Number(vatPercentage);
            const lineTotal = calculateItemTotal(qty, price, vat, item.vat_inclusive);
            return { ...item, vat_percentage: vatPercentage, line_total: lineTotal };
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
            let newVatPercentage = item.vat_percentage;
            if (vatInclusive && item.vat_percentage === 0) {
              newVatPercentage = defaultTaxRate;
            }
            if (!vatInclusive) {
              newVatPercentage = 0;
            }

            const lineTotal = calculateItemTotal(item.quantity, item.unit_price, newVatPercentage, vatInclusive);
            return { ...item, vat_inclusive: vatInclusive, vat_percentage: newVatPercentage, line_total: lineTotal };
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
    }));
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
      const sectionTax = section.items.reduce((itemSum, item) => itemSum + calculateTaxAmount(item), 0);
      return sum + sectionTax;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    if (sections.length === 0 || sections.every(s => s.items.length === 0)) {
      toast.error('Please add at least one item to a section');
      return;
    }

    if (!quotationDate) {
      toast.error('Please select a quotation date');
      return;
    }

    if (!validUntil) {
      toast.error('Please select a valid until date');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Starting quotation creation process...');
      console.log('Selected customer:', selectedCustomerId);
      console.log('Sections count:', sections.length);

      const quotationNumber = await generateDocNumber.mutateAsync({
        companyId: currentCompany?.id || 'default-company-id',
        type: 'quotation'
      });
      console.log('Generated quotation number:', quotationNumber);

      if (!currentCompany?.id) {
        toast.error('No company selected. Please ensure you are associated with a company.');
        return;
      }

      if (authLoading) {
        toast.info('Please wait, authenticating user...');
        return;
      }

      if (!profile?.id) {
        toast.error('User not authenticated. Please sign in and try again.');
        return;
      }

      const totalMaterials = calculateTotalMaterials();
      const totalLabor = calculateTotalLabor();
      const totalTax = getTotalTax();
      const grandTotal = calculateGrandTotal();

      const quotationData = {
        company_id: currentCompany.id,
        customer_id: selectedCustomerId,
        quotation_number: quotationNumber,
        quotation_date: quotationDate,
        valid_until: validUntil,
        status: 'draft',
        subtotal: totalMaterials,
        tax_amount: totalTax,
        total_amount: grandTotal,
        currency: currency,
        terms_and_conditions: termsAndConditions,
        notes: notes,
        display_as_percentage: displayAsPercentage,
        created_by: profile.id
      };
      console.log('Quotation data prepared:', quotationData);

      console.log('Preparing quotation items...');
      const quotationItems = sections.flatMap((section, sectionIndex) =>
        section.items.map(item => {
          if (!item.description || item.description.trim() === '') {
            throw new Error(`Item "${item.product_name}" is missing a description`);
          }
          if (item.quantity <= 0) {
            throw new Error(`Item "${item.product_name}" must have a quantity greater than 0`);
          }
          if (item.unit_price < 0) {
            throw new Error(`Item "${item.product_name}" cannot have a negative unit price`);
          }

          return {
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_percentage: item.vat_percentage || 0,
            tax_amount: calculateTaxAmount(item),
            tax_inclusive: item.vat_inclusive || false,
            line_total: item.line_total,
            section_name: section.name,
            section_labor_cost: toNumber(section.labor_cost, 0),
            sort_order: sectionIndex,
            unit_of_measure: item.unit_of_measure || 'Each'
          };
        })
      );
      console.log('Quotation items prepared:', quotationItems);

      if (!quotationData.customer_id) {
        throw new Error('Customer is required');
      }
      if (!quotationData.quotation_date) {
        throw new Error('Quotation date is required');
      }
      if (!quotationData.quotation_number) {
        throw new Error('Failed to generate quotation number');
      }

      console.log('Submitting quotation to database...');
      await createQuotationWithItems.mutateAsync({
        quotation: quotationData,
        items: quotationItems
      });
      console.log('Quotation created successfully!');

      toast.success(`Quotation ${quotationNumber} created successfully!`);
      onSuccess();
      handleOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating quotation:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      let errorMessage = 'Unknown error occurred';
      let fullErrorDetail = '';

      if (error instanceof Error) {
        errorMessage = error.message;
        fullErrorDetail = error.message;
      } else if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
          fullErrorDetail = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
          fullErrorDetail = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
          fullErrorDetail = `${supabaseError.message || ''} - ${supabaseError.hint}`;
        } else if (supabaseError.error?.message) {
          errorMessage = supabaseError.error.message;
          fullErrorDetail = supabaseError.error.message;
        } else if (supabaseError.statusText) {
          errorMessage = supabaseError.statusText;
          fullErrorDetail = supabaseError.statusText;
        } else if (supabaseError.data?.message) {
          errorMessage = supabaseError.data.message;
          fullErrorDetail = supabaseError.data.message;
        } else {
          const errorStr = JSON.stringify(error);
          if (errorStr.length > 200) {
            errorMessage = 'Database operation failed. See console for details.';
            fullErrorDetail = errorStr.substring(0, 500);
          } else {
            errorMessage = errorStr;
            fullErrorDetail = errorStr;
          }
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
        fullErrorDetail = error;
      }

      // Show detailed error message
      const detailedMessage = fullErrorDetail ? `Failed to create quotation:\n\n${fullErrorDetail}` : `Failed to create quotation: ${errorMessage}`;
      toast.error(detailedMessage, { duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setQuotationDate(new Date().toISOString().split('T')[0]);
    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setCurrency('KES');
    setNotes('');
    setTermsAndConditions('Payment due within 30 days of invoice date.');
    setDisplayAsPercentage(false);
    setSections([]);
    setSearchProduct('');
    setNewSectionName('');
    setPreviousTermsLoaded(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPreviousTermsLoaded(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-primary" />
            <span>Create New Quotation with Sections</span>
          </DialogTitle>
          <DialogDescription>
            Create a detailed quotation with multiple sections, items, and labor costs
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
                        <SelectItem value="loading" disabled>Loading customers...</SelectItem>
                      ) : !currentCompany ? (
                        <SelectItem value="no-company" disabled>No company found - please refresh</SelectItem>
                      ) : !customers || customers.length === 0 ? (
                        <SelectItem value="no-customers" disabled>No customers found - create customers first</SelectItem>
                      ) : (
                        customers.map((customer) => (
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

                <div className="flex items-center space-x-2 pt-4 border-t">
                  <Checkbox
                    id="display-as-percentage"
                    checked={displayAsPercentage}
                    onCheckedChange={(checked) => setDisplayAsPercentage(!!checked)}
                  />
                  <Label htmlFor="display-as-percentage" className="font-medium cursor-pointer">
                    Display as progressive percentages
                  </Label>
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
                            className="p-3 hover:bg-muted/50 border-b last:border-b-0 transition-smooth"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-muted-foreground">{product.product_code}</div>
                                {product.description && (
                                  <div className="text-xs text-muted-foreground mt-1">{product.description}</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{formatCurrency(product.selling_price)}</div>
                                <div className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</div>
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
                placeholder="Section name (e.g., Ground Floor Walling)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSection()}
              />
              <Button onClick={addSection} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>

            {sections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sections added yet. Create a section to start adding items.
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
                            <Table className="text-sm">
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
                                  <TableRow key={item.id} className="text-xs">
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
                                          <FloatingItemPreview quantity={item.quantity} rate={item.unit_price} formatCurrency={formatCurrency} showTax={true} taxPercentage={item.vat_percentage} description={item.product_name} />
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
                                          <FloatingItemPreview quantity={item.quantity} rate={item.unit_price} formatCurrency={formatCurrency} showTax={true} taxPercentage={item.vat_percentage} description={item.product_name} />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={item.vat_percentage ?? ''}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          updateItemVAT(section.id, item.id, value === '' ? '' : parseFloat(value) || 0);
                                        }}
                                        className="w-28 h-10 text-sm px-2"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        disabled={item.vat_inclusive}
                                        placeholder="0"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Checkbox
                                        checked={item.vat_inclusive}
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
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedCustomerId || sections.length === 0 || sections.every(s => s.items.length === 0)}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating...' : 'Create Quotation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
