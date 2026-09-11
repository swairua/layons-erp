import { useState } from 'react';
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
import { Plus, Minus, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateRemittanceAdvice, useCustomers, useGenerateDocumentNumber } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import type { RemittanceAdviceItemFormData } from '@/types/remittance';
import { toCollection } from '@/utils/collection';

interface CreateRemittanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface RemittanceItem {
  id: string;
  date: string;
  invoiceNumber: string;
  creditNote: string;
  invoiceAmount: number;
  creditAmount: number;
  payment: number;
}

export function CreateRemittanceModal({ open, onOpenChange, onSuccess }: CreateRemittanceModalProps) {
  const { profile } = useAuth();
  const { currentCompany } = useCurrentCompany();
  const createRemittanceMutation = useCreateRemittanceAdvice();
  const { data: customersResponse } = useCustomers(currentCompany?.id);
  const customers = toCollection(customersResponse);
  const generateNumberMutation = useGenerateDocumentNumber();

  const [formData, setFormData] = useState({
    adviceNumber: '',
    customerId: '',
    customerName: '',
    customerAddress: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<RemittanceItem[]>([{
    id: '1',
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    creditNote: '',
    invoiceAmount: 0,
    creditAmount: 0,
    payment: 0,
  }]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate advice number when modal opens
  const generateAdviceNumber = async () => {
    if (!currentCompany?.id) return;
    
    try {
      const number = await generateNumberMutation.mutateAsync({
        documentType: 'remittance',
        companyId: currentCompany.id
      });
      setFormData(prev => ({ ...prev, adviceNumber: number }));
    } catch (error) {
      console.error('Error generating advice number:', error);
      // Fallback to simple number generation
      const fallbackNumber = `RA-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      setFormData(prev => ({ ...prev, adviceNumber: fallbackNumber }));
    }
  };

  // Generate number when modal opens and company is available
  useState(() => {
    if (open && currentCompany?.id && !formData.adviceNumber) {
      generateAdviceNumber();
    }
  });

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
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      creditNote: '',
      invoiceAmount: 0,
      creditAmount: 0,
      payment: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof RemittanceItem, value: string | number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotalPayment = () => {
    return items.reduce((total, item) => total + (item.payment || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCompany?.id || !profile?.id) {
      toast.error('Company or user information not available');
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.customerName.trim()) {
        toast.error('Customer name is required');
        return;
      }

      if (!formData.customerId && !formData.customerName) {
        toast.error('Please select a customer');
        return;
      }

      if (items.some(item => !item.date || item.payment === 0)) {
        toast.error('All items must have a date and payment amount');
        return;
      }

      // Prepare remittance data for database
      const remittanceData = {
        company_id: currentCompany.id,
        customer_id: formData.customerId || null, // Can be null if customer is not in system
        advice_number: formData.adviceNumber,
        advice_date: formData.date,
        total_payment: calculateTotalPayment(),
        status: 'draft' as const,
        notes: formData.notes || null,
        created_by: profile.id,
      };

      // Create the remittance advice
      const createdRemittance = await createRemittanceMutation.mutateAsync(remittanceData);
      
      // TODO: Create remittance advice items
      // Note: This would require a separate hook for creating items
      // For now, we're creating the main record
      
      console.log('Created remittance advice:', createdRemittance);
      console.log('Items to be created:', items);
      
      toast.success('Remittance advice created successfully!');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        adviceNumber: '',
        customerId: '',
        customerName: '',
        customerAddress: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setItems([{
        id: '1',
        date: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        creditNote: '',
        invoiceAmount: 0,
        creditAmount: 0,
        payment: 0,
      }]);
      
    } catch (error: any) {
      console.error('Error creating remittance advice:', error);
      toast.error('Failed to create remittance advice: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Create Remittance Advice</span>
          </DialogTitle>
          <DialogDescription>
            Create a new remittance advice document for customer payments
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
                  placeholder="Auto-generated"
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
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="Customer name"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerAddress">Customer Address</Label>
                <Textarea
                  id="customerAddress"
                  value={formData.customerAddress}
                  onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                  placeholder="Customer address"
                  rows={2}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Additional notes or comments"
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
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.invoiceNumber}
                          onChange={(e) => updateItem(item.id, 'invoiceNumber', e.target.value)}
                          placeholder="INV-001"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.creditNote}
                          onChange={(e) => updateItem(item.id, 'creditNote', e.target.value)}
                          placeholder="CN-001"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.invoiceAmount}
                          onChange={(e) => updateItem(item.id, 'invoiceAmount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.creditAmount}
                          onChange={(e) => updateItem(item.id, 'creditAmount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.payment}
                          onChange={(e) => updateItem(item.id, 'payment', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-32"
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
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
              {isSubmitting ? 'Creating...' : 'Create Remittance Advice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
