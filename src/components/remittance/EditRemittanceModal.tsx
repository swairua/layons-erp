import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Edit3, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateRemittanceAdvice, useUpdateRemittanceAdviceItems, useCustomers } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import type { RemittanceAdvice, RemittanceAdviceItem } from '@/types/remittance';
import { toCollection } from '@/utils/collection';

interface EditRemittanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remittance: RemittanceAdvice | null;
  onSuccess?: () => void;
}

interface RemittanceItem {
  id?: string;
  date: string;
  invoiceNumber: string;
  creditNote: string;
  invoiceAmount: number;
  creditAmount: number;
  payment: number;
}

export function EditRemittanceModal({ open, onOpenChange, remittance, onSuccess }: EditRemittanceModalProps) {
  const { profile } = useAuth();
  const { currentCompany } = useCurrentCompany();
  const updateRemittanceMutation = useUpdateRemittanceAdvice();
  const updateItemsMutation = useUpdateRemittanceAdviceItems();
  const { data: customersResponse } = useCustomers(currentCompany?.id);
  const customers = toCollection(customersResponse);

  const [formData, setFormData] = useState({
    adviceNumber: '',
    customerId: '',
    customerName: '',
    customerAddress: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'draft' as const,
  });

  const [items, setItems] = useState<RemittanceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when remittance changes
  useEffect(() => {
    if (remittance && open) {
      setFormData({
        adviceNumber: remittance.advice_number || '',
        customerId: remittance.customer_id || '',
        customerName: remittance.customers?.name || '',
        customerAddress: remittance.customers?.address || '',
        date: remittance.advice_date || new Date().toISOString().split('T')[0],
        notes: remittance.notes || '',
        status: remittance.status || 'draft',
      });

      // Convert remittance advice items to form items
      const formItems = remittance.remittance_advice_items?.map((item, index) => ({
        id: item.id,
        date: item.document_date,
        invoiceNumber: item.document_number,
        creditNote: '', // Map as needed
        invoiceAmount: item.invoice_amount || 0,
        creditAmount: item.credit_amount || 0,
        payment: item.payment_amount,
      })) || [{
        id: undefined,
        date: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        creditNote: '',
        invoiceAmount: 0,
        creditAmount: 0,
        payment: 0,
      }];

      setItems(formItems);
    }
  }, [remittance, open]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-populate customer data when customer is selected
    if (field === 'customerId') {
      const customer = customers.find(c => c.id === value);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customerId: value,
          customerName: customer.name,
          customerAddress: customer.address || ''
        }));
      }
    }
  };

  const addItem = () => {
    const newItem: RemittanceItem = {
      id: undefined,
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      creditNote: '',
      invoiceAmount: 0,
      creditAmount: 0,
      payment: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof RemittanceItem, value: string | number) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotalPayment = () => {
    return items.reduce((total, item) => total + (item.payment || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!remittance?.id || !currentCompany?.id || !profile?.id) {
      toast.error('Remittance, company, or user information not available');
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.customerName.trim()) {
        toast.error('Customer name is required');
        return;
      }

      if (items.some(item => !item.date || item.payment === 0)) {
        toast.error('All items must have a date and payment amount');
        return;
      }

      // Prepare remittance data for database
      const updateData = {
        id: remittance.id,
        customer_id: formData.customerId || remittance.customer_id,
        advice_number: formData.adviceNumber,
        advice_date: formData.date,
        total_payment: calculateTotalPayment(),
        status: formData.status,
        notes: formData.notes || null,
      };

      // Update the remittance advice
      await updateRemittanceMutation.mutateAsync(updateData);

      // Update remittance advice items
      if (items && items.length > 0) {
        const itemsToUpdate = items
          .filter(item => item.payment > 0) // Only save items with payment amounts
          .map((item, index) => ({
            id: item.id,
            document_date: item.date,
            document_number: item.invoiceNumber || item.creditNote || `Item ${index + 1}`,
            document_type: (item.invoiceNumber ? 'invoice' : item.creditNote ? 'credit_note' : 'payment') as 'invoice' | 'credit_note' | 'payment',
            invoice_amount: item.invoiceAmount || null,
            credit_amount: item.creditAmount || null,
            payment_amount: item.payment,
            sort_order: index + 1,
          }));

        await updateItemsMutation.mutateAsync({
          remittanceId: remittance.id,
          items: itemsToUpdate
        });
        console.log('Updated remittance advice items:', itemsToUpdate);
      }

      console.log('Updated remittance advice:', updateData);
      
      toast.success('Remittance advice updated successfully!');
      onSuccess?.();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Error updating remittance advice:', error);
      toast.error('Failed to update remittance advice: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!remittance) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <span>Edit Remittance Advice</span>
            <Badge className={getStatusColor(formData.status)}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Edit remittance advice {remittance.advice_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Remittance Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adviceNumber">Advice Number</Label>
                <Input
                  id="adviceNumber"
                  value={formData.adviceNumber}
                  onChange={(e) => handleInputChange('adviceNumber', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Select value={formData.customerId} onValueChange={(value) => handleInputChange('customerId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerAddress">Customer Address</Label>
                <Textarea
                  id="customerAddress"
                  value={formData.customerAddress}
                  onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Payment Items
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Credit Note</TableHead>
                    <TableHead>Invoice Amount</TableHead>
                    <TableHead>Credit Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateItem(index, 'date', e.target.value)}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.invoiceNumber}
                          onChange={(e) => updateItem(index, 'invoiceNumber', e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.creditNote}
                          onChange={(e) => updateItem(index, 'creditNote', e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.invoiceAmount}
                          onChange={(e) => updateItem(index, 'invoiceAmount', parseFloat(e.target.value) || 0)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.creditAmount}
                          onChange={(e) => updateItem(index, 'creditAmount', parseFloat(e.target.value) || 0)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.payment}
                          onChange={(e) => updateItem(index, 'payment', parseFloat(e.target.value) || 0)}
                          className="w-32"
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Total */}
              <div className="mt-4 flex justify-end">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-lg font-semibold">
                    Total Payment: ${calculateTotalPayment().toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Remittance Advice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
