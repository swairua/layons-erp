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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Trash2, 
  Search,
  ShoppingCart,
  Package,
  Edit
} from 'lucide-react';
import { useUpdateLPOWithItems, useAllSuppliersAndCustomers, useProducts, useCompanies } from '@/hooks/useDatabase';
import { toast } from '@/utils/safeToast';
import { validateLPOEdit } from '@/utils/lpoValidation';

function formatErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error?.message && typeof error.message === 'string') return error.message;
  return 'An unexpected error occurred';
}

interface LPOItem {
  id: string;
  product_id: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  unit_of_measure: string;
}

interface EditLPOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lpo: any | null;
  onSuccess?: () => void;
}

export const EditLPOModal = ({ 
  open, 
  onOpenChange, 
  lpo,
  onSuccess
}: EditLPOModalProps) => {
  const [formData, setFormData] = useState({
    supplier_id: '',
    lpo_date: '',
    delivery_date: '',
    delivery_address: '',
    contact_person: '',
    contact_phone: '',
    notes: '',
    terms_and_conditions: '',
    status: 'draft',
  });

  const [items, setItems] = useState<LPOItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { data: supplierData } = useAllSuppliersAndCustomers(currentCompany?.id);
  const suppliers = supplierData?.all || [];
  const { data: products } = useProducts(currentCompany?.id);
  const updateLPOWithItems = useUpdateLPOWithItems();

  useEffect(() => {
    if (lpo && open) {
      setFormData({
        supplier_id: lpo.supplier_id || '',
        lpo_date: lpo.lpo_date || '',
        delivery_date: lpo.delivery_date || '',
        delivery_address: lpo.delivery_address || '',
        contact_person: lpo.contact_person || '',
        contact_phone: lpo.contact_phone || '',
        notes: lpo.notes || '',
        terms_and_conditions: lpo.terms_and_conditions || '',
        status: lpo.status || 'draft',
      });

      if (lpo.lpo_items) {
        const lpoItems: LPOItem[] = lpo.lpo_items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown Product',
          description: item.description || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
          unit_of_measure: item.products?.unit_of_measure || 'pcs',
        }));
        setItems(lpoItems);
      }
    }
  }, [lpo, open]);

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (product: any) => {
    const newItem: LPOItem = {
      id: `new-item-${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      description: product.description || '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 16, // Default VAT rate
      tax_amount: 0,
      line_total: 0,
      unit_of_measure: product.unit_of_measure || 'pcs',
    };

    setItems(prev => [...prev, newItem]);
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const updateItem = (id: string, field: keyof LPOItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate totals when quantity, unit_price, or tax_rate changes
        if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
          const subtotal = updatedItem.quantity * updatedItem.unit_price;
          updatedItem.tax_amount = (subtotal * updatedItem.tax_rate) / 100;
          updatedItem.line_total = subtotal + updatedItem.tax_amount;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
  const totalAmount = subtotal + totalTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lpo?.id) {
      toast.error('LPO ID is missing');
      return;
    }

    // Validate LPO data
    const validationResult = validateLPOEdit({
      supplier_id: formData.supplier_id,
      lpo_date: formData.lpo_date,
      status: formData.status,
      items: items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description: item.description,
      }))
    });

    if (!validationResult.isValid) {
      validationResult.errors.forEach(error => toast.error(formatErrorMessage(error)));
      return;
    }

    setIsSubmitting(true);
    try {
      const lpoUpdates = {
        supplier_id: formData.supplier_id,
        lpo_date: formData.lpo_date,
        delivery_date: formData.delivery_date || null,
        status: formData.status,
        subtotal,
        tax_amount: totalTax,
        total_amount: totalAmount,
        delivery_address: formData.delivery_address,
        contact_person: formData.contact_person,
        contact_phone: formData.contact_phone,
        notes: formData.notes,
        terms_and_conditions: formData.terms_and_conditions,
      };

      // Update LPO with items using the new comprehensive hook
      await updateLPOWithItems.mutateAsync({
        lpoId: lpo.id,
        lpoUpdates,
        items: items.map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
        }))
      });

      toast.success('Purchase Order updated successfully!');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating LPO:', error);
      toast.error('Failed to update LPO. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!lpo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Purchase Order - {lpo.lpo_number}
          </DialogTitle>
          <DialogDescription>
            Update purchase order information and items
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lpo_number">LPO Number</Label>
              <Input
                id="lpo_number"
                value={lpo.lpo_number}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier *</Label>
              <Select 
                value={formData.supplier_id} 
                onValueChange={(value) => handleInputChange('supplier_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lpo_date">LPO Date</Label>
              <Input
                id="lpo_date"
                type="date"
                value={formData.lpo_date}
                onChange={(e) => handleInputChange('lpo_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Expected Delivery Date</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => handleInputChange('delivery_date', e.target.value)}
              />
            </div>
          </div>

          {lpo.currency && lpo.currency !== (currentCompany?.currency || 'KES') && lpo.exchange_rate && lpo.exchange_rate > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                1 {lpo.currency} = {lpo.exchange_rate?.toFixed(4)} {currentCompany?.currency || 'KES'}
                <span className="text-xs ml-1">(rate locked at creation)</span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                placeholder="Contact person at supplier"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                placeholder="+254 700 000000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_address">Delivery Address</Label>
            <Textarea
              id="delivery_address"
              value={formData.delivery_address}
              onChange={(e) => handleInputChange('delivery_address', e.target.value)}
              placeholder="Delivery address..."
              rows={3}
            />
          </div>

          {/* Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items to Purchase
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
                                {product.product_code} • Stock: {product.stock_quantity}
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
                  No items in this purchase order.
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-40">Qty</TableHead>
                        <TableHead className="w-48">Unit Price</TableHead>
                        <TableHead className="w-32">Tax %</TableHead>
                        <TableHead className="w-40">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product_name}
                            <div className="text-xs text-muted-foreground">{item.unit_of_measure}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Description"
                              className="min-w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-28 h-10 text-sm px-2"
                              placeholder="1"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-36 h-10 text-sm px-2"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.tax_rate}
                              onChange={(e) => updateItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.01"
                              className="w-28 h-10 text-sm px-2"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            KES {item.line_total.toFixed(2)}
                          </TableCell>
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

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>KES {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>KES {totalTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>KES {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
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
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
              <Textarea
                id="terms_and_conditions"
                value={formData.terms_and_conditions}
                onChange={(e) => handleInputChange('terms_and_conditions', e.target.value)}
                placeholder="Terms and conditions..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.supplier_id || items.length === 0}>
              {isSubmitting ? 'Updating...' : 'Update Purchase Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
