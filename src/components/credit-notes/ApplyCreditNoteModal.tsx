import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign,
  Receipt,
  User,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useApplyCreditNoteToInvoice, type CreditNote } from '@/hooks/useCreditNotes';
import { useAuth } from '@/contexts/AuthContext';

interface ApplyCreditNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  creditNote?: CreditNote | null;
}

export function ApplyCreditNoteModal({ 
  open, 
  onOpenChange, 
  onSuccess, 
  creditNote 
}: ApplyCreditNoteModalProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amountToApply, setAmountToApply] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: invoiceResponse } = useInvoices(creditNote?.company_id);
  const invoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse?.data ?? [];
  const applyCreditNoteMutation = useApplyCreditNoteToInvoice();
  const { user } = useAuth();

  // Filter invoices for the same customer with outstanding balance
  const availableInvoices = invoices.filter(inv => 
    inv.customer_id === creditNote?.customer_id && 
    inv.status !== 'cancelled' &&
    (inv.balance_due || 0) > 0
  );

  const selectedInvoice = availableInvoices.find(inv => inv.id === selectedInvoiceId);

  // Reset form when modal opens/closes or credit note changes
  useEffect(() => {
    if (open && creditNote) {
      setSelectedInvoiceId('');
      setAmountToApply(creditNote.balance || 0);
    } else if (!open) {
      setSelectedInvoiceId('');
      setAmountToApply(0);
    }
  }, [open, creditNote]);

  // Update amount when invoice is selected
  useEffect(() => {
    if (selectedInvoice && creditNote) {
      const maxApplicableAmount = Math.min(
        creditNote.balance || 0,
        selectedInvoice.balance_due || 0
      );
      setAmountToApply(maxApplicableAmount);
    }
  }, [selectedInvoice, creditNote]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    const maxAmount = Math.min(
      creditNote?.balance || 0,
      selectedInvoice?.balance_due || 0
    );
    
    if (numValue <= maxAmount) {
      setAmountToApply(numValue);
    } else {
      toast.error(`Amount cannot exceed ${formatCurrency(maxAmount)}`);
    }
  };

  const handleSubmit = async () => {
    if (!creditNote || !selectedInvoiceId || !user) {
      toast.error('Missing required information');
      return;
    }

    if (amountToApply <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    if (amountToApply > (creditNote.balance || 0)) {
      toast.error('Amount exceeds available credit note balance');
      return;
    }

    if (amountToApply > (selectedInvoice?.balance_due || 0)) {
      toast.error('Amount exceeds invoice balance due');
      return;
    }

    setIsSubmitting(true);

    try {
      await applyCreditNoteMutation.mutateAsync({
        creditNoteId: creditNote.id,
        invoiceId: selectedInvoiceId,
        amount: amountToApply,
        appliedBy: user.id
      });

      onSuccess();
      onOpenChange(false);
      toast.success('Credit note applied successfully!');
    } catch (error) {
      console.error('Error applying credit note:', error);
      toast.error('Failed to apply credit note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!creditNote) {
    return null;
  }

  const maxApplicableAmount = selectedInvoice 
    ? Math.min(creditNote.balance || 0, selectedInvoice.balance_due || 0)
    : creditNote.balance || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <span>Apply Credit Note</span>
          </DialogTitle>
          <DialogDescription>
            Apply credit note {creditNote.credit_note_number} to an outstanding invoice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Credit Note Details */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Credit Note Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Credit Note Number</Label>
                  <p className="font-medium">{creditNote.credit_note_number}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Available Balance</Label>
                  <p className="font-medium text-success">{formatCurrency(creditNote.balance || 0)}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Customer</Label>
                <p className="font-medium">{creditNote.customers?.name || 'Unknown Customer'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="invoice-select">Select Invoice to Apply Credit To</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an invoice..." />
                </SelectTrigger>
                <SelectContent>
                  {availableInvoices.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground">
                      No outstanding invoices for this customer
                    </div>
                  ) : (
                    availableInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{invoice.invoice_number}</span>
                          <Badge variant="outline" className="ml-2">
                            {formatCurrency(invoice.balance_due || 0)} due
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedInvoice && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Invoice Total</Label>
                      <p className="font-medium">{formatCurrency(selectedInvoice.total_amount || 0)}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Balance Due</Label>
                      <p className="font-medium text-warning">{formatCurrency(selectedInvoice.balance_due || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Amount to Apply */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Apply</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={maxApplicableAmount}
              value={amountToApply}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              disabled={!selectedInvoiceId}
            />
            {selectedInvoiceId && (
              <p className="text-sm text-muted-foreground">
                Maximum: {formatCurrency(maxApplicableAmount)}
              </p>
            )}
          </div>

          {/* Warning if no invoices available */}
          {availableInvoices.length === 0 && (
            <div className="flex items-center space-x-2 p-3 bg-warning-light text-warning rounded-md">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">
                No outstanding invoices found for this customer. 
                Create an invoice first to apply this credit note.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={
              isSubmitting || 
              !selectedInvoiceId || 
              amountToApply <= 0 || 
              availableInvoices.length === 0
            }
            className="gradient-primary text-primary-foreground"
          >
            {isSubmitting ? 'Applying...' : `Apply ${formatCurrency(amountToApply)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
