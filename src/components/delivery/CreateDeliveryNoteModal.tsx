import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { 
  Plus, 
  Trash2, 
  Search,
  Truck,
  Package
} from 'lucide-react';
import { useCustomers, useProducts, useCompanies } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useCreateDeliveryNote } from '@/hooks/useQuotationItems';
import { mapDeliveryNoteForDatabase } from '@/utils/deliveryNoteMapper';
import { validateDeliveryNoteData } from '@/utils/deliveryNoteValidation';
import { toast } from 'sonner';

interface DeliveryItem {
  id: string;
  product_id: string;
  product_name: string;
  description: string;
  quantity_ordered: number;
  quantity_delivered: number;
  unit_of_measure: string;
}

interface CreateDeliveryNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  invoiceId?: string; // Optional - for creating from invoice
}

export const CreateDeliveryNoteModal = ({
  open,
  onOpenChange,
  onSuccess,
  invoiceId
}: CreateDeliveryNoteModalProps) => {
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_id: invoiceId || '',
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_address: '',
    delivery_method: 'pickup',
    tracking_number: '',
    carrier: '',
    notes: '',
    delivered_by: '',
    received_by: '',
  });

  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');

  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const companyId = currentCompany?.id;

  const { data: customers } = useCustomers(companyId);
  const { data: products } = useProducts(companyId);
  const { data: invoiceResponse } = useInvoices(companyId);
  const invoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse?.data ?? [];
  const createDeliveryNote = useCreateDeliveryNote();

  useEffect(() => {
    if (open) {
      setDeliveryNoteNumber(`DN-${Date.now()}`);
    }
  }, [open]);

  // Keep form invoice_id in sync with prop when opening or changing
  useEffect(() => {
    if (open && invoiceId && formData.invoice_id !== invoiceId) {
      setFormData(prev => ({ ...prev, invoice_id: invoiceId }));
    }
  }, [open, invoiceId]);

  // When invoice is selected, populate customer and items
  useEffect(() => {
    if (formData.invoice_id && invoices) {
      const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id);
      if (selectedInvoice) {
        setFormData(prev => ({
          ...prev,
          customer_id: selectedInvoice.customer_id || '',
          delivery_address: selectedInvoice.customers?.address || ''
        }));

        if (selectedInvoice.invoice_items && selectedInvoice.invoice_items.length > 0) {
          const deliveryItems: DeliveryItem[] = selectedInvoice.invoice_items.map((item: any) => ({
            id: `item-${item.id}`,
            product_id: item.product_id || '',
            product_name: item.products?.name || item.description || 'Unknown Product',
            description: item.description || item.products?.name || '',
            quantity_ordered: Math.max(Number(item.quantity) || 1, 1),
            quantity_delivered: Math.max(Number(item.quantity) || 1, 1),
            unit_of_measure: item.products?.unit_of_measure || 'pcs',
          }));

          setItems(deliveryItems);
          toast.success(`Loaded ${deliveryItems.length} items from invoice ${selectedInvoice.invoice_number}`);
        } else {
          setItems([]);
          toast.info('Selected invoice has no items');
        }
      }
    } else if (!formData.invoice_id) {
      setItems([]);
      setFormData(prev => ({
        ...prev,
        customer_id: '',
        delivery_address: ''
      }));
    }
  }, [formData.invoice_id, invoices]);

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (product: any) => {
    const newItem: DeliveryItem = {
      id: `item-${Date.now()}`,
      product_id: product.id,
      product_name: product.name,
      description: product.description || product.name || '',
      quantity_ordered: 1, // Default to 1 unit
      quantity_delivered: 1, // Default to 1 unit for delivery
      unit_of_measure: product.unit_of_measure || 'pcs',
    };

    setItems(prev => [...prev, newItem]);
    setShowProductSearch(false);
    setSearchTerm('');
    toast.success(`Added ${product.name} to delivery note`);
  };

  const updateItem = (id: string, field: keyof DeliveryItem, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      toast.error('Company not found. Please refresh and try again.');
      return;
    }

    // Check invoice selection first with detailed error
    if (!formData.invoice_id) {
      toast.error('Invoice Required', {
        description: 'Please select an invoice. Delivery notes must be linked to an existing invoice.',
        duration: 5000
      });
      return;
    }

    // Verify selected invoice still exists
    const selectedInvoice = invoices?.find(inv => inv.id === formData.invoice_id);
    if (!selectedInvoice) {
      toast.error('Invoice Not Found', {
        description: 'The selected invoice may have been deleted. Please select a different invoice.',
        duration: 5000
      });
      return;
    }

    if (!formData.customer_id) {
      toast.error('Customer Required', {
        description: 'Please select a customer for this delivery',
        duration: 4000
      });
      return;
    }

    if (items.length === 0) {
      toast.error('Items Required', {
        description: 'Please add at least one item to deliver',
        duration: 4000
      });
      return;
    }

    // Pre-validation check for quantities
    const invalidItems = items.filter(item =>
      !item.quantity_delivered || item.quantity_delivered <= 0
    );

    if (invalidItems.length > 0) {
      toast.error('Invalid Quantities', {
        description: 'All items must have a delivery quantity greater than 0',
        duration: 4000
      });
      return;
    }

    try {
      const deliveryNoteData = mapDeliveryNoteForDatabase({
        company_id: companyId,
        customer_id: formData.customer_id,
        invoice_id: formData.invoice_id || null,
        delivery_note_number: deliveryNoteNumber,
        delivery_date: formData.delivery_date,
        delivery_address: formData.delivery_address,
        delivery_method: formData.delivery_method,
        tracking_number: formData.tracking_number,
        carrier: formData.carrier,
        status: 'draft',
        notes: formData.notes,
        delivered_by: formData.delivered_by,
        received_by: formData.received_by,
      });

      // Validate delivery note data
      const validation = validateDeliveryNoteData(deliveryNoteData, items);
      if (!validation.isValid) {
        console.error('Delivery note validation failed:', validation.errors);
        toast.error(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => toast.info(warning));
      }

      await createDeliveryNote.mutateAsync({
        deliveryNote: deliveryNoteData,
        items: items.map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity_ordered: Math.max(item.quantity_ordered, 0.01),
          quantity_delivered: Math.max(item.quantity_delivered, 0.01),
          quantity: Math.max(item.quantity_delivered, 0.01), // For compatibility
          unit_price: 0 // Delivery notes don't include pricing
        }))
      });

      toast.success('Delivery note created successfully!');
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error('Error creating delivery note:', error);
      const message = typeof error?.message === 'string' ? error.message : 'Failed to create delivery note';

      // Handle specific error cases
      if (message.includes('not found')) {
        toast.error('Data Mismatch Error', {
          description: message + '. The invoice or customer may have been deleted. Please refresh and try again.',
          duration: 6000
        });
      } else if (message.includes('customer must match')) {
        toast.error('Customer Mismatch', {
          description: 'The delivery note customer does not match the invoice customer. Please select the correct customer.',
          duration: 6000
        });
      } else if (message.includes('exceed')) {
        toast.error('Quantity Error', {
          description: message,
          duration: 5000
        });
      } else {
        toast.error('Failed to Create Delivery Note', {
          description: message,
          duration: 5000
        });
      }
    }
  };

  const handleClose = () => {
    // Reset form to initial state
    setFormData({
      customer_id: '',
      invoice_id: invoiceId || '', // Preserve invoice if passed as prop
      delivery_date: new Date().toISOString().split('T')[0],
      delivery_address: '',
      delivery_method: 'pickup',
      tracking_number: '',
      carrier: '',
      notes: '',
      delivered_by: '',
      received_by: '',
    });
    setItems([]);
    setSearchTerm('');
    setShowProductSearch(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Create Delivery Note
          </DialogTitle>
          <DialogDescription>
            Create a new delivery note to track shipments
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_note_number">Delivery Note Number</Label>
              <Input
                id="delivery_note_number"
                value={deliveryNoteNumber}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select 
                value={formData.customer_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}
                disabled={!!formData.invoice_id} // Disable if created from invoice
              >
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
              <Label htmlFor="invoice_id">Related Invoice * <span className="text-destructive">(Required)</span></Label>
              <Select value={formData.invoice_id} onValueChange={(value) => {
                setFormData(prev => ({ ...prev, invoice_id: value }));
                if (value) {
                  const selectedInv = invoices?.find(inv => inv.id === value);
                  if (selectedInv) {
                    toast.success(`Selected invoice ${selectedInv.invoice_number} - loading items...`);
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={invoices && invoices.length > 0 ? "Select invoice to load items" : "No invoices available"} />
                </SelectTrigger>
                <SelectContent>
                  {(!invoices || invoices.length === 0) ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No invoices available. Create an invoice first.
                    </div>
                  ) : (
                    invoices.filter(inv => !formData.customer_id || inv.customer_id === formData.customer_id)
                      .map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {new Intl.NumberFormat('en-KE', { style: 'currency', currency: invoice.currency || 'KES' }).format(invoice.total_amount?.toFixed(2) || 0)}
                        {invoice.invoice_items && invoice.invoice_items.length > 0 ?
                          ` (${invoice.invoice_items.length} items)` :
                          ' (no items)'
                        }
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {formData.invoice_id && (
                <p className="text-xs text-success">✅ Invoice selected - items auto-populated from invoice</p>
              )}
              {!formData.invoice_id && (
                <p className="text-xs text-muted-foreground">Select an invoice to automatically load its items</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Delivery Date</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_method">Delivery Method</Label>
              <Select value={formData.delivery_method} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, delivery_method: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Customer Pickup</SelectItem>
                  <SelectItem value="delivery">Home Delivery</SelectItem>
                  <SelectItem value="courier">Courier Service</SelectItem>
                  <SelectItem value="freight">Freight Shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_address">Delivery Address</Label>
              <Textarea
                id="delivery_address"
                value={formData.delivery_address}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                placeholder="Full delivery address..."
                rows={3}
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  value={formData.carrier}
                  onChange={(e) => setFormData(prev => ({ ...prev, carrier: e.target.value }))}
                  placeholder="Shipping carrier name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking_number">Tracking Number</Label>
                <Input
                  id="tracking_number"
                  value={formData.tracking_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, tracking_number: e.target.value }))}
                  placeholder="Tracking number"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items to Deliver
                </CardTitle>
                {!formData.invoice_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProductSearch(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                )}
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
                  {formData.invoice_id
                    ? (
                        <div className="space-y-2">
                          <p>No items found in selected invoice.</p>
                          <p className="text-xs">The invoice may not have any items or they failed to load.</p>
                        </div>
                      )
                    : (
                        <div className="space-y-2">
                          <p>📋 Select an invoice above to automatically load items for delivery.</p>
                          <p className="text-xs">Items from the selected invoice will appear here automatically.</p>
                        </div>
                      )
                  }
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Unit</TableHead>
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
                          <Input
                            type="number"
                            value={item.quantity_ordered}
                            onChange={(e) => {
                              const value = Math.max(parseFloat(e.target.value) || 1, 0.01); // Minimum 0.01
                              updateItem(item.id, 'quantity_ordered', value);
                            }}
                            min="0.01"
                            step="0.01"
                            className="w-20"
                            disabled={!!formData.invoice_id} // Disable if from invoice
                            placeholder="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity_delivered}
                            onChange={(e) => {
                              const value = Math.max(parseFloat(e.target.value) || 1, 0.01); // Minimum 0.01
                              updateItem(item.id, 'quantity_delivered', value);
                            }}
                            min="0.01"
                            max={item.quantity_ordered}
                            step="0.01"
                            className="w-20"
                            placeholder="1"
                          />
                        </TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell>
                          {!formData.invoice_id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivered_by">Delivered By</Label>
              <Input
                id="delivered_by"
                value={formData.delivered_by}
                onChange={(e) => setFormData(prev => ({ ...prev, delivered_by: e.target.value }))}
                placeholder="Driver/Delivery person name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="received_by">Received By</Label>
              <Input
                id="received_by"
                value={formData.received_by}
                onChange={(e) => setFormData(prev => ({ ...prev, received_by: e.target.value }))}
                placeholder="Recipient name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Delivery notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!companyId || !formData.invoice_id || !formData.customer_id || items.length === 0}>
              Create Delivery Note
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
