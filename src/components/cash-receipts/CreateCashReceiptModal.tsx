import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FloatingItemPreview } from '@/components/ui/floating-item-preview';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2, Plus, Trash2, Search } from 'lucide-react';
import { useCustomers, useProducts, useTaxSettings } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { toCollection } from '@/utils/collection';

const PAYMENT_METHODS = [
  'Cash',
  'Cheque',
  'Bank Transfer',
  'Mobile Money',
  'Card',
  'Other'
];

interface CashReceiptItem {
  id: string;
  product_id?: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  line_total: number;
  unit_of_measure?: string;
}

interface CreateCashReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCashReceiptModal({ open, onOpenChange, onSuccess }: CreateCashReceiptModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [items, setItems] = useState<CashReceiptItem[]>([]);
  const [applyTax, setApplyTax] = useState(false);

  const { profile, loading: authLoading } = useAuth();
  const { currentCompany, isLoading: companyLoading } = useCurrentCompany();
  const { data: customersResponse, isLoading: loadingCustomers } = useCustomers(currentCompany?.id);
  const customers = toCollection(customersResponse);
  const { data: productsResponse, isLoading: loadingProducts } = useProducts(currentCompany?.id);
  const products = toCollection(productsResponse);
  const { data: taxSettings } = useTaxSettings(currentCompany?.id);

  // Get default tax rate
  const defaultTax = taxSettings?.find(tax => tax.is_default && tax.is_active);
  const defaultTaxRate = defaultTax?.rate || 16;

  // Recalculate all items when applyTax changes
  useEffect(() => {
    setItems(prevItems => prevItems.map(item => {
      const newTaxPercentage = applyTax ? defaultTaxRate : 0;
      const taxAmount = calculateTaxAmount(item.quantity, item.unit_price, newTaxPercentage, applyTax);
      const lineTotal = calculateLineTotal(item.quantity, item.unit_price, newTaxPercentage, applyTax);
      return { ...item, tax_percentage: newTaxPercentage, tax_amount: taxAmount, line_total: lineTotal };
    }));
  }, [applyTax, defaultTaxRate]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchProduct.toLowerCase())
  ) || [];

  const calculateLineTotal = (quantity: number, unitPrice: number, taxPercentage: number, includeTax: boolean) => {
    const baseAmount = quantity * unitPrice;
    if (!includeTax) return baseAmount;
    const taxAmount = baseAmount * (taxPercentage / 100);
    return baseAmount + taxAmount;
  };

  const calculateTaxAmount = (quantity: number, unitPrice: number, taxPercentage: number, includeTax: boolean) => {
    if (!includeTax) return 0;
    const baseAmount = quantity * unitPrice;
    return baseAmount * (taxPercentage / 100);
  };

  const addItem = (product: any) => {
    // Check if item already exists
    const existingItem = items.find(item => item.product_id === product.id);

    if (existingItem) {
      // Increment quantity
      updateItemQuantity(existingItem.id, existingItem.quantity + 1);
      setSearchProduct('');
      return;
    }

    const price = Number(product.selling_price || product.unit_price || 0);
    const taxPercentage = applyTax ? defaultTaxRate : 0;
    const newItem: CashReceiptItem = {
      id: `temp-${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      description: product.description || product.name,
      quantity: 1,
      unit_price: price,
      tax_percentage: taxPercentage,
      tax_amount: calculateTaxAmount(1, price, taxPercentage, applyTax),
      line_total: calculateLineTotal(1, price, taxPercentage, applyTax),
      unit_of_measure: product.unit_of_measure || 'pcs'
    };

    setItems([...items, newItem]);
    setSearchProduct('');
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(items.map(item => {
      if (item.id === itemId) {
        const taxAmount = calculateTaxAmount(quantity, item.unit_price, item.tax_percentage, applyTax);
        const lineTotal = calculateLineTotal(quantity, item.unit_price, item.tax_percentage, applyTax);
        return { ...item, quantity, tax_amount: taxAmount, line_total: lineTotal };
      }
      return item;
    }));
  };

  const updateItemPrice = (itemId: string, unitPrice: number) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const taxAmount = calculateTaxAmount(item.quantity, unitPrice, item.tax_percentage, applyTax);
        const lineTotal = calculateLineTotal(item.quantity, unitPrice, item.tax_percentage, applyTax);
        return { ...item, unit_price: unitPrice, tax_amount: taxAmount, line_total: lineTotal };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const totalAmount = subtotal + taxAmount;
    return { subtotal, taxAmount, totalAmount };
  };

  const { totalAmount, taxAmount } = calculateTotals();

  // Value tendered is entered, calculate change
  const [valueTendered, setValueTendered] = useState('');
  const change = valueTendered && totalAmount > 0
    ? Math.max(0, parseFloat(valueTendered) - totalAmount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (!valueTendered || parseFloat(valueTendered) <= 0) {
      toast.error('Please enter value tendered');
      return;
    }

    if (parseFloat(valueTendered) < totalAmount) {
      toast.error('Value tendered must be greater than or equal to total amount');
      return;
    }

    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    try {
      setIsSubmitting(true);

      if (!currentCompany?.id) {
        throw new Error('No company is associated with your account. Please contact your administrator.');
      }

      if (!profile?.id) {
        throw new Error('User information not loaded. Please refresh the page and try again.');
      }

      // Generate receipt number based on the count of existing receipts
      let receiptNumber: string;
      try {
        const { data: existingReceipts, error: countError } = await supabase
          .from('cash_receipts')
          .select('id', { count: 'exact' })
          .eq('company_id', currentCompany.id);

        if (!countError && existingReceipts) {
          const count = (existingReceipts.length || 0) + 1;
          receiptNumber = `RCP-${String(count).padStart(3, '0')}`;
        } else {
          receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;
        }
      } catch (err) {
        receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;
      }

      // Create the cash receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('cash_receipts')
        .insert({
          company_id: currentCompany.id,
          customer_id: selectedCustomerId,
          receipt_number: receiptNumber,
          receipt_date: receiptDate,
          total_amount: totalAmount,
          value_tendered: parseFloat(valueTendered),
          change: change,
          payment_method: paymentMethod,
          notes: notes || null,
          created_by: profile.id,
        })
        .select()
        .single();

      if (receiptError) {
        throw receiptError;
      }

      if (!receipt) {
        throw new Error('Failed to create receipt');
      }

      // Insert all items
      const itemsToInsert = items.map(item => ({
        cash_receipt_id: receipt.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_percentage: item.tax_percentage,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        unit_of_measure: item.unit_of_measure || 'pcs',
      }));

      const { error: itemsError } = await supabase
        .from('cash_receipt_items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw itemsError;
      }

      toast.success('Cash receipt created successfully!');
      onSuccess();
      onOpenChange(false);

      // Reset form
      setSelectedCustomerId('');
      setReceiptDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Cash');
      setNotes('');
      setItems([]);
      setValueTendered('');
      setSearchProduct('');
    } catch (err) {
      console.error('Error creating cash receipt:', err);
      let errorMessage = 'Failed to create cash receipt';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const errorObj = err as any;

        // Handle Supabase errors
        if (errorObj.message && typeof errorObj.message === 'string') {
          errorMessage = errorObj.message;
        } else if (errorObj.error_description && typeof errorObj.error_description === 'string') {
          errorMessage = errorObj.error_description;
        } else if (errorObj.error && typeof errorObj.error === 'string') {
          errorMessage = errorObj.error;
        } else if (errorObj.details && typeof errorObj.details === 'string') {
          errorMessage = errorObj.details;
        } else {
          // Last resort - try to stringify with circular reference handling
          try {
            const seen: any[] = [];
            errorMessage = JSON.stringify(err, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (seen.includes(value)) return '[Circular]';
                seen.push(value);
              }
              return value;
            }, 2).slice(0, 500); // Limit to 500 chars
          } catch {
            errorMessage = String(err).slice(0, 500);
          }
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Cash Receipt</DialogTitle>
          <DialogDescription>
            Record a cash payment receipt with items
          </DialogDescription>
        </DialogHeader>

        {companyLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
            Loading company information...
          </div>
        )}

        {!currentCompany && !companyLoading && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            Error: No company associated with your account. Please contact your administrator.
          </div>
        )}

        {!profile && !authLoading && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            Error: User information not loaded. Please refresh the page.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {loadingCustomers ? (
                    <SelectItem disabled value="loading">Loading customers...</SelectItem>
                  ) : customers && customers.length > 0 ? (
                    customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="no-customers">No customers found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptDate">Receipt Date *</Label>
              <Input
                id="receiptDate"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="searchProduct">Add Items</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="searchProduct"
                      placeholder="Search products..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {searchProduct && filteredProducts.length > 0 && (
                    <div className="absolute top-10 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addItem(product)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-600">
                            {product.selling_price ? `KES ${product.selling_price}` : 'No price'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="applyTax"
                  checked={applyTax}
                  onCheckedChange={(checked) => setApplyTax(checked as boolean)}
                />
                <Label htmlFor="applyTax" className="cursor-pointer font-normal">Apply Tax</Label>
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Description</TableHead>
                      <TableHead className="w-32">Qty</TableHead>
                      <TableHead className="w-40">Unit Price</TableHead>
                      <TableHead className="w-32">Tax %</TableHead>
                      <TableHead className="w-40">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                            min="0.01"
                            step="0.01"
                            className="w-28 h-10 text-sm px-2"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-36 h-10 text-sm px-2"
                          />
                        </TableCell>
                        <TableCell className="text-right">{item.tax_percentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-medium">{item.line_total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No items added yet. Search and select products to add.
              </div>
            )}
          </div>

          {/* Totals Section */}
          {items.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-end gap-32">
                <span>Subtotal:</span>
                <span className="w-28 text-right font-medium">{calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-32">
                <span>Tax:</span>
                <span className="w-28 text-right font-medium">{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-32 text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="w-28 text-right">{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Section */}
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valueTendered">Value Tendered *</Label>
                <Input
                  id="valueTendered"
                  type="number"
                  placeholder="0.00"
                  value={valueTendered}
                  onChange={(e) => setValueTendered(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            {items.length > 0 && (
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
                <div>
                  <div className="text-sm text-gray-600">Amount Due</div>
                  <div className="text-lg font-bold">{totalAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Change</div>
                  <div className="text-lg font-bold text-green-600">{change.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || authLoading || companyLoading || loadingCustomers || items.length === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Receipt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
