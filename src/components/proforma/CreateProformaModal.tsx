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
  Receipt
} from 'lucide-react';
import { useCustomers, useProducts, useGenerateDocumentNumber, useTaxSettings } from '@/hooks/useDatabase';
import { useCreateProformaWithItems } from '@/hooks/useQuotationItems';
import { toast } from 'sonner';

interface ProformaItem {
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
}

interface CreateProformaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  companyId?: string;
}

export const CreateProformaModal = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  companyId = '550e8400-e29b-41d4-a716-446655440000' 
}: CreateProformaModalProps) => {
  const [formData, setFormData] = useState({
    customer_id: '',
    proforma_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: '',
    terms_and_conditions: '',
    display_as_percentage: false,
  });

  const [items, setItems] = useState<ProformaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [proformaNumber, setProformaNumber] = useState('');
  const [previewItem, setPreviewItem] = useState<string | null>(null);

  const { data: customers } = useCustomers(companyId);
  const { data: products } = useProducts(companyId);
  const { data: taxSettings } = useTaxSettings(companyId);
  const generateDocumentNumber = useGenerateDocumentNumber();
  const createProformaWithItems = useCreateProformaWithItems();

  const defaultTaxRate = taxSettings?.find(t => t.is_default)?.rate || 0;

  useEffect(() => {
    if (open) {
      // Generate proforma number
      generateDocumentNumber.mutate(
        { companyId, type: 'proforma' },
        {
          onSuccess: (number) => {
            setProformaNumber(number);
          },
          onError: (error) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn('Proforma number generation failed, using fallback:', errorMessage);

            // Generate a fallback number using new format: {4_digit_seq}{MM}{YYYY}
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const timestamp = Date.now();
            const seq = String(timestamp % 10000).padStart(4, '0');
            const fallbackNumber = `${seq}${month}${year}`;
            setProformaNumber(fallbackNumber);

            console.info('Using fallback proforma number:', fallbackNumber);
          }
        }
      );

      // Set default valid until date (30 days from today)
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      setFormData(prev => ({
        ...prev,
        valid_until: validUntil.toISOString().split('T')[0]
      }));
    }
  }, [open, generateDocumentNumber, companyId]);

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (product: any) => {
    const newItem: ProformaItem = {
      id: `item-${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      description: product.description || '',
      quantity: 1,
      unit_price: product.selling_price,
      tax_percentage: defaultTaxRate,
      tax_amount: 0,
      tax_inclusive: false,
      line_total: 0,
    };

    // Calculate tax and totals
    const updatedItem = calculateItemTotals(newItem);
    setItems(prev => [...prev, updatedItem]);
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const updateItem = (id: string, field: keyof ProformaItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        let updatedItem = { ...item, [field]: value };

        // Special handling for tax_inclusive checkbox
        if (field === 'tax_inclusive') {
          // When checking VAT Inclusive, auto-apply default tax rate if no VAT is set
          if (value && item.tax_percentage === 0) {
            updatedItem.tax_percentage = defaultTaxRate;
          }
          // When unchecking VAT Inclusive, reset VAT to 0
          if (!value) {
            updatedItem.tax_percentage = 0;
          }
        }

        return calculateItemTotals(updatedItem);
      }
      return item;
    }));
  };

  const calculateItemTotals = (item: ProformaItem): ProformaItem => {
    const qty = item.quantity === '' ? 0 : Number(item.quantity);
    const price = item.unit_price === '' ? 0 : Number(item.unit_price);
    const tax = item.tax_percentage === '' ? 0 : Number(item.tax_percentage);

    const baseAmount = qty * price;

    if (tax === 0 || !item.tax_inclusive) {
      // No tax or tax checkbox unchecked
      return {
        ...item,
        tax_amount: 0,
        line_total: parseFloat(baseAmount.toFixed(2))
      };
    }

    // Tax checkbox checked: add tax to the base amount
    const taxAmount = baseAmount * (tax / 100);
    const lineTotal = baseAmount + taxAmount;

    return {
      ...item,
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      line_total: parseFloat(lineTotal.toFixed(2))
    };
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    // Unit prices are always tax-exclusive, so subtotal is always the base amount
    const subtotal = items.reduce((sum, item) => {
      const qty = item.quantity === '' ? 0 : Number(item.quantity);
      const price = item.unit_price === '' ? 0 : Number(item.unit_price);
      return sum + (qty * price);
    }, 0);

    const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      const totals = calculateTotals();

      // Create proforma invoice using the correct table
      const proformaData = {
        company_id: companyId,
        customer_id: formData.customer_id,
        proforma_number: proformaNumber,
        proforma_date: formData.proforma_date,
        valid_until: formData.valid_until,
        status: 'draft',
        subtotal: totals.subtotal,
        tax_amount: totals.totalTax,
        total_amount: totals.total,
        notes: formData.notes,
        terms_and_conditions: formData.terms_and_conditions,
        display_as_percentage: formData.display_as_percentage,
      };

      // Convert items to proforma items format (simplified for current schema)
      const proformaItems = items.map(item => ({
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percentage: 0,
        discount_amount: 0,
        tax_percentage: item.tax_percentage,
        tax_amount: item.tax_amount,
        tax_inclusive: item.tax_inclusive,
        line_total: item.line_total,
      }));

      // Create proforma in database
      await createProformaWithItems.mutateAsync({
        proforma: proformaData,
        items: proformaItems
      });

      toast.success('Proforma invoice created successfully!');
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Error creating proforma:', error);

      let errorMessage = 'Failed to create proforma invoice';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Handle Supabase error objects
        const supabaseError = error as any;

        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
        } else if (supabaseError.error?.message) {
          errorMessage = supabaseError.error.message;
        } else if (supabaseError.statusText) {
          errorMessage = supabaseError.statusText;
        } else {
          // Check for common database errors
          const errorStr = JSON.stringify(error);
          if (errorStr.includes('column') && errorStr.includes('does not exist')) {
            errorMessage = 'Database schema issue: Missing required fields. Please contact support.';
          } else if (errorStr.includes('violates')) {
            errorMessage = 'Data validation error. Please check your input values.';
          } else {
            errorMessage = 'Database operation failed. Please try again.';
          }
        }
      }

      toast.error(`Error creating proforma: ${errorMessage}`);
    }
  };

  const handleClose = () => {
    setFormData({
      customer_id: '',
      proforma_date: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: '',
      terms_and_conditions: '',
    });
    setItems([]);
    setSearchTerm('');
    setShowProductSearch(false);
    onOpenChange(false);
  };

  const { subtotal, totalTax, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Proforma Invoice
          </DialogTitle>
          <DialogDescription>
            Create a new proforma invoice for advance payment scenarios
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Notification */}
          {createError && (
            <ProformaErrorSolution
              error={createError}
              onResolved={() => setCreateError('')}
              compact={true}
            />
          )}

          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proforma_number">Proforma Number</Label>
              <Input
                id="proforma_number"
                value={proformaNumber}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select value={formData.customer_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, customer_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
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
            <div className="space-y-2">
              <Label htmlFor="proforma_date">Proforma Date</Label>
              <Input
                id="proforma_date"
                type="date"
                value={formData.proforma_date}
                onChange={(e) => setFormData(prev => ({ ...prev, proforma_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>
          </div>

          {/* Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Items
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProductSearch(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showProductSearch && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Add Product</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search products..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {filteredProducts?.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted/50"
                            onClick={() => addItem(product)}
                          >
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {product.product_code} • ${product.selling_price}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowProductSearch(false)}
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click "Add Item" to start.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Tax %</TableHead>
                      <TableHead>Tax Incl.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Description"
                            className="min-w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              type="number"
                              value={item.quantity ?? ''}
                              onChange={(e) => updateItem(item.id, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              onFocus={() => setPreviewItem(item.id)}
                              onBlur={() => setPreviewItem(null)}
                              min="0"
                              step="0.01"
                              className="w-32 h-10 text-sm px-2"
                              placeholder="1"
                            />
                            {previewItem === item.id && (
                              <FloatingItemPreview quantity={item.quantity} rate={item.unit_price} formatCurrency={formatCurrency} showTax={true} taxPercentage={item.tax_percentage} description={item.product_name} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              type="number"
                              value={item.unit_price ?? ''}
                              onChange={(e) => updateItem(item.id, 'unit_price', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              onFocus={() => setPreviewItem(item.id)}
                              onBlur={() => setPreviewItem(null)}
                              min="0"
                              step="0.01"
                              className="w-48 h-10 text-sm px-2"
                              placeholder="0.00"
                            />
                            {previewItem === item.id && (
                              <FloatingItemPreview quantity={item.quantity} rate={item.unit_price} formatCurrency={formatCurrency} showTax={true} taxPercentage={item.tax_percentage} description={item.product_name} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.tax_percentage ?? ''}
                            onChange={(e) => updateItem(item.id, 'tax_percentage', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-28 h-10 text-sm px-2"
                            disabled={item.tax_inclusive}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={item.tax_inclusive}
                            onCheckedChange={(checked) => updateItem(item.id, 'tax_inclusive', checked)}
                          />
                        </TableCell>
                        <TableCell>${item.line_total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="mt-6 space-y-2 max-w-sm ml-auto">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal notes..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
              <Textarea
                id="terms_and_conditions"
                value={formData.terms_and_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                placeholder="Terms and conditions..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox
                id="display-as-percentage"
                checked={formData.display_as_percentage}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, display_as_percentage: !!checked }))}
              />
              <Label htmlFor="display-as-percentage" className="font-medium cursor-pointer">
                Display as progressive percentages
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.customer_id || items.length === 0 || createProformaWithItems.isPending}
            >
              {createProformaWithItems.isPending ? 'Creating...' : 'Create Proforma'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
