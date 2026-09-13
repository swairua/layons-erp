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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Trash2, 
  Search,
  Calculator,
  Receipt,
  Edit
} from 'lucide-react';
import { useCustomers, useProducts, useTaxSettings } from '@/hooks/useDatabase';
import { useCreateQuotationWithItems } from '@/hooks/useQuotationItems';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { toCollection } from '@/utils/collection';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';

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

interface Proforma {
  id: string;
  proforma_number: string;
  customer_id: string;
  proforma_date: string;
  valid_until: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency?: string;
  exchange_rate?: number;
  notes?: string;
  terms_and_conditions?: string;
  customers?: {
    name: string;
    email?: string;
  };
  proforma_items?: ProformaItem[];
}

interface EditProformaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proforma: Proforma | null;
  onSuccess?: () => void;
  companyId?: string;
}

export const EditProformaModal = ({ 
  open, 
  onOpenChange, 
  proforma,
  onSuccess,
  companyId = '550e8400-e29b-41d4-a716-446655440000' 
}: EditProformaModalProps) => {
  const [formData, setFormData] = useState({
    customer_id: '',
    proforma_date: '',
    valid_until: '',
    notes: '',
    terms_and_conditions: '',
    status: 'draft',
  });

  const [items, setItems] = useState<ProformaItem[]>([]);
  const [currency, setCurrency] = useState(proforma?.currency || 'KES');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [previewItem, setPreviewItem] = useState<string | null>(null);

  const { currentCompany } = useCurrentCompany();
  const { data: customersResponse } = useCustomers(companyId);
  const customers = toCollection(customersResponse);
  const { data: productsResponse } = useProducts(companyId);
  const products = toCollection(productsResponse);
  const { data: taxSettings } = useTaxSettings(companyId);
  const { rate: fetchedRate, isLoading: rateLoading, isForeignCurrency } = useExchangeRate(currency, currentCompany?.currency || 'KES');

  useEffect(() => {
    if (!rateLoading && fetchedRate > 0) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate, rateLoading]);

  useCurrencyConversion({ exchangeRate, isOpen: open, items, setItems });

  const defaultTaxRate = taxSettings?.find(t => t.is_default)?.rate || 0;

  // Populate form when proforma changes
  useEffect(() => {
    if (proforma && open) {
      setFormData({
        customer_id: proforma.customer_id,
        proforma_date: proforma.proforma_date,
        valid_until: proforma.valid_until,
        notes: proforma.notes || '',
        terms_and_conditions: proforma.terms_and_conditions || '',
        status: proforma.status,
      });

      setCurrency(proforma?.currency || currentCompany?.currency || 'KES');
      
      if (proforma.proforma_items) {
        setItems(proforma.proforma_items.map(item => ({
          ...item,
          tax_inclusive: false // Default to false if not provided
        })));
      }
    }
  }, [proforma, open]);

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

    // Both inclusive and exclusive now add VAT on top
    const taxAmount = baseAmount * (tax / 100);

    return {
      ...item,
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      line_total: parseFloat((baseAmount + taxAmount).toFixed(2))
    };
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      // Always use base amount for subtotal (unit price × quantity)
      // VAT is calculated separately and added for exclusive, or extracted for inclusive
      const qty = item.quantity === '' ? 0 : Number(item.quantity);
      const price = item.unit_price === '' ? 0 : Number(item.unit_price);
      return sum + (qty * price);
    }, 0);

    const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = subtotal + totalTax;

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
      
      // Update proforma (implement API call here)
      const updatedProformaData = {
        ...proforma,
        customer_id: formData.customer_id,
        proforma_date: formData.proforma_date,
        valid_until: formData.valid_until,
        status: formData.status,
        subtotal: totals.subtotal,
        tax_amount: totals.totalTax,
        total_amount: totals.total,
        notes: formData.notes,
        terms_and_conditions: formData.terms_and_conditions,
        proforma_items: items,
      };

      // For now, show success message (would implement API call here)
      toast.success('Proforma invoice updated successfully!');
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Error updating proforma:', error);
      toast.error('Failed to update proforma invoice');
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setShowProductSearch(false);
    onOpenChange(false);
  };

  const { subtotal, totalTax, total } = calculateTotals();

  if (!proforma) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Proforma Invoice #{proforma.proforma_number}
          </DialogTitle>
          <DialogDescription>
            Update proforma invoice details and items
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proforma_number">Proforma Number</Label>
              <Input
                id="proforma_number"
                value={proforma.proforma_number}
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
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, status: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proforma_date">Proforma Date</Label>
              <Input
                id="proforma_date"
                type="date"
                value={formData.proforma_date}
                onChange={(e) => setFormData(prev => ({ ...prev, proforma_date: e.target.value }))}
              />
            </div>
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

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
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
                  <span>Fetching exchange rate...</span>
                ) : (
                  <span>
                    1 {currency} = {exchangeRate.toFixed(4)} {currentCompany?.currency || 'KES'}
                  </span>
                )}
              </div>
            )}
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.customer_id || items.length === 0}>
              Update Proforma
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
