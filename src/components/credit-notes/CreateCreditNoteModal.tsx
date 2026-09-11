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
  FileText,
  AlertCircle
} from 'lucide-react';
import { useCustomers, useProducts, useTaxSettings, useCompanies } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useGenerateCreditNoteNumber } from '@/hooks/useCreditNotes';
import { useCreateCreditNoteWithItems } from '@/hooks/useCreditNoteItems';
import { toast } from 'sonner';

interface CreditNoteItem {
  id: string;
  product_id?: string; // Optional to allow custom items
  product_name: string;
  description: string;
  quantity: number | '';
  unit_price: number | '';
  tax_percentage: number | '';
  tax_amount: number;
  tax_inclusive: boolean;
  line_total: number;
}

interface CreateCreditNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedCustomer?: any;
  preSelectedInvoice?: any;
}

export function CreateCreditNoteModal({ 
  open, 
  onOpenChange, 
  onSuccess, 
  preSelectedCustomer,
  preSelectedInvoice 
}: CreateCreditNoteModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(preSelectedCustomer?.id || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(preSelectedInvoice?.id || 'none');
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('All credits must be used within 90 days.');
  const [affectsInventory, setAffectsInventory] = useState(false);
  
  const [items, setItems] = useState<CreditNoteItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: companies, isLoading: loadingCompanies, error: companiesError } = useCompanies();
  const companyId = companies?.[0]?.id;
  
  const { data: customers, isLoading: loadingCustomers } = useCustomers(companyId);
  const { data: products, isLoading: loadingProducts } = useProducts(companyId);
  const { data: taxSettings } = useTaxSettings(companyId);
  const { data: invoiceResponse } = useInvoices(companyId);
  const invoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse?.data ?? [];
  const createCreditNoteWithItems = useCreateCreditNoteWithItems();
  const generateCreditNoteNumber = useGenerateCreditNoteNumber();

  // Get default tax rate
  const defaultTax = taxSettings?.find(tax => tax.is_default && tax.is_active);
  const defaultTaxRate = defaultTax?.rate || 16;

  // Filter invoices for selected customer
  const customerInvoices = invoices?.filter(inv => 
    inv.customer_id === selectedCustomerId && 
    inv.status !== 'cancelled' &&
    (inv.balance_due || 0) > 0
  ) || [];

  // Handle pre-selected data
  useEffect(() => {
    if (preSelectedCustomer && open) {
      setSelectedCustomerId(preSelectedCustomer.id);
    }
    if (preSelectedInvoice && open) {
      setSelectedInvoiceId(preSelectedInvoice.id);
      setSelectedCustomerId(preSelectedInvoice.customer_id);
    }
  }, [preSelectedCustomer, preSelectedInvoice, open]);

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchProduct.toLowerCase())
  ) || [];

  const addItem = (product: any) => {
    const existingItem = items.find(item => item.product_id === product.id);

    if (existingItem) {
      updateItemQuantity(existingItem.id, existingItem.quantity + 1);
      return;
    }

    const newItem: CreditNoteItem = {
      id: `temp-${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      description: product.description || product.name,
      quantity: 1,
      unit_price: product.selling_price,
      tax_percentage: 0,
      tax_amount: 0,
      tax_inclusive: false,
      line_total: product.selling_price
    };

    const { lineTotal, taxAmount } = calculateLineTotal(newItem);
    newItem.line_total = lineTotal;
    newItem.tax_amount = taxAmount;

    setItems([...items, newItem]);
    setSearchProduct('');
  };

  const addCustomItem = () => {
    const newItem: CreditNoteItem = {
      id: `custom-${Date.now()}`,
      product_id: undefined, // No product association
      product_name: 'Custom Item',
      description: 'Custom credit item',
      quantity: 1,
      unit_price: 0,
      tax_percentage: 0,
      tax_amount: 0,
      tax_inclusive: false,
      line_total: 0
    };

    setItems([...items, newItem]);
  };

  const calculateLineTotal = (item: CreditNoteItem, quantity?: number, unitPrice?: number, taxPercentage?: number, taxInclusive?: boolean) => {
    const qtyValue = quantity ?? item.quantity;
    const priceValue = unitPrice ?? item.unit_price;
    const taxValue = taxPercentage ?? item.tax_percentage;
    const inclusive = taxInclusive ?? item.tax_inclusive;

    const qty = qtyValue === '' ? 0 : Number(qtyValue);
    const price = priceValue === '' ? 0 : Number(priceValue);
    const tax = taxValue === '' ? 0 : Number(taxValue);

    const baseAmount = qty * price;
    let taxAmount = 0;
    let lineTotal = 0;

    if (tax === 0) {
      // No tax
      lineTotal = baseAmount;
      taxAmount = 0;
    } else if (inclusive) {
      // Tax-inclusive: tax is included in the price
      lineTotal = baseAmount;
      taxAmount = baseAmount * (tax / (100 + tax));
    } else {
      // Tax-exclusive: tax is added to the price
      taxAmount = baseAmount * (tax / 100);
      lineTotal = baseAmount + taxAmount;
    }

    return { lineTotal, taxAmount };
  };

  const updateItemQuantity = (itemId: string, quantity: number | '') => {
    const numQuantity = quantity === '' ? 0 : Number(quantity);
    if (numQuantity < 0) {
      removeItem(itemId);
      return;
    }

    setItems(items.map(item => {
      if (item.id === itemId) {
        const { lineTotal, taxAmount } = calculateLineTotal(item, numQuantity);
        return { ...item, quantity, line_total: lineTotal, tax_amount: taxAmount };
      }
      return item;
    }));
  };

  const updateItemPrice = (itemId: string, unitPrice: number | '') => {
    const numPrice = unitPrice === '' ? 0 : Number(unitPrice);
    setItems(items.map(item => {
      if (item.id === itemId) {
        const { lineTotal, taxAmount } = calculateLineTotal(item, undefined, numPrice);
        return { ...item, unit_price: unitPrice, line_total: lineTotal, tax_amount: taxAmount };
      }
      return item;
    }));
  };

  const updateItemTax = (itemId: string, taxPercentage: number | '') => {
    const numTax = taxPercentage === '' ? 0 : Number(taxPercentage);
    setItems(items.map(item => {
      if (item.id === itemId) {
        const { lineTotal, taxAmount } = calculateLineTotal(item, undefined, undefined, numTax);
        return { ...item, tax_percentage: taxPercentage, line_total: lineTotal, tax_amount: taxAmount };
      }
      return item;
    }));
  };

  const updateItemTaxInclusive = (itemId: string, taxInclusive: boolean) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        let newTaxPercentage = item.tax_percentage;
        if (taxInclusive && item.tax_percentage === 0) {
          newTaxPercentage = defaultTaxRate;
        }
        if (!taxInclusive) {
          newTaxPercentage = 0;
        }

        const { lineTotal, taxAmount } = calculateLineTotal(item, undefined, undefined, newTaxPercentage, taxInclusive);
        return { ...item, tax_inclusive: taxInclusive, tax_percentage: newTaxPercentage, line_total: lineTotal, tax_amount: taxAmount };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const subtotal = items.reduce((sum, item) => {
    const qty = item.quantity === '' ? 0 : Number(item.quantity);
    const price = item.unit_price === '' ? 0 : Number(item.unit_price);
    return sum + (qty * price);
  }, 0);
  const taxAmount = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

  const handleSubmit = async () => {
    // Enhanced validation
    if (!companyId) {
      toast.error('Company information not available. Please ensure you have a company set up.');
      return;
    }

    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the credit note');
      return;
    }

    // Validate items
    const invalidItems = items.filter(item =>
      !item.description.trim() ||
      item.quantity <= 0 ||
      item.unit_price < 0
    );

    if (invalidItems.length > 0) {
      toast.error('Please ensure all items have valid descriptions, quantities, and prices.');
      return;
    }

    // Validate total amount
    if (totalAmount <= 0) {
      toast.error('Credit note total amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate credit note number
      const creditNoteNumber = await generateCreditNoteNumber.mutateAsync(companyId);

      // Create credit note with items
      const creditNoteData = {
        company_id: companyId,
        customer_id: selectedCustomerId,
        invoice_id: selectedInvoiceId && selectedInvoiceId !== 'none' ? selectedInvoiceId : null,
        credit_note_number: creditNoteNumber,
        credit_note_date: creditNoteDate,
        status: 'draft' as const,
        reason: reason,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        applied_amount: 0,
        balance: totalAmount,
        affects_inventory: affectsInventory,
        notes: notes,
        terms_and_conditions: termsAndConditions,
        created_by: null // TODO: Get from auth context when implemented
      };

      const creditNoteItems = items.map((item, index) => ({
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_percentage: item.tax_percentage,
        tax_amount: item.tax_amount,
        tax_inclusive: item.tax_inclusive,
        tax_setting_id: item.tax_percentage > 0 ? defaultTax?.id || null : null,
        line_total: item.line_total,
        sort_order: index
      }));

      await createCreditNoteWithItems.mutateAsync({
        creditNote: creditNoteData,
        items: creditNoteItems
      });

      toast.success(`Credit note ${creditNoteNumber} created successfully!`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating credit note:', error);
      toast.error('Failed to create credit note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setSelectedInvoiceId('none');
    setCreditNoteDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setNotes('');
    setTermsAndConditions('All credits must be used within 90 days.');
    setAffectsInventory(false);
    setItems([]);
    setSearchProduct('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Create Credit Note</span>
          </DialogTitle>
          <DialogDescription>
            Create a credit note to refund or adjust customer accounts
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Credit Note Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Credit Note Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Selection */}
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCustomers ? (
                        <SelectItem value="loading" disabled>Loading customers...</SelectItem>
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

                {/* Invoice Selection (Optional) */}
                {selectedCustomerId && customerInvoices.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="invoice">Related Invoice (Optional)</Label>
                    <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an invoice (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific invoice</SelectItem>
                        {customerInvoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.invoice_number} - {formatCurrency(invoice.balance_due || 0)} due
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Date and Reason */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credit_note_date">Credit Note Date *</Label>
                    <Input
                      id="credit_note_date"
                      type="date"
                      value={creditNoteDate}
                      onChange={(e) => setCreditNoteDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason for credit note" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Product Return">Product Return</SelectItem>
                        <SelectItem value="Pricing Error">Pricing Error</SelectItem>
                        <SelectItem value="Billing Error">Billing Error</SelectItem>
                        <SelectItem value="Damaged Goods">Damaged Goods</SelectItem>
                        <SelectItem value="Customer Goodwill">Customer Goodwill</SelectItem>
                        <SelectItem value="Overpayment">Overpayment</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Inventory Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="affects_inventory"
                    checked={affectsInventory}
                    onCheckedChange={(checked) => setAffectsInventory(!!checked)}
                  />
                  <Label htmlFor="affects_inventory" className="text-sm">
                    Affects Inventory (returns items to stock)
                  </Label>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes for this credit note..."
                  />
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-2">
                  <Label htmlFor="terms">Terms and Conditions</Label>
                  <Textarea
                    id="terms"
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Product Selection */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Product Search */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search products by name or code..."
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomItem}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Custom Item
                    </Button>
                  </div>

                  {/* Product List */}
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
                            className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-smooth"
                            onClick={() => addItem(product)}
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

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Credit Note Items</span>
              <Badge variant="outline">{items.length} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items added yet. Search and select products to add them.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>VAT %</TableHead>
                    <TableHead>VAT Incl.</TableHead>
                    <TableHead>Line Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          {item.product_id ? (
                            <div>
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-sm text-muted-foreground">{item.description}</div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Input
                                value={item.product_name}
                                onChange={(e) => setItems(items.map(i =>
                                  i.id === item.id ? { ...i, product_name: e.target.value } : i
                                ))}
                                placeholder="Item name"
                                className="font-medium text-sm h-8"
                              />
                              <Input
                                value={item.description}
                                onChange={(e) => setItems(items.map(i =>
                                  i.id === item.id ? { ...i, description: e.target.value } : i
                                ))}
                                placeholder="Description"
                                className="text-sm h-8"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity ?? ''}
                          onChange={(e) => updateItemQuantity(item.id, e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                          className="w-28 h-10 text-sm px-2"
                          min="1"
                          placeholder="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unit_price ?? ''}
                          onChange={(e) => updateItemPrice(item.id, e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          className="w-36 h-10 text-sm px-2"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.tax_percentage ?? ''}
                          onChange={(e) => updateItemTax(item.id, e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          className="w-28 h-10 text-sm px-2"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          disabled={item.tax_inclusive}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={item.tax_inclusive}
                          onCheckedChange={(checked) => updateItemTaxInclusive(item.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(item.line_total)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
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

            {/* Totals */}
            {items.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span className="font-semibold">{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg border-t pt-2">
                      <span className="font-bold">Total Credit:</span>
                      <span className="font-bold text-success">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedCustomerId || items.length === 0 || !reason.trim()}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating...' : 'Create Credit Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
